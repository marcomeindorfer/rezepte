/* Rezepte übernehmen: Zutatenparser, Abteilungserkennung, Portionsumrechnung,
   Import/Export und die Datumslogik der Prospekte. */
load("tests/harness.js");

function frisch() {
  A.S = A.leer(); A.cfg = { db: "", hid: "", leser: "" }; A.queue = [];
  A.S.angebote = {}; A.planWoche = 0;
}

gruppe("Zutatenzeilen lesen");
const zeile = z => A.parseZutat(z);
t("Menge, Einheit und Name werden getrennt", () => {
  gleich(zeile("200 g Möhren").slice(0, 3), ["Möhren", 200, "g"]);
  gleich(zeile("1 Dose Kichererbsen").slice(0, 3), ["Kichererbsen", 1, "Dose"]);
  gleich(zeile("1,5 EL Olivenöl").slice(0, 3), ["Olivenöl", 1.5, "EL"]);
});
t("Menge ohne Leerzeichen wird erkannt", () => {
  gleich(zeile("200g Mehl").slice(0, 3), ["Mehl", 200, "g"]);
});
t("Aufzählungszeichen werden entfernt", () => {
  gleich(zeile("- 100 ml Milch").slice(0, 3), ["Milch", 100, "ml"]);
  gleich(zeile("• 2 Zehen Knoblauch").slice(0, 3), ["Knoblauch", 2, "Zehe"]);
});
t("Zutaten ohne Menge bleiben mengenlos", () => {
  gleich(zeile("Salz").slice(0, 3), ["Salz", 0, ""]);
});
t("Zahl ohne Einheit meint Stück", () => {
  gleich(zeile("2 Zwiebeln").slice(0, 3), ["Zwiebeln", 2, "Stk"]);
});
t("Bruchzeichen werden verstanden", () => {
  gleich(zeile("½ TL Zimt").slice(0, 3), ["Zimt", 0.5, "TL"]);
  gleich(zeile("¼ Bund Petersilie").slice(0, 3), ["Petersilie", 0.25, "Bund"]);
});
t("Gemischte Brüche werden verstanden", () => {
  gleich(zeile("1 ½ EL Öl").slice(0, 3), ["Öl", 1.5, "EL"]);
});
t("Brüche mit Schrägstrich werden verstanden", () => {
  gleich(zeile("1/2 TL Salz").slice(0, 3), ["Salz", 0.5, "TL"]);
  gleich(zeile("1 1/2 EL Senf").slice(0, 3), ["Senf", 1.5, "EL"]);
});
t("Mengenangaben von bis nehmen den unteren Wert", () => {
  const z = zeile("1-2 EL Öl");
  gleich(z[0], "Öl", "Name sauber");
  wahr(z[1] >= 1 && z[1] <= 2, "Menge " + z[1] + " liegt im Bereich");
  gleich(z[2], "EL");
});
t("Leere Zeilen fallen weg", () => {
  gleich(A.parseZutaten("200 g Möhren\n\n   \n1 Zwiebel").length, 2);
});
t("Zubereitungsschritte verlieren ihre Nummerierung", () => {
  gleich(A.parseSchritte("1. Schnippeln\n2) Kochen\n\nServieren"), ["Schnippeln", "Kochen", "Servieren"]);
});

gruppe("Abteilung erraten");
t("Bekannte Zutaten landen in der richtigen Abteilung", () => {
  const proben = [["Möhren", "og"], ["Zwiebel", "og"], ["Milch", "kr"], ["Naturjoghurt", "kr"],
    ["Haferflocken", "tr"], ["Olivenöl", "gw"], ["Lachsfilet", "ff"]];
  const falsch = proben.filter(([n, soll]) => A.katFuer(n) !== soll).map(([n, soll]) => n + " → " + A.katFuer(n) + " statt " + soll);
  gleich(falsch, []);
});
t("Unbekanntes landet unter Sonstiges statt zu scheitern", () => {
  gleich(A.katFuer("Zauberpulver XY"), "so");
});
t("Mehrzahl und Einzahl treffen dieselbe Abteilung", () => {
  gleich(A.katFuer("Möhre"), A.katFuer("Möhren"));
});

gruppe("Prospekte und Zeiträume");
const iso = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
t("Die Wochenspanne läuft von Montag bis Sonntag", () => {
  const [mo, so] = A.wochenSpanne(0);
  const dMo = new Date(mo + "T12:00:00"), dSo = new Date(so + "T12:00:00");
  gleich(dMo.getDay(), 1, "Montag");
  gleich(dSo.getDay(), 0, "Sonntag");
  gleich(Math.round((dSo - dMo) / 86400000), 6, "sechs Tage Abstand");
});
t("Die Spanne der Folgewochen liegt genau eine Woche später", () => {
  const [mo0] = A.wochenSpanne(0), [mo1] = A.wochenSpanne(1), [mo2] = A.wochenSpanne(2);
  gleich(Math.round((new Date(mo1 + "T12:00:00") - new Date(mo0 + "T12:00:00")) / 86400000), 7);
  gleich(Math.round((new Date(mo2 + "T12:00:00") - new Date(mo1 + "T12:00:00")) / 86400000), 7);
});
t("Heute liegt in der Spanne der laufenden Woche", () => {
  const [mo, so] = A.wochenSpanne(0);
  const heute = iso(new Date());
  wahr(heute >= mo && heute <= so, heute + " nicht zwischen " + mo + " und " + so);
});
t("Ein Prospekt gilt bei Überschneidung", () => {
  wahr(A.deckt({ von: "2026-08-10", bis: "2026-08-16" }, "2026-08-10", "2026-08-16"), "deckungsgleich");
  wahr(A.deckt({ von: "2026-08-14", bis: "2026-08-20" }, "2026-08-10", "2026-08-16"), "teilweise");
  wahr(!A.deckt({ von: "2026-08-17", bis: "2026-08-23" }, "2026-08-10", "2026-08-16"), "danach");
  wahr(!A.deckt({ von: "2026-08-01", bis: "2026-08-07" }, "2026-08-10", "2026-08-16"), "davor");
});
t("Jede Woche sieht nur ihren eigenen Prospekt", () => {
  frisch();
  const [mo0, so0] = A.wochenSpanne(0), [mo1, so1] = A.wochenSpanne(1);
  A.S.angebote = {
    p0: { von: mo0, bis: so0, items: ["Möhren"], quelle: "diese Woche", geholt: 1 },
    p1: { von: mo1, bis: so1, items: ["Lauch"], quelle: "nächste Woche", geholt: 1 }
  };
  gleich(A.angeboteFuerWoche(0), ["Möhren"]);
  gleich(A.angeboteFuerWoche(1), ["Lauch"]);
});
t("Ohne passenden Prospekt wird nichts hervorgehoben", () => {
  frisch();
  A.S.angebote = { p9: { von: "2020-01-01", bis: "2020-01-07", items: ["Möhren"], quelle: "alt", geholt: 1 } };
  gleich(A.angeboteAktiv(0), [], "lieber nichts als Falsches");
});

gruppe("Rezepte übernehmen");
function einspielen(text) {
  meldungen.alert.length = 0;
  elemente.imp = neuesElement("textarea");
  elemente.imp.value = text;
  A.importAusfuehren();
}
t("Ein übernommenes Rezept wird auf eine Portion heruntergerechnet", () => {
  frisch();
  A.nf = { ...A.nf, zText: "400 g Möhren\n2 Zwiebeln\nSalz", port: 4 };
  A.aufEinePortionStill();
  const z = A.parseZutaten(A.nf.zText);
  gleich(z[0].slice(0, 3), ["Möhren", 100, "g"]);
  gleich(z[1].slice(0, 3), ["Zwiebeln", 0.5, "Stk"]);
  gleich(z[2][0], "Salz", "Zutat ohne Menge bleibt unverändert");
  gleich(A.nf.port, 1);
});
t("Backwerk wird nicht heruntergerechnet", () => {
  wahr(A.BACKWERK.test("Apfelkuchen"), "Kuchen erkannt");
  wahr(A.BACKWERK.test("Gemüseauflauf"), "Auflauf erkannt");
  wahr(!A.BACKWERK.test("Linsensuppe"), "Suppe nicht");
});
t("Import und Export beschreiben dieselben Rezepte", () => {
  frisch();
  const rezept = { id: "e1", n: "Testgericht", k: "veg", typ: "haupt", ma: ["m"], m: A.ALL,
    min: 20, p: 20, bl: 0, nut: [], why: "Test.", z: [["Möhren", 100, "g", "og"]], s: ["Kochen."], src: "eigen" };
  einspielen(JSON.stringify([rezept]));
  const raus = Object.values(A.S.eigene);
  gleich(raus.length, 1);
  gleich(raus[0].n, "Testgericht");
  gleich(raus[0].z[0], ["Möhren", 100, "g", "og"]);
  wahr(A.S.sammlung.e1, "landet auch in der Sammlung");
});
t("Kaputte Importdaten werden abgewiesen statt eingelesen", () => {
  frisch();
  einspielen("{kein json");
  gleich(Object.keys(A.S.eigene).length, 0);
  wahr(meldungen.alert.length > 0, "der Nutzer wird informiert");
});
t("Etwas anderes als eine Liste wird abgewiesen", () => {
  frisch();
  einspielen('{"n":"Einzelrezept"}');
  gleich(Object.keys(A.S.eigene).length, 0);
  wahr(meldungen.alert.length > 0, "mit Erklärung");
});
t("Ein Rezept ohne Namen wird übersprungen", () => {
  frisch();
  einspielen(JSON.stringify([{ id: "x", z: [], s: [] }, { n: "Mit Namen" }]));
  gleich(Object.keys(A.S.eigene).length, 1);
});
t("Zutaten als Text werden beim Einspielen zerlegt", () => {
  frisch();
  einspielen(JSON.stringify([{ n: "Textzutaten", z: ["200 g Möhren", "½ TL Salz"] }]));
  const r = Object.values(A.S.eigene)[0];
  gleich(r.z[0].slice(0, 3), ["Möhren", 200, "g"]);
  gleich(r.z[1].slice(0, 3), ["Salz", 0.5, "TL"]);
});
t("Eingespielte Rezepte sind vollständig und anzeigbar", () => {
  frisch();
  einspielen(JSON.stringify([{ n: "Halbfertig" }]));
  const r = A.rezeptNorm(Object.values(A.S.eigene)[0]);
  wahr(Array.isArray(r.z) && Array.isArray(r.s) && Array.isArray(r.ma) && Array.isArray(r.m), "alle Listen vorhanden");
  wahr(r.min > 0 && r.p > 0, "Zeit und Protein gesetzt");
});

gruppe("Beilagenvielfalt");
t("Beilagen werden richtig zugeordnet", () => {
  const probe = (zutaten) => A.khVon({ id: "probe" + Math.random(), src: "eigen", z: zutaten });
  gleich(probe([["Spaghetti", 100, "g", "tr"]]), "nudeln");
  gleich(probe([["Reis", 80, "g", "tr"]]), "reis");
  gleich(probe([["Kartoffeln", 300, "g", "og"]]), "kartoffeln");
  gleich(probe([["Rote Linsen", 80, "g", "tr"]]), "huelsen");
  gleich(probe([["Vollkornbrot", 2, "Scheibe", "bw"]]), "brot");
  gleich(probe([["Zucchini", 200, "g", "og"]]), "ohne");
});
t("Dal mit Reis zählt als Reis, nicht als Hülsenfrucht", () => {
  gleich(A.khVon({ id: "p1", src: "eigen", z: [["Reis", 80, "g", "tr"], ["Rote Linsen", 60, "g", "tr"]] }), "reis");
});

bilanz();
