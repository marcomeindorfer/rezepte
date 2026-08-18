/* Aufgaben: Datumslogik, Schnelleingabe, Wiederholungen, Abhaken, Reihenfolge. */
load("tests/harness.js");

function frisch() {
  A.S = A.leer();
  A.cfg = { db: "", hid: "" };
  A.queue = []; A.tab = "heute";
  netz.calls = []; netz.failing = false; netz.status = null;
}
const tagVor = n => A.iso(new Date(Date.now() - n * 86400000));
const tagNach = n => A.iso(new Date(Date.now() + n * 86400000));

gruppe("Datum");
t("iso nimmt den lokalen Kalendertag", () => {
  gleich(A.iso(new Date(2026, 0, 15, 23, 30)), "2026-01-15");
  gleich(A.iso(new Date(2026, 6, 1, 0, 5)), "2026-07-01");
});
t("heute, morgen und gestern werden benannt", () => {
  gleich(A.datumText(A.heute()), "Heute");
  gleich(A.datumText(A.morgen()), "Morgen");
  gleich(A.datumText(tagVor(1)), "Gestern");
});
t("Die Woche beginnt am Montag", () => {
  const tage = A.wochenTage(0);
  gleich(tage.length, 7);
  gleich(A.ausIso(tage[0]).getDay(), 1, "Montag zuerst");
  gleich(A.ausIso(tage[6]).getDay(), 0, "Sonntag zuletzt");
  wahr(tage.includes(A.heute()), "heute liegt in dieser Woche");
});
t("Wochen davor und danach liegen genau sieben Tage auseinander", () => {
  const a = A.wochenTage(0)[0], b = A.wochenTage(1)[0], c = A.wochenTage(-1)[0];
  gleich(Math.round((A.ausIso(b) - A.ausIso(a)) / 86400000), 7);
  gleich(Math.round((A.ausIso(a) - A.ausIso(c)) / 86400000), 7);
});
t("Zeitumstellung verschiebt keinen Tag", () => {
  const tage = A.wochenTage(0);
  const abstaende = tage.slice(1).map((d, i) => Math.round((A.ausIso(d) - A.ausIso(tage[i])) / 86400000));
  gleich(abstaende, [1, 1, 1, 1, 1, 1]);
});
t("Kalenderwoche nach ISO", () => {
  gleich(A.kw(new Date(2026, 0, 1)), "KW 1");
  gleich(A.kw(new Date(2024, 11, 30)), "KW 1");
});

gruppe("Schnelleingabe");
const deuten = s => A.eingabeDeuten(s);
t("Ein einfacher Text bleibt unverändert", () => {
  const d = deuten("Kinderwagen abholen");
  gleich(d.text, "Kinderwagen abholen");
  gleich(d.wann, null);
  gleich(d.katId, null);
});
t("Das Wort morgen wird zum Datum und verschwindet aus dem Text", () => {
  const d = deuten("Kinderwagen abholen morgen");
  gleich(d.text, "Kinderwagen abholen");
  gleich(d.wann, A.morgen());
});
t("heute, übermorgen, woche und danach werden verstanden", () => {
  gleich(deuten("Müll rausbringen heute").wann, A.heute());
  gleich(deuten("Arzt anrufen übermorgen").wann, tagNach(2));
  gleich(deuten("Steuer woche").wann, "woche");
  gleich(deuten("Keller aufräumen danach").wann, "danach");
  gleich(deuten("Buch lesen irgendwann").wann, "danach");
});
t("Ein Wochentag meint den nächsten passenden", () => {
  const d = deuten("Wäsche Freitag");
  gleich(d.text, "Wäsche");
  gleich(A.wochentag(d.wann), 4, "Freitag");
  wahr(d.wann > A.heute(), "liegt in der Zukunft");
});
t("Kurzformen von Wochentagen zählen auch", () => {
  const d = deuten("Sport Mo");
  gleich(A.wochentag(d.wann), 0, "Montag");
  gleich(d.text, "Sport");
});
t("Ein Datum wird gelesen, Vergangenes rutscht ins Folgejahr", () => {
  const d = deuten("Geschenk kaufen 24.12.");
  gleich(d.text, "Geschenk kaufen");
  wahr(/-12-24$/.test(d.wann), "24. Dezember, bekommen " + d.wann);
  wahr(d.wann >= A.heute(), "nie in der Vergangenheit");
});
t("Eine Liste wird über die Raute zugeordnet", () => {
  frisch();
  const d = deuten("Kinderwagen abholen #Geburt");
  gleich(d.katId, "k_geb");
  gleich(d.text, "Kinderwagen abholen");
});
t("Ein Präfix genügt für die Liste", () => {
  frisch();
  gleich(deuten("Notiz #arb").katId, "k_arb");
});
t("Eine unbekannte Raute bleibt im Text stehen", () => {
  frisch();
  const d = deuten("Idee #gibtsnicht");
  gleich(d.katId, null);
  wahr(d.text.includes("#gibtsnicht"), "Text unangetastet");
});
t("Datum und Liste zusammen", () => {
  frisch();
  const d = deuten("Kinderwagen abholen morgen #Geburt");
  gleich(d.text, "Kinderwagen abholen");
  gleich(d.wann, A.morgen());
  gleich(d.katId, "k_geb");
});
t("Wörter, die nur zufällig so anfangen, lösen nichts aus", () => {
  gleich(deuten("Wochenplan schreiben").wann, null, "Wochenplan ist kein „woche“");
  gleich(deuten("Mit Anna reden").wann, null, "Mit ist kein Montag");
  gleich(deuten("Heutige Post sortieren").wann, null, "Heutige ist kein heute");
});

gruppe("Aufgaben anlegen und abhaken");
t("Eine Aufgabe landet mit Datum in der richtigen Liste", () => {
  frisch();
  const id = A.aufgabeAnlegen("Kinderwagen abholen morgen #Geburt");
  const a = A.S.aufgaben[id];
  gleich(a.t, "Kinderwagen abholen");
  gleich(a.wann, A.morgen());
  gleich(a.kat, "k_geb");
  gleich(a.fertig, null);
  wahr(a.pos > 0 && a.erstellt > 0, "Position und Zeitstempel gesetzt");
});
t("Leere Eingaben legen nichts an", () => {
  frisch();
  gleich(A.aufgabeAnlegen("   "), null);
  gleich(Object.keys(A.S.aufgaben).length, 0);
});
/* 600 Einträge am Stück: so entsteht ein Import aus Google Notizen. Alles, was
   dabei in dieselbe Millisekunde fällt, muss trotzdem eindeutig bleiben. */
t("Kennungen und Positionen halten auch einem Massenimport stand", () => {
  frisch();
  const ids = [];
  for (let i = 0; i < 600; i++) ids.push(A.aufgabeAnlegen("Aufgabe " + i));
  gleich(new Set(ids).size, 600, "eindeutige Kennungen");
  const pos = ids.map(i => A.S.aufgaben[i].pos);
  gleich(new Set(pos).size, 600, "eindeutige Positionen");
  gleich(pos.slice().sort((a, b) => a - b), pos, "streng aufsteigend");
});
t("Positionen sind auch bei schnellem Tippen eindeutig", () => {
  frisch();
  const ids = [];
  for (let i = 0; i < 200; i++) ids.push(A.aufgabeAnlegen("Aufgabe " + i));
  gleich(new Set(ids).size, 200, "eindeutige Kennungen");
  const pos = ids.map(i => A.S.aufgaben[i].pos);
  gleich(new Set(pos).size, 200, "eindeutige Positionen");
  gleich(pos.slice().sort((a, b) => a - b), pos, "streng aufsteigend");
});
t("Abhaken setzt den Zeitpunkt, nochmal Abhaken nimmt ihn zurück", () => {
  frisch();
  const id = A.aufgabeAnlegen("Müll rausbringen heute");
  A.haken(id);
  wahr(A.S.aufgaben[id].fertig > 0, "erledigt");
  A.haken(id);
  wahr(!A.S.aufgaben[id].fertig, "wieder offen");
});
t("Jede Änderung führt einen Abgleichsstempel mit", () => {
  frisch();
  const id = A.aufgabeAnlegen("Etwas tun heute");
  A.haken(id);
  const nachHaken = A.S.aufgaben[id].ts;
  wahr(nachHaken > 0, "Stempel nach dem Abhaken");
  A.haken(id);
  wahr(A.S.aufgaben[id].ts >= nachHaken, "Stempel nach dem Zurücknehmen");
  A.verschieben(id, A.morgen());
  wahr(A.S.aufgaben[id].ts >= nachHaken, "Stempel nach dem Verschieben");
});
t("Heute Erledigtes verschwindet am nächsten Tag von allein", () => {
  frisch();
  const id = A.aufgabeAnlegen("Gestern erledigt heute");
  A.S.aufgaben[id].fertig = Date.now() - 2 * 86400000;
  wahr(!A.istHeuteFertig(A.S.aufgaben[id]), "zählt nicht mehr zu heute");
});

gruppe("Wiederholungen");
function wdhAufgabe(wdh, wann) {
  frisch();
  const id = A.aufgabeAnlegen("Vitamin nehmen");
  A.S.aufgaben[id].wdh = wdh;
  A.S.aufgaben[id].wann = wann;
  return id;
}
t("Täglich rückt einen Tag vor", () => {
  const id = wdhAufgabe("taeglich", A.heute());
  gleich(A.naechsterTermin(A.S.aufgaben[id]), tagNach(1));
});
t("Wöchentlich rückt sieben Tage vor", () => {
  const id = wdhAufgabe("woechentlich", A.heute());
  gleich(A.naechsterTermin(A.S.aufgaben[id]), tagNach(7));
});
t("Monatlich rückt einen Monat vor", () => {
  const id = wdhAufgabe("monatlich", "2026-03-15");
  const a = A.S.aufgaben[id];
  const n = A.naechsterTermin(a);
  wahr(n > A.heute(), "liegt in der Zukunft");
  wahr(/-\d\d-15$/.test(n), "bleibt der 15., bekommen " + n);
});
t("Der 31. springt nicht über den Folgemonat hinaus", () => {
  const id = wdhAufgabe("monatlich", "2026-01-31");
  const a = A.S.aufgaben[id];
  a.wann = "2026-01-31";
  /* Vom 31. Januar aus ist der nächste Termin Ende Februar, nicht der 3. März */
  const roh = new Date(2026, 0, 31, 12);
  roh.setMonth(roh.getMonth() + 1);
  const naiv = A.iso(roh);
  const echt = A.naechsterTermin(a);
  wahr(!/^2026-03-0[123]/.test(echt), "nicht in den März gerutscht (naiv wäre " + naiv + "), bekommen " + echt);
});
t("Eine lange liegengebliebene Wiederholung liefert nicht alles nach", () => {
  const id = wdhAufgabe("woechentlich", tagVor(40));
  const n = A.naechsterTermin(A.S.aufgaben[id]);
  wahr(n >= A.heute(), "nächster Termin liegt nicht in der Vergangenheit: " + n);
});
t("Abhaken einer Wiederholung erzeugt genau einen Nachfolger", () => {
  frisch();
  const id = A.aufgabeAnlegen("Vitamin nehmen heute");
  A.S.aufgaben[id].wdh = "taeglich";
  A.haken(id);
  const offene = Object.values(A.S.aufgaben).filter(a => !a.fertig);
  gleich(offene.length, 1, "ein Nachfolger");
  gleich(offene[0].wann, tagNach(1));
  gleich(offene[0].wdh, "taeglich", "wiederholt sich weiter");
});
t("Ohne Wiederholung entsteht kein Nachfolger", () => {
  frisch();
  const id = A.aufgabeAnlegen("Einmalig heute");
  A.haken(id);
  gleich(Object.keys(A.S.aufgaben).length, 1);
});

gruppe("Verschieben und Reihenfolge");
t("Überfälliges wird als solches erkannt", () => {
  frisch();
  const id = A.aufgabeAnlegen("Liegengeblieben");
  A.S.aufgaben[id].wann = tagVor(5);
  const { ueberfaellig, faellig } = A.topfHeute();
  gleich(ueberfaellig.map(a => a.id), [id]);
  gleich(faellig.length, 0);
});
t("Überfälliges lässt sich auf heute ziehen", () => {
  frisch();
  const id = A.aufgabeAnlegen("Liegengeblieben");
  A.S.aufgaben[id].wann = tagVor(5);
  A.ueberfaelligHolen();
  gleich(A.S.aufgaben[id].wann, A.heute());
});
t("Erledigtes wird dabei nicht mitgezogen", () => {
  frisch();
  const id = A.aufgabeAnlegen("Alt und erledigt");
  A.S.aufgaben[id].wann = tagVor(5);
  A.S.aufgaben[id].fertig = Date.now() - 5 * 86400000;
  const offen = A.aufgabeAnlegen("Alt und offen");
  A.S.aufgaben[offen].wann = tagVor(5);
  A.ueberfaelligHolen();
  gleich(A.S.aufgaben[id].wann, tagVor(5), "Erledigtes bleibt liegen");
  gleich(A.S.aufgaben[offen].wann, A.heute(), "Offenes kommt mit");
});
t("Auf heute ziehen überschreibt nicht alle Aufgaben am Stück", () => {
  frisch();
  const alt = A.aufgabeAnlegen("Überfällig");
  A.S.aufgaben[alt].wann = tagVor(3);
  A.aufgabeAnlegen("Unbeteiligt heute");
  A.cfg = { db: "https://test.example", hid: "h".repeat(24) };
  netz.calls = [];
  A.ueberfaelligHolen();
  drainMicrotasks();
  const grob = netz.calls.filter(c => /\/aufgaben\.json$/.test(c.url));
  gleich(grob.length, 0, "kein Rundumschlag auf alle Aufgaben");
});
t("Um einen Tag verschieben rechnet richtig", () => {
  frisch();
  const id = A.aufgabeAnlegen("Verschieben heute");
  A.umEinenTag(id);
  gleich(A.S.aufgaben[id].wann, tagNach(1));
});
t("Zwei Aufgaben tauschen ihre Position", () => {
  frisch();
  const a = A.aufgabeAnlegen("Erste"), b = A.aufgabeAnlegen("Zweite");
  const pa = A.S.aufgaben[a].pos, pb = A.S.aufgaben[b].pos;
  A.posTausch(a, b);
  gleich(A.S.aufgaben[a].pos, pb);
  gleich(A.S.aufgaben[b].pos, pa);
});
t("Löschen entfernt die Aufgabe", () => {
  frisch();
  const id = A.aufgabeAnlegen("Weg damit");
  A.aufgabeLoeschen(id);
  wahr(!A.S.aufgaben[id], "entfernt");
});

bilanz();
