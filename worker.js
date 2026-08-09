/* Rezept-Leser für den Küchenplan.
   Läuft als Cloudflare Worker und holt eine Rezeptseite, weil der Browser
   fremde Seiten nicht direkt abrufen darf. Liest das schema.org-Rezept aus,
   das fast alle Rezeptblogs mitliefern, und gibt es als JSON zurück.

   Aufruf:  https://dein-worker.workers.dev/?url=https://beispiel.de/rezept
*/

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Content-Type": "application/json; charset=utf-8"
};

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });

    const ziel = new URL(request.url).searchParams.get("url");
    if (!ziel) return json({ fehler: "Kein url-Parameter angegeben." }, 400);

    let adresse;
    try { adresse = new URL(ziel); } catch { return json({ fehler: "Das ist keine gültige Adresse." }, 400); }
    if (!/^https?:$/.test(adresse.protocol)) return json({ fehler: "Nur http und https sind erlaubt." }, 400);

    let html;
    try {
      const res = await fetch(adresse.toString(), {
        headers: {
          "User-Agent": "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36",
          "Accept-Language": "de-DE,de;q=0.9,en;q=0.8"
        },
        cf: { cacheTtl: 900 }
      });
      if (!res.ok) return json({ fehler: "Die Seite antwortet mit Fehler " + res.status + "." }, 502);
      html = await res.text();
    } catch (e) {
      return json({ fehler: "Die Seite war nicht erreichbar." }, 502);
    }

    if (/(?:^|\.)(youtube\.com|youtu\.be)$/.test(adresse.hostname)) return json(video(html, adresse));

    const rezept = ausSchema(html);
    if (rezept) return json(rezept);
    return json(notbehelf(html, adresse));
  }
};

const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: CORS });

/* ---------- schema.org/Recipe aus den eingebetteten Daten lesen ---------- */
function ausSchema(html) {
  const bloecke = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)];
  for (const b of bloecke) {
    let daten;
    try { daten = JSON.parse(b[1].trim().replace(/^\uFEFF/, "")); } catch { continue; }
    const treffer = suchen(daten);
    if (treffer) return aufbereiten(treffer);
  }
  return null;
}
function suchen(k) {
  if (!k || typeof k !== "object") return null;
  if (Array.isArray(k)) { for (const e of k) { const t = suchen(e); if (t) return t; } return null; }
  const typ = [].concat(k["@type"] || []).map(String);
  if (typ.includes("Recipe")) return k;
  if (k["@graph"]) return suchen(k["@graph"]);
  return null;
}
function aufbereiten(r) {
  const zutaten = [].concat(r.recipeIngredient || r.ingredients || [])
    .map(t => saeubern(String(t))).filter(Boolean);
  const schritte = flachSchritte(r.recipeInstructions)
    .map(t => saeubern(t)).filter(t => t && t.length > 3);
  return {
    quelle: "schema",
    name: saeubern(String(r.name || "")),
    zutaten,
    schritte,
    minuten: dauer(r.totalTime) || (dauer(r.cookTime) + dauer(r.prepTime)) || 0,
    portionen: portionen(r.recipeYield),
    hinweis: zutaten.length ? "" : "Die Seite liefert ein Rezept, aber keine Zutatenliste."
  };
}
function flachSchritte(x) {
  if (!x) return [];
  if (typeof x === "string") return x.split(/\n|<br\s*\/?>/i);
  if (Array.isArray(x)) return x.flatMap(flachSchritte);
  if (x.itemListElement) return flachSchritte(x.itemListElement);
  if (x.text) return [x.text];
  if (x.name) return [x.name];
  return [];
}
function dauer(iso) {
  if (!iso || typeof iso !== "string") return 0;
  const m = iso.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/);
  if (!m) return 0;
  return (+m[1] || 0) * 1440 + (+m[2] || 0) * 60 + (+m[3] || 0);
}
function portionen(y) {
  if (y == null) return 0;
  const t = Array.isArray(y) ? y.join(" ") : String(y);
  const m = t.match(/\d+/);
  return m ? +m[0] : 0;
}
const ENTITY = {
  auml:"ä", ouml:"ö", uuml:"ü", Auml:"Ä", Ouml:"Ö", Uuml:"Ü", szlig:"ß",
  eacute:"é", egrave:"è", agrave:"à", ccedil:"ç", nbsp:" ", amp:"&",
  quot:'"', apos:"'", lt:"<", gt:">", ndash:"–", mdash:"—", hellip:"…",
  laquo:"«", raquo:"»", bdquo:"„", ldquo:"“", rdquo:"”", sbquo:"‚",
  lsquo:"‘", rsquo:"’", deg:"°", frac12:"½", frac14:"¼", frac34:"¾", middot:"·", euro:"€"
};
function saeubern(t) {
  return t.replace(/<[^>]+>/g, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&([a-z]+\d*);/gi, (m, n) => ENTITY[n] !== undefined ? ENTITY[n] : m)
    .replace(/\s+/g, " ").trim();
}

/* ---------- YouTube: Titel und Beschreibung, mehr gibt die Seite nicht her ---------- */
function video(html, adresse) {
  const titel = (html.match(/<meta\s+name="title"\s+content="([^"]*)"/i) || [])[1] || "";
  let text = "";
  const m = html.match(/"shortDescription":"((?:[^"\\]|\\.)*)"/);
  if (m) { try { text = JSON.parse('"' + m[1] + '"'); } catch { text = m[1]; } }
  const zeilen = text.split("\n").map(z => z.trim()).filter(Boolean);
  const zutaten = zeilen.filter(z => /^[-–•*]?\s*\d/.test(z) && z.length < 80);
  return {
    quelle: "video",
    name: saeubern(titel),
    zutaten,
    schritte: [],
    minuten: 0,
    portionen: 0,
    rohtext: text.slice(0, 4000),
    hinweis: zutaten.length
      ? "Aus der Videobeschreibung gelesen – bitte gegenprüfen."
      : "Das Video nennt keine Zutaten in der Beschreibung. Der Rohtext steht unten, falls dort etwas brauchbar ist."
  };
}

/* ---------- Seite ohne strukturierte Daten ---------- */
function notbehelf(html, adresse) {
  const titel = saeubern(((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || adresse.hostname));
  return {
    quelle: "titel",
    name: titel.split(/\s[|–-]\s/)[0].trim(),
    zutaten: [], schritte: [], minuten: 0, portionen: 0,
    hinweis: "Diese Seite liefert keine strukturierten Rezeptdaten. Name und Link sind übernommen, Zutaten musst du einfügen – am schnellsten über „Rezepttext einfügen“."
  };
}
