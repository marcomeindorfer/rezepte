/* Klick-Durchlauf: jede Ansicht in jeder Variante rendern, alle Bedienelemente
   herausziehen und einzeln aufrufen. */
load("tests/harness.js");

function standAufbauen() {
  A.S = A.leer();
  A.cfg = { db: "https://test.example", hid: "h".repeat(24) };
  A.queue = []; A.syncState = "live";
  const heute = A.heute(), gestern = A.iso(new Date(Date.now() - 86400000));
  const anlegen = (t, felder) => {
    const id = "a" + A.id6();
    A.S.aufgaben[id] = { t, wann: null, kat: null, fertig: null, erstellt: Date.now(),
      pos: A.naechstePos(), notiz: null, wdh: null, ...felder };
    return id;
  };
  anlegen("Kinderwagen abholen", { wann: heute, kat: "k_geb" });
  anlegen("Überfällig seit gestern", { wann: gestern });
  anlegen("Heute schon geschafft", { wann: heute, fertig: Date.now() });
  anlegen("Diese Woche", { wann: "woche", kat: "k_arb" });
  anlegen("Irgendwann später", { wann: "danach" });
  anlegen("Nur gesammelt", { wann: null, kat: "k_idee" });
  anlegen("Mit Notiz und Wiederholung", { wann: heute, notiz: "Telefon 0170", wdh: "woechentlich" });
  anlegen("Nächste Woche", { wann: A.iso(new Date(Date.now() + 8 * 86400000)) });
  const notiz = (titel, felder) => {
    const id = "n" + A.id6();
    A.S.notizen[id] = { titel, html: "<h3>Abschnitt</h3><p>Etwas Text mit <b>fett</b></p>",
      kat: null, art: "frei", archiv: false, oben: false, erstellt: Date.now(),
      geaendert: Date.now(), geoeffnet: Date.now(), pos: A.naechstePos(), ...felder };
    return id;
  };
  notiz("Angeheftete Notiz", { oben: true, kat: "k_arb" });
  notiz("Normale Notiz");
  notiz("Archivierte Notiz", { archiv: true });
  notiz("Alte Notiz", { erstellt: new Date(2024, 2, 1).getTime(), geaendert: new Date(2024, 2, 1).getTime() });
  notiz("Notiz mit Bild", { html: '<p>Bild:</p><img src="data:image/jpeg;base64,/9j/4AAQ">' });
  return JSON.parse(JSON.stringify({ S: A.S, cfg: A.cfg }));
}
const SICHERUNG = standAufbauen();
function zurueckSetzen() {
  A.S = JSON.parse(JSON.stringify(SICHERUNG.S));
  A.cfg = JSON.parse(JSON.stringify(SICHERUNG.cfg));
  A.queue = []; A.syncState = "live";
  A.katFilter = "alle"; A.notizSuche = ""; A.notizFilter = "aktiv";
  A.aufSuche = ""; A.wochenVersatz = 0; A.sortAn = false; A.offenAuf = null;
  netz.calls = []; netz.failing = false; netz.status = null;
  document.getElementById("sheet").innerHTML = "";
  meldungen.alert.length = 0; meldungen.confirm.length = 0;
}

const HANDLER = /\son(click|input|change|keydown|keyup|submit|blur|focus|pointerdown)="([^"]*)"/g;
const gesammelt = [];
function elementeAus(html, herkunft) {
  let m; HANDLER.lastIndex = 0;
  while ((m = HANDLER.exec(html || ""))) {
    const code = m[2].replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
    gesammelt.push({ code, herkunft });
  }
}
function ansicht(name, vorbereiten) {
  zurueckSetzen();
  if (vorbereiten) vorbereiten();
  A.render();
  const html = document.getElementById("view").innerHTML;
  elementeAus(html, name);
  elementeAus(document.getElementById("nav").innerHTML, name + "/nav");
  elementeAus(document.getElementById("sheet").innerHTML, name + "/sheet");
  return html;
}

gruppe("Ansichten");
["heute", "woche", "listen", "notizen", "mehr"].forEach(x => {
  t("Ansicht „" + x + "“ rendert", () => {
    const html = ansicht(x, () => { A.tab = x; });
    wahr(html.length > 50, "Inhalt vorhanden");
  });
});
t("Woche lässt sich vor- und zurückblättern", () => {
  [-2, -1, 0, 1, 2].forEach(v => ansicht("woche" + v, () => { A.tab = "woche"; A.wochenVersatz = v; }));
});
t("Erledigte in der Woche lassen sich ausblenden", () => {
  ansicht("woche/ohne", () => { A.tab = "woche"; A.wocheFertig = false; });
  A.wocheFertig = true;
});
t("Listen in jedem Filter", () => {
  ["alle", "k_all", "k_geb", "k_arb", "k_idee"].forEach(f => ansicht("listen/" + f, () => { A.tab = "listen"; A.katFilter = f; }));
});
t("Aufgabensuche mit Treffern und ohne", () => {
  ansicht("listen/suche", () => { A.tab = "listen"; A.aufSuche = "kinderwagen"; });
  const leer = ansicht("listen/nichts", () => { A.tab = "listen"; A.aufSuche = "xyzgibtsnicht"; });
  wahr(/nichts|kein/i.test(leer), "ehrliche Leermeldung");
});
t("Notizen in jedem Filter und jeder Sortierung", () => {
  ["aktiv", "archiv", "alle"].forEach(f => ansicht("notizen/" + f, () => { A.tab = "notizen"; A.notizFilter = f; }));
  ["erstellt", "geoeffnet", "geaendert", "eigen"].forEach(s => ansicht("notizen/sort-" + s, () => {
    A.tab = "notizen"; A.S.einst.notizSort = s;
  }));
});
t("Notizsuche mit Treffern und ohne", () => {
  ansicht("notizen/suche", () => { A.tab = "notizen"; A.notizSuche = "abschnitt"; });
  const leer = ansicht("notizen/nichts", () => { A.tab = "notizen"; A.notizSuche = "xyzgibtsnicht"; });
  wahr(/nichts|kein/i.test(leer), "ehrliche Leermeldung");
});
t("Sortiermodus rendert überall", () => {
  ["heute", "woche", "listen", "notizen"].forEach(x => ansicht("sort/" + x, () => { A.tab = x; A.sortAn = true; }));
});
t("Leere Zustände rendern ebenfalls", () => {
  ["heute", "woche", "listen", "notizen", "mehr"].forEach(x => {
    zurueckSetzen();
    A.S = A.leer(); A.tab = x;
    A.render();
    const html = document.getElementById("view").innerHTML;
    elementeAus(html, x + "/leer");
    wahr(html.length > 20, x + " zeigt etwas");
  });
});
t("Eine Rückmeldung mit Rücknahme wird angezeigt", () => {
  zurueckSetzen();
  A.tab = "heute";
  A.hinweis("Etwas gelöscht", "Rückgängig", () => {});
  elementeAus(document.getElementById("view").innerHTML, "hinweis");
  wahr(/Rückgängig/.test(document.getElementById("view").innerHTML), "Rücknahme angeboten");
  A.hinweisWeg();
});

gruppe("Fenster");
const FENSTER = [
  ["Aufgabe öffnen", () => A.aufgabeOeffnen(Object.keys(A.S.aufgaben)[0])],
  ["Notiz öffnen", () => A.notizOeffnen(Object.keys(A.S.notizen)[0])],
  ["Listen verwalten", () => A.katVerwalten()],
  ["Listenfilter wählen", () => A.listenFilterWaehlen()],
  ["Notizfilter wählen", () => A.notizFilterWaehlen()],
  ["Aufgabe löschen", () => A.aufgabeLoeschenFragen(Object.keys(A.S.aufgaben)[0])],
  ["Notiz löschen", () => A.notizLoeschenFragen(Object.keys(A.S.notizen)[0])]
];
FENSTER.forEach(([name, oeffnen]) => {
  t("Fenster „" + name + "“ öffnet", () => {
    zurueckSetzen();
    oeffnen();
    const html = document.getElementById("sheet").innerHTML;
    wahr(html.length > 20, "Inhalt vorhanden");
    elementeAus(html, "fenster:" + name);
  });
});

gruppe("Bedienelemente");
const einzeln = [];
const gesehen = new Set();
gesammelt.forEach(h => { const s = h.code + "|" + h.herkunft; if (!gesehen.has(s)) { gesehen.add(s); einzeln.push(h); } });
const kaputt = [];
globalThis.__ziel = neuesElement("input");
einzeln.forEach(h => {
  zurueckSetzen();
  globalThis.event = { key: "Enter", preventDefault() {}, stopPropagation() {},
    target: neuesElement("input"), currentTarget: neuesElement("div"),
    clientX: 10, clientY: 10, pointerId: 1 };
  try {
    imScope("(function(){ var event = globalThis.event; " + h.code + " }).call(globalThis.__ziel)");
  } catch (e) {
    kaputt.push(h.herkunft + ": " + h.code.slice(0, 80) + "\n         → " + (e && e.message));
  }
});
t(einzeln.length + " Bedienelemente laufen ohne Ausnahme", () => {
  if (kaputt.length) throw new Error(kaputt.length + " von " + einzeln.length + " scheitern:\n       " + kaputt.slice(0, 10).join("\n       "));
});

bilanz();
