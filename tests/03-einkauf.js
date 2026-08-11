/* Einkaufsliste, Vorrat, Angebotsabgleich und die kleinen Helfer darunter. */
load("tests/harness.js");

function frisch() {
  A.S = A.leer();
  A.cfg = { db: "", hid: "", leser: "" };
  A.planWoche = 0;
  A.S.plan = {}; A.S.liste = {}; A.S.extra = {}; A.S.angebote = {};
  A.queue = [];
  A.S.vorrat = {};        /* Standardvorrat stört die Rechnung, deshalb je Test gezielt setzen */
}
/* Ein Testrezept mit bekannten Mengen, damit die Rechnung nachprüfbar ist */
function testRezept(id, z, extra) {
  return { id, n: "Test " + id, k: "veg", typ: "haupt", ma: ["f", "m", "a"], m: A.ALL,
    min: 20, p: 20, bl: 0, nut: [], why: "Test.", z, s: ["Kochen."], ...(extra || {}) };
}
function mitRezepten(rezepte) {
  frisch();
  rezepte.forEach(r => { A.S.eigene[r.id] = r; });
}
const listeItems = () => Object.values(A.S.liste || {});
const finde = n => listeItems().find(i => i.n === n);

gruppe("Mengen und Portionen");
t("Mengen gelten je Portion und werden hochgerechnet", () => {
  mitRezepten([testRezept("t1", [["Möhren", 100, "g", "og"]])]);
  A.S.plan = { "w0-0-m": { r: "t1", p: 4 } };
  A.listeBauen();
  gleich(finde("Möhren").q, 400);
});
t("Zwei Gerichte mit derselben Zutat werden zusammengefasst", () => {
  mitRezepten([testRezept("t1", [["Möhren", 100, "g", "og"]]), testRezept("t2", [["Möhren", 50, "g", "og"]])]);
  A.S.plan = { "w0-0-m": { r: "t1", p: 2 }, "w0-1-a": { r: "t2", p: 2 } };
  A.listeBauen();
  gleich(listeItems().length, 1, "ein Posten");
  gleich(finde("Möhren").q, 300);
});
t("Gleiche Zutat in anderer Einheit bleibt getrennt", () => {
  mitRezepten([testRezept("t1", [["Milch", 100, "ml", "kr"]]), testRezept("t2", [["Milch", 1, "Stk", "kr"]])]);
  A.S.plan = { "w0-0-m": { r: "t1", p: 2 }, "w0-1-a": { r: "t2", p: 2 } };
  A.listeBauen();
  gleich(listeItems().length, 2);
});
t("Ein Restetag mit 0 Portionen erzeugt keine Einkäufe", () => {
  mitRezepten([testRezept("t1", [["Möhren", 100, "g", "og"]])]);
  A.S.plan = { "w0-0-m": { r: "t1", p: 0 } };
  A.listeBauen();
  gleich(listeItems().length, 0);
});
t("Gerichte anderer Wochen zählen nicht mit", () => {
  mitRezepten([testRezept("t1", [["Möhren", 100, "g", "og"]])]);
  A.S.plan = { "w1-0-m": { r: "t1", p: 2 } };
  A.listeBauen();
  gleich(listeItems().length, 0, "Woche 1 gehört nicht zu Woche 0");
});
t("Zusätzliche Gerichte der Woche zählen mit", () => {
  mitRezepten([testRezept("t1", [["Möhren", 100, "g", "og"]])]);
  A.S.extra = { "w0_x1": { r: "t1", p: 3 } };
  A.listeBauen();
  gleich(finde("Möhren").q, 300);
});

gruppe("Vorrat");
t("Was zuhause da ist, kommt nicht auf die Liste", () => {
  mitRezepten([testRezept("t1", [["Olivenöl", 10, "ml", "gw"], ["Möhren", 100, "g", "og"]])]);
  A.S.vorrat = { olivenoel: { n: "Olivenöl", k: "gw", da: true } };
  A.S.plan = { "w0-0-m": { r: "t1", p: 2 } };
  A.listeBauen();
  wahr(!finde("Olivenöl"), "Olivenöl ausgelassen");
  wahr(finde("Möhren"), "Möhren dabei");
});
t("Was im Vorrat fehlt, landet als Nachfüllposten auf der Liste", () => {
  mitRezepten([]);
  A.S.vorrat = { salz: { n: "Salz", k: "gw", da: false } };
  A.listeBauen();
  const p = finde("Salz");
  wahr(p && p.nach === true, "Salz als Nachfüllposten");
});
t("Kokosmilch geht nicht als Milch durch", () => {
  frisch();
  A.S.vorrat = { milch: { n: "Milch", k: "kr", da: true } };
  wahr(A.imVorrat("Milch"), "Milch trifft");
  wahr(!A.imVorrat("Kokosmilch"), "Kokosmilch trifft nicht");
  wahr(!A.imVorrat("Buttermilch"), "Buttermilch trifft nicht");
});
t("Einfache Mehrzahl wird erkannt", () => {
  frisch();
  A.S.vorrat = { zwiebel: { n: "Zwiebel", k: "og", da: true } };
  wahr(A.imVorrat("Zwiebeln"), "Zwiebeln trifft Zwiebel");
});

gruppe("Zweiter Einkauf");
t("Gekaufte Menge wird beim Abhaken festgehalten", () => {
  mitRezepten([testRezept("t1", [["Möhren", 100, "g", "og"]])]);
  A.S.plan = { "w0-0-m": { r: "t1", p: 2 } };
  A.listeBauen();
  const id = Object.keys(A.S.liste)[0];
  A.posten(id, true);
  gleich(A.S.liste[id].gekauft, 200);
  gleich(A.S.liste[id].on, true);
});
t("Beim erneuten Bauen erscheint nur die Differenz", () => {
  mitRezepten([testRezept("t1", [["Möhren", 100, "g", "og"]])]);
  A.S.plan = { "w0-0-m": { r: "t1", p: 2 } };
  A.listeBauen();
  const id = Object.keys(A.S.liste)[0];
  A.posten(id, true);                       /* 200 g gekauft */
  A.S.plan = { "w0-0-m": { r: "t1", p: 5 } };  /* jetzt werden 500 g gebraucht */
  A.listeBauen();
  gleich(A.S.liste[id].q, 300, "nur der Rest");
  gleich(A.S.liste[id].on, false, "wieder offen");
});
t("Reicht das Gekaufte, bleibt der Posten erledigt", () => {
  mitRezepten([testRezept("t1", [["Möhren", 100, "g", "og"]])]);
  A.S.plan = { "w0-0-m": { r: "t1", p: 5 } };
  A.listeBauen();
  const id = Object.keys(A.S.liste)[0];
  A.posten(id, true);                       /* 500 g gekauft */
  A.S.plan = { "w0-0-m": { r: "t1", p: 2 } };  /* Bedarf sinkt auf 200 g */
  A.listeBauen();
  gleich(A.S.liste[id].on, true, "bleibt abgehakt");
});
t("Ein Nachkauf ist in der Liste als solcher zu sehen", () => {
  mitRezepten([testRezept("t1", [["Möhren", 100, "g", "og"]])]);
  A.S.plan = { "w0-0-m": { r: "t1", p: 2 } };
  A.listeBauen();
  const id = Object.keys(A.S.liste)[0];
  A.posten(id, true);
  A.S.plan = { "w0-0-m": { r: "t1", p: 5 } };
  A.listeBauen();
  gleich(A.S.liste[id].gekauft, 200, "gekaufte Menge bleibt vermerkt");
  A.einkaufAnsicht = "woche";
  wahr(/Nachkauf/.test(A.vEinkauf()), "Kennzeichnung erscheint in der Einkaufsansicht");
});
t("Abhaken und wieder freigeben rechnet sauber zurück", () => {
  mitRezepten([testRezept("t1", [["Möhren", 100, "g", "og"]])]);
  A.S.plan = { "w0-0-m": { r: "t1", p: 2 } };
  A.listeBauen();
  const id = Object.keys(A.S.liste)[0];
  A.posten(id, true); A.posten(id, false);
  gleich(A.S.liste[id].gekauft, 0);
  gleich(A.S.liste[id].on, false);
});

gruppe("Von Hand ergänzte Posten");
t("Eigene Posten überleben den Neuaufbau", () => {
  mitRezepten([testRezept("t1", [["Möhren", 100, "g", "og"]])]);
  A.S.plan = { "w0-0-m": { r: "t1", p: 2 } };
  A.S.liste["taschentuecher_manuell"] = { n: "Taschentücher", q: 0, e: "", k: "so", on: false, nach: true, manuell: true };
  A.listeBauen();
  wahr(finde("Taschentücher"), "bleibt erhalten");
});
t("Eigener Posten mit Zutatennamen wird nicht doppelt geführt", () => {
  mitRezepten([testRezept("t1", [["Möhren", 100, "g", "og"]])]);
  A.S.plan = { "w0-0-m": { r: "t1", p: 2 } };
  A.S.liste[A.slug("Möhren_manuell")] = { n: "Möhren", q: 0, e: "", k: "og", on: false, manuell: true };
  A.listeBauen();
  const treffer = listeItems().filter(i => i.n === "Möhren");
  gleich(treffer.length, 1, "nur einmal Möhren");
});

gruppe("Robustheit");
t("Fehlende Liste nach einem Abgleich lässt die App nicht stürzen", () => {
  mitRezepten([testRezept("t1", [["Möhren", 100, "g", "og"]])]);
  A.S.plan = { "w0-0-m": { r: "t1", p: 2 } };
  delete A.S.liste;                       /* Firebase liefert leere Objekte gar nicht erst zurück */
  A.listeBauen();
  wahr(finde("Möhren"), "Liste wurde neu aufgebaut");
});
t("Ein Plan mit unbekanntem Rezept wird übersprungen", () => {
  mitRezepten([testRezept("t1", [["Möhren", 100, "g", "og"]])]);
  A.S.plan = { "w0-0-m": { r: "gibtsnicht", p: 2 }, "w0-1-a": { r: "t1", p: 2 } };
  A.listeBauen();
  gleich(listeItems().length, 1);
});
t("Rezept ohne Zutaten nach dem Abgleich stürzt nicht ab", () => {
  frisch();
  A.S.eigene.t9 = { id: "t9", n: "Ohne Zutaten", k: "veg", ma: ["m"] };   /* z und s fehlen, wie nach Firebase */
  A.S.plan = { "w0-0-m": { r: "t9", p: 2 } };
  A.listeBauen();
  gleich(listeItems().length, 0);
});

gruppe("Angebote");
t("Die Zutat darf das Angebotswort enthalten, nicht umgekehrt", () => {
  wahr(A.angebotPasst("lauch", "lauch"), "Lauch trifft Lauch");
  wahr(A.angebotPasst("lauch", "porree_lauch"), "Teil der Zutat trifft");
  wahr(!A.angebotPasst("gartenschlauch", "lauch"), "Gartenschlauch trifft Lauch nicht");
});
t("Wortstamm-Vergleich greift ab sechs Buchstaben", () => {
  wahr(A.angebotPasst("haehnchenbrustfilet", "haehnchenschenkel"), "gleicher Stamm trifft");
  wahr(!A.angebotPasst("brot", "brokkoli"), "kurze Wörter nicht über den Stamm");
});
t("Markenfüllwörter lösen keinen Treffer aus", () => {
  const worte = A.angebotWorte("Meine Bio Gold Frische Möhren");
  wahr(worte.includes("moehren"), "Möhren bleibt");
  ["meine", "bio", "gold", "frische"].forEach(w => wahr(!worte.includes(w), w + " sollte gefiltert sein"));
});
t("Angebote wirken nur in der Woche, für die der Prospekt gilt", () => {
  frisch();
  const heute = new Date();
  const inDreiWochen = new Date(Date.now() + 21 * 86400000);
  const iso = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  A.S.angebote = { p1: { von: iso(heute), bis: iso(heute), items: ["Lauch"], quelle: "test", geholt: Date.now() } };
  wahr(A.zutatImAngebot("Lauch", 0) !== "", "diese Woche im Angebot");
  A.S.angebote = { p1: { von: iso(inDreiWochen), bis: iso(inDreiWochen), items: ["Lauch"], quelle: "test", geholt: Date.now() } };
  gleich(A.zutatImAngebot("Lauch", 0), "", "künftiger Prospekt zählt für diese Woche nicht");
});

gruppe("Gestaltung");
t("Jede benutzte CSS-Variable ist auch definiert", () => {
  const html = read("index.html");
  const kopf = html.slice(0, html.indexOf("</style>"));
  const definiert = new Set((kopf.match(/--[a-z0-9-]+\s*:/g) || []).map(s => s.replace(/\s*:$/, "")));
  const benutzt = new Set((html.match(/var\(--[a-z0-9-]+\)/g) || []).map(s => s.slice(4, -1)));
  const fehlend = [...benutzt].filter(v => !definiert.has(v));
  gleich(fehlend, [], "nicht definierte Farben fallen im Betrieb unsichtbar aus");
});
t("Eingabefelder sind mindestens 16px groß, sonst zoomt iOS beim Tippen", () => {
  const html = read("index.html");
  const kopf = html.slice(0, html.indexOf("</style>"));
  const regel = kopf.match(/input[^{]*\{[^}]*\}/g) || [];
  const zuKlein = regel.filter(r => {
    const m = r.match(/font-size:\s*(\d+(?:\.\d+)?)px/);
    return m && +m[1] < 16;
  });
  gleich(zuKlein, []);
});

gruppe("Formatierung");
t("Stückzahlen werden auf halbe gerundet", () => {
  gleich(A.fmt(2.4, "Stk"), "2,5 Stk");
  gleich(A.fmt(3, "Stk"), "3 Stk");
});
t("Große Grammmengen werden auf 5 gerundet", () => {
  gleich(A.fmt(233, "g"), "235 g");
  gleich(A.fmt(12, "g"), "12 g");
});
t("Prisen sind immer mindestens eine", () => {
  gleich(A.fmt(0.2, "Prise"), "1 Prise");
});
t("Kalenderwoche wird nach ISO gezählt", () => {
  gleich(A.kw(new Date(2026, 0, 1)), "KW 1");
  gleich(A.kw(new Date(2026, 11, 31)), "KW 53");
  gleich(A.kw(new Date(2024, 11, 30)), "KW 1");   /* gehört schon zu 2025 */
});
t("Kennungen kollidieren auch im selben Moment nicht", () => {
  const ids = new Set();
  for (let i = 0; i < 500; i++) ids.add(A.neueId("t"));
  gleich(ids.size, 500);
});
t("Schlüssel enthalten keine für Firebase verbotenen Zeichen", () => {
  const boese = ['Möhren/Karotten', 'Salz.Pfeffer', 'A$B', 'C#D', 'E[F]', 'a b'];
  const falsch = boese.map(A.slug).filter(s => /[./$#[\]]/.test(s));
  gleich(falsch, []);
});

bilanz();
