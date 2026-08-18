/* Import aus Google Notizen (Takeout): JSON, HTML-Rückfall, Checklisten,
   Etiketten, Bereinigung der Google-Formatierung. */
load("tests/harness.js");

function frisch() {
  A.S = A.leer(); A.cfg = { db: "", hid: "" }; A.queue = [];
  A.keepStand = null;
  A.keepOpt.archivMit = false;
  A.keepOpt.listenAlsAufgaben = true;
  A.keepOpt.etikettenAlsListen = true;
  meldungen.alert.length = 0;
}
const jsonNotiz = felder => JSON.stringify({
  title: "Titel", textContent: "Ein Text", isArchived: false, isTrashed: false, isPinned: false,
  createdTimestampUsec: 1700000000000000, userEditedTimestampUsec: 1700000900000000, ...felder
});

gruppe("JSON aus dem Takeout");
t("Titel, Text und Zeitstempel kommen an", () => {
  const n = A.keepLesen("notiz.json", jsonNotiz({}));
  gleich(n.quelle, "json");
  gleich(n.titel, "Titel");
  wahr(/Ein Text/.test(n.html), "Text als Absatz");
  gleich(n.erstellt, 1700000000000, "Mikrosekunden werden umgerechnet");
  gleich(n.geaendert, 1700000900000);
});
t("Mehrere Absätze bleiben getrennt", () => {
  const n = A.keepLesen("x.json", jsonNotiz({ textContent: "Erste Zeile\nZweite Zeile" }));
  gleich((n.html.match(/<p>/g) || []).length, 2);
});
t("Etiketten werden gelesen", () => {
  const n = A.keepLesen("x.json", jsonNotiz({ labels: [{ name: "Geburt" }, { name: "Arbeit" }] }));
  gleich(n.etiketten, ["Geburt", "Arbeit"]);
});
t("Archiv, Papierkorb und Anheftung werden erkannt", () => {
  gleich(A.keepLesen("x.json", jsonNotiz({ isArchived: true })).archiviert, true);
  gleich(A.keepLesen("x.json", jsonNotiz({ isTrashed: true })).geloescht, true);
  gleich(A.keepLesen("x.json", jsonNotiz({ isPinned: true })).gepinnt, true);
});
t("Checklisten werden als Punkte gelesen", () => {
  const n = A.keepLesen("x.json", jsonNotiz({
    listContent: [{ text: "Windeln", isChecked: false }, { text: "Erledigt", isChecked: true }]
  }));
  gleich(n.liste, [{ t: "Windeln", ab: false }, { t: "Erledigt", ab: true }]);
});
t("Anhänge werden gezählt, aber nicht übernommen", () => {
  gleich(A.keepLesen("x.json", jsonNotiz({ attachments: [{ filePath: "bild.jpg" }] })).anhaenge, 1);
});
t("Kaputtes JSON meldet einen Fehler statt abzustürzen", () => {
  gleich(A.keepLesen("x.json", "{kaputt").fehler, "kein gültiges JSON");
});
t("Fehlende Felder führen zu brauchbaren Vorgaben", () => {
  const n = A.keepLesen("x.json", "{}");
  gleich(n.titel, "");
  gleich(n.liste, []);
  gleich(n.etiketten, []);
  wahr(n.erstellt > 0, "Zeitstempel gesetzt");
});

gruppe("HTML-Rückfall");
const htmlNotiz = (inhalt, extra) => `<html><body><div class="note ${extra || ""}">
  <div class="heading">14.08.2026, 09:30:00</div>
  <div class="title">Einkaufen</div>
  <div class="content">${inhalt}</div>
  <div class="chips"><span class="label"><span class="label-name">Geburt</span></span></div>
  </div></body></html>`;
t("Titel, Text, Etikett und Datum werden gelesen", () => {
  const n = A.keepLesen("notiz.html", htmlNotiz("<span>Milch und Brot</span>"));
  gleich(n.quelle, "html");
  gleich(n.titel, "Einkaufen");
  wahr(/Milch und Brot/.test(n.html), "Text übernommen");
  gleich(n.etiketten, ["Geburt"]);
  gleich(A.iso(new Date(n.erstellt)), "2026-08-14");
});
t("Checklisten im HTML werden ebenfalls erkannt", () => {
  const inhalt = `<ul class="list">
    <li class="listitem"><span class="bullet">☐</span><span class="text">Windeln kaufen</span></li>
    <li class="listitem checked"><span class="bullet">☑</span><span class="text">Schon erledigt</span></li></ul>`;
  const n = A.keepLesen("notiz.html", htmlNotiz(inhalt));
  gleich(n.liste, [{ t: "Windeln kaufen", ab: false }, { t: "Schon erledigt", ab: true }]);
  gleich(n.html, "", "eine Checkliste wird nicht zusätzlich als Fließtext geführt");
});
t("Archiviert und gelöscht werden auch im HTML erkannt", () => {
  gleich(A.keepLesen("x.html", htmlNotiz("Text", "archived")).archiviert, true);
  gleich(A.keepLesen("x.html", htmlNotiz("Text", "trashed")).geloescht, true);
  gleich(A.keepLesen("x.html", htmlNotiz("Text", "pinned")).gepinnt, true);
});

gruppe("Google-Formatierung bereinigen");
t("Die winzige Schriftgröße von Google fliegt raus", () => {
  const raus = A.keepSaeubern('<span style="font-size:7.2pt;font-family:Roboto">Lesbarer Text</span>');
  wahr(!/font-size/.test(raus), "keine Schriftgröße mehr");
  wahr(/Lesbarer Text/.test(raus), "Text bleibt");
});
t("Echte Auszeichnung bleibt erhalten", () => {
  wahr(/<b>/.test(A.keepSaeubern('<span style="font-weight:bold">fett</span>')), "fett");
  wahr(/<i>/.test(A.keepSaeubern('<span style="font-style:italic">kursiv</span>')), "kursiv");
  wahr(/<s>/.test(A.keepSaeubern('<span style="text-decoration:line-through">weg</span>')), "durchgestrichen");
  wahr(/<u>/.test(A.keepSaeubern('<span style="text-decoration:underline">wichtig</span>')), "unterstrichen");
});
t("Verschachtelte Auszeichnung überlebt", () => {
  const raus = A.keepSaeubern('<span style="font-weight:bold"><span style="font-style:italic">beides</span></span>');
  wahr(/<b>/.test(raus) && /<i>/.test(raus), "fett und kursiv, bekommen " + raus);
});
t("Listen und Absätze bleiben, alles andere fliegt", () => {
  const raus = A.keepSaeubern("<p>Absatz</p><ul><li>Punkt</li></ul><table><tr><td>Tabelle</td></tr></table>");
  wahr(/<ul><li>Punkt<\/li><\/ul>/.test(raus), "Liste bleibt");
  wahr(!/<table|<tr|<td/.test(raus), "Tabelle raus");
});
t("Nur sichere Links bleiben stehen", () => {
  wahr(/href="https:\/\/beispiel.de"/.test(A.keepSaeubern('<a href="https://beispiel.de">Link</a>')), "https bleibt");
  wahr(!/javascript/i.test(A.keepSaeubern('<a href="javascript:alert(1)">Link</a>')), "javascript raus");
});
t("Skripte überstehen die Bereinigung nicht", () => {
  const raus = A.keepSaeubern('<span>Text</span><script>alert(1)</script>');
  wahr(!/<script/i.test(raus), "kein Skript-Element");
});
t("Umlaute kommen richtig an", () => {
  gleich(A.keepSaeubern("<p>Gr&uuml;&szlig;e aus M&#252;nchen</p>"), "<p>Grüße aus München</p>");
});

gruppe("Dateien bündeln");
t("JSON schlägt HTML bei gleichem Namen", () => {
  const raus = A.keepBuendeln([{ name: "Notiz.html", inhalt: "h" }, { name: "Notiz.json", inhalt: "j" }]);
  gleich(raus.length, 1);
  gleich(raus[0].name, "Notiz.json");
});
t("Die Reihenfolge der Dateien ist egal", () => {
  const raus = A.keepBuendeln([{ name: "Notiz.json", inhalt: "j" }, { name: "Notiz.html", inhalt: "h" }]);
  gleich(raus[0].name, "Notiz.json");
});
t("Verschiedene Notizen bleiben getrennt", () => {
  gleich(A.keepBuendeln([{ name: "A.json", inhalt: "" }, { name: "B.json", inhalt: "" }]).length, 2);
});

gruppe("Übernahme");
function stand(notizen) {
  frisch();
  A.keepStand = { gelesen: notizen.length, gebuendelt: notizen.length, notizen, kaputt: [] };
}
const gelesen = (name, roh) => A.keepLesen(name, roh);
t("Archivierte werden übersprungen, Papierkorb immer", () => {
  stand([
    gelesen("a.json", jsonNotiz({ title: "Normal" })),
    gelesen("b.json", jsonNotiz({ title: "Archiv", isArchived: true })),
    gelesen("c.json", jsonNotiz({ title: "Müll", isTrashed: true }))
  ]);
  gleich(A.keepAuswahl().map(n => n.titel), ["Normal"]);
  A.keepOpt.archivMit = true;
  gleich(A.keepAuswahl().map(n => n.titel).sort(), ["Archiv", "Normal"], "Papierkorb bleibt draußen");
});
t("Der Bericht sagt vorher, was passieren wird", () => {
  stand([
    gelesen("a.json", jsonNotiz({ title: "Mit Liste", listContent: [{ text: "Windeln" }] })),
    gelesen("b.json", jsonNotiz({ title: "Text", labels: [{ name: "Neue Liste" }] }))
  ]);
  const bericht = A.keepBericht();
  wahr(/2 Notizen gelesen/.test(bericht), "Anzahl genannt");
  wahr(/Neue Liste/.test(bericht), "neue Liste angekündigt");
  wahr(/Aufgaben/.test(bericht), "Checkliste als Aufgaben angekündigt");
});
t("Eine Notiz ohne Titel bekommt keinen leeren Eintrag", () => {
  const n = A.keepLesen("x.json", jsonNotiz({ title: "", textContent: "Nur Text" }));
  gleich(n.titel, "");
  wahr(/Nur Text/.test(n.html), "Text ist da – der Titel wird beim Anlegen daraus gebildet");
});

bilanz();
