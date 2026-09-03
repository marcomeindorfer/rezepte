/* Was 4.1 aufgeräumt hat: Rezepte unterscheiden nicht mehr zwischen Mittag und
   Abend, das Formular fragt nicht mehr danach, der Foto-Weg ist raus, und die
   Rezeptliste ist nach Art gruppiert. */
load("tests/harness.js");

function frisch() {
  A.S = A.leer();
  A.cfg = { db: "", hid: "", leser: "" };
  A.queue = []; A.planWoche = 0; A.filter = "alle"; A.suche = "";
  A.S.eigene = {}; A.S.plan = {};
  Object.keys(elemente).forEach(k => delete elemente[k]);
}

gruppe("Mittag und Abend sind eine Hauptspeise");
t("Die Art des Gerichts bestimmt die Mahlzeit", () => {
  gleich(A.mahlzeitenZu("fruehstueck"), ["f"]);
  gleich(A.mahlzeitenZu("haupt"), ["m", "a"]);
  gleich(A.mahlzeitenZu("snack"), []);
  gleich(A.mahlzeitenZu("dessert"), []);
});
t("Alte Rezepte gelten rückwirkend für beides", () => {
  gleich(A.mahlzeitenNorm(["m"]), ["m", "a"], "„nur mittags“ passt jetzt auch abends");
  gleich(A.mahlzeitenNorm(["a"]), ["m", "a"]);
  gleich(A.mahlzeitenNorm(["m", "a"]), ["m", "a"]);
  gleich(A.mahlzeitenNorm(["f"]), ["f"], "Frühstück bleibt Frühstück");
  gleich(A.mahlzeitenNorm([]), []);
  gleich(A.mahlzeitenNorm(["x"]), [], "Unsinn zählt nicht");
});
t("Ein mitgeliefertes Mittagsrezept lässt sich abends einplanen", () => {
  frisch();
  const mittags = A.REZEPTE.find(r => r.ma.length === 1 && r.ma[0] === "m");
  wahr(mittags, "kein Rezept mit alter Einteilung gefunden");
  wahr(A.passtZuMahlzeit(mittags, "a"), mittags.n + " sollte abends passen");
  wahr(A.passtZuMahlzeit(mittags, "m"));
  wahr(!A.passtZuMahlzeit(mittags, "f"), "eine Hauptspeise ist kein Frühstück");
});
t("Ein Frühstück bleibt beim Frühstück", () => {
  frisch();
  const morgens = A.REZEPTE.find(r => A.typVon(r) === "fruehstueck");
  wahr(A.passtZuMahlzeit(morgens, "f"));
  wahr(!A.passtZuMahlzeit(morgens, "m"), morgens.n + " gehört nicht auf den Mittagsplatz");
});
t("Der Wochenplan hat weiterhin drei Felder je Tag", () => {
  frisch();
  gleich(A.slots().length, 21, "Frühstück, Mittag und Abend bleiben getrennte Plätze");
  gleich(A.MAHL.m, "Mittag"); gleich(A.MAHL.a, "Abend");
});
t("Ein selbst angelegtes Rezept bekommt die Mahlzeit aus seiner Art", () => {
  frisch();
  A.neuesRezept();
  document.getElementById("nfn").value = "Testgericht";
  document.getElementById("nfz").value = "200 g Möhren";
  A.nfSet("typ", "haupt");
  document.getElementById("nfn").value = "Testgericht";
  A.nfSpeichern();
  const r = Object.values(A.S.eigene)[0];
  gleich(r.ma, ["m", "a"]);
});

gruppe("Das Formular ist kürzer geworden");
t("Es fragt nicht mehr, zu welcher Mahlzeit ein Rezept passt", () => {
  frisch();
  A.neuesRezept();
  const html = elemente.sheet.innerHTML;
  wahr(html.indexOf("Passt zu") < 0, "die Frage steht noch im Formular");
  wahr(html.indexOf("Was ist das?") >= 0, "die Art muss weiter wählbar sein");
});
t("Foto aufnehmen und Bild auswählen sind verschwunden", () => {
  frisch();
  A.neuesRezept();
  const html = elemente.sheet.innerHTML;
  ["Foto aufnehmen", "Bild auswählen"].forEach(x =>
    wahr(html.indexOf(x) < 0, "„" + x + "“ steht noch im Formular"));
  wahr(html.indexOf("Text einwerfen") >= 0, "der Textweg muss bleiben");
});
t("Von der Texterkennung ist nichts übrig geblieben", () => {
  const html = read("index.html");
  ["tesseract", "fotoLesen", "fotowahl", "fotokamera", "bildEbnen", "seitenAusschnitt"]
    .forEach(x => wahr(html.indexOf(x) < 0, "„" + x + "“ steht noch in der Datei"));
});

gruppe("Die Rezeptliste ist nach Art geordnet");
t("Die Filterleiste kennt Mittag und Abend nicht mehr", () => {
  frisch();
  const chips = A.chipsHtml();
  wahr(chips.indexOf(">Mittag<") < 0, "„Mittag“ steht noch in der Leiste");
  wahr(chips.indexOf(">Abend<") < 0, "„Abend“ steht noch in der Leiste");
  wahr(chips.indexOf(">Hauptspeisen<") >= 0, "„Hauptspeisen“ fehlt");
  wahr(chips.indexOf(">Frühstück<") >= 0, "„Frühstück“ fehlt");
});
t("Die Treffer tragen Überschriften mit Anzahl", () => {
  frisch();
  A.filter = "alles";
  const html = A.trefferHtml();
  ["Frühstück", "Hauptspeisen", "Snacks", "Desserts"].forEach(x =>
    wahr(html.indexOf("<h2>" + x + "</h2>") >= 0, "Überschrift „" + x + "“ fehlt"));
  wahr(/<span class="zahl">\d+<\/span>/.test(html), "die Anzahl fehlt");
});
t("Wer schon auf eine Art filtert, braucht keine Überschrift", () => {
  frisch();
  /* „Meine Rezepte“ zeigt die eigene Sammlung – also erst eines hineinlegen */
  const suess = A.RZ().find(r => A.typVon(r) === "dessert");
  wahr(suess, "kein Dessert im Bestand");
  A.S.sammlung[suess.id] = Date.now();
  A.filter = "dessert";
  const html = A.trefferHtml();
  wahr(html.indexOf("rec-t") >= 0, "es sollten Rezepte kommen");
  wahr(html.indexOf("<h2>Desserts</h2>") < 0, "die Überschrift wiederholt nur den Filter");
});
t("Jedes Rezept steht genau einmal in der Liste", () => {
  frisch();
  A.filter = "alles";
  const html = A.trefferHtml();
  const alle = A.RZ().filter(r => !A.S.archiv[r.id]);
  gleich((html.match(/class="rec /g) || []).length, alle.length,
    "gruppiert dürfen nicht mehr oder weniger Karten herauskommen");
});
t("Die Suche findet weiterhin über alle Gruppen hinweg", () => {
  frisch();
  A.filter = "alles"; A.suche = "möhren";
  const html = A.trefferHtml();
  wahr(html.indexOf("Möhren") >= 0 || html.indexOf("öhren") >= 0, "nichts gefunden");
  A.suche = "";
});

t("Unter der Überschrift wiederholt keine Karte die Art", () => {
  frisch();
  A.filter = "alles";
  const gruppiert = A.trefferHtml();
  wahr(gruppiert.indexOf("<h2>Frühstück</h2>") >= 0, "keine Gruppierung");
  wahr(gruppiert.indexOf(">Frühstück · ") < 0, "die Karten wiederholen die Überschrift");
  wahr(/rec-m">\d+ Min/.test(gruppiert), "die Dauer muss stehen bleiben");
});
t("Ohne Gruppierung nennt die Karte die Art weiterhin", () => {
  frisch();
  const suess = A.RZ().find(r => A.typVon(r) === "dessert");
  A.S.sammlung[suess.id] = Date.now();
  A.filter = "dessert";
  wahr(A.trefferHtml().indexOf("Dessert · ") >= 0, "sonst weiß man nicht, was man sieht");
});

bilanz();
