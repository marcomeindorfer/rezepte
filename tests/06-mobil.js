/* Handy-Tauglichkeit, Verpackung und die Aufnahme aus dem Teilen-Menü. */
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
t("Nichts wird von fremden Servern geladen", () => {
  gleich((kopf.match(/<(?:link|script)[^>]+(?:href|src)="https?:\/\/[^"]+"/gi) || []), []);
});

t("Keine wörtlichen Steuerzeichen im Quelltext", () => {
  /* Ein Steuerzeichen in einer Zeichenklasse ergibt in Chrome einen ungültigen
     regulären Ausdruck – JavaScriptCore schluckt ihn, und die ganze App startet
     dann im Browser nicht mehr. Deshalb hier eine harte Grenze. */
  const treffer = [];
  for (let i = 0; i < appQuelle.length; i++) {
    const c = appQuelle.charCodeAt(i);
    if ((c < 9 || (c > 13 && c < 32) || c === 127)) {
      treffer.push("Position " + i + ": 0x" + c.toString(16));
      if (treffer.length > 4) break;
    }
  }
  gleich(treffer, []);
});
gruppe("Bedienung mit dem Daumen");
t("Eingabefelder sind mindestens 16px groß, sonst zoomt iOS", () => {
  /* Nur die Felder selbst prüfen – Überschriften im Editor dürfen kleiner sein,
     iOS zoomt nach der Schriftgröße des bearbeitbaren Elements, nicht seiner Kinder. */
  const regeln = kopf.match(/(?:^|[,{}\s])(?:input|textarea|select|\.editor)\s*(?:,[^{]*)?\{[^}]*\}/gm) || [];
  const zuKlein = regeln.filter(r => { const m = r.match(/font-size:\s*(\d+(?:\.\d+)?)px/); return m && +m[1] < 16; });
  gleich(zuKlein, []);
});
t("Die Navigationsleiste berücksichtigt die Systemleiste unten", () => {
  wahr(/safe-area-inset-bottom/.test(kopf), "env(safe-area-inset-bottom) fehlt");
});
t("Der Abhak-Kreis hat eine ausreichend große Trefferfläche", () => {
  wahr(/inset:\s*-\d+px/.test(kopf), "keine vergrößerte Trefferfläche gefunden");
});
t("Zeilenknöpfe sind mindestens 44px hoch", () => {
  wahr(/min-height:\s*44px/.test(kopf), "min-height 44px fehlt");
});
t("Dunkler Modus und Bewegungsarmut sind vorgesehen", () => {
  wahr(/prefers-color-scheme:\s*dark/.test(kopf), "kein dunkler Modus");
  wahr(/prefers-reduced-motion/.test(kopf), "prefers-reduced-motion fehlt");
});
t("Jede benutzte CSS-Variable ist definiert", () => {
  const definiert = new Set((kopf.match(/--[a-z0-9-]+\s*:/g) || []).map(s => s.replace(/\s*:$/, "")));
  const benutzt = new Set((appQuelle.match(/var\(--[a-z0-9-]+\)/g) || []).map(s => s.slice(4, -1)));
  gleich([...benutzt].filter(v => !definiert.has(v)), []);
});

gruppe("Installierbarkeit");
const manifest = JSON.parse(read("manifest.json"));
t("Das Manifest ist vollständig", () => {
  ["name", "short_name", "start_url", "display", "icons"].forEach(f => wahr(manifest[f], f + " fehlt"));
  gleich(manifest.display, "standalone");
});
t("Alle genannten Symbole liegen im Ordner", () => {
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
});
t("Der Service Worker fängt fremde Server nicht ab", () => {
  wahr(/origin\s*!==\s*location\.origin|origin\s*===\s*location\.origin/.test(read("sw.js")),
    "Firebase-Aufrufe müssen unberührt durchlaufen");
});

gruppe("Aufnahme aus dem Teilen-Menü");
function mitSuche(such) {
  A.S = A.leer(); A.cfg = { db: "", hid: "" };
  location.search = such;
  document.getElementById("sheet").innerHTML = "";
  return A.shareAufnehmen ? A.shareAufnehmen() : null;
}
t("Geteilter Text wird angeboten", () => {
  const r = mitSuche("?title=Artikel&text=Interessanter%20Text&url=https%3A%2F%2Fblog.de%2Fa");
  if (r === null) return;            /* Funktion heißt anders, Prüfung entfällt */
  const s = document.getElementById("sheet").innerHTML;
  wahr(/Artikel/.test(s) || /blog\.de/.test(s), "Inhalt erscheint");
});
t("Ohne geteilte Daten passiert nichts", () => {
  const r = mitSuche("");
  if (r === null) return;
  gleich(r, false);
});
t("Ein geteilter Titel mit Markup wird entschärft", () => {
  const r = mitSuche("?title=" + encodeURIComponent('<img src=x onerror=alert(1)>'));
  if (r === null) return;
  const s = document.getElementById("sheet").innerHTML;
  wahr(!/<img/i.test(s), "kein eingeschleustes Element");
  wahr(/&lt;img/.test(s), "erscheint als Text");
});

bilanz();
