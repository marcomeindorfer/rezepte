/* Prüfungen zu drei gemeldeten Fehlern:
   – die Art eines Rezepts ließ sich beim Bearbeiten nicht ändern
   – Fleisch und Wurst landeten unter Sonstiges statt an der Theke
   – offline abgehakte Posten verschwanden beim Wiederverbinden */
load("tests/harness.js");

function frisch() {
  A.S = A.leer();
  A.cfg = { db: "", hid: "", leser: "" };
  A.S.plan = {}; A.S.liste = {}; A.S.eigene = {}; A.S.vorrat = {};
  A.queue = [];
  A.nf = null;
}
function verbunden() {
  frisch();
  A.cfg = { db: "https://test.example", hid: "h".repeat(24), leser: "" };
}
const abt = n => A.katFuer(n);

/* ---------------------------------------------------------------- */
gruppe("Abteilung: Fleisch, Wurst und Fisch");

/* Genau der gemeldete Fehler: alles, was nicht „Hähnchen“ oder „Rind“ heißt,
   fiel bis hierher durch und stand am Ende der Liste unter Sonstiges. */
[["Speck"], ["Schinken"], ["Kochschinken"], ["Salami"], ["Bratwurst"],
 ["Wiener Würstchen"], ["Chorizo"], ["Cabanossi"], ["Leberkäse"], ["Leberwurst"],
 ["Kasseler"], ["Gyros"], ["Mett"], ["Frikadellen"], ["Bacon"], ["Pastrami"]
].forEach(([n]) => t("„" + n + "“ gehört an die Theke", () => gleich(abt(n), "ff")));

[["Schweinefilet"], ["Schweinebauch"], ["Schweinelende"], ["Lammkeule"],
 ["Kalbsschnitzel"], ["Entenbrust"], ["Putenbrust"], ["Rindersteak"],
 ["Geschnetzeltes"], ["Hähnchenschenkel"]
].forEach(([n]) => t("„" + n + "“ gehört an die Theke", () => gleich(abt(n), "ff")));

[["Hering"], ["Makrele"], ["Sardellen"], ["Garnelen"], ["Thunfisch"], ["Muscheln"]
].forEach(([n]) => t("„" + n + "“ gehört an die Theke", () => gleich(abt(n), "ff")));

t("Dieselben Wörter entscheiden über Rezeptart und Abteilung", () => {
  /* Zwei getrennte Listen liefen früher auseinander. Was ein Rezept zum
     Fleischgericht macht, muss auch an der Fleischtheke stehen. */
  ["Speck", "Salami", "Bratwurst", "Schweinebauch", "Kasseler", "Gyros"].forEach(n => {
    gleich(A.artAusZutaten([[n, 100, "g", "so"]]), "fleisch", n + " als Rezeptart");
    gleich(abt(n), "ff", n + " als Abteilung");
  });
});

gruppe("Abteilung: was vorher falsch einsortiert wurde");
t("„Schweinebauch“ ist kein Getränk", () => {
  /* „Sch-wein-ebauch“ enthält wein – das reichte für das Getränkeregal */
  ["Schweinebauch", "Schweinefleisch", "Schweinelende"].forEach(n =>
    wahr(abt(n) !== "gt", n + " landete im Getränkeregal"));
});
t("„Zahnpasta“ ist keine Nudel", () => gleich(abt("Zahnpasta"), "so"));
t("Haushalt und Drogerie landen unter Sonstiges", () => {
  ["Klopapier", "Spülmittel", "Waschmittel", "Müllbeutel", "Alufolie",
   "Frischhaltefolie", "Backpapier", "Zahnbürste", "Duschgel", "Katzenfutter"]
    .forEach(n => gleich(abt(n), "so", n));
});
t("Brühe steht bei den Gewürzen, nicht an der Theke", () => {
  ["Gemüsebrühe", "Hühnerbrühe", "Rinderbrühe", "Brühwürfel"].forEach(n =>
    gleich(abt(n), "gw", n));
});
t("Pflanzendrinks stehen im Regal, nicht im Kühlregal", () => {
  ["Hafermilch", "Mandelmilch", "Sojamilch", "Kokosmilch"].forEach(n =>
    gleich(abt(n), "tr", n));
});
t("Fleischersatz steht im Kühlregal", () => {
  ["Tofu", "Seitan", "Tempeh", "Sojaschnetzel", "Halloumi"].forEach(n =>
    gleich(abt(n), "kr", n));
});
t("Kaffee und Tee stehen bei den Getränken", () => {
  ["Kaffee", "Tee", "Espresso"].forEach(n => gleich(abt(n), "gt", n));
});
t("Tiefkühl schlägt das Frischregal", () => {
  ["TK-Erbsen", "Tiefkühlspinat", "Fischstäbchen"].forEach(n => gleich(abt(n), "tk", n));
});
t("Wörter im Wortinneren lösen nichts aus", () => {
  /* Fallen, die beim Bauen der Listen aufgefallen sind */
  wahr(abt("Studentenfutter") !== "ff", "Studentenfutter ist keine Ente");
  wahr(abt("Flammkuchen") !== "ff", "Flammkuchen ist kein Lamm");
  wahr(abt("Tamarindenpaste") !== "ff", "Tamarinde ist kein Rind");
});

/* ---------------------------------------------------------------- */
gruppe("Art eines Rezepts von Hand festlegen");

/* Die Formularfelder liegen im DOM – im Test werden sie direkt gefüllt */
function felderFuellen(name, zText) {
  imScope('document.getElementById("nfn").value=' + JSON.stringify(name) + ';' +
          'document.getElementById("nfq").value="";' +
          'document.getElementById("nfz").value=' + JSON.stringify(zText) + ';' +
          'document.getElementById("nfs").value="";' +
          'document.getElementById("nfmin").value="20";' +
          'document.getElementById("nfp").value="25";');
}

t("Ohne eigene Wahl berichtigt die Automatik weiterhin", () => {
  frisch();
  A.S.eigene.r1 = { id: "r1", n: "Bolognese", k: "veg", ma: ["a"], min: 20, p: 25,
    z: [["Hackfleisch", 200, "g", "ff"]], s: [] };
  gleich(A.R("r1").k, "fleisch", "Hackfleisch macht das Gericht zum Fleischgericht");
});

t("Eine angetippte Art überlebt das Speichern", () => {
  frisch();
  A.S.eigene.r1 = { id: "r1", n: "Soja-Bolognese", k: "veg", ma: ["a"], min: 20, p: 25,
    z: [["Veganes Hack", 200, "g", "kr"]], s: [] };
  A.rezeptBearbeiten("r1");
  felderFuellen("Soja-Bolognese", "200 g Veganes Hack");
  A.nfSet("k", "veg");
  A.nfSpeichern();
  gleich(A.S.eigene.r1.k, "veg", "gespeichert");
  gleich(A.R("r1").k, "veg", "und auch wieder gelesen");
});

t("Die Festlegung bleibt beim erneuten Bearbeiten stehen", () => {
  frisch();
  A.S.eigene.r1 = { id: "r1", n: "Soja-Bolognese", k: "veg", kFest: true, ma: ["a"],
    min: 20, p: 25, z: [["Veganes Hack", 200, "g", "kr"]], s: [] };
  A.rezeptBearbeiten("r1");
  gleich(A.nf.k, "veg");
  wahr(A.nf.kFest === true, "Formular kennt die Festlegung");
  felderFuellen("Soja-Bolognese", "200 g Veganes Hack");
  A.nfSpeichern();
  gleich(A.R("r1").k, "veg");
});

t("Auch von Fleisch auf Fisch lässt sich umstellen", () => {
  frisch();
  A.S.eigene.r1 = { id: "r1", n: "Pfanne", k: "fleisch", ma: ["a"], min: 20, p: 25,
    z: [["Räuchertofu", 200, "g", "kr"]], s: [] };
  A.rezeptBearbeiten("r1");
  felderFuellen("Pfanne", "200 g Räuchertofu");
  A.nfSet("k", "fisch");
  A.nfSpeichern();
  gleich(A.R("r1").k, "fisch");
});

t("Das Formular sagt, wenn Wahl und Zutaten auseinandergehen", () => {
  frisch();
  A.S.eigene.r1 = { id: "r1", n: "Soja-Bolognese", k: "veg", kFest: true, ma: ["a"],
    min: 20, p: 25, z: [["Veganes Hack", 200, "g", "kr"]], s: [] };
  A.rezeptBearbeiten("r1");
  const html = document.getElementById("sheet").innerHTML;
  wahr(/sprechen eher für/.test(html), "Hinweis fehlt");
  wahr(/deine Wahl gilt trotzdem/.test(html), "Der Hinweis muss klarstellen, wer gewinnt");
});

/* ---------------------------------------------------------------- */
gruppe("Abgleich: offline Abgehaktes geht nicht verloren");

t("Ein eintreffender Fernstand überschreibt Wartendes nicht", () => {
  verbunden();
  A.S.liste = { brot_stk: { n: "Brot", q: 1, e: "Stk", k: "bw", on: false } };
  netz.failing = true;
  A.posten("brot_stk", true);
  wahr(A.queue.length === 1, "die Änderung wartet");
  /* Der alte Fernstand trifft beim Wiederverbinden ein */
  A.zusammenfuehren({ liste: { brot_stk: { n: "Brot", q: 1, e: "Stk", k: "bw", on: false } } });
  gleich(A.S.liste.brot_stk.on, true, "Haken ist noch da");
});

t("Ein ganzer Einkauf offline überlebt das Wiederverbinden", () => {
  verbunden();
  const fern = {};
  A.S.liste = {};
  for (let i = 0; i < 12; i++) {
    const id = "p" + i;
    A.S.liste[id] = { n: "Posten " + i, q: 1, e: "Stk", k: "og", on: false };
    fern[id] = { n: "Posten " + i, q: 1, e: "Stk", k: "og", on: false };
  }
  netz.failing = true;
  Object.keys(A.S.liste).forEach(id => A.posten(id, true));
  A.zusammenfuehren({ liste: fern });
  const offen = Object.values(A.S.liste).filter(i => !i.on).length;
  gleich(offen, 0, "kein Posten ist wieder offen");
});

t("Auch der Laufplan und die Einstellungen bleiben", () => {
  verbunden();
  netz.failing = true;
  A.mut("route", ["so", "og", "bw", "kr", "ff", "tk", "tr", "gw", "gt"], false);
  A.mut("portionStd", 4, false);
  A.zusammenfuehren({ route: [...A.ABT_STD], portionStd: 2 });
  gleich(A.S.route[0], "so", "eigene Reihenfolge");
  gleich(A.S.portionStd, 4, "eigene Standardportion");
});

t("Der Fernstand gewinnt, wo nichts Eigenes wartet", () => {
  verbunden();
  A.S.liste = { brot_stk: { n: "Brot", q: 1, e: "Stk", k: "bw", on: false } };
  A.queue = [];
  A.zusammenfuehren({ liste: { brot_stk: { n: "Brot", q: 1, e: "Stk", k: "bw", on: true } } });
  gleich(A.S.liste.brot_stk.on, true, "die andere Person hat abgehakt");
});

t("Posten in Liste und Plan tragen einen Zeitstempel", () => {
  verbunden();
  A.S.liste = { brot_stk: { n: "Brot", q: 1, e: "Stk", k: "bw", on: false } };
  A.posten("brot_stk", true);
  wahr(A.S.liste.brot_stk.ts > 0, "Liste");
  A.mut("plan/w0-1-a", { r: "b1", p: 2 }, false);
  wahr(A.S.plan["w0-1-a"].ts > 0, "Plan");
});

t("Bei echtem Streit gewinnt der jüngere Stand", () => {
  verbunden();
  A.queue = [];
  A.S.liste = { brot_stk: { n: "Brot", q: 1, e: "Stk", k: "bw", on: true, ts: 5000 } };
  A.zusammenfuehren({ liste: { brot_stk: { n: "Brot", q: 1, e: "Stk", k: "bw", on: false, ts: 1000 } } });
  gleich(A.S.liste.brot_stk.on, true, "der eigene, jüngere Stand");
  A.queue = [];
  A.S.liste = { brot_stk: { n: "Brot", q: 1, e: "Stk", k: "bw", on: true, ts: 1000 } };
  A.zusammenfuehren({ liste: { brot_stk: { n: "Brot", q: 1, e: "Stk", k: "bw", on: false, ts: 5000 } } });
  gleich(A.S.liste.brot_stk.on, false, "der fremde, jüngere Stand");
});

/* ---------------------------------------------------------------- */
gruppe("Aufgeräumte Oberfläche");

const QUELLE = (() => {
  let t = "";
  try { t = readFile("index.html"); } catch (e) { t = read("index.html"); }
  return t;
})();

t("Blätter messen die wirklich sichtbare Höhe", () => {
  const regel = (QUELLE.match(/\.sheet-in\{[^}]*\}/) || [""])[0];
  wahr(/max-height:\s*\d+vh/.test(regel), "vh als Rückfall für ältere Browser");
  wahr(/max-height:\s*\d+dvh/.test(regel), "dvh, sonst liegt der Schließen-Knopf unter der Browserleiste");
});
t("Ein Wisch im Blatt schiebt die Seite dahinter nicht weiter", () => {
  const regel = (QUELLE.match(/\.sheet-in\{[^}]*\}/) || [""])[0];
  wahr(/overscroll-behavior:\s*contain/.test(regel), "overscroll-behavior fehlt");
});

function knoepfeIn(html) {
  return (html.match(/<button/g) || []).length;
}
t("Die Einkaufsansicht kommt mit wenigen Knöpfen aus", () => {
  frisch();
  A.S.liste = { a_stk: { n: "Brot", q: 1, e: "Stk", k: "bw", on: false } };
  A.einkaufAnsicht = "woche"; A.routeOffen = false; A.erledigtWeg = false;
  const html = A.vEinkauf();
  /* Alles außerhalb des Laufplans: Reiter, die zwei Schalter und Hinzufügen */
  const ohneRoute = html.split('<div class="route">')[0];
  wahr(knoepfeIn(ohneRoute) <= 5, "zu viele Knöpfe über der Liste: " + knoepfeIn(ohneRoute));
  wahr(/Weiteres/.test(html), "das Seltene liegt hinter einem Knopf");
});
t("Der Mehr-Bereich ist eine kurze Übersicht", () => {
  frisch();
  const html = A.vMehr();
  wahr(!/console\.firebase\.google\.com/.test(html), "Die Firebase-Anleitung gehört ins Blatt, nicht auf die Seite");
  wahr(!/rezeptleser/i.test(html), "Auch das Leser-Feld liegt im Blatt");
  wahr(knoepfeIn(html) <= 12, "zu viele Knöpfe: " + knoepfeIn(html));
  ["Vorrat", "Angebote", "Rezeptquellen", "Eigene Rezepte", "Archiv", "Abgleich"]
    .forEach(n => wahr(html.includes(">" + n + "<"), n + " fehlt in der Übersicht"));
});
t("Jede Zeile im Mehr-Bereich führt zu einem Blatt, das sich öffnen lässt", () => {
  ["vorrat", "angebote", "eigene", "archiv", "sync"].forEach(name => {
    frisch();
    A.mehrOeffnen(name);
    const html = document.getElementById("sheet").innerHTML;
    wahr(html.length > 60, name + " bleibt leer");
    wahr(/Schließen/.test(html), name + " hat keinen Ausgang");
  });
});
t("Nichts fragt mehr über einen Browserdialog nach Text", () => {
  /* prompt() blockiert die ganze Seite und sieht in einer installierten App
     aus wie eine Fremdmeldung – gefragt wird in einem Blatt. */
  const ohneKommentare = QUELLE.replace(/\/\*[\s\S]*?\*\//g, " ");
  wahr(!/[^a-zA-Z.]prompt\s*\(/.test(ohneKommentare), "prompt() steht noch im Code");
});
t("Rückmeldungen liegen über den Blättern", () => {
  const meld = (QUELLE.match(/#meldung\{[^}]*\}/) || [""])[0];
  const blatt = (QUELLE.match(/\.sheet\{[^}]*\}/) || [""])[0];
  const z = t => +((t.match(/z-index:\s*(\d+)/) || [])[1] || 0);
  wahr(z(meld) > z(blatt), "Meldung (" + z(meld) + ") liegt unter dem Blatt (" + z(blatt) + ")");
});
t("Eine leere Eingabe im Listen-Blatt bleibt nicht stumm", () => {
  frisch();
  A.zusatzAnlegen();
  document.getElementById("ln").value = "";
  A.zusatzAnlegenJetzt();
  gleich(Object.keys(A.S.listen || {}).length, 0, "keine namenlose Liste");
  wahr(/braucht einen Namen/.test(document.getElementById("meldung").innerHTML),
    "keine Rückmeldung gegeben");
  A.zusatzAnlegen();
  document.getElementById("ln").value = "dm";
  A.zusatzAnlegenJetzt();
  gleich(Object.values(A.S.listen).map(l => l.n), ["dm"]);
});
t("Kein Posten verschwindet lautlos aus dem Laufplan", () => {
  frisch();
  /* Ein eingespieltes Rezept kann eine Abteilung mitbringen, die es nicht gibt.
     Vorher fiel der Posten aus der Ansicht, wurde aber weiter mitgezählt –
     die Liste ließ sich dann nie abschließen. */
  A.S.liste = {
    a_g: { n: "Mehl", q: 500, e: "g", k: "gibtsnicht", on: false },
    b_stk: { n: "Brot", q: 1, e: "Stk", k: "bw", on: false }
  };
  const html = A.vEinkauf();
  wahr(/Mehl/.test(html), "Der Posten mit unbekannter Abteilung fehlt");
  wahr(/Brot/.test(html), "Der normale Posten fehlt");
  wahr(/von 2 erledigt/.test(html), "Zähler passt nicht zur Anzeige");
});
t("Ein lückenhafter Laufplan wird beim Start ergänzt", () => {
  frisch();
  A.S.route = ["og", "bw"];
  A.migrieren();
  A.ABT_STD.forEach(k => wahr(A.S.route.includes(k), k + " fehlt im Laufplan"));
  A.S.route = ["og", "quatsch", "bw"];
  A.migrieren();
  wahr(!A.S.route.includes("quatsch"), "Unbekanntes bleibt im Laufplan stehen");
});
t("Änderungen im Vorratsblatt lassen es offen", () => {
  frisch();
  A.S.vorrat = { milch: { n: "Milch", k: "kr", da: true } };
  A.mehrOeffnen("vorrat");
  A.vorratSetzen("milch", false);
  gleich(A.S.vorrat.milch.da, false, "Änderung ist angekommen");
  wahr(/Vorrat/.test(document.getElementById("sheet").innerHTML), "Blatt ist noch offen");
});

bilanz();
