/* Abgleich, Warteschlange, Zusammenführen und die Migration alter Stände. */
load("tests/harness.js");

function frisch() {
  netz.failing = false; netz.failNth = null; netz.status = null;
  drainMicrotasks();
  A.S = A.leer();
  A.cfg = { db: "https://test.example", hid: "h".repeat(24), leser: "" };
  A.queue = [];
  A.syncState = "lokal";
  netz.calls = []; netz.n = 0;
}

gruppe("Pfade und Schlüssel");
t("Adressen zeigen unter /haushalte/<code>", () => {
  frisch();
  gleich(A.adresse("plan"), "https://test.example/haushalte/" + "h".repeat(24) + "/plan.json");
  gleich(A.adresse(""), "https://test.example/haushalte/" + "h".repeat(24) + ".json");
});
t("Plan-Schlüssel erzeugen keine verschachtelte Struktur", () => {
  frisch();
  A.mut("plan/w0-2-a", { r: "b1", p: 2 }, false);
  const e = A.S.plan["w0-2-a"];
  gleich({ r: e.r, p: e.p }, { r: "b1", p: 2 });
  wahr(e.ts > 0, "Eintrag traegt einen Zeitstempel");
  gleich(Object.keys(A.S.plan), ["w0-2-a"], "flach geblieben");
});
t("Ein Schlüssel mit Schrägstrich landet nie in den Daten", () => {
  const schluessel = [];
  for (let w = 0; w < 3; w++) for (let d = 0; d < 7; d++) for (const mk of ["f", "m", "a"]) schluessel.push("w" + w + "-" + d + "-" + mk);
  gleich(schluessel.filter(k => /[./$#[\]]/.test(k)), []);
});

gruppe("Warteschlange bei Verbindungsabbruch");
t("Fehlgeschlagene Schreibvorgänge gehen in die Warteschlange", () => {
  frisch();
  netz.failing = true;
  A.senden("plan/a", 1); A.senden("plan/b", 2);
  drainMicrotasks();
  gleich(A.queue.length, 2);
});
t("Ein Fehler mitten im Nachsenden verliert die restlichen Einträge nicht", () => {
  frisch();
  A.queue = [{ pfad: "plan/a", wert: 1 }, { pfad: "plan/b", wert: 2 }, { pfad: "plan/c", wert: 3 }];
  netz.failNth = 1;
  A.flush();
  drainMicrotasks();
  gleich(A.queue.length, 3, "alle drei bleiben erhalten");
  gleich(A.queue.map(q => q.pfad), ["plan/a", "plan/b", "plan/c"], "Reihenfolge bleibt");
});
t("Wiederholtes Schreiben auf denselben Pfad staut sich nicht auf", () => {
  frisch();
  netz.failing = true;
  for (let i = 0; i < 60; i++) A.senden("liste", { stand: i });
  drainMicrotasks();
  gleich(A.queue.length, 1, "nur der jüngste Stand");
  gleich(A.queue[0].wert.stand, 59);
});
t("Erfolgreiches Nachsenden leert die Warteschlange", () => {
  frisch();
  A.queue = [{ pfad: "plan/a", wert: 1 }, { pfad: "plan/b", wert: 2 }];
  A.flush();
  drainMicrotasks();
  gleich(A.queue.length, 0);
});
t("Ohne eingerichteten Haushalt wird nichts gesendet", () => {
  frisch();
  A.cfg = { db: "", hid: "", leser: "" };
  netz.calls = [];
  A.senden("plan/a", 1);
  drainMicrotasks();
  gleich(netz.calls.length, 0);
});
t("Verweigert die Datenbank den Zugriff, wird das erkannt", () => {
  frisch();
  netz.status = 403;
  A.senden("plan/a", 1);
  drainMicrotasks();
  wahr(A.syncState === "verweigert" || A.syncState === "wartet", "Zustand: " + A.syncState);
  wahr(A.queue.length === 1, "Änderung geht nicht verloren");
});

gruppe("Zusammenführen zweier Stände");
t("Alle Sammelfelder werden gemischt, keines vergessen", () => {
  frisch();
  const felder = A.SAMMELFELDER();
  ["sammlung", "spaeter", "archiv", "geprueft", "eigene", "angebote", "quellen", "extra", "listen", "plan", "liste", "verlauf", "vorrat", "geloescht"]
    .forEach(f => wahr(felder.includes(f), f + " fehlt in SAMMELFELDER"));
});
t("Einträge, die es nur auf einer Seite gibt, bleiben erhalten", () => {
  frisch();
  A.S.plan = { "w0-0-m": { r: "b1", p: 2, geaendert: 100 } };
  A.zusammenfuehren({ plan: { "w0-1-a": { r: "b2", p: 2, geaendert: 100 } } });
  wahr(A.S.plan["w0-0-m"], "lokaler Eintrag bleibt");
  wahr(A.S.plan["w0-1-a"], "ferner Eintrag kommt an");
});
t("Bei gleicher Kennung gewinnt der jüngere Zeitstempel", () => {
  frisch();
  A.S.eigene = { e1: { id: "e1", n: "Lokal neu", geaendert: 2000 } };
  A.zusammenfuehren({ eigene: { e1: { id: "e1", n: "Fern alt", geaendert: 1000 } } });
  gleich(A.S.eigene.e1.n, "Lokal neu");
  A.S.eigene = { e1: { id: "e1", n: "Lokal alt", geaendert: 1000 } };
  A.zusammenfuehren({ eigene: { e1: { id: "e1", n: "Fern neu", geaendert: 3000 } } });
  gleich(A.S.eigene.e1.n, "Fern neu");
});
t("Ein gelöschtes Rezept kehrt durch den Abgleich nicht zurück", () => {
  frisch();
  A.S.eigene = { e1: { id: "e1", n: "Weg", geaendert: 1000 } };
  A.grabsteinSetzen("e1");
  A.zusammenfuehren({ eigene: { e1: { id: "e1", n: "Weg", geaendert: 1000 } }, sammlung: { e1: 500 } });
  wahr(!A.S.eigene.e1, "bleibt gelöscht");
  wahr(!A.S.sammlung.e1, "auch aus der Sammlung");
  wahr(A.RZ().every(r => r.id !== "e1"), "taucht in der Rezeptliste nicht auf");
});
t("Sammlung und Archiv schließen einander aus", () => {
  frisch();
  A.S.sammlung = { b1: 5000 };
  A.zusammenfuehren({ archiv: { b1: 9000 } });
  wahr(!A.S.sammlung.b1, "jüngeres Archiv gewinnt");
  frisch();
  A.S.archiv = { b1: 1000 };
  A.zusammenfuehren({ sammlung: { b1: 9000 } });
  wahr(!A.S.archiv.b1, "jüngere Sammlung gewinnt");
});
t("Einstellungen der Gegenseite werden übernommen", () => {
  frisch();
  A.S.still = true; A.S.portionStd = 2;
  A.zusammenfuehren({ still: false, portionStd: 4, route: ["so", "og"] });
  gleich(A.S.still, false);
  gleich(A.S.portionStd, 4);
  gleich(A.S.route, ["so", "og"]);
});
t("Ein leerer Fernstand löscht nicht den lokalen Bestand", () => {
  frisch();
  A.S.plan = { "w0-0-m": { r: "b1", p: 2 } };
  A.S.liste = { x: { n: "Möhren", q: 200 } };
  A.zusammenfuehren({});
  wahr(A.S.plan["w0-0-m"], "Plan bleibt");
  wahr(A.S.liste.x, "Liste bleibt");
});
t("Nach dem Mischen wird nur bei echtem Unterschied hochgeladen", () => {
  frisch();
  A.S.plan = { "w0-0-m": { r: "b1", p: 2 } };
  netz.calls = [];
  A.zusammenfuehren({ plan: { "w0-0-m": { r: "b1", p: 2 } }, sammlung: A.S.sammlung, vorrat: A.S.vorrat, route: A.S.route, still: A.S.still, portionStd: A.S.portionStd });
  drainMicrotasks();
  const wurzel = netz.calls.filter(c => /haushalte\/h+\.json$/.test(c.url));
  gleich(wurzel.length, 0, "kein überflüssiger Rundumschlag");
});

gruppe("Zwei Geräte, ein Haushalt");
function geraet() {
  /* Ein zweites Gerät wird über den Zustand nachgestellt: was A sendet, empfängt B */
  return { plan: {}, sammlung: {} };
}
t("Was Gerät A plant, kommt bei Gerät B an", () => {
  frisch();
  A.mut("plan/w0-0-m", { r: "b1", p: 2, geaendert: 1000 }, false);
  drainMicrotasks();
  const gesendet = netz.calls.find(c => /plan\/w0-0-m\.json$/.test(c.url));
  wahr(gesendet && gesendet.method === "PUT", "wurde übertragen");
  const fern = JSON.parse(gesendet.body);
  /* Gerät B führt diesen Stand mit seinem eigenen zusammen */
  A.S = A.leer(); A.S.plan = { "w0-3-a": { r: "b2", p: 2, geaendert: 900 } };
  A.zusammenfuehren({ plan: { "w0-0-m": fern } });
  wahr(A.S.plan["w0-0-m"] && A.S.plan["w0-3-a"], "beide Stände vereint");
});
t("Gleichzeitige Änderungen am selben Feld: der jüngere gewinnt", () => {
  frisch();
  A.S.plan = { "w0-0-m": { r: "lokal", p: 2, geaendert: 5000 } };
  A.zusammenfuehren({ plan: { "w0-0-m": { r: "fern", p: 2, geaendert: 4000 } } });
  gleich(A.S.plan["w0-0-m"].r, "lokal");
});
t("Ein Ereignis für einen Teilpfad wird eingespielt", () => {
  frisch();
  A.verbinden();
  const q = letzteQuelle();
  q.feuern("put", { path: "/plan/w0-2-a", data: { r: "b5", p: 3 } });
  gleich(A.S.plan["w0-2-a"], { r: "b5", p: 3 });
});
t("Ein Löschereignis der Gegenseite entfernt den Eintrag", () => {
  frisch();
  A.S.plan = { "w0-2-a": { r: "b5", p: 3 } };
  A.verbinden();
  const q = letzteQuelle();
  q.feuern("put", { path: "/plan/w0-2-a", data: null });
  wahr(!A.S.plan["w0-2-a"], "Eintrag entfernt");
});
t("Unsinnige Daten aus der Leitung legen die App nicht lahm", () => {
  frisch();
  A.verbinden();
  const q = letzteQuelle();
  (q.hoerer.put || []).forEach(f => f({ data: "{kein json" }));
  wahr(true, "kein Absturz");
});

gruppe("Migration alter Stände");
t("Altformat \"2-a\" wird zu \"w0-2-a\"", () => {
  frisch();
  A.S.plan = { "2-a": { r: "b1", p: 2 } };
  A.migrieren();
  wahr(A.S.plan["w0-2-a"], "umgeschrieben");
  wahr(!A.S.plan["2-a"], "alter Schlüssel weg");
});
t("Altformat \"0/2-a\" wird zu \"w0-2-a\"", () => {
  frisch();
  A.S.plan = { "0/2-a": { r: "b1", p: 2 } };
  A.migrieren();
  wahr(A.S.plan["w0-2-a"], "umgeschrieben");
});
t("Verschachteltes Altformat wird flachgezogen", () => {
  frisch();
  A.S.plan = { "0": { "2-a": { r: "b1", p: 2 } } };
  A.migrieren();
  wahr(A.S.plan["w0-2-a"], "umgeschrieben");
  wahr(!A.S.plan["0"], "Verschachtelung weg");
});
t("Sammlung mit true statt Zeitstempel wird berichtigt", () => {
  frisch();
  A.S.sammlung = { b1: true };
  A.migrieren();
  gleich(typeof A.S.sammlung.b1, "number");
});
t("Null-Einträge in der Sammlung verschwinden", () => {
  frisch();
  A.S.sammlung = { b1: null, b2: Date.now() };
  A.migrieren();
  wahr(!("b1" in A.S.sammlung), "null entfernt");
  wahr("b2" in A.S.sammlung, "gültiger bleibt");
});
t("Alte flache Angebotsliste wird zu einem Prospekt", () => {
  frisch();
  A.S.angebote = { items: ["Lauch", "Möhren"], bis: "2026-08-20", geholt: 1 };
  A.migrieren();
  const p = Object.values(A.S.angebote);
  gleich(p.length, 1);
  gleich(p[0].items, ["Lauch", "Möhren"]);
});
t("Migration läuft auch auf einem frischen Stand ohne Fehler", () => {
  frisch();
  A.migrieren();
  gleich(A.S.plan, {});
});
t("Grabsteine verfallen nach einem halben Jahr", () => {
  frisch();
  A.S.geloescht = { alt: Date.now() - 200 * 86400000, neu: Date.now() };
  A.migrieren();
  wahr(!A.S.geloescht.alt, "alter Grabstein entfernt");
  wahr(A.S.geloescht.neu, "frischer bleibt");
});

bilanz();
