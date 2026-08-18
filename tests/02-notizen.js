/* Notizen: Suche, Sortierung, Gruppierung und die Bereinigung von HTML. */
load("tests/harness.js");

function frisch() {
  A.S = A.leer();
  A.cfg = { db: "", hid: "" };
  A.queue = []; A.notizSuche = ""; A.notizFilter = "aktiv"; A.katFilter = "alle";
  netz.calls = [];
}
let n = 0;
function notiz(felder) {
  const id = "n" + (++n);
  A.S.notizen[id] = { titel: "", html: "", kat: null, art: "frei", archiv: false, oben: false,
    erstellt: Date.now(), geaendert: Date.now(), geoeffnet: Date.now(), pos: Date.now() * 100 + n, ...felder };
  return id;
}

gruppe("Suche");
t("Alle eingegebenen Wörter müssen vorkommen", () => {
  frisch();
  notiz({ titel: "Einkauf Berlin", html: "<p>Reise nach Berlin</p>" });
  notiz({ titel: "Einkauf München", html: "<p>Nichts weiter</p>" });
  gleich(A.notizenSuchen("einkauf berlin", "aktiv").length, 1);
  gleich(A.notizenSuchen("einkauf", "aktiv").length, 2);
});
t("Der Titel wiegt schwerer als der Text", () => {
  frisch();
  const imTitel = notiz({ titel: "Kürbissuppe", html: "<p>nichts</p>" });
  notiz({ titel: "Rezepte", html: "<p>Kürbissuppe kochen</p>" });
  gleich(A.notizenSuchen("kürbissuppe", "aktiv")[0].id, imTitel, "Titeltreffer zuerst");
});
t("Der Listenname zählt mit", () => {
  frisch();
  const id = notiz({ titel: "Ohne Bezug", html: "<p>leer</p>", kat: "k_geb" });
  gleich(A.notizenSuchen("geburt", "aktiv").map(x => x.id), [id]);
});
t("Auch weit hinten im Text wird gefunden", () => {
  frisch();
  const lang = "<p>" + "Vorspann ".repeat(40) + "Nadel im Heuhaufen</p>";
  const id = notiz({ titel: "Lange Notiz", html: lang });
  gleich(A.notizenSuchen("nadel", "aktiv").map(x => x.id), [id], "normText darf nicht kürzen");
});
t("Umlaute und Großschreibung stören nicht", () => {
  frisch();
  const id = notiz({ titel: "Grüße an Öma", html: "<p>Straße</p>" });
  gleich(A.notizenSuchen("gruesse", "aktiv").map(x => x.id), [id]);
  gleich(A.notizenSuchen("STRASSE", "aktiv").map(x => x.id), [id]);
});
t("HTML-Auszeichnung zerreißt kein Wort", () => {
  frisch();
  const id = notiz({ titel: "Test", html: "<p>Der <b>Kinderwagen</b> ist da</p>" });
  gleich(A.notizenSuchen("kinderwagen", "aktiv").map(x => x.id), [id]);
});
t("Archiv und aktive Notizen werden getrennt durchsucht", () => {
  frisch();
  const a = notiz({ titel: "Aktiv Ordner", html: "" });
  const b = notiz({ titel: "Archiv Ordner", html: "", archiv: true });
  gleich(A.notizenSuchen("ordner", "aktiv").map(x => x.id), [a]);
  gleich(A.notizenSuchen("ordner", "archiv").map(x => x.id), [b]);
  gleich(A.notizenSuchen("ordner", "alle").length, 2);
});
t("Ohne Suchbegriff kommt alles, zuletzt Geändertes zuerst", () => {
  frisch();
  const alt = notiz({ titel: "Alt", geaendert: Date.now() - 86400000 });
  const neu = notiz({ titel: "Neu", geaendert: Date.now() });
  gleich(A.notizenSuchen("", "aktiv").map(x => x.id), [neu, alt]);
});
t("Ein Ausschnitt zeigt die Fundstelle hervorgehoben", () => {
  frisch();
  const id = notiz({ titel: "Test", html: "<p>" + "Text ".repeat(30) + "Kinderwagen abholen</p>" });
  const aus = A.ausschnitt(A.S.notizen[id], "kinderwagen");
  wahr(/<mark>/i.test(aus), "Fundstelle markiert");
  wahr(/kinderwagen/i.test(aus), "Fundstelle im Ausschnitt");
});

gruppe("HTML bereinigen");
const sauber = h => A.sauberHtml(h);
t("Erlaubte Auszeichnung bleibt erhalten", () => {
  const h = "<h3>Titel</h3><p>Text <b>fett</b> <i>kursiv</i></p><ul><li>Punkt</li></ul>";
  gleich(sauber(h), h);
});
t("Skriptblöcke fliegen raus", () => {
  wahr(!/alert/i.test(sauber("<p>A</p><script>alert(1)</script>")), "mit Ende");
  wahr(!/<script/i.test(sauber("<p>A</p><script src='x.js'></script>")), "mit Quelle");
});
t("Ereignis-Attribute fliegen raus", () => {
  wahr(!/onerror/i.test(sauber('<img src="x" onerror="alert(1)">')), "onerror");
  wahr(!/onclick/i.test(sauber("<p onclick='alert(1)'>A</p>")), "onclick");
  wahr(!/ONLOAD/i.test(sauber('<svg ONLOAD="alert(1)"></svg>')), "Großschreibung");
  wahr(!/onmouseover/i.test(sauber("<p onmouseover=alert(1)>A</p>")), "ohne Anführungszeichen");
});
t("Ereignis-Attribute auch ohne Leerzeichen davor", () => {
  wahr(!/onerror/i.test(sauber('<img/onerror="alert(1)" src="x">')), "mit Schrägstrich getrennt");
  wahr(!/onerror/i.test(sauber('<img\nonerror="alert(1)" src="x">')), "mit Zeilenumbruch");
});
t("Eingebettete Fremdinhalte fliegen raus", () => {
  wahr(!/<iframe/i.test(sauber('<iframe src="https://fremd.example"></iframe>')), "iframe");
  wahr(!/<object/i.test(sauber('<object data="x"></object>')), "object");
  wahr(!/<embed/i.test(sauber('<embed src="x">')), "embed");
});
t("Adressen, die Code ausführen, werden entschärft", () => {
  wahr(!/javascript:/i.test(sauber('<a href="javascript:alert(1)">Klick</a>')), "javascript im Link");
  wahr(!/javascript:/i.test(sauber('<img src="javascript:alert(1)">')), "javascript im Bild");
  wahr(!/vbscript:/i.test(sauber('<a href="vbscript:msgbox">x</a>')), "vbscript");
});
t("Auch verschleierte Adressen werden entschärft", () => {
  const raus = sauber('<a href="java&#115;cript:alert(1)">x</a>');
  wahr(!/cript:alert/i.test(raus), "mit Zahlenentity: " + raus);
  const raus2 = sauber('<a href=" javascript:alert(1)">x</a>');
  wahr(!/javascript:/i.test(raus2), "mit führendem Leerzeichen");
});
t("Normale Links und eingefügte Bilder bleiben nutzbar", () => {
  const link = '<a href="https://beispiel.de/seite">Seite</a>';
  gleich(sauber(link), link);
  const bild = '<img src="data:image/jpeg;base64,/9j/4AAQ">';
  gleich(sauber(bild), bild);
  const rel = '<a href="/intern">Intern</a>';
  gleich(sauber(rel), rel);
});
t("Ein leerer oder fehlender Wert stürzt nicht ab", () => {
  gleich(sauber(""), "");
  gleich(sauber(null), "");
  gleich(sauber(undefined), "");
});

gruppe("Sortierung und Gruppierung");
t("Angeheftete Notizen stehen immer oben", () => {
  frisch();
  notiz({ titel: "Normal", geaendert: 9000 });
  const oben = notiz({ titel: "Angeheftet", geaendert: 1000, oben: true });
  gleich(A.notizenGeordnet(A.notizenSuchen("", "aktiv"))[0].id, oben);
});
t("Die Sortierung folgt der Einstellung", () => {
  frisch();
  const frueher = Date.now() - 5 * 86400000, spaeter = Date.now();
  const a = notiz({ titel: "A", erstellt: frueher, geaendert: spaeter });
  const b = notiz({ titel: "B", erstellt: spaeter, geaendert: frueher });
  A.S.einst.notizSort = "erstellt";
  gleich(A.notizenGeordnet(Object.entries(A.S.notizen).map(([id, x]) => ({ id, ...x })))[0].id, b, "nach Erstellung");
  A.S.einst.notizSort = "geaendert";
  gleich(A.notizenGeordnet(Object.entries(A.S.notizen).map(([id, x]) => ({ id, ...x })))[0].id, a, "nach Änderung");
});
t("Eine unbekannte Sortierung fällt auf den Standard zurück", () => {
  frisch();
  A.S.einst.notizSort = "quatsch";
  gleich(A.notizSortierung(), "erstellt");
});
t("Zeitgruppen benennen den Zeitraum", () => {
  frisch();
  A.S.einst.notizSort = "erstellt";
  const heute = notiz({ titel: "Heute", erstellt: Date.now() });
  gleich(A.zeitGruppe(A.S.notizen[heute]), "Heute");
  const alt = notiz({ titel: "Alt", erstellt: new Date(2020, 4, 1).getTime() });
  wahr(/2020/.test(A.zeitGruppe(A.S.notizen[alt])), "Jahr genannt, bekommen " + A.zeitGruppe(A.S.notizen[alt]));
});

gruppe("Anlegen, Anheften, Archivieren");
t("Eine neue Notiz landet in der aktuellen Liste", () => {
  frisch();
  A.katFilter = "k_arb";
  A.notizAnlegen();
  const neu = Object.values(A.S.notizen)[0];
  gleich(neu.kat, "k_arb");
});
t("Anheften und Archivieren führen einen Abgleichsstempel mit", () => {
  frisch();
  const id = notiz({ titel: "Test" });
  delete A.S.notizen[id].ts;
  A.notizAnheften(id);
  wahr(A.S.notizen[id].oben === true && A.S.notizen[id].ts > 0, "angeheftet mit Stempel");
  A.notizArchivListe(id);
  wahr(A.S.notizen[id].archiv === true && A.S.notizen[id].ts > 0, "archiviert mit Stempel");
});
t("Anheften verändert nicht den Änderungszeitpunkt des Inhalts", () => {
  frisch();
  const id = notiz({ titel: "Test", geaendert: 5000 });
  A.notizAnheften(id);
  gleich(A.S.notizen[id].geaendert, 5000, "Sortierung nach Änderung bleibt stimmig");
});
t("Löschen entfernt die Notiz, Rücknahme holt sie zurück", () => {
  frisch();
  const id = notiz({ titel: "Weg" });
  const kopie = { ...A.S.notizen[id] };
  A.mut("notizen/" + id, null);
  wahr(!A.S.notizen[id], "entfernt");
  A.mut("notizen/" + id, kopie);
  wahr(A.S.notizen[id], "wieder da");
});

/* Der Griff nennt den Kasten, in dem gezogen wird. Nennt er einen, den es nicht
   gibt, passiert beim Ziehen schlicht nichts – und genau das war der Fall,
   sobald einmal auf die eigene Reihenfolge umgestellt war. */
gruppe("Der Griff zeigt auf den richtigen Kasten");
const kaesten = html => [...html.matchAll(/<div id="(nbox[^"]*)">/g)].map(m => m[1]);
const griffZiele = html => [...html.matchAll(/dndGriff\(event,'([^']+)'/g)].map(m => m[1]);
t("Bei eigener Reihenfolge steht die Liste in genau einem Kasten", () => {
  frisch();
  notiz({ titel: "Eins" }); notiz({ titel: "Zwei" });
  A.mut("einst/notizSort", "eigen", false);
  const html = A.notizTreffer();
  gleich(kaesten(html), ["nbox"]);
  gleich([...new Set(griffZiele(html))], ["nbox"], "jeder Griff zeigt dorthin");
});
t("Bei zeitlicher Sortierung zeigt jeder Griff auf seine eigene Zeitgruppe", () => {
  frisch();
  notiz({ titel: "Heute" });
  notiz({ titel: "Vor einem Jahr", erstellt: Date.now() - 400 * 86400000, geaendert: Date.now() - 400 * 86400000 });
  A.mut("einst/notizSort", "erstellt", false);
  const html = A.notizTreffer();
  const boxen = kaesten(html), ziele = griffZiele(html);
  wahr(boxen.length > 1, "mehrere Zeitgruppen");
  gleich(ziele.filter(z => !boxen.includes(z)), [], "kein Griff zeigt ins Leere");
});
t("Auch in der Suche zeigen die Griffe auf den Trefferkasten", () => {
  frisch();
  notiz({ titel: "Steuerbüro" });
  A.notizSuche = "steuer";
  const html = A.notizTreffer();
  A.notizSuche = "";
  gleich([...new Set(griffZiele(html))], kaesten(html));
});

bilanz();
