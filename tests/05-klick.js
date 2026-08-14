/* Klick-Durchlauf: jede Ansicht in jeder Variante rendern, alle Bedienelemente
   herausziehen und einzeln aufrufen. Der Aufruf läuft über imScope, sonst sieht
   der Code die Funktionen der App nicht.
   Vor jedem Aufruf wird der Zustand zurückgesetzt, damit sich die Aufrufe nicht
   gegenseitig den Boden wegziehen. */
load("tests/harness.js");

/* ---------- ein realistischer Stand ---------- */
function standAufbauen() {
  A.S = A.leer();
  A.cfg = { db: "https://test.example", hid: "h".repeat(24), leser: "https://leser.test" };
  A.queue = []; A.syncState = "live";
  A.S.sammlung = Object.fromEntries(A.REZEPTE.slice(0, 60).map(r => [r.id, Date.now() - 70 * 86400000]));
  A.S.archiv = { [A.REZEPTE[70].id]: Date.now() };
  A.S.spaeter = { [A.REZEPTE[71].id]: Date.now() };
  A.S.geprueft = { [A.REZEPTE[72].id]: Date.now() };
  A.S.eigene = {
    eig1: { id: "eig1", n: "Eigenes Testgericht", k: "veg", typ: "haupt", ma: ["m", "a"], m: A.ALL,
      min: 25, p: 24, bl: 0, nut: ["eisen"], why: "Test.", q: "https://beispiel.test/rezept",
      z: [["Möhren", 100, "g", "og"], ["Linsen", 60, "g", "tr"]], s: ["Schnippeln.", "Kochen."], src: "eigen", geaendert: Date.now() },
    eig2: { id: "eig2", n: "Eigener Snack", k: "veg", typ: "snack", ma: [], m: A.ALL,
      min: 5, p: 22, bl: 0, nut: [], why: "Test.", z: [["Quark", 200, "g", "kr"]], s: ["Rühren."], src: "eigen", geaendert: Date.now() }
  };
  A.S.plan = {};
  A.planWoche = 0; A.autoWoche();
  A.S.plan["w0-4-a"] = { r: A.REZEPTE[3].id, p: 0 };          /* Restetag */
  A.S.extra = { "w0_x1": { r: "eig1", p: 3 } };
  A.S.verlauf = { [Date.now() - 7 * 86400000]: { r: A.REZEPTE[1].id, kw: "KW 30" } };
  const heute = new Date(), iso = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  A.S.angebote = { p1: { von: iso(heute), bis: iso(new Date(Date.now() + 5 * 86400000)), items: ["Möhren", "Lauch", "Linsen"], quelle: "Test-Prospekt", geholt: Date.now() } };
  A.S.quellen = { q1: { n: "Testblog", u: "https://blog.test", an: true } };
  A.S.listen = { l1: { n: "Drogerie", items: { i1: { n: "Zahnpasta", on: false }, i2: { n: "Seife", on: true } } } };
  A.S.vorrat = { salz: { n: "Salz", k: "gw", da: true }, mehl: { n: "Mehl", k: "gw", da: false } };
  A.listeBauen();
  const ids = Object.keys(A.S.liste);
  if (ids[0]) A.posten(ids[0], true);                          /* ein Posten schon erledigt */
  A.S.liste["extra_manuell"] = { n: "Taschentücher", q: 0, e: "", k: "so", on: false, nach: true, manuell: true };
  return JSON.parse(JSON.stringify({ S: A.S, cfg: A.cfg }));
}
const SICHERUNG = standAufbauen();
function zurueckSetzen() {
  A.S = JSON.parse(JSON.stringify(SICHERUNG.S));
  A.cfg = JSON.parse(JSON.stringify(SICHERUNG.cfg));
  A.queue = []; A.syncState = "live";
  netz.calls = []; netz.failing = false; netz.status = null;
  elemente.sheet.innerHTML = "";
  meldungen.alert.length = 0; meldungen.confirm.length = 0;
}

/* ---------- Bedienelemente einsammeln ---------- */
const HANDLER = /\son(click|input|change|keydown|keyup|submit|blur|focus)="([^"]*)"/g;
function elementeAus(html, herkunft, sammlung) {
  let m;
  HANDLER.lastIndex = 0;
  while ((m = HANDLER.exec(html || ""))) {
    /* HTML-Entities zurückwandeln, sonst wird &amp;&amp; zu ungültigem Code */
    const code = m[2].replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
    sammlung.push({ code, herkunft, art: m[1] });
  }
}

const gesammelt = [];
function ansichtSammeln(name, vorbereiten) {
  zurueckSetzen();
  if (vorbereiten) vorbereiten();
  let html = "";
  try { A.render(); html = elemente.view.innerHTML; }
  catch (e) { throw new Error("Ansicht " + name + " rendert nicht: " + e.message); }
  elementeAus(html, name, gesammelt);
  elementeAus(elemente.nav.innerHTML, name + "/nav", gesammelt);
  elementeAus(elemente.sheet.innerHTML, name + "/sheet", gesammelt);
  return html;
}

gruppe("Alle Ansichten rendern");
["woche", "rezepte", "entdecken", "einkauf", "mehr"].forEach(tab => {
  t("Ansicht „" + tab + "“ rendert", () => {
    const html = ansichtSammeln(tab, () => { A.tab = tab; });
    wahr(html.length > 50, "Inhalt vorhanden");
  });
});
t("Wochenplan in allen drei Wochen", () => {
  [0, 1, 2].forEach(w => ansichtSammeln("woche" + w, () => { A.tab = "woche"; A.planWoche = w; }));
  A.planWoche = 0;
});
t("Rezeptansicht in jedem Filter", () => {
  const filter = ["alle", "schnell", "darm", "f", "m", "a", "fisch", "fleisch", "veg", "snack", "dessert", "sammlung", "eigen", "gesamt"];
  filter.forEach(f => ansichtSammeln("rezepte/" + f, () => { A.tab = "rezepte"; A.filter = f; A.suche = ""; }));
});
t("Rezeptsuche mit Treffern und ohne", () => {
  ansichtSammeln("rezepte/suche", () => { A.tab = "rezepte"; A.filter = "alle"; A.suche = "linsen"; });
  const leer = ansichtSammeln("rezepte/nichts", () => { A.tab = "rezepte"; A.filter = "alle"; A.suche = "xyzgibtsnicht"; });
  wahr(/nichts|kein|keine/i.test(leer), "ehrliche Leermeldung statt Ersatzinhalt");
  A.suche = "";
});
t("Entdecken in allen Modi", () => {
  ["ideen", "angebote", "netz"].forEach(m => ansichtSammeln("entdecken/" + m, () => { A.tab = "entdecken"; A.ideenModus = m; }));
  A.ideenModus = "ideen";
});
t("Jedes Thema rendert", () => {
  A.tab = "entdecken"; A.ideenModus = "ideen";
  A.THEMEN.forEach(th => ansichtSammeln("entdecken/thema/" + th.k, () => { A.themaWahl = th.k; }));
  A.themaWahl = null;
});
t("Einkauf mit Wochenliste und Zusatzliste", () => {
  ansichtSammeln("einkauf/woche", () => { A.tab = "einkauf"; A.einkaufAnsicht = "woche"; });
  ansichtSammeln("einkauf/erledigtWeg", () => { A.tab = "einkauf"; A.erledigtWeg = true; });
  ansichtSammeln("einkauf/route", () => { A.tab = "einkauf"; A.erledigtWeg = false; A.routeOffen = true; });
  ansichtSammeln("einkauf/liste", () => { A.tab = "einkauf"; A.routeOffen = false; A.einkaufAnsicht = "l1"; });
  A.einkaufAnsicht = "woche";
});
t("Leere Zustände rendern ebenfalls", () => {
  ["woche", "rezepte", "entdecken", "einkauf", "mehr"].forEach(tab => {
    zurueckSetzen();
    A.S = A.leer(); A.S.plan = {}; A.S.liste = {}; A.S.sammlung = {};
    A.tab = tab;
    let html = "";
    try { A.render(); html = elemente.view.innerHTML; } catch (e) { throw new Error(tab + " leer: " + e.message); }
    elementeAus(html, tab + "/leer", gesammelt);
    wahr(html.length > 20, tab + " zeigt etwas");
  });
});

gruppe("Fenster (Sheets)");
const SHEETS = [
  ["Rezeptdetail", () => A.detail(A.REZEPTE[0].id)],
  ["Detail eigenes Rezept", () => A.detail("eig1")],
  ["Gericht wählen", () => A.waehle("w0-1-m", "m")],
  ["Vorratsfrage", () => A.vorratFrage()],
  ["Snackblatt", () => A.snackBlatt()],
  ["Quellen verwalten", () => A.quellenVerwalten()],
  ["Zusatzgericht wählen", () => A.extraWaehlen()],
  ["Rezeptformular", () => A.neuesRezept()],
  ["Rezeptformular vorbefüllt", () => A.neuesRezept({ n: "Aus dem Netz", z: "200 g Möhren\n1 Zwiebel", s: "Kochen." })],
  ["Angebote bearbeiten", () => A.angeboteBearbeiten()],
  ["Rezept bearbeiten", () => A.neuesRezept(A.S.eigene.eig1)],
  ["Weiteres zur Einkaufsliste", () => A.einkaufMehr()],
  ["Mehr: Vorrat", () => A.mehrOeffnen("vorrat")],
  ["Mehr: Angebote", () => A.mehrOeffnen("angebote")],
  ["Mehr: Eigene Rezepte", () => A.mehrOeffnen("eigene")],
  ["Mehr: Archiv", () => A.mehrOeffnen("archiv")],
  ["Mehr: Abgleich", () => A.mehrOeffnen("sync")],
  ["Mehr: Abgleich eingerichtet", () => {
    A.cfg = { db: "https://test.example", hid: "h".repeat(24), leser: "" };
    A.mehrOeffnen("sync");
  }],
  ["Mehr: Archiv gefüllt", () => { A.S.archiv = { b1: Date.now() }; A.mehrOeffnen("archiv"); }]
];
SHEETS.forEach(([name, oeffnen]) => {
  t("Fenster „" + name + "“ öffnet", () => {
    zurueckSetzen();
    try { oeffnen(); } catch (e) { throw new Error(e.message); }
    const html = elemente.sheet.innerHTML;
    wahr(html.length > 20, "Inhalt vorhanden");
    elementeAus(html, "sheet:" + name, gesammelt);
  });
});

gruppe("Woche abschließen");
t("Abschließen fragt erst, was wirklich gekocht wurde", () => {
  zurueckSetzen();
  const vorher = Object.keys(A.S.plan).filter(k => k.startsWith("w0-")).length;
  wahr(vorher > 0, "Woche war gefüllt");
  A.wocheAbschliessen();
  wahr(elemente.sheet.innerHTML.includes("wirklich gekocht"), "Rückfrage erscheint");
  gleich(Object.keys(A.S.plan).filter(k => k.startsWith("w0-")).length, vorher, "noch nichts geleert");
});
t("Nur das Angehakte landet im Verlauf, der Plan wird geleert", () => {
  zurueckSetzen();
  A.S.verlauf = {};
  const vorher = Object.keys(A.S.plan).filter(k => k.startsWith("w0-")).length;
  A.wocheAbschliessen();
  A.wocheAbschliessenJetzt();
  gleich(Object.keys(A.S.plan).filter(k => k.startsWith("w0-")).length, 0, "Plan geleert");
  wahr(Object.keys(A.S.verlauf).length > 0, "Gekochtes im Verlauf");
});
t("Abgewählte Gerichte kommen nicht in den Verlauf", () => {
  zurueckSetzen();
  A.S.verlauf = {};
  A.wocheAbschliessen();
  A.abschlussAlle(false);
  A.wocheAbschliessenJetzt();
  gleich(Object.keys(A.S.verlauf).length, 0, "nichts vermerkt");
  gleich(Object.keys(A.S.plan).filter(k => k.startsWith("w0-")).length, 0, "Plan trotzdem geleert");
});
t("Restetage sind nicht vorangehakt", () => {
  zurueckSetzen();
  const k = Object.keys(A.S.plan).find(x => x.startsWith("w0-"));
  A.S.plan[k] = { ...A.S.plan[k], p: 0 };
  A.wocheAbschliessen();
  wahr(A.abschlussAus[k] === true, "Restetag abgewählt");
});
t("Der Verlauf wächst nicht über 80 Einträge", () => {
  zurueckSetzen();
  A.S.verlauf = {};
  for (let i = 0; i < 120; i++) A.S.verlauf[1000 + i] = { r: "b1", kw: "KW 1" };
  A.wocheAbschliessen();
  A.wocheAbschliessenJetzt();
  wahr(Object.keys(A.S.verlauf).length <= 80, "jetzt " + Object.keys(A.S.verlauf).length);
});
t("Abbrechen ändert nichts", () => {
  zurueckSetzen();
  const vorher = JSON.stringify(A.S.plan);
  A.wocheAbschliessen();
  A.closeSheet();
  gleich(JSON.stringify(A.S.plan), vorher);
});

/* ---------- jedes eingesammelte Bedienelement einmal aufrufen ---------- */
gruppe("Bedienelemente");
const einzeln = [];
const gesehen = new Set();
gesammelt.forEach(h => { const s = h.code + "|" + h.herkunft; if (!gesehen.has(s)) { gesehen.add(s); einzeln.push(h); } });

const kaputt = [];
globalThis.__klickZiel = neuesElement("input");   /* muss vor der Schleife stehen */
einzeln.forEach(h => {
  zurueckSetzen();
  globalThis.event = { key: "Enter", preventDefault() {}, stopPropagation() {}, target: neuesElement("input"), currentTarget: neuesElement("div") };
  try {
    imScope("(function(){ var event = globalThis.event; " + h.code + " }).call(globalThis.__klickZiel)");
  } catch (e) {
    kaputt.push({ code: h.code.slice(0, 90), herkunft: h.herkunft, fehler: e && e.message });
  }
});

t(einzeln.length + " Bedienelemente laufen ohne Ausnahme", () => {
  if (kaputt.length) {
    const zeilen = kaputt.slice(0, 12).map(k => k.herkunft + ": " + k.code + "\n         → " + k.fehler);
    throw new Error(kaputt.length + " von " + einzeln.length + " scheitern:\n       " + zeilen.join("\n       "));
  }
});

bilanz();
