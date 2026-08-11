/* Rezept-Leser für den Küchenplan.
   Läuft als Cloudflare Worker, weil der Browser fremde Seiten nicht direkt
   abrufen darf. Drei Routen, die die App benutzt:

     /                     Statusmeldung
     /?url=…               Rezept auslesen (schema.org, sonst YouTube, sonst Titel)
     /angebote?tage=14     Aldi-Süd-Angebote der nächsten Tage
     /feed?url=…           RSS oder Atom eines Blogs

   Alle Antworten sind JSON mit CORS-Kopf, auch die Fehlerfälle – die App soll
   nie auf eine Ausnahme laufen, sondern immer einen lesbaren Grund bekommen.
*/

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Content-Type": "application/json; charset=utf-8"
};
const UA = {
  "User-Agent": "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36",
  "Accept-Language": "de-DE,de;q=0.9,en;q=0.8"
};
const MAX_ZEICHEN = 3_000_000;   /* Ein Prospekt-Portal kann riesig sein; irgendwo ist Schluss */

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });

    const anfrage = new URL(request.url);
    const pfad = anfrage.pathname.replace(/\/+$/, "") || "/";

    if (pfad === "/angebote") {
      return json(await angebote(+anfrage.searchParams.get("tage") || 14));
    }
    if (pfad === "/feed") {
      const q = anfrage.searchParams.get("url");
      if (!q) return json({ fehler: "Kein url-Parameter angegeben." }, 400);
      const adr = adressePruefen(q);
      if (adr.fehler) return json({ fehler: adr.fehler }, 400);
      return json(await feed(adr.url));
    }

    const ziel = anfrage.searchParams.get("url");
    if (!ziel) return json({ status: "Der Rezept-Leser läuft.", routen: ["/?url=…", "/angebote?tage=14", "/feed?url=…"] });

    const geprueft = adressePruefen(ziel);
    if (geprueft.fehler) return json({ fehler: geprueft.fehler }, 400);
    const adresse = geprueft.url;

    let html;
    try {
      const res = await fetch(adresse.toString(), { headers: UA, cf: { cacheTtl: 900 } });
      if (!res.ok) return json({ fehler: "Die Seite antwortet mit Fehler " + res.status + "." }, 502);
      html = (await res.text()).slice(0, MAX_ZEICHEN);
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

/* Der Worker holt Adressen, die von außen kommen. Damit er nicht als offener
   Zugang ins interne Netz taugt, sind nur öffentliche http(s)-Ziele erlaubt. */
const PRIVAT = /^(localhost$|127\.|0\.0\.0\.0$|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?$|.*\.local$|.*\.internal$)/i;
function adressePruefen(roh) {
  let url;
  try { url = new URL(String(roh)); } catch { return { fehler: "Das ist keine gültige Adresse." }; }
  if (!/^https?:$/.test(url.protocol)) return { fehler: "Nur http und https sind erlaubt." };
  if (PRIVAT.test(url.hostname)) return { fehler: "Diese Adresse führt nicht ins offene Netz." };
  return { url };
}

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

/* ---------- Aldi-Süd-Angebote ----------
   Die Angebotsseiten sind datumsbasiert. Produktnamen stecken in Links der Form
   /produkt/<name>-<artikelnummer>. Nicht Essbares stört nicht: es passt später
   auf keine Zutat. Antwortformat: { items:[…], bis:"JJJJ-MM-TT" } */
const isoDatum = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
function nameAusSlug(s) {
  return s.replace(/-/g, " ").replace(/\s+/g, " ").trim()
    .replace(/^\w/, c => c.toUpperCase());
}
function produkteAusHtml(html) {
  const raus = new Set();
  for (const m of String(html).matchAll(/\/produkt\/([a-z0-9äöüß-]{3,80}?)-\d{5,}/gi)) {
    const n = nameAusSlug(m[1]);
    if (n.length >= 3) raus.add(n);
  }
  return [...raus];
}
async function angebote(tage) {
  const spanne = Math.min(21, Math.max(1, tage || 14));
  const heute = new Date();
  const tagesListe = [];
  for (let i = 0; i < spanne; i++) tagesListe.push(isoDatum(new Date(heute.getTime() + i * 86400000)));

  const gefunden = new Set();
  let erreicht = 0, bis = "";
  /* In Häppchen abfragen: ein Worker darf nur begrenzt viele Unteranfragen stellen */
  for (let i = 0; i < tagesListe.length; i += 5) {
    const teil = tagesListe.slice(i, i + 5);
    await Promise.all(teil.map(async datum => {
      try {
        const res = await fetch("https://www.aldi-sued.de/de/angebote/" + datum + ".html", { headers: UA, cf: { cacheTtl: 3600 } });
        if (!res.ok) return;
        const html = (await res.text()).slice(0, MAX_ZEICHEN);
        const p = produkteAusHtml(html);
        if (!p.length) return;
        p.forEach(x => gefunden.add(x));
        erreicht++;
        if (datum > bis) bis = datum;
      } catch (e) { /* einzelner Tag darf ausfallen */ }
    }));
  }
  if (!gefunden.size) {
    return { items: [], bis: "",
      hinweis: erreicht
        ? "Die Angebotsseiten waren erreichbar, nannten aber keine Produkte. Trag die Angebote von Hand ein oder lies das Prospekt-PDF ein – das ist ohnehin verlässlicher."
        : "Die Angebotsseiten von Aldi Süd waren nicht erreichbar. Das Prospekt-PDF einzulesen ist der verlässlichere Weg." };
  }
  return { items: [...gefunden].sort(), bis, quelle: "aldi-sued.de" };
}

/* ---------- RSS und Atom ----------
   Antwortformat: { eintraege:[{titel,link,datum,text}] } */
function feedZerlegen(xml) {
  const text = String(xml);
  const stueck = (block, ...namen) => {
    for (const n of namen) {
      const m = block.match(new RegExp("<" + n + "[^>]*>([\\s\\S]*?)</" + n + ">", "i"));
      if (m) return saeubern(m[1].replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, "$1"));
    }
    return "";
  };
  const bloecke = [...text.matchAll(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi)].map(m => m[0]);
  return bloecke.map(b => {
    let link = stueck(b, "link");
    if (!link) {                                   /* Atom trägt den Link im Attribut */
      const m = b.match(/<link[^>]*href="([^"]+)"[^>]*\/?>/i);
      if (m) link = m[1];
    }
    const datumText = stueck(b, "pubDate", "published", "updated", "dc:date");
    const zeit = datumText ? Date.parse(datumText) : NaN;
    return {
      titel: stueck(b, "title") || "Ohne Titel",
      link,
      datum: Number.isNaN(zeit) ? 0 : zeit,
      text: stueck(b, "description", "summary").slice(0, 400)
    };
  }).filter(e => e.link);
}
async function feed(adresse) {
  const roh = adresse.toString().replace(/\/$/, "");
  /* Viele Blogs geben unter der Startseite HTML zurück und den Feed erst unter /feed */
  const kandidaten = [adresse.toString(), roh + "/feed", roh + "/feed/", roh + "/rss", roh + "/atom.xml"];
  let letzterFehler = "";
  for (const k of kandidaten) {
    try {
      const res = await fetch(k, { headers: { ...UA, Accept: "application/rss+xml, application/atom+xml, application/xml;q=0.9, */*;q=0.8" }, cf: { cacheTtl: 1800 } });
      if (!res.ok) { letzterFehler = "Fehler " + res.status; continue; }
      const xml = (await res.text()).slice(0, MAX_ZEICHEN);
      const eintraege = feedZerlegen(xml);
      if (eintraege.length) return { eintraege: eintraege.slice(0, 30), quelle: k };
      /* HTML statt Feed: den verlinkten Feed suchen und einmal nachfassen */
      const verweis = xml.match(/<link[^>]+type="application\/(?:rss|atom)\+xml"[^>]*href="([^"]+)"/i);
      if (verweis && !kandidaten.includes(verweis[1])) kandidaten.push(new URL(verweis[1], k).toString());
    } catch (e) { letzterFehler = "nicht erreichbar"; }
  }
  return { eintraege: [], fehler: "Unter dieser Adresse war kein Rezept-Feed zu finden" + (letzterFehler ? " (" + letzterFehler + ")" : "") + "." };
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
