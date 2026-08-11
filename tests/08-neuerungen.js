/* Die elf Verbesserungen aus dem Umbau. */
load("tests/harness.js");

function frisch() {
  A.S = A.leer();
  A.cfg = { db: "", hid: "", leser: "" };
  A.queue = []; A.tab = "woche"; A.planWoche = 0; A.suche = ""; A.filter = "alle";
  A.S.plan = {}; A.S.liste = {}; A.S.extra = {}; A.S.angebote = {}; A.S.verlauf = {};
  A.S.vorrat = {};
  Object.keys(elemente).forEach(k => delete elemente[k]);
  netz.calls = []; meldungen.alert.length = 0; meldungen.confirm.length = 0;
}
function testRezept(id, z, extra) {
  return { id, n: "Test " + id, k: "veg", typ: "haupt", ma: ["f", "m", "a"], m: A.ALL,
    min: 20, p: 20, bl: 0, nut: [], why: "Test.", z, s: ["Kochen."], ...(extra || {}) };
}
const heuteSlot = mk => "w0-" + A.heuteIdx() + "-" + mk;

gruppe("1 · Heute-Karte im Wochenplan");
t("Die Karte zeigt die drei Mahlzeiten des heutigen Tages", () => {
  frisch();
  A.S.eigene = { t1: testRezept("t1", [["Möhren", 100, "g", "og"]], { n: "Möhrensuppe" }) };
  A.S.plan[heuteSlot("m")] = { r: "t1", p: 2 };
  const html = A.heuteKarte();
  wahr(/Heute/.test(html), "Überschrift");
  wahr(/Möhrensuppe/.test(html), "Gericht genannt");
  wahr(/kochModus\('t1'/.test(html), "Kochmodus direkt erreichbar");
});
t("Leere Felder laden zum Eintragen ein", () => {
  frisch();
  const html = A.heuteKarte();
  wahr(/Noch nichts geplant/.test(html), "Hinweis");
  wahr(/waehle\('w0-/.test(html), "Auswahl direkt möglich");
});
t("Für andere Wochen erscheint die Karte nicht", () => {
  frisch();
  A.planWoche = 1;
  gleich(A.heuteKarte(), "");
  A.planWoche = 0;
});
t("Die Karte nennt das Protein des Tages", () => {
  frisch();
  A.S.eigene = { t1: testRezept("t1", [["Quark", 200, "g", "kr"]], { p: 30 }) };
  A.S.plan[heuteSlot("f")] = { r: "t1", p: 2 };
  wahr(/30 G PROTEIN/.test(A.heuteKarte()), "Protein sichtbar");
});

gruppe("2 · Suche über Zutaten");
t("Eine Zutat findet die Gerichte, in denen sie steckt", () => {
  frisch();
  A.S.eigene = {
    t1: testRezept("t1", [["Zucchini", 200, "g", "og"]], { n: "Sommergemüse" }),
    t2: testRezept("t2", [["Möhren", 200, "g", "og"]], { n: "Wurzelpfanne" })
  };
  A.S.sammlung = { t1: Date.now(), t2: Date.now() };
  A.suche = "zucchini"; A.filter = "alle";
  const html = A.trefferHtml();
  wahr(/Sommergemüse/.test(html), "Treffer über die Zutat");
  wahr(!/Wurzelpfanne/.test(html), "anderes Gericht nicht");
});
t("Treffer im Namen stehen vor Treffern in der Zutat", () => {
  frisch();
  A.S.eigene = {
    t1: testRezept("t1", [["Linsen", 80, "g", "tr"]], { n: "Ofengemüse" }),
    t2: testRezept("t2", [["Möhren", 80, "g", "og"]], { n: "Linsensuppe" })
  };
  A.S.sammlung = { t1: Date.now(), t2: Date.now() };
  A.suche = "linsen";
  const html = A.trefferHtml();
  wahr(html.indexOf("Linsensuppe") < html.indexOf("Ofengemüse"), "Namenstreffer zuerst");
});
t("Bei einem Zutatentreffer wird die Zutat genannt", () => {
  frisch();
  A.S.eigene = { t1: testRezept("t1", [["Rote Linsen", 80, "g", "tr"]], { n: "Ofengemüse" }) };
  A.S.sammlung = { t1: Date.now() };
  A.suche = "linsen";
  wahr(/mit Rote Linsen/.test(A.trefferHtml()), "Zutat als Begründung");
});
t("Die Suche kommt mit Großschreibung und Leerraum zurecht", () => {
  frisch();
  A.S.eigene = { t1: testRezept("t1", [["Zucchini", 200, "g", "og"]], { n: "Auflauf" }) };
  A.S.sammlung = { t1: Date.now() };
  A.suche = "  ZUCCHINI ";
  wahr(/Auflauf/.test(A.trefferHtml()));
});
t("Ein fehlender Suchbegriff bringt die Ansicht nicht zum Absturz", () => {
  frisch();
  A.sucheAendern(undefined);
  wahr(A.trefferHtml().length > 10, "rendert trotzdem");
  A.suche = "";
});

gruppe("3 · Vorratsabfrage auf das Nötige eindampfen");
t("Gefragt wird nur nach dem, was diese Woche vorkommt", () => {
  frisch();
  A.S.eigene = { t1: testRezept("t1", [["Olivenöl", 10, "ml", "gw"]]) };
  A.S.vorrat = {
    olivenoel: { n: "Olivenöl", k: "gw", da: true },
    backpulver: { n: "Backpulver", k: "gw", da: true }
  };
  A.S.plan["w0-0-m"] = { r: "t1", p: 2 };
  const noetig = A.vorratGebraucht();
  wahr(noetig.has(A.slug("Olivenöl")), "Olivenöl wird gebraucht");
  wahr(!noetig.has(A.slug("Backpulver")), "Backpulver nicht");
});
t("Die Abfrage zeigt nur das Nötige und bietet den Rest an", () => {
  frisch();
  A.S.eigene = { t1: testRezept("t1", [["Olivenöl", 10, "ml", "gw"]]) };
  A.S.vorrat = {
    olivenoel: { n: "Olivenöl", k: "gw", da: true },
    backpulver: { n: "Backpulver", k: "gw", da: true }
  };
  A.S.plan["w0-0-m"] = { r: "t1", p: 2 };
  A.vorratFrage();
  const html = elemente.sheet.innerHTML;
  wahr(/Olivenöl/.test(html), "Gebrauchtes gezeigt");
  wahr(!/Backpulver/.test(html), "Unnötiges ausgeblendet");
  wahr(/Restliche 1 auch zeigen/.test(html), "der Rest bleibt erreichbar");
});
t("Ohne Bezug zur Woche wird alles gezeigt", () => {
  frisch();
  A.S.vorrat = { salz: { n: "Salz", k: "gw", da: true } };
  A.vorratFrage();
  wahr(/Salz/.test(elemente.sheet.innerHTML), "nichts fällt unter den Tisch");
});
t("Restetage zählen bei der Vorratsfrage nicht mit", () => {
  frisch();
  A.S.eigene = { t1: testRezept("t1", [["Olivenöl", 10, "ml", "gw"]]) };
  A.S.vorrat = { olivenoel: { n: "Olivenöl", k: "gw", da: true } };
  A.S.plan["w0-0-m"] = { r: "t1", p: 0 };
  gleich(A.vorratGebraucht().size, 0);
});

gruppe("4 · Wofür ist dieser Posten?");
t("Die Liste merkt sich, aus welchen Gerichten ein Posten stammt", () => {
  frisch();
  A.S.eigene = {
    t1: testRezept("t1", [["Möhren", 100, "g", "og"]], { n: "Suppe" }),
    t2: testRezept("t2", [["Möhren", 50, "g", "og"]], { n: "Salat" })
  };
  A.S.plan["w0-0-m"] = { r: "t1", p: 2 };
  A.S.plan["w0-1-a"] = { r: "t2", p: 2 };
  A.listeBauen();
  const posten = Object.values(A.S.liste)[0];
  gleich(posten.fuer.sort(), ["t1", "t2"], "beide Gerichte vermerkt");
});
t("Das Fenster nennt Gerichte und Teilmengen", () => {
  frisch();
  A.S.eigene = { t1: testRezept("t1", [["Möhren", 100, "g", "og"]], { n: "Möhrensuppe" }) };
  A.S.plan["w0-0-m"] = { r: "t1", p: 3 };
  A.listeBauen();
  const id = Object.keys(A.S.liste)[0];
  A.postenWoher(id);
  const html = elemente.sheet.innerHTML;
  wahr(/Möhrensuppe/.test(html), "Gericht genannt");
  wahr(/300 g/.test(html), "Teilmenge berechnet");
});
t("Ein von Hand ergänzter Posten sagt das ehrlich", () => {
  frisch();
  A.S.liste = { x_manuell: { n: "Taschentücher", q: 0, e: "", k: "so", on: false, manuell: true } };
  A.postenWoher("x_manuell");
  wahr(/Von Hand ergänzt/.test(elemente.sheet.innerHTML));
});
t("Ein Posten ohne Herkunft stürzt nicht ab", () => {
  frisch();
  A.S.liste = { x: { n: "Irgendwas", q: 100, e: "g", k: "so", on: false } };
  A.postenWoher("x");
  wahr(elemente.sheet.innerHTML.length > 20, "Fenster erscheint trotzdem");
});

gruppe("5 · Frühstück für alle Tage");
t("Ein Frühstück wird auf die ganze Woche übernommen", () => {
  frisch();
  A.S.eigene = { t1: testRezept("t1", [["Haferflocken", 60, "g", "tr"]], { n: "Porridge" }) };
  A.S.plan["w0-2-f"] = { r: "t1", p: 2 };
  A.fruehstueckUebernehmen();
  for (let d = 0; d < 7; d++) gleich(A.S.plan["w0-" + d + "-f"].r, "t1", "Tag " + d);
});
t("Ohne Frühstück passiert nichts", () => {
  frisch();
  A.fruehstueckUebernehmen();
  gleich(Object.keys(A.S.plan).length, 0);
  wahr(document.getElementById("meldung").innerHTML.includes("zuerst"), "mit Erklärung");
});
t("Mittag und Abend bleiben unangetastet", () => {
  frisch();
  A.S.eigene = {
    t1: testRezept("t1", [["Haferflocken", 60, "g", "tr"]]),
    t2: testRezept("t2", [["Möhren", 100, "g", "og"]])
  };
  A.S.plan["w0-0-f"] = { r: "t1", p: 2 };
  A.S.plan["w0-3-m"] = { r: "t2", p: 4 };
  A.fruehstueckUebernehmen();
  gleich(A.S.plan["w0-3-m"], { r: "t2", p: 4 });
});

gruppe("6 · Nur Gekochtes in den Verlauf");
function wocheFuellen() {
  frisch();
  A.S.eigene = { t1: testRezept("t1", [["Möhren", 100, "g", "og"]]), t2: testRezept("t2", [["Reis", 80, "g", "tr"]]) };
  A.S.plan["w0-0-m"] = { r: "t1", p: 2 };
  A.S.plan["w0-1-a"] = { r: "t2", p: 2 };
}
t("Beim Abschließen wird erst gefragt", () => {
  wocheFuellen();
  A.wocheAbschliessen();
  wahr(/wirklich gekocht/.test(elemente.sheet.innerHTML), "Rückfrage");
  gleich(Object.keys(A.S.plan).length, 2, "noch nichts geleert");
});
t("Angehaktes kommt in den Verlauf, der Plan wird geleert", () => {
  wocheFuellen();
  A.wocheAbschliessen();
  A.wocheAbschliessenJetzt();
  gleich(Object.values(A.S.verlauf).length, 2);
  gleich(Object.keys(A.S.plan).length, 0);
});
t("Abgewähltes bleibt draußen", () => {
  wocheFuellen();
  A.wocheAbschliessen();
  A.abschlussTick("w0-0-m");
  A.wocheAbschliessenJetzt();
  const drin = Object.values(A.S.verlauf).map(v => v.r);
  gleich(drin, ["t2"], "nur das Gekochte");
});
t("Restetage sind von vornherein abgewählt", () => {
  wocheFuellen();
  A.S.plan["w0-1-a"] = { r: "t2", p: 0 };
  A.wocheAbschliessen();
  gleich(A.abschlussAus["w0-1-a"], true);
  A.wocheAbschliessenJetzt();
  gleich(Object.values(A.S.verlauf).map(v => v.r), ["t1"]);
});
t("Alle und Keins wirken auf einen Schlag", () => {
  wocheFuellen();
  A.wocheAbschliessen();
  A.abschlussAlle(false);
  gleich(Object.keys(A.abschlussAus).length, 2, "alles abgewählt");
  A.abschlussAlle(true);
  gleich(Object.keys(A.abschlussAus).length, 0, "alles gewählt");
});
t("Der Verlauf bleibt bei 80 Einträgen gedeckelt", () => {
  wocheFuellen();
  for (let i = 0; i < 120; i++) A.S.verlauf[1000 + i] = { r: "t1", kw: "KW 1" };
  A.wocheAbschliessen();
  A.wocheAbschliessenJetzt();
  wahr(Object.keys(A.S.verlauf).length <= 80, "jetzt " + Object.keys(A.S.verlauf).length);
});

gruppe("7 und 8 · Saison und Liegezeit");
t("Ein Saisongericht wird als solches gekennzeichnet", () => {
  frisch();
  A.S.eigene = { t1: testRezept("t1", [["Kürbis", 300, "g", "og"]], { m: [A.monat()] }) };
  A.detail("t1");
  wahr(/Hat gerade Saison/.test(elemente.sheet.innerHTML));
});
t("Ganzjährige Gerichte bekommen kein Saisonschild", () => {
  frisch();
  A.S.eigene = { t1: testRezept("t1", [["Reis", 80, "g", "tr"]]) };
  A.detail("t1");
  wahr(!/Hat gerade Saison/.test(elemente.sheet.innerHTML));
});
t("Die Karte nennt die Tage seit dem letzten Kochen", () => {
  frisch();
  A.S.eigene = { t1: testRezept("t1", [["Möhren", 100, "g", "og"]], { n: "Möhrensuppe" }) };
  A.S.sammlung = { t1: Date.now() };
  A.S.verlauf = { [Date.now() - 12 * 86400000]: { r: "t1", kw: "KW 30" } };
  wahr(/ZULETZT VOR 12 TAGEN/.test(A.trefferHtml()), "Tage statt Kalenderwoche");
});

gruppe("9 · Was der Vorrat gespart hat");
t("Ausgelassene Zutaten werden gezählt und genannt", () => {
  frisch();
  A.S.eigene = { t1: testRezept("t1", [["Olivenöl", 10, "ml", "gw"], ["Möhren", 100, "g", "og"]]) };
  A.S.vorrat = { olivenoel: { n: "Olivenöl", k: "gw", da: true } };
  A.S.plan["w0-0-m"] = { r: "t1", p: 2 };
  A.listeBauen();
  gleich(A.S.listeInfo.ausVorrat, 1);
  /* Gezählt werden verschiedene Zutaten, nicht ihre Vorkommen in allen Gerichten */
  A.S.eigene.t2 = testRezept("t2", [["Olivenöl", 5, "ml", "gw"]]);
  A.S.plan["w0-1-a"] = { r: "t2", p: 2 };
  A.listeBauen();
  gleich(A.S.listeInfo.ausVorrat, 1, "Olivenöl in zwei Gerichten zählt einmal");
  A.tab = "einkauf"; A.einkaufAnsicht = "woche";
  wahr(/aus dem Vorrat gedeckt/.test(A.vEinkauf()), "Hinweis in der Ansicht");
});
t("Ohne Vorratstreffer erscheint kein Hinweis", () => {
  frisch();
  A.S.eigene = { t1: testRezept("t1", [["Möhren", 100, "g", "og"]]) };
  A.S.plan["w0-0-m"] = { r: "t1", p: 2 };
  A.listeBauen();
  gleich(A.S.listeInfo.ausVorrat, 0);
  A.tab = "einkauf";
  wahr(!/aus dem Vorrat gedeckt/.test(A.vEinkauf()));
});

gruppe("10 · Resteküche");
t("Die Zutatenauswahl enthält Übliches, aber keine Grundzutaten", () => {
  frisch();
  const z = A.resteZutaten();
  wahr(z.length > 10, "genug Auswahl, bekommen " + z.length);
  wahr(!z.some(x => /^salz$/i.test(x)), "kein Salz");
  wahr(!z.some(x => /^olivenöl$/i.test(x)), "kein Olivenöl");
});
t("Gewählte Zutaten finden passende Gerichte", () => {
  frisch();
  A.resteWahl = ["Zucchini"];
  const treffer = A.resteTreffer();
  wahr(treffer.length > 0, "es gibt Treffer");
  wahr(treffer.every(x => x.treffer.length > 0), "jeder Treffer hat eine Begründung");
});
t("Mehr Übereinstimmung steht weiter oben", () => {
  frisch();
  A.S.eigene = {
    beide: testRezept("beide", [["Zucchini", 100, "g", "og"], ["Feta", 50, "g", "kr"]], { n: "Beides" }),
    eins: testRezept("eins", [["Zucchini", 100, "g", "og"]], { n: "Nur eines" })
  };
  A.resteWahl = ["Zucchini", "Feta"];
  const treffer = A.resteTreffer();
  gleich(treffer[0].r.id, "beide", "das mit zwei Treffern zuerst");
});
t("Ohne Auswahl gibt es keine Treffer", () => {
  frisch();
  A.resteWahl = [];
  gleich(A.resteTreffer(), []);
});
t("Das Fenster zeigt die Auswahl und die Gerichte", () => {
  frisch();
  A.resteWahl = ["Zucchini"];
  A.resteKueche();
  const html = elemente.sheet.innerHTML;
  wahr(/Was ist noch da/.test(html), "Überschrift");
  wahr(/von 1/.test(html), "Trefferzahl genannt");
  A.resteWahl = [];
});
t("Eine Zutat ohne Gericht wird ehrlich beschieden", () => {
  frisch();
  A.resteWahl = ["Ananasgurke"];
  A.resteKueche();
  wahr(/kein Gericht/.test(elemente.sheet.innerHTML));
  A.resteWahl = [];
});

gruppe("11 · Einkaufen zu zweit");
t("Hakt die Gegenseite ab, erscheint eine Rückmeldung", () => {
  frisch();
  A.cfg = { db: "https://test.example", hid: "h".repeat(24), leser: "" };
  A.tab = "einkauf";
  A.verbinden();
  const q = letzteQuelle();
  q.feuern("put", { path: "/", data: {} });   /* Firebase schickt zuerst den Gesamtstand */
  q.feuern("put", { path: "/liste/moehren_g", data: { n: "Möhren", q: 200, e: "g", k: "og", on: true } });
  timersLaufen();
  wahr(/abgehakt/.test(document.getElementById("meldung").innerHTML), "Meldung erschienen");
});
t("Mehrere Meldungen werden zu einer zusammengefasst", () => {
  frisch();
  A.cfg = { db: "https://test.example", hid: "h".repeat(24), leser: "" };
  A.tab = "einkauf";
  A.verbinden();
  const q = letzteQuelle();
  q.feuern("put", { path: "/", data: {} });   /* Firebase schickt zuerst den Gesamtstand */
  ["a", "b", "c"].forEach(n => q.feuern("put", { path: "/liste/" + n, data: { n, on: true } }));
  timersLaufen();
  wahr(/3 Posten/.test(document.getElementById("meldung").innerHTML), "zusammengefasst");
});
t("Außerhalb der Einkaufsansicht wird nicht gestört", () => {
  frisch();
  A.cfg = { db: "https://test.example", hid: "h".repeat(24), leser: "" };
  A.tab = "woche";
  A.verbinden();
  const q = letzteQuelle();
  q.feuern("put", { path: "/", data: {} });   /* Firebase schickt zuerst den Gesamtstand */
  q.feuern("put", { path: "/liste/x", data: { n: "Möhren", on: true } });
  timersLaufen();
  gleich(document.getElementById("meldung").innerHTML, "", "keine Meldung");
});
t("Das erste vollständige Ereignis löst keine Meldungsflut aus", () => {
  frisch();
  A.cfg = { db: "https://test.example", hid: "h".repeat(24), leser: "" };
  A.tab = "einkauf";
  A.verbinden();
  const q = letzteQuelle();
  q.feuern("put", { path: "/", data: { liste: { a: { n: "A", on: true }, b: { n: "B", on: true } } } });
  timersLaufen();
  gleich(document.getElementById("meldung").innerHTML, "", "beim ersten Abgleich still");
});

bilanz();
