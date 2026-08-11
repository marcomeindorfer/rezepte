/* Der Cloudflare-Worker („Rezept-Leser"). Geprüft werden die auswertenden
   Funktionen – ohne Netz, mit echten Beispielantworten. */

/* ---------- kleine Umgebung für den Worker ---------- */
function Response(koerper, opt) { this.body = koerper; this.status = (opt && opt.status) || 200; this.ok = this.status < 300; }
function URL(u, basis) {
  let s = String(u);
  if (basis && !/^[a-z]+:\/\//i.test(s)) s = String(basis).replace(/\/[^/]*$/, "/") + s.replace(/^\//, "");
  const m = s.match(/^([a-z]+:)\/\/([^/?#]*)([^?#]*)(\?[^#]*)?(#.*)?$/i);
  if (!m) throw new Error("ungültige Adresse");
  this.href = s; this.protocol = m[1]; this.host = m[2]; this.hostname = m[2].split(":")[0];
  this.pathname = m[3] || "/"; this.search = m[4] || ""; this.hash = m[5] || "";
  this.searchParams = { get: k => { const f = (this.search || "").replace(/^\?/, "").split("&").map(p => p.split("=")).find(p => p[0] === k); return f ? decodeURIComponent(f[1] || "") : null; } };
  this.toString = () => s;
}
function fetch() { return Promise.reject(new Error("kein Netz im Test")); }

var quellText = read("worker.js").replace(/export default/, "globalThis.WORKER =");
var namen = ["adressePruefen", "dauer", "portionen", "saeubern", "ausSchema", "suchen", "aufbereiten",
  "flachSchritte", "video", "notbehelf", "produkteAusHtml", "nameAusSlug", "feedZerlegen", "isoDatum", "PRIVAT"];
(0, eval)(quellText + ";globalThis.W={" + namen.map(n => `get ${n}(){return ${n}}`).join(",") + "};");

/* ---------- Testframework ---------- */
var ok = 0, fehler = [];
function t(name, fn) {
  try { fn(); ok++; print("  ok   " + name); }
  catch (e) { fehler.push(name); print("  FEHL " + name + "\n       " + (e && e.message)); }
}
function gleich(a, b, was) {
  var x = JSON.stringify(a), y = JSON.stringify(b);
  if (x !== y) throw new Error((was ? was + ": " : "") + "erwartet " + y + ", bekommen " + x);
}
function wahr(b, was) { if (!b) throw new Error(was || "sollte wahr sein"); }
function gruppe(x) { print("\n== " + x + " =="); }

gruppe("Adressen");
t("Gültige Adressen werden durchgelassen", () => {
  wahr(!W.adressePruefen("https://beispiel.de/rezept").fehler);
  wahr(!W.adressePruefen("http://beispiel.de/rezept").fehler);
});
t("Unsinn und fremde Protokolle werden abgewiesen", () => {
  wahr(W.adressePruefen("nicht mal eine adresse").fehler, "kein Unsinn");
  wahr(W.adressePruefen("file:///etc/passwd").fehler, "kein file");
  wahr(W.adressePruefen("ftp://beispiel.de").fehler, "kein ftp");
});
t("Der Worker taugt nicht als Zugang ins interne Netz", () => {
  ["http://localhost/x", "http://127.0.0.1/x", "http://192.168.1.1/x", "http://10.0.0.5/x",
    "http://169.254.169.254/latest/meta-data", "http://172.16.0.1/x", "http://router.local/x"]
    .forEach(u => wahr(W.adressePruefen(u).fehler, u + " sollte abgewiesen werden"));
});

gruppe("Rezeptdaten auswerten");
t("Zeitangaben nach ISO 8601", () => {
  gleich(W.dauer("PT30M"), 30);
  gleich(W.dauer("PT1H30M"), 90);
  gleich(W.dauer("PT2H"), 120);
  gleich(W.dauer("P1DT2H"), 1560);
  gleich(W.dauer("Unsinn"), 0);
  gleich(W.dauer(null), 0);
});
t("Portionsangaben", () => {
  gleich(W.portionen("4 Portionen"), 4);
  gleich(W.portionen(["6"]), 6);
  gleich(W.portionen(2), 2);
  gleich(W.portionen(null), 0);
  gleich(W.portionen("Portionen"), 0);
});
t("Umlaute und Entities kommen sauber an", () => {
  gleich(W.saeubern("M&ouml;hren mit So&szlig;e"), "Möhren mit Soße");
  gleich(W.saeubern("K&#228;se &amp; Brot"), "Käse & Brot");
  gleich(W.saeubern("Zwiebel &#x2013; fein"), "Zwiebel – fein");
  gleich(W.saeubern("<b>Salz</b>  und   Pfeffer"), "Salz und Pfeffer");
  gleich(W.saeubern("&frac12; TL Zimt"), "½ TL Zimt");
});
t("Unbekannte Entities bleiben stehen statt zu verschwinden", () => {
  gleich(W.saeubern("A &gibtsnicht; B"), "A &gibtsnicht; B");
});
t("Zubereitungsschritte in allen Formen", () => {
  gleich(W.flachSchritte("Erst dies\nDann das"), ["Erst dies", "Dann das"]);
  gleich(W.flachSchritte([{ "@type": "HowToStep", text: "Schnippeln" }, { "@type": "HowToStep", text: "Kochen" }]), ["Schnippeln", "Kochen"]);
  gleich(W.flachSchritte({ itemListElement: [{ text: "A" }, { text: "B" }] }), ["A", "B"]);
  gleich(W.flachSchritte(null), []);
});

gruppe("schema.org aus echten Seitenformen");
const seiteMit = daten => `<html><head><script type="application/ld+json">${JSON.stringify(daten)}</` + `script></head><body></body></html>`;
t("Einfaches Recipe-Objekt", () => {
  const r = W.ausSchema(seiteMit({ "@type": "Recipe", name: "Linsensuppe",
    recipeIngredient: ["200 g rote Linsen", "1 Zwiebel"], recipeInstructions: "Kochen.\nServieren.",
    totalTime: "PT35M", recipeYield: "4 Portionen" }));
  gleich(r.name, "Linsensuppe");
  gleich(r.zutaten, ["200 g rote Linsen", "1 Zwiebel"]);
  gleich(r.minuten, 35);
  gleich(r.portionen, 4);
});
t("Recipe im @graph", () => {
  const r = W.ausSchema(seiteMit({ "@context": "https://schema.org",
    "@graph": [{ "@type": "WebPage" }, { "@type": "Recipe", name: "Ofengemüse", recipeIngredient: ["1 Zucchini"] }] }));
  gleich(r.name, "Ofengemüse");
});
t("Recipe in einer Liste", () => {
  const r = W.ausSchema(seiteMit([{ "@type": "Organization" }, { "@type": "Recipe", name: "Dal", recipeIngredient: ["Linsen"] }]));
  gleich(r.name, "Dal");
});
t("Mehrere Typen an einem Objekt", () => {
  const r = W.ausSchema(seiteMit({ "@type": ["Recipe", "NewsArticle"], name: "Curry", recipeIngredient: ["Reis"] }));
  gleich(r.name, "Curry");
});
t("Kaputtes JSON blockiert die weitere Suche nicht", () => {
  const html = `<script type="application/ld+json">{kaputt</` + `script>` + seiteMit({ "@type": "Recipe", name: "Trotzdem da", recipeIngredient: ["Salz"] });
  gleich(W.ausSchema(html).name, "Trotzdem da");
});
t("Seite ohne Rezept liefert null", () => {
  gleich(W.ausSchema(seiteMit({ "@type": "BlogPosting", headline: "Kein Rezept" })), null);
  gleich(W.ausSchema("<html><body>nichts</body></html>"), null);
});
t("Rezept ohne Zutatenliste sagt das ehrlich", () => {
  const r = W.ausSchema(seiteMit({ "@type": "Recipe", name: "Nur Text" }));
  gleich(r.zutaten, []);
  wahr(r.hinweis.length > 10, "mit Erklärung");
});
t("Ohne Gesamtzeit werden Vorbereitung und Garzeit addiert", () => {
  const r = W.ausSchema(seiteMit({ "@type": "Recipe", name: "X", recipeIngredient: ["a"], prepTime: "PT10M", cookTime: "PT25M" }));
  gleich(r.minuten, 35);
});

gruppe("Notbehelf und Video");
t("Ohne strukturierte Daten wird der Titel übernommen", () => {
  const r = W.notbehelf("<html><head><title>Bestes Ofengemüse | Foodblog</title></head></html>", { hostname: "blog.de" });
  gleich(r.name, "Bestes Ofengemüse");
  gleich(r.zutaten, []);
  wahr(r.hinweis.includes("Rezepttext"), "verweist auf den Weg von Hand");
});
t("Ohne Titel bleibt wenigstens der Hostname", () => {
  gleich(W.notbehelf("<html></html>", { hostname: "blog.de" }).name, "blog.de");
});
t("Aus einer Videobeschreibung werden Mengenzeilen gefischt", () => {
  const html = `<meta name="title" content="Schnelles Dal">` +
    `"shortDescription":"Zutaten:\\n200 g Linsen\\n1 Zwiebel\\nViel Spa\\u00df beim Kochen!"`;
  const r = W.video(html, { hostname: "youtube.com" });
  gleich(r.name, "Schnelles Dal");
  gleich(r.zutaten, ["200 g Linsen", "1 Zwiebel"]);
});

gruppe("Aldi-Angebote");
t("Produktnamen werden aus Produktlinks gelesen", () => {
  const html = `<a href="/de/produkt/bio-moehren-1kg-123456.html">…</a>
                <a href="/de/produkt/rote-linsen-500g-987654.html">…</a>
                <a href="/de/angebote/2026-08-17.html">kein Produkt</a>`;
  gleich(W.produkteAusHtml(html), ["Bio moehren 1kg", "Rote linsen 500g"]);
});
t("Dubletten erscheinen nur einmal", () => {
  const html = `<a href="/produkt/moehren-111111.html">a</a><a href="/produkt/moehren-111111.html">b</a>`;
  gleich(W.produkteAusHtml(html).length, 1);
});
t("Eine Seite ohne Produkte liefert eine leere Liste", () => {
  gleich(W.produkteAusHtml("<html>nichts</html>"), []);
});
t("Das Datumsformat passt zu dem der App", () => {
  gleich(W.isoDatum(new Date(2026, 7, 3)), "2026-08-03");
});

gruppe("Blog-Feeds");
t("RSS wird gelesen", () => {
  const xml = `<rss><channel>
    <item><title>Ofengemüse</title><link>https://blog.de/ofen</link><pubDate>Mon, 10 Aug 2026 08:00:00 +0000</pubDate><description>Lecker</description></item>
    <item><title>Dal</title><link>https://blog.de/dal</link><pubDate>Tue, 11 Aug 2026 08:00:00 +0000</pubDate></item>
  </channel></rss>`;
  const e = W.feedZerlegen(xml);
  gleich(e.length, 2);
  gleich(e[0].titel, "Ofengemüse");
  gleich(e[0].link, "https://blog.de/ofen");
  wahr(e[0].datum > 0, "Datum gelesen");
  gleich(e[0].text, "Lecker");
});
t("Atom wird gelesen, auch mit Link im Attribut", () => {
  const xml = `<feed><entry><title>Suppe</title><link rel="alternate" href="https://blog.de/suppe"/>
    <updated>2026-08-10T08:00:00Z</updated><summary>Kurz</summary></entry></feed>`;
  const e = W.feedZerlegen(xml);
  gleich(e.length, 1);
  gleich(e[0].link, "https://blog.de/suppe");
  gleich(e[0].titel, "Suppe");
});
t("CDATA-Titel kommen sauber an", () => {
  const xml = `<rss><item><title><![CDATA[Möhren & Co]]></title><link>https://blog.de/m</link></item></rss>`;
  gleich(W.feedZerlegen(xml)[0].titel, "Möhren & Co");
});
t("Einträge ohne Link fallen weg", () => {
  const xml = `<rss><item><title>Ohne Link</title></item></rss>`;
  gleich(W.feedZerlegen(xml), []);
});
t("HTML statt Feed ergibt keine Einträge statt Unsinn", () => {
  gleich(W.feedZerlegen("<html><body><item>kein Feed</body></html>"), []);
});
t("Fehlendes Datum wird zu null, nicht zu NaN", () => {
  const xml = `<rss><item><title>X</title><link>https://blog.de/x</link><pubDate>keine Ahnung</pubDate></item></rss>`;
  gleich(W.feedZerlegen(xml)[0].datum, 0);
});

print("\n" + ok + " bestanden, " + fehler.length + " fehlgeschlagen");
if (fehler.length) { fehler.forEach(f => print("  - " + f)); quit(1); }
