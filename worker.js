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
      /* archiv=1 sucht zusätzlich die Sitemap ab – dort stehen auch Beiträge,
         die längst aus dem Feed gefallen sind. */
      return json(await feed(adr.url, anfrage.searchParams.get("archiv") === "1"));
    }

    const ziel = anfrage.searchParams.get("url");
    if (!ziel) return json({ status: "Der Rezept-Leser läuft.", routen: ["/?url=…", "/angebote?tage=14", "/feed?url=…&archiv=1"] });

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
async function feed(adresse, mitArchiv) {
  const roh = adresse.toString().replace(/\/$/, "");
  /* Viele Blogs geben unter der Startseite HTML zurück und den Feed erst unter /feed */
  const kandidaten = [adresse.toString(), roh + "/feed", roh + "/feed/", roh + "/rss", roh + "/atom.xml"];
  let letzterFehler = "", ausFeed = [], quelle = "";
  for (const k of kandidaten) {
    try {
      const res = await fetch(k, { headers: { ...UA, Accept: "application/rss+xml, application/atom+xml, application/xml;q=0.9, */*;q=0.8" }, cf: { cacheTtl: 1800 } });
      if (!res.ok) { letzterFehler = "Fehler " + res.status; continue; }
      const xml = (await res.text()).slice(0, MAX_ZEICHEN);
      const eintraege = feedZerlegen(xml);
      if (eintraege.length) { ausFeed = eintraege.slice(0, 40).map(e => ({ ...e, art: "neu" })); quelle = k; break; }
      /* HTML statt Feed: den verlinkten Feed suchen und einmal nachfassen */
      const verweis = xml.match(/<link[^>]+type="application\/(?:rss|atom)\+xml"[^>]*href="([^"]+)"/i);
      if (verweis && !kandidaten.includes(verweis[1])) kandidaten.push(new URL(verweis[1], k).toString());
    } catch (e) { letzterFehler = "nicht erreichbar"; }
  }

  let ausArchiv = [];
  if (mitArchiv) {
    try { ausArchiv = await archiv(adresse); } catch (e) { ausArchiv = []; }
  }
  /* Was schon im Feed steht, muss nicht zweimal kommen */
  const bekannt = new Set(ausFeed.map(e => norm(e.link)));
  ausArchiv = ausArchiv.filter(e => !bekannt.has(norm(e.link)));

  const alle = ausFeed.concat(ausArchiv);
  if (!alle.length) {
    return { eintraege: [], fehler: "Unter dieser Adresse war weder ein Rezept-Feed noch eine lesbare Sitemap zu finden" + (letzterFehler ? " (" + letzterFehler + ")" : "") + "." };
  }
  return { eintraege: alle, quelle: quelle || adresse.toString(), neu: ausFeed.length, archiv: ausArchiv.length };
}
const norm = u => String(u || "").replace(/[?#].*$/, "").replace(/\/$/, "").toLowerCase();

/* ---------- Archiv über die Sitemap ----------
   Der Feed einer Seite reicht meist zwei bis drei Monate zurück. Alles davor ist
   für den Leser unsichtbar, obwohl es genau das ist, was man noch nicht kennt.
   Sitemaps führen dagegen jeden Beitrag – deshalb der zweite Weg. */
const SITEMAP_STD = ["/sitemap.xml", "/sitemap_index.xml", "/wp-sitemap.xml", "/sitemap-index.xml", "/post-sitemap.xml"];
const MAX_SITEMAPS = 4;        /* Obergrenze, damit ein Aufruf nicht ausufert */
const MAX_ARCHIV = 400;

async function archiv(adresse) {
  const basis = adresse.origin || (adresse.protocol + "//" + adresse.host);
  const gesehen = new Set();
  let offen = [];

  /* robots.txt nennt die Sitemap oft selbst und spart das Raten */
  try {
    const res = await fetch(basis + "/robots.txt", { headers: UA, cf: { cacheTtl: 86400 } });
    if (res.ok) {
      const txt = (await res.text()).slice(0, 20000);
      for (const m of txt.matchAll(/^\s*sitemap:\s*(\S+)/gim)) offen.push(m[1]);
    }
  } catch (e) { /* ohne robots.txt wird geraten */ }
  if (!offen.length) offen = SITEMAP_STD.map(p => basis + p);

  const eintraege = [];
  let geholt = 0;
  while (offen.length && geholt < MAX_SITEMAPS && eintraege.length < MAX_ARCHIV) {
    const url = offen.shift();
    if (!url || gesehen.has(url)) continue;
    gesehen.add(url);
    let xml;
    try {
      const res = await fetch(url, { headers: UA, cf: { cacheTtl: 86400 } });
      if (!res.ok) continue;
      geholt++;
      xml = (await res.text()).slice(0, MAX_ZEICHEN);
    } catch (e) { continue; }

    if (/<sitemapindex/i.test(xml)) {
      /* Ein Index verweist auf Unterkarten. Die mit Beiträgen zuerst –
         Seiten-, Kategorie- und Bilderkarten tragen keine Rezepte. */
      const kinder = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map(m => m[1]);
      const wichtig = kinder.filter(k => /post|beitrag|rezept|recipe|article/i.test(k));
      const rest = kinder.filter(k => !wichtig.includes(k) && !/image|bild|page|seite|category|kategorie|tag|author/i.test(k));
      offen = wichtig.concat(rest, offen);
      continue;
    }
    for (const block of xml.matchAll(/<url>([\s\S]*?)<\/url>/gi)) {
      const loc = (block[1].match(/<loc>\s*([^<\s]+)\s*<\/loc>/i) || [])[1];
      if (!loc || !rezeptVerdacht(loc)) continue;
      const mod = (block[1].match(/<lastmod>\s*([^<\s]+)\s*<\/lastmod>/i) || [])[1];
      const zeit = mod ? Date.parse(mod) : NaN;
      eintraege.push({
        titel: titelAusAdresse(loc), link: loc,
        datum: Number.isNaN(zeit) ? 0 : zeit, text: "", art: "archiv"
      });
      if (eintraege.length >= MAX_ARCHIV) break;
    }
  }
  return eintraege;
}

/* Was in einer Sitemap steht, ist längst nicht alles ein Rezept. Diese Liste
   wirft heraus, was sicher keins ist – lieber ein Beitrag zu viel als eine
   Sammlung voller Impressumsseiten. */
const KEIN_REZEPT = /\/(impressum|datenschutz|kontakt|agb|widerruf|ueber-?mich|about|autor|author|team|shop|produkt|product|warenkorb|cart|kasse|checkout|kurs|coaching|ebook|buch|newsletter|gewinnspiel|podcast|video|kategorie|category|tag|schlagwort|thema|archiv|seite|page|suche|search|login|konto|merkliste|faq|presse|werbung|kooperation|jobs)(\/|$|-)/i;
const LISTENSEITE = /\/(rezepte|recipes|blog|artikel)\/?$/i;
function rezeptVerdacht(url) {
  let pfad;
  try { pfad = new URL(url).pathname; } catch { return false; }
  if (pfad === "/" || pfad === "") return false;
  if (KEIN_REZEPT.test(pfad)) return false;
  if (LISTENSEITE.test(pfad)) return false;
  const teile = pfad.replace(/^\/|\/$/g, "").split("/");
  const letztes = teile[teile.length - 1] || "";
  if (letztes.length < 6) return false;                 /* zu kurz für einen Rezeptnamen */
  if (/^\d+$/.test(letztes)) return false;              /* reine Seitenzahlen */
  /* Rezept-Slugs bestehen meist aus mehreren Wörtern. Ein einzelnes darf durch,
     wenn es lang genug ist – „schokokuchen" ist ein Rezept, „blog" nicht. */
  if (!/-/.test(letztes) && letztes.length < 10) return false;
  return true;
}
/* „kichererbsen-curry-mit-spinat" wird zu „Kichererbsen Curry mit Spinat".
   Ohne Titel wäre die Karte im Archiv nicht zu lesen. */
function titelAusAdresse(url) {
  let pfad;
  try { pfad = new URL(url).pathname; } catch { return url; }
  const teile = pfad.replace(/^\/|\/$/g, "").split("/");
  let slug = teile[teile.length - 1] || "";
  slug = slug.replace(/\.(html?|php)$/i, "").replace(/^\d{4}-\d{2}-\d{2}-/, "");
  const worte = slug.split("-").filter(Boolean)
    .filter(w => !/^\d+$/.test(w) || w.length === 4);   /* Nummern raus, Jahreszahlen dürfen bleiben */
  if (!worte.length) return url;
  const KLEIN = new Set(["mit", "und", "im", "in", "aus", "auf", "der", "die", "das", "vom", "von", "zum", "zur", "fuer", "für", "ohne", "am", "an"]);
  return worte.map((w, i) => (i > 0 && KLEIN.has(w.toLowerCase())) ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
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
