/* Die zwölf Verbesserungen aus dem Umbau. */
load("tests/harness.js");

function frisch() {
  A.S = A.leer();
  A.cfg = { db: "", hid: "", name: "" };
  A.queue = []; A.tab = "heute"; A.katFilter = "alle"; A.aufSuche = "";
  /* Attrappen-Elemente überleben sonst den Testwechsel: ein Titelfeld aus dem
     vorigen Test hätte hier noch seinen alten Wert. */
  Object.keys(elemente).forEach(k => delete elemente[k]);
  document.getElementById("sheet").innerHTML = "";
  meldungen.alert.length = 0;
  netz.calls = [];
}
const tagVor = n => A.iso(new Date(Date.now() - n * 86400000));
const tagNach = n => A.iso(new Date(Date.now() + n * 86400000));
const anlegen = (t, felder) => {
  const id = A.aufgabeAnlegen(t);
  Object.assign(A.S.aufgaben[id], felder || {});
  return id;
};

gruppe("1 · Heute und Morgen direkt auf der Zeile");
t("Gesammelte Aufgaben zeigen die Schnellknöpfe", () => {
  frisch();
  const id = anlegen("Aus dem Vorrat", { kat: "k_geb", wann: null });
  A.tab = "listen"; A.render();
  const html = document.getElementById("view").innerHTML;
  wahr(html.includes("verschieben('" + id + "','" + A.heute() + "')"), "Heute-Knopf vorhanden");
  wahr(html.includes("verschieben('" + id + "','" + A.morgen() + "')"), "Morgen-Knopf vorhanden");
});
t("Der Knopf für den aktuellen Termin wird weggelassen", () => {
  frisch();
  const id = anlegen("Schon für heute", { wann: A.heute() });
  const zeile = A.aufZeile({ id, ...A.S.aufgaben[id] }, { schnell: true });
  wahr(!zeile.includes("','" + A.heute() + "')"), "kein zweiter Heute-Knopf");
  wahr(zeile.includes("','" + A.morgen() + "')"), "Morgen bleibt");
});
t("Erledigte Zeilen bekommen keine Schnellknöpfe", () => {
  frisch();
  const id = anlegen("Fertig", { fertig: Date.now() });
  const zeile = A.aufZeile({ id, ...A.S.aufgaben[id] }, { schnell: true });
  wahr(!zeile.includes("zeilentakt"), "keine Knöpfe");
});
t("Ein Klick auf Heute setzt den Termin wirklich", () => {
  frisch();
  const id = anlegen("Aus dem Vorrat", { wann: null });
  A.verschieben(id, A.heute());
  gleich(A.S.aufgaben[id].wann, A.heute());
  wahr(A.S.aufgaben[id].ts > 0, "mit Abgleichsstempel");
});

gruppe("2 · Überfälliges dort aufräumen, wo es steht");
t("Der Kopf der Überfällig-Sektion bietet die Aktion an", () => {
  frisch();
  anlegen("Liegengeblieben", { wann: tagVor(3) });
  A.tab = "heute"; A.render();
  wahr(document.getElementById("view").innerHTML.includes("ueberfaelligHolen()"), "Knopf vorhanden");
});
t("Ohne Überfälliges erscheint der Knopf nicht", () => {
  frisch();
  anlegen("Für heute", { wann: A.heute() });
  A.tab = "heute"; A.render();
  wahr(!document.getElementById("view").innerHTML.includes("ueberfaelligHolen()"), "kein Knopf");
});

gruppe("3 · Leere Notizen verschwinden von allein");
t("Anlegen und ohne Eingabe schließen hinterlässt nichts", () => {
  frisch();
  A.notizAnlegen();
  gleich(Object.keys(A.S.notizen).length, 1, "erst angelegt");
  A.notizSchliessen();
  gleich(Object.keys(A.S.notizen).length, 0, "wieder weg");
});
t("Eine Notiz mit getipptem Titel bleibt", () => {
  frisch();
  A.notizAnlegen();
  document.getElementById("ntitel").value = "Behalten";     /* so tippt der Nutzer */
  A.notizSchliessen();
  gleich(Object.keys(A.S.notizen).length, 1);
  gleich(Object.values(A.S.notizen)[0].titel, "Behalten");
});
t("Eine Notiz mit Text, aber ohne Titel bleibt ebenfalls", () => {
  frisch();
  A.notizAnlegen();
  document.getElementById("edit").innerHTML = "<p>Nur ein Gedanke</p>";
  A.notizSchliessen();
  gleich(Object.keys(A.S.notizen).length, 1);
  gleich(Object.values(A.S.notizen)[0].titel, "Nur ein Gedanke", "Titel aus dem Text gebildet");
});
t("Ist das Fenster schon zu, wird nichts mit Inhalt verworfen", () => {
  frisch();
  A.notizAnlegen();
  const id = Object.keys(A.S.notizen)[0];
  A.S.notizen[id].html = "<p>Schon gespeichert</p>";
  /* Geschlossenes Fenster: der Browser liefert für die Felder dann null */
  const echt = document.getElementById;
  document.getElementById = n => (n === "edit" || n === "ntitel") ? null : echt(n);
  try { A.notizSchliessen(); } finally { document.getElementById = echt; }
  gleich(Object.keys(A.S.notizen).length, 1, "bleibt erhalten");
  gleich(Object.values(A.S.notizen)[0].html, "<p>Schon gespeichert</p>", "Inhalt unangetastet");
});

gruppe("4 · Schnelleingabe in Daumenreichweite");
t("Der Knopf öffnet ein Feld und legt an, wohin gewählt wurde", () => {
  frisch();
  A.schnellWohin = "morgen";
  A.schnellOeffnen();
  const feld = document.getElementById("schnellfeld");
  feld.value = "Windeln kaufen";
  A.schnellAnlegen();
  const neu = Object.values(A.S.aufgaben)[0];
  gleich(neu.t, "Windeln kaufen");
  gleich(neu.wann, A.morgen());
});
t("Das Feld bleibt für den nächsten Eintrag leer und offen", () => {
  frisch();
  A.schnellWohin = "heute";
  A.schnellOeffnen();
  document.getElementById("schnellfeld").value = "Erstes";
  A.schnellAnlegen();
  gleich(document.getElementById("schnellfeld").value, "", "Feld geleert");
  wahr(document.getElementById("sheet").innerHTML.length > 20, "Fenster bleibt offen");
});
t("Zusätze im Text schlagen die Auswahl", () => {
  frisch();
  A.schnellWohin = "sammeln";
  A.schnellOeffnen();
  document.getElementById("schnellfeld").value = "Arzt anrufen morgen #Geburt";
  A.schnellAnlegen();
  const neu = Object.values(A.S.aufgaben)[0];
  gleich(neu.wann, A.morgen(), "morgen aus dem Text");
  gleich(neu.kat, "k_geb");
});
t("Auf der Notizansicht legt derselbe Knopf eine Notiz an", () => {
  frisch();
  A.tab = "notizen";
  A.daumenKnopf();
  gleich(Object.keys(A.S.notizen).length, 1);
  gleich(Object.keys(A.S.aufgaben).length, 0);
});

gruppe("5 · Suche zeichnet nicht mehr alles neu");
t("Beim Tippen wird nur der Trefferblock getauscht", () => {
  frisch();
  anlegen("Kinderwagen abholen", { wann: null });
  A.tab = "listen"; A.aufSuche = "kinder"; A.render();
  const vorher = document.getElementById("view").innerHTML;
  A.aufSucheAendern("kinderw");
  gleich(document.getElementById("view").innerHTML, vorher, "die Ansicht selbst bleibt unangetastet");
  wahr(document.getElementById("suchtreffer").innerHTML.includes("Kinderwagen"), "Treffer aktualisiert");
});
t("Das Leeren der Suche zeichnet wieder vollständig", () => {
  frisch();
  anlegen("Etwas", { wann: null });
  A.tab = "listen"; A.aufSuche = "etwas"; A.render();
  A.aufSucheAendern("");
  wahr(!document.getElementById("view").innerHTML.includes("suchtreffer"), "zurück in der Listenansicht");
});

gruppe("6 · Wiederholungen");
t("Alle 2 Tage rückt zwei Tage vor", () => {
  frisch();
  const id = anlegen("Vitamin", { wann: A.heute(), wdh: "zweitaeglich" });
  gleich(A.naechsterTermin(A.S.aufgaben[id]), tagNach(2));
});
t("Ein fester Wochentag wird eingehalten", () => {
  frisch();
  const id = anlegen("Müll rausbringen", { wann: A.heute(), wdh: "woechentlich", wdhTag: 2 });
  const n = A.naechsterTermin(A.S.aufgaben[id]);
  gleich(A.wochentag(n), 2, "Mittwoch, bekommen " + n);
  wahr(n > A.heute(), "in der Zukunft");
});
t("Ohne festen Wochentag bleibt der Abstand von sieben Tagen", () => {
  frisch();
  const id = anlegen("Wöchentlich", { wann: A.heute(), wdh: "woechentlich" });
  gleich(A.naechsterTermin(A.S.aufgaben[id]), tagNach(7));
});
t("Der 31. landet im Februar auf dem letzten Tag, nicht im März", () => {
  frisch();
  const id = anlegen("Monatlich", { wann: "2026-01-31", wdh: "monatlich" });
  const a = A.S.aufgaben[id];
  /* Die Rechnung selbst prüfen, unabhängig vom heutigen Datum */
  const roh = A.naechsterTermin({ ...a, wann: "2026-01-31" });
  wahr(!/^2026-03/.test(roh), "nicht in den März gesprungen, bekommen " + roh);
});
t("Eine unbekannte Wiederholung liefert keinen Termin", () => {
  frisch();
  const id = anlegen("Kaputt", { wann: A.heute(), wdh: "quatsch" });
  gleich(A.naechsterTermin(A.S.aufgaben[id]), null);
});
t("Abhaken erzeugt den Nachfolger im neuen Rhythmus", () => {
  frisch();
  const id = anlegen("Vitamin", { wann: A.heute(), wdh: "zweitaeglich" });
  A.haken(id);
  const offene = Object.values(A.S.aufgaben).filter(a => !a.fertig);
  gleich(offene.length, 1);
  gleich(offene[0].wann, tagNach(2));
});

gruppe("7 · Diese Woche noch");
t("Der Wochentopf erscheint auf Heute", () => {
  frisch();
  anlegen("Ohne festen Tag", { wann: "woche" });
  A.tab = "heute"; A.render();
  const html = document.getElementById("view").innerHTML;
  wahr(/Diese Woche noch/.test(html), "Abschnitt da");
  wahr(/Ohne festen Tag/.test(html), "Eintrag sichtbar");
});
t("Ohne Wocheneinträge bleibt der Abschnitt weg", () => {
  frisch();
  anlegen("Für heute", { wann: A.heute() });
  A.tab = "heute"; A.render();
  wahr(!/Diese Woche noch/.test(document.getElementById("view").innerHTML));
});
t("Mehr als drei Einträge werden zusammengefasst", () => {
  frisch();
  for (let i = 0; i < 6; i++) anlegen("Wocheneintrag " + i, { wann: "woche" });
  A.tab = "heute"; A.render();
  const html = document.getElementById("view").innerHTML;
  wahr(/und 3 weitere/.test(html), "Rest zusammengefasst");
});
t("Erledigtes taucht im Wochentopf nicht auf", () => {
  frisch();
  anlegen("Schon erledigt", { wann: "woche", fertig: Date.now() });
  A.tab = "heute"; A.render();
  wahr(!/Diese Woche noch/.test(document.getElementById("view").innerHTML));
});

gruppe("8 · Liegezeit im Vorrat");
t("Was lange liegt, sagt es leise", () => {
  frisch();
  const id = anlegen("Vergessen", { wann: null });
  A.S.aufgaben[id].erstellt = Date.now() - 30 * 86400000;
  const zeile = A.aufZeile({ id, ...A.S.aufgaben[id] }, {});
  wahr(/liegt seit 30 Tagen/.test(zeile), "Hinweis da");
});
t("Frisch Gesammeltes bleibt still", () => {
  frisch();
  const id = anlegen("Neu", { wann: null });
  wahr(!/liegt seit/.test(A.aufZeile({ id, ...A.S.aufgaben[id] }, {})));
});
t("Aufgaben mit Termin zeigen keine Liegezeit", () => {
  frisch();
  const id = anlegen("Mit Termin", { wann: A.heute() });
  A.S.aufgaben[id].erstellt = Date.now() - 60 * 86400000;
  wahr(!/liegt seit/.test(A.aufZeile({ id, ...A.S.aufgaben[id] }, {})));
});

gruppe("9 · Rückblick mit Inhalt");
t("Der Rückblick nennt die erledigten Aufgaben", () => {
  frisch();
  const id = anlegen("Kinderwagen abgeholt", {});
  A.S.aufgaben[id].fertig = Date.now() - 2 * 86400000;
  const html = A.rueckblickListe();
  wahr(/Kinderwagen abgeholt/.test(html), "Titel genannt");
  wahr(/<s>/.test(html), "durchgestrichen dargestellt");
});
t("Älteres als sieben Tage bleibt draußen", () => {
  frisch();
  const id = anlegen("Uralt", {});
  A.S.aufgaben[id].fertig = Date.now() - 20 * 86400000;
  wahr(!/Uralt/.test(A.rueckblickListe()));
});
t("Ohne Erledigtes steht das ehrlich da", () => {
  frisch();
  wahr(/nichts abgehakt/.test(A.rueckblickListe()));
});

gruppe("12 · Wer hat es gemacht");
t("Ohne Namen bleibt alles anonym", () => {
  frisch();
  A.cfg.name = "";
  const id = anlegen("Etwas", { wann: A.heute() });
  A.haken(id);
  wahr(!A.S.aufgaben[id].von, "kein Name vermerkt");
});
t("Mit Namen wird vermerkt, wer abgehakt hat", () => {
  frisch();
  A.cfg.name = "Marco";
  const id = anlegen("Etwas", { wann: A.heute() });
  A.haken(id);
  gleich(A.S.aufgaben[id].von, "Marco");
  wahr(/Marco/.test(A.aufZeile({ id, ...A.S.aufgaben[id] }, {})), "steht in der Zeile");
  wahr(/Marco/.test(A.rueckblickListe()), "steht im Rückblick");
});
t("Der Name gilt nur für dieses Gerät und nicht für den Text", () => {
  frisch();
  A.cfg.name = "Partnerin";
  const id = anlegen("Etwas", { wann: A.heute() });
  wahr(!A.S.aufgaben[id].von, "vor dem Abhaken kein Name");
});

gruppe("10 · Eine Suche über beides");
t("Aufgaben und Notizen werden zusammen gefunden", () => {
  frisch();
  anlegen("Kinderwagen abholen", { wann: null });
  const nid = "n" + A.id6();
  A.S.notizen[nid] = { titel: "Kinderwagen Modelle", html: "<p>Vergleich</p>", kat: null,
    archiv: false, oben: false, erstellt: Date.now(), geaendert: Date.now(), pos: A.naechstePos() };
  A.aufSuche = "kinderwagen";
  const html = A.sucheTreffer();
  wahr(/Kinderwagen abholen/.test(html), "Aufgabe gefunden");
  wahr(/Kinderwagen Modelle/.test(html), "Notiz gefunden");
});
t("Auch archivierte Notizen werden gefunden", () => {
  frisch();
  const nid = "n" + A.id6();
  A.S.notizen[nid] = { titel: "Alte Idee", html: "", kat: null, archiv: true,
    oben: false, erstellt: Date.now(), geaendert: Date.now(), pos: A.naechstePos() };
  A.aufSuche = "idee";
  const html = A.sucheTreffer();
  wahr(/Alte Idee/.test(html), "gefunden");
  wahr(/Archiv/.test(html), "als Archiv gekennzeichnet");
});
t("Findet die Suche nichts, sagt sie warum sie nichts fand", () => {
  frisch();
  A.aufSuche = "gibtsnichtxyz";
  const html = A.sucheTreffer();
  wahr(/Nichts gefunden/.test(html));
  wahr(/Archiv/.test(html), "erklärt den Suchraum");
});
t("Erledigte Aufgaben stehen hinten", () => {
  frisch();
  const offen = anlegen("Suchwort offen", { wann: null });
  const zu = anlegen("Suchwort erledigt", { fertig: Date.now() });
  A.aufSuche = "suchwort";
  const html = A.sucheTreffer();
  wahr(html.indexOf("Suchwort offen") < html.indexOf("Suchwort erledigt"), "Offenes zuerst");
});

gruppe("11 · Aufgabe und Notiz verbinden");
t("Aus einer Aufgabe entsteht eine verbundene Notiz", () => {
  frisch();
  const id = anlegen("Vortrag vorbereiten", { kat: "k_arb" });
  A.notizZuAufgabe(id);
  const nid = A.S.aufgaben[id].notizId;
  wahr(nid && A.S.notizen[nid], "Notiz existiert");
  gleich(A.S.notizen[nid].titel, "Vortrag vorbereiten", "Titel übernommen");
  gleich(A.S.notizen[nid].kat, "k_arb", "Liste übernommen");
  gleich(A.S.notizen[nid].aufgabe, id, "Rückverweis gesetzt");
});
t("Aus einer Notiz entsteht eine verbundene Aufgabe", () => {
  frisch();
  const nid = "n" + A.id6();
  A.S.notizen[nid] = { titel: "Elternabend planen", html: "<p>x</p>", kat: "k_arb",
    archiv: false, oben: false, erstellt: Date.now(), geaendert: Date.now(), pos: A.naechstePos() };
  A.aufgabeZuNotiz(nid);
  const aid = A.S.notizen[nid].aufgabe;
  wahr(aid && A.S.aufgaben[aid], "Aufgabe existiert");
  gleich(A.S.aufgaben[aid].t, "Elternabend planen");
  gleich(A.S.aufgaben[aid].kat, "k_arb");
  gleich(A.S.aufgaben[aid].notizId, nid, "Rückverweis gesetzt");
});
t("Eine verbundene Notiz wird beim Schließen nicht verworfen", () => {
  frisch();
  const id = anlegen("Mit Notiz", {});
  A.notizZuAufgabe(id);
  A.notizSchliessen();
  wahr(A.S.notizen[A.S.aufgaben[id].notizId], "Notiz bleibt trotz leerem Inhalt");
});
t("Die Verbindung lässt sich lösen", () => {
  frisch();
  const id = anlegen("Mit Notiz", {});
  A.notizZuAufgabe(id);
  A.aufAendern(id, { notizId: null }, false);
  gleich(A.S.aufgaben[id].notizId, null);
});
t("Beide Fenster zeigen den Sprung zur Gegenseite", () => {
  frisch();
  const id = anlegen("Vortrag", {});
  A.notizZuAufgabe(id);
  const nid = A.S.aufgaben[id].notizId;
  A.aufgabeOeffnen(id);
  wahr(/notizOeffnen\('n/.test(document.getElementById("sheet").innerHTML), "Aufgabe verweist auf die Notiz");
  A.notizOeffnen(nid);
  wahr(/aufgabeOeffnen\('a/.test(document.getElementById("sheet").innerHTML), "Notiz verweist auf die Aufgabe");
});

/* Vom Ziehen selbst lässt sich ohne echtes Fenster nur das Ergebnis prüfen:
   was nach dem Loslassen in den Positionen steht. Genau darauf kam es an. */
gruppe("13 · Reihenfolge nach dem Ziehen");
t("Die gezogene Reihenfolge steht anschließend in den Positionen", () => {
  frisch();
  const a = anlegen("Erste"), b = anlegen("Zweite"), c = anlegen("Dritte");
  A.dndUebernehmen([c, a, b], "aufgabe");
  gleich(A.sortiert(A.aufListe()).map(x => x.id), [c, a, b]);
});
t("Die Abstände lassen Platz zum späteren Einschieben", () => {
  frisch();
  const a = anlegen("Erste"), b = anlegen("Zweite");
  A.dndUebernehmen([a, b], "aufgabe");
  wahr(A.S.aufgaben[b].pos - A.S.aufgaben[a].pos >= 10, "zwischen zwei Zeilen bleibt Luft");
});
t("Jede bewegte Aufgabe bekommt einen frischen Abgleichstempel", () => {
  frisch();
  const a = anlegen("Erste"), b = anlegen("Zweite");
  A.S.aufgaben[a].ts = 1700000000000;
  A.dndUebernehmen([b, a], "aufgabe");
  wahr(A.S.aufgaben[a].ts > 1700000000000, "sonst überschreibt das andere Gerät die neue Ordnung");
});
t("Eine gezogene Notiz schaltet auf die eigene Reihenfolge um", () => {
  frisch();
  A.S.notizen = {
    n1: { titel: "A", erstellt: 1700000000000, pos: 100 },
    n2: { titel: "B", erstellt: 1700000100000, pos: 200 }
  };
  gleich(A.notizSortierung(), "erstellt");
  A.dndUebernehmen(["n2", "n1"], "notiz");
  gleich(A.notizSortierung(), "eigen");
  wahr(A.S.notizen.n2.pos < A.S.notizen.n1.pos, "die neue Ordnung gilt");
});
t("Unbekannte Kennungen bringen das Übernehmen nicht durcheinander", () => {
  frisch();
  const a = anlegen("Bleibt");
  A.dndUebernehmen(["schon-weg", a], "aufgabe");
  wahr(A.S.aufgaben[a], "die vorhandene Aufgabe steht noch");
});
t("Solange gezogen wird, zeichnet die App nicht neu", () => {
  frisch();
  A.tab = "heute"; A.render();
  A.dndSperre = true;
  document.getElementById("view").innerHTML = "unberührt";
  A.render();
  gleich(document.getElementById("view").innerHTML, "unberührt", "das Bild bleibt stehen");
  A.dndSperre = false;
  A.render();
  wahr(document.getElementById("view").innerHTML !== "unberührt", "danach wird nachgeholt");
});

bilanz();
