/* Handy-Tauglichkeit und Verpackung: statische Prüfungen am Quelltext sowie
   die Aufnahme aus dem Teilen-Menü. Ersetzt keinen Blick aufs Gerät, fängt
   aber alles ab, was sich am Text erkennen lässt. */
load("tests/harness.js");

const appQuelle = read("index.html");
const kopf = appQuelle.slice(0, appQuelle.indexOf("</style>"));

gruppe("Seitenkopf");
t("Viewport erlaubt den ganzen Bildschirm samt Aussparungen", () => {
  const m = appQuelle.match(/<meta[^>]+name="viewport"[^>]*>/i);
  wahr(m, "kein Viewport gesetzt");
  wahr(/width=device-width/.test(m[0]), "width=device-width fehlt");
  wahr(/viewport-fit=cover/.test(m[0]), "viewport-fit=cover fehlt");
});
t("Die App bleibt aus Suchmaschinen heraus", () => {
  wahr(/name="robots"[^>]*noindex/i.test(appQuelle), "robots-noindex fehlt");
});
t("Sprache ist auf Deutsch gestellt", () => {
  wahr(/<html[^>]+lang="de"/i.test(appQuelle), "lang=de fehlt");
});
t("Es werden keine Schriften oder Skripte von fremden Servern geladen", () => {
  const verweise = (kopf.match(/<(?:link|script)[^>]+(?:href|src)="https?:\/\/[^"]+"/gi) || []);
  gleich(verweise, [], "im Supermarkt gibt es kein Netz");
});

gruppe("Bedienung mit dem Daumen");
t("Eingabefelder sind mindestens 16px groß, sonst zoomt iOS", () => {
  const regeln = kopf.match(/(?:input|textarea|select)[^{}]*\{[^}]*\}/g) || [];
  const zuKlein = regeln.filter(r => { const m = r.match(/font-size:\s*(\d+(?:\.\d+)?)px/); return m && +m[1] < 16; });
  gleich(zuKlein, []);
});
t("Die Navigationsleiste berücksichtigt die Systemleiste unten", () => {
  wahr(/safe-area-inset-bottom/.test(kopf), "env(safe-area-inset-bottom) fehlt");
});
t("Antippflächen der Navigation sind groß genug", () => {
  const m = kopf.match(/--nav-h:\s*(\d+)px/);
  wahr(m && +m[1] >= 44, "Navigationshöhe " + (m ? m[1] : "?") + "px");
});
t("Keine festen Breiten, die auf schmalen Geräten überstehen", () => {
  const breiten = (kopf.match(/[^-]width:\s*(\d{3,})px/g) || [])
    .map(s => +s.match(/(\d+)px/)[1]).filter(x => x > 330);
  gleich(breiten, []);
});
t("Dunkler Modus ist vorgesehen", () => {
  wahr(/prefers-color-scheme:\s*dark/.test(kopf), "kein dunkler Modus");
});
t("Wer Bewegung nicht mag, bekommt keine", () => {
  wahr(/prefers-reduced-motion/.test(kopf), "prefers-reduced-motion fehlt");
});
t("Farben stehen in Variablen, nicht fest im Markup", () => {
  const koerper = appQuelle.slice(appQuelle.indexOf("</style>"));
  const fest = (koerper.match(/style="[^"]*(?:color|background):\s*#[0-9a-f]{3,8}/gi) || []);
  gleich(fest.slice(0, 5), []);
});

gruppe("Installierbarkeit");
const manifest = JSON.parse(read("manifest.json"));
t("Das Manifest ist vollständig", () => {
  ["name", "short_name", "start_url", "display", "icons"].forEach(f => wahr(manifest[f], f + " fehlt"));
  gleich(manifest.display, "standalone");
  gleich(manifest.lang, "de");
});
t("Alle im Manifest genannten Symbole liegen auch im Ordner", () => {
  const fehlend = manifest.icons.map(i => i.src.replace(/^\.\//, "")).filter(d => {
    try { read(d); return false; } catch (e) { return true; }
  });
  gleich(fehlend, []);
});
t("Es gibt ein maskierbares Symbol für Android", () => {
  wahr(manifest.icons.some(i => String(i.purpose || "").includes("maskable")), "kein maskable-Icon");
});
t("Das Teilen-Ziel ist eingerichtet", () => {
  wahr(manifest.share_target, "kein share_target");
  gleich(manifest.share_target.params, { title: "title", text: "text", url: "url" });
});
t("Der Service Worker fängt fremde Server nicht ab", () => {
  const sw = read("sw.js");
  wahr(/origin\s*!==\s*location\.origin/.test(sw), "Firebase-Aufrufe müssen unberührt durchlaufen");
});
t("Der Service Worker speichert keine Fehlerantworten", () => {
  const sw = read("sw.js");
  wahr(/res\.ok/.test(sw), "ohne Prüfung landet auch eine Fehlerseite im Zwischenspeicher");
});

gruppe("Aufnahme aus dem Teilen-Menü");
function mitSuche(such) {
  A.S = A.leer(); A.cfg = { db: "", hid: "", leser: "" };
  location.search = such;
  document.getElementById("sheet").innerHTML = "";
  return A.shareAufnehmen();
}
t("Eine geteilte Adresse öffnet das Formular vorbefüllt", () => {
  wahr(mitSuche("?title=Ofengem%C3%BCse&url=https%3A%2F%2Fblog.de%2Fofen"), "wurde aufgenommen");
  const s = document.getElementById("sheet").innerHTML;
  wahr(/Ofengem/.test(s), "Titel steht im Formular");
  wahr(/blog\.de/.test(s), "Adresse steht im Formular");
});
t("Steckt die Adresse im Text, wird sie herausgelöst", () => {
  wahr(mitSuche("?text=Schau%20mal%20https%3A%2F%2Fblog.de%2Fdal"), "wurde aufgenommen");
  wahr(/blog\.de\/dal/.test(document.getElementById("sheet").innerHTML), "Adresse gefunden");
});
t("Ohne geteilte Daten passiert nichts", () => {
  gleich(mitSuche(""), false);
  gleich(document.getElementById("sheet").innerHTML, "");
});
t("Ein geteilter Titel mit Anführungszeichen bricht das Formular nicht auf", () => {
  mitSuche('?title=' + encodeURIComponent('Salat "extra" & <b>fein</b>'));
  const s = document.getElementById("sheet").innerHTML;
  wahr(!/<b>fein<\/b>/.test(s), "kein eingeschleustes Markup");
  wahr(/value="[^"]*Salat/.test(s) || /Salat/.test(s), "Titel kommt an");
});

bilanz();
