/* Rezepte einspielen: der zweite Weg für Kochbücher. Fotos bei Claude, von dort
   ein Rezeptpaket, hier hinein. Geprüft wird, dass das Paket nachsichtig
   gelesen wird und dass nichts stillschweigend falsch in der App landet –
   allen voran die Mengen, die in der ganzen App für EINE Portion gelten. */
load("tests/harness.js");

function frisch() {
  A.S = A.leer();
  A.cfg = { db: "", hid: "", leser: "" };
  A.queue = [];
  A.S.eigene = {}; A.S.sammlung = {}; A.S.liste = {}; A.S.plan = {};
  Object.keys(elemente).forEach(k => delete elemente[k]);
}
function einspielen(text) {
  frisch();
  document.getElementById("imp").value = typeof text === "string" ? text : JSON.stringify(text);
  A.importAusfuehren();
  return Object.values(A.S.eigene);
}
/* So sieht aus, was Claude aus der Kochbuchseite zurückgibt */
const NUSSKUCHEN = {
  n: "Nusskuchen mit Möhren und Sauerrahm", port: 18, min: 85, typ: "dessert", ma: [],
  m: [1,2,3,4,5,6,7,8,9,10,11,12], bl: 0, nut: ["eisen", "ballast"],
  why: "Kuchen mit Möhren, Nüssen und Vollkornmehl statt Weißmehl.",
  q: "Kochbuch, Seite 204",
  z: ["200 g Möhren", "100 g weiche Butter", "50 g Vollrohrzucker (z. B. Muscovado)",
      "1/2 TL Zimtpulver", "6 Eier", "100 g Dinkel-Vollkornmehl", "100 g saure Sahne"],
  s: ["Den Backofen auf 180 °C vorheizen.", "Die Möhren putzen, schälen und fein raspeln."]
};

gruppe("Ein Paket einspielen");
t("Aus Klartextzeilen werden Zutaten mit Menge, Einheit und Abteilung", () => {
  const r = einspielen([{ n: "Test", z: ["200 g Möhren", "1 Dose Kichererbsen", "Salz"] }])[0];
  gleich(r.z[0], ["Möhren", 200, "g", "og"]);
  gleich(r.z[1], ["Kichererbsen", 1, "Dose", "tr"]);
  gleich(r.z[2][0], "Salz");
  gleich(r.z[2][1], 0, "ohne Menge bleibt die Menge leer");
});
t("Zutaten dürfen auch als fertige Liste kommen", () => {
  const r = einspielen([{ n: "Test", z: [["Möhren", 200, "g", "og"]] }])[0];
  gleich(r.z[0], ["Möhren", 200, "g", "og"]);
});
t("Zutaten und Schritte dürfen ein Textblock sein", () => {
  const r = einspielen([{ n: "Test", z: "200 g Möhren\n1 Zwiebel", s: "1. Schälen.\n2. Kochen." }])[0];
  gleich(r.z.length, 2);
  gleich(r.s, ["Schälen.", "Kochen."], "die Nummer gehört nicht in den Schritt");
});

gruppe("Die wichtigste Umrechnung");
t("Mengen werden auf eine Portion heruntergerechnet", () => {
  const r = einspielen([NUSSKUCHEN])[0];
  gleich(r.z[0], ["Möhren", 11.111, "g", "og"], "200 g für 18 Scheiben sind 11,1 g je Scheibe");
  gleich(r.z[4][1], 0.333, "6 Eier für 18 Scheiben");
});
t("Ohne Portionsangabe bleiben die Mengen, wie sie sind", () => {
  const r = einspielen([{ n: "Test", z: ["200 g Möhren"] }])[0];
  gleich(r.z[0][1], 200);
});
t("Die Einkaufsliste rechnet danach richtig hoch", () => {
  einspielen([NUSSKUCHEN]);
  const id = Object.keys(A.S.eigene)[0];
  A.planWoche = 0;
  A.S.plan = { "w0-0-m": { r: id, p: 18 } };
  A.S.vorrat = {};
  A.listeBauen();
  const moehren = Object.values(A.S.liste).find(i => i.n === "Möhren");
  wahr(moehren, "Möhren fehlen auf der Liste");
  wahr(Math.abs(moehren.q - 200) < 0.1, "18 Portionen sollten wieder 200 g ergeben, sind: " + moehren.q);
});

gruppe("Was die App selbst ableitet");
t("Die Art des Gerichts kommt aus den Zutaten", () => {
  gleich(einspielen([{ n: "A", z: ["200 g Lachsfilet"] }])[0].k, "fisch");
  gleich(einspielen([{ n: "B", z: ["200 g Hähnchenbrust"] }])[0].k, "fleisch");
  gleich(einspielen([{ n: "C", z: ["200 g Möhren"] }])[0].k, "veg");
  gleich(einspielen([{ n: "D", k: "fleisch", z: ["200 g Möhren"] }])[0].k, "fleisch", "eine Angabe schlägt die Ableitung");
});
t("Das Protein wird geschätzt statt auf 20 gesetzt", () => {
  const linsen = einspielen([{ n: "Linsen", z: ["100 g Linsen"] }])[0];
  const gurke = einspielen([{ n: "Gurke", z: ["100 g Salatgurke"] }])[0];
  wahr(linsen.p > gurke.p, "Linsen sollten mehr Protein haben als Gurke: " + linsen.p + " gegen " + gurke.p);
  gleich(einspielen([{ n: "X", p: 42, z: ["100 g Linsen"] }])[0].p, 42, "eine Angabe schlägt die Schätzung");
});
t("Snacks und Desserts bekommen keine Mahlzeit zugewiesen", () => {
  gleich(einspielen([{ n: "A", typ: "dessert", ma: ["m", "a"], z: ["100 g Mehl"] }])[0].ma, []);
  gleich(einspielen([{ n: "B", typ: "haupt", ma: [], z: ["100 g Mehl"] }])[0].ma, ["a"], "sonst wäre es nie planbar");
});
t("Unsinnige Angaben werden aussortiert, nicht übernommen", () => {
  const r = einspielen([{ n: "Test", typ: "quatsch", k: "vogel", m: [1, 99], nut: ["eisen", "erfunden"],
    bl: 7, ma: ["f", "x"], z: ["100 g Mehl"] }])[0];
  gleich(r.typ, "haupt"); gleich(r.k, "veg"); gleich(r.m, [1]);
  gleich(r.nut, ["eisen"]); gleich(r.bl, 0); gleich(r.ma, ["f"]);
});

gruppe("Nachsichtig gegenüber dem, was aus einem Chat kommt");
t("Ein Satz hinter der Liste lässt das Einspielen nicht scheitern", () => {
  const r = einspielen('Hier ist dein Rezeptpaket:\n[{"n":"Test","z":["200 g Möhren"]}]\nUnsicher war Zeile 3.');
  gleich(r.length, 1);
  gleich(r[0].n, "Test");
});
t("Auch ein Paket in einem Objekt wird gefunden", () => {
  const r = einspielen('{"rezepte":[{"n":"Test","z":["200 g Möhren"]}]}');
  gleich(r.length, 1);
});
t("Ein eingespieltes Rezept landet in der Sammlung", () => {
  einspielen([NUSSKUCHEN]);
  const id = Object.keys(A.S.eigene)[0];
  wahr(A.S.sammlung[id], "sonst taucht es nirgends auf");
  gleich(A.S.eigene[id].src, "eigen");
  gleich(A.S.eigene[id].q, "Kochbuch, Seite 204", "die Quelle gehört dazu");
  wahr(A.S.eigene[id].port === undefined, "die Portionszahl ist verrechnet und hat im Rezept nichts verloren");
});
t("Einträge ohne Namen werden übersprungen, der Rest kommt an", () => {
  const r = einspielen([{ z: ["200 g Möhren"] }, { n: "Test", z: ["1 Zwiebel"] }]);
  gleich(r.length, 1);
  gleich(r[0].n, "Test");
});
t("Ein leeres Feld meldet sich, statt nichts zu tun", () => {
  frisch();
  meldungen.alert = [];
  document.getElementById("imp").value = "   ";
  A.importAusfuehren();
  wahr(/nichts zum Einspielen/.test(meldungen.alert.join(" ")), "keine Meldung: " + meldungen.alert.join(" | "));
  gleich(Object.keys(A.S.eigene).length, 0);
});
t("Was geschätzt oder umgerechnet wurde, wird gesagt", () => {
  frisch();
  meldungen.alert = [];
  document.getElementById("imp").value = JSON.stringify([NUSSKUCHEN, { n: "Ohne Schritte", z: ["1 Wunderwurzel"] }]);
  A.importAusfuehren();
  const text = meldungen.alert.join(" ");
  wahr(/2 Rezepte eingespielt/.test(text), "die Zahl fehlt: " + text);
  wahr(/heruntergerechnet/.test(text), "die Umrechnung wird verschwiegen: " + text);
  wahr(/ohne Abteilung/.test(text), "die unbekannte Zutat wird verschwiegen: " + text);
  wahr(/ohne Zubereitung/.test(text), "das fehlende Rezept wird verschwiegen: " + text);
});

gruppe("Die Anleitung für Claude");
t("Die Vorlage nennt alle Felder, die der Import auswertet", () => {
  const v = A.CLAUDE_VORLAGE;
  ["n", "port", "z", "s", "min", "typ", "ma", "m", "bl", "nut", "why", "q"].forEach(f =>
    wahr(new RegExp("\\b" + f + "\\b").test(v), "Feld " + f + " fehlt in der Anleitung"));
  ["haupt", "fruehstueck", "snack", "dessert"].forEach(x =>
    wahr(v.indexOf(x) >= 0, "Rezeptart " + x + " fehlt"));
  ["eisen", "jod", "omega3", "folat", "b12", "calcium", "zink", "ballast"].forEach(x =>
    wahr(v.indexOf(x) >= 0, "Nährstoff " + x + " fehlt"));
});
t("Das Beispiel in der Anleitung ist gültiges JSON und geht durch den Import", () => {
  const m = A.CLAUDE_VORLAGE.match(/\[\s*\n\s*\{[\s\S]*\]\s*$/);
  wahr(m, "kein Beispiel gefunden");
  const r = einspielen(m[0]);
  gleich(r.length, 1);
  gleich(r[0].n, "Nusskuchen mit Möhren und Sauerrahm");
  gleich(r[0].typ, "dessert");
  gleich(r[0].min, 85);
  wahr(Math.abs(r[0].z[0][1] - 200 / 18) < 0.01, "auf eine Portion heruntergerechnet");
});

gruppe("Backzutaten finden ihr Regal");
t("Schokolade und Gewürze stehen bei den Backzutaten", () => {
  ["Bitterschokolade", "Zartbitterschokolade", "Kuvertüre", "Nelkenpulver", "gemahlene Nelken",
   "Kardamom", "Piment", "Safran"].forEach(n =>
    gleich(A.katFuer(n), "gw", n + " gehört zu Öl, Gewürze und Backzutaten"));
});
t("Die alten Zuordnungen bleiben, wie sie waren", () => {
  gleich(A.katFuer("Möhren"), "og");
  gleich(A.katFuer("Haselnusskerne"), "tr");
  gleich(A.katFuer("saure Sahne"), "kr");
  gleich(A.katFuer("Zahnpasta"), "so", "Drogerie steht weiter vor allem anderen");
});
t("Aus dem ganzen Kochbuchrezept bleibt keine Zutat ohne Regal", () => {
  const r = einspielen([NUSSKUCHEN])[0];
  gleich(r.z.filter(z => z[3] === "so").map(z => z[0]), [], "diese Zutaten haben kein Regal");
});

bilanz();
