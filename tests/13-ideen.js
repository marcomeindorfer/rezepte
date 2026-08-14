/* Der Entdecken-Bereich zeigt nur Vorschläge, die es in der Sammlung noch nicht
   gibt. Diese Reihe hält zweierlei fest: dass die Ideen dieselben Regeln erfüllen
   wie die Rezepte (sie werden ja zu welchen), und dass sie sauber vom Bestand
   getrennt bleiben – sonst wäre „Entdecken" wieder eine Zweitansicht der Liste. */
load("tests/harness.js");

const IDEEN = A.IDEEN, THEMEN = A.THEMEN;
const ABT = A.ABT, MAHL = A.MAHL, NUT = A.NUT;
const TAG = 86400000;

function frisch() {
  A.S = A.leer();
  A.S.eigene = {}; A.S.sammlung = {}; A.S.archiv = {}; A.S.ideenWeg = {}; A.S.spaeter = {}; A.S.geprueft = {};
  A.S.vorrat = {};          /* sonst deckt der Vorrat Zutaten ab und sie fehlen auf der Liste */
  A.themaWahl = null;
  A.ideenModus = "ideen";
}

gruppe("Bestand");
t("Es gibt genug Ideen für ein Jahr Entdecken", () => {
  wahr(IDEEN.length >= 40, IDEEN.length + " Ideen");
});
t("Zwölf Themen, jedes mit mindestens drei Ideen", () => {
  gleich(THEMEN.length, 12);
  const duenn = THEMEN.filter(th => IDEEN.filter(i => i.thema === th.k).length < 3)
    .map(th => th.k + ": " + IDEEN.filter(i => i.thema === th.k).length);
  gleich(duenn, []);
});
t("Jede Idee gehört zu einem bekannten Thema", () => {
  const bekannt = new Set(THEMEN.map(t => t.k));
  gleich(IDEEN.filter(i => !bekannt.has(i.thema)).map(i => i.id + "→" + i.thema), []);
});
t("Kennungen und Namen sind eindeutig", () => {
  gleich(IDEEN.length, new Set(IDEEN.map(i => i.id)).size, "doppelte Kennung");
  gleich(IDEEN.length, new Set(IDEEN.map(i => i.n.toLowerCase())).size, "doppelter Name");
});

gruppe("Ideen sind keine bestehenden Rezepte");
t("Keine Kennung kollidiert mit einem mitgelieferten Rezept", () => {
  const da = new Set(A.REZEPTE.map(r => r.id));
  gleich(IDEEN.filter(i => da.has(i.id)).map(i => i.id), []);
});
t("Kein Name kommt schon in der Sammlung vor", () => {
  const norm = s => s.toLowerCase().replace(/[^a-zäöüß]/g, "");
  const da = new Set(A.REZEPTE.map(r => norm(r.n)));
  gleich(IDEEN.filter(i => da.has(norm(i.n))).map(i => i.n), []);
});
t("Unübernommene Ideen stehen nicht in der Rezeptliste", () => {
  frisch();
  const ids = new Set(A.RZ().map(r => r.id));
  gleich(IDEEN.filter(i => ids.has(i.id)).map(i => i.id), [], "Idee taucht in RZ() auf");
});
t("Der Wochenvorschlag kennt sie nicht", () => {
  frisch();
  A.autoWoche();
  const geplant = new Set(Object.values(A.S.plan).map(e => e.r));
  gleich(IDEEN.filter(i => geplant.has(i.id)).map(i => i.id), []);
});

gruppe("Dieselben Regeln wie für Rezepte");
function jede(name, pruef) {
  t(name, () => {
    const schlecht = [];
    IDEEN.forEach(i => { const m = pruef(i); if (m) schlecht.push(i.id + " (" + i.n + "): " + m); });
    if (schlecht.length) throw new Error(schlecht.length + " Ideen, u.a.\n       " + schlecht.slice(0, 6).join("\n       "));
  });
}
jede("Art ist veg, fisch oder fleisch", i => ["veg", "fisch", "fleisch"].includes(i.k) ? null : "k=" + i.k);
jede("Zubereitungszeit plausibel", i => (typeof i.min === "number" && i.min >= 3 && i.min <= 240) ? null : "min=" + i.min);
jede("Protein plausibel", i => (typeof i.p === "number" && i.p >= 10 && i.p <= 80) ? null : "p=" + i.p);
jede("Blähfaktor 0, 1 oder 2", i => [0, 1, 2].includes(i.bl) ? null : "bl=" + i.bl);
jede("Saisonmonate gültig", i => {
  if (!Array.isArray(i.m) || !i.m.length) return "keine Monate";
  const falsch = i.m.filter(x => !(Number.isInteger(x) && x >= 1 && x <= 12));
  return falsch.length ? "Monate " + falsch : null;
});
jede("Nährstoffkennzeichen bekannt", i => {
  const falsch = (i.nut || []).filter(x => !NUT[x]);
  return falsch.length ? "unbekannt: " + falsch : null;
});
jede("Mahlzeiten sind bekannt und vorhanden", i => {
  if (!Array.isArray(i.ma) || !i.ma.length) return "keine Mahlzeit";
  const falsch = i.ma.filter(x => !MAHL[x]);
  return falsch.length ? "unbekannt: " + falsch : null;
});
jede("Begründung erklärt, warum es sich lohnt", i => (typeof i.why === "string" && i.why.trim().length > 25) ? null : "why zu kurz");
jede("Mindestens drei Zubereitungsschritte", i => (Array.isArray(i.s) && i.s.length >= 3 && i.s.every(x => typeof x === "string" && x.trim())) ? null : "Schritte fehlen");
jede("Zutaten vollständig mit Menge, Einheit und Abteilung", i => {
  if (!Array.isArray(i.z) || i.z.length < 3) return "zu wenige Zutaten";
  const falsch = i.z.filter(x => !Array.isArray(x) || x.length < 4 || !x[0] || !(typeof x[1] === "number" && x[1] > 0) || !x[2] || !ABT[x[3]]);
  return falsch.length ? JSON.stringify(falsch[0]) : null;
});
jede("Mengen gelten für eine Portion", i => {
  const gross = (i.z || []).filter(x => ["g", "ml"].includes(x[2]) && x[1] > 400);
  return gross.length ? gross.map(x => x[0] + " " + x[1] + x[2]).join(", ") : null;
});
const SCHWEIN = /schwein|kassler|kasseler|leberk(ä|ae)s|schinken|speck|bacon|salami|bratwurst|mettwurst|lyoner|wiener|frankfurter|pancetta|guanciale|chorizo/i;
t("Kein Schweinefleisch", () => {
  const treffer = [];
  IDEEN.forEach(i => {
    if (SCHWEIN.test(i.n)) treffer.push("Name: " + i.n);
    (i.z || []).forEach(x => { if (SCHWEIN.test(x[0])) treffer.push(i.n + ": " + x[0]); });
    (i.s || []).forEach(s => { if (SCHWEIN.test(s)) treffer.push(i.n + " (Schritt)"); });
  });
  gleich(treffer, []);
});
t("Deklarierte Art passt zu den Zutaten", () => {
  const falsch = IDEEN.filter(i => A.artAusZutaten(i.z, i.k) !== i.k)
    .map(i => i.id + ": deklariert " + i.k + ", Zutaten sagen " + A.artAusZutaten(i.z, i.k));
  gleich(falsch, []);
});
t("Die Mischung stimmt: überwiegend vegetarisch", () => {
  const veg = IDEEN.filter(i => i.k === "veg").length;
  wahr(veg / IDEEN.length >= 0.6, "nur " + veg + " von " + IDEEN.length + " vegetarisch");
  wahr(IDEEN.some(i => i.k === "fisch"), "kein Fischgericht dabei");
});

gruppe("Thema der Woche");
t("Das Thema wechselt mit der Kalenderwoche und bleibt innerhalb einer stehen", () => {
  const a = A.kwNummer(new Date(2026, 0, 5));      /* Montag KW 2 */
  const b = A.kwNummer(new Date(2026, 0, 11));     /* Sonntag derselben Woche */
  gleich(a, b, "Kalenderwoche springt innerhalb der Woche");
  gleich(A.kwNummer(new Date(2026, 0, 12)), a + 1, "nächste Woche zählt weiter");
});
t("Über ein Jahr kommt jedes Thema mehrfach dran", () => {
  const zaehler = {};
  for (let w = 1; w <= 52; w++) zaehler[THEMEN[(w - 1) % THEMEN.length].k] = 1;
  gleich(Object.keys(zaehler).length, THEMEN.length, "nicht jedes Thema kommt vor");
});
t("Ein selbst gewähltes Thema gewinnt", () => {
  frisch();
  A.themaWahl = "suppe";
  gleich(A.themaAktiv().k, "suppe");
  A.themaWahl = null;
  wahr(THEMEN.some(t => t.k === A.themaAktiv().k), "ohne Wahl gilt das Thema der Woche");
});
t("Der Ideenstrom stellt das aktuelle Thema nach vorn", () => {
  frisch();
  A.themaWahl = "suppe";
  const pool = A.ideenPool();
  wahr(pool.length > 6, "zu wenig Nachschub");
  gleich(pool.slice(0, 3).map(i => i.thema), ["suppe", "suppe", "suppe"]);
  A.themaWahl = null;
});

gruppe("Übernehmen und Weglegen");
t("Übernehmen macht aus der Idee ein Rezept", () => {
  frisch();
  const idee = IDEEN[0];
  A.ideeUebernehmen(idee.id);
  wahr(A.S.eigene[idee.id], "nicht unter eigene abgelegt");
  wahr(A.S.sammlung[idee.id], "nicht in der Sammlung");
  const r = A.R(idee.id);
  wahr(r && r.n === idee.n, "über R() nicht auffindbar");
  gleich(r.src, "idee", "Herkunft nicht vermerkt");
  wahr(A.RZ().some(x => x.id === idee.id), "taucht nicht in der Rezeptliste auf");
});
t("Eine übernommene Idee bringt ihre Zutaten in die Einkaufsliste", () => {
  frisch();
  const idee = IDEEN.find(i => i.ma.includes("a"));
  A.ideeUebernehmen(idee.id);
  A.S.plan = { "w0-0-a": { r: idee.id, p: 2 } };
  A.listeBauen();
  const namen = Object.values(A.S.liste).map(i => i.n);
  idee.z.forEach(([n]) => wahr(namen.includes(n), "fehlt auf der Liste: " + n));
  const erste = Object.values(A.S.liste).find(x => x.n === idee.z[0][0]);
  gleich(erste.q, idee.z[0][1] * 2, "Menge nicht auf zwei Portionen gerechnet");
});
t("Übernommenes verschwindet aus dem Ideenstrom", () => {
  frisch();
  const idee = IDEEN[0];
  A.ideeUebernehmen(idee.id);
  wahr(A.ideenPool().every(i => i.id !== idee.id), "steht weiter im Strom");
});
t("Weggelegtes ruht und kommt danach wieder", () => {
  frisch();
  const idee = IDEEN[0];
  A.ideeWeg(idee.id);
  wahr(A.ideenPool().every(i => i.id !== idee.id), "sofort wieder da");
  A.S.ideenWeg[idee.id] = Date.now() - (A.FRIST.idee + 1) * TAG;
  wahr(A.ideenPool().some(i => i.id === idee.id), "kommt nach der Frist nicht zurück");
});
t("Weglegen lässt sich zurücknehmen", () => {
  frisch();
  const idee = IDEEN[0];
  A.ideeWeg(idee.id);
  A.mut("ideenWeg/" + idee.id, null);
  wahr(A.ideenPool().some(i => i.id === idee.id), "bleibt verschwunden");
});
t("Zweimal Übernehmen legt nichts doppelt an", () => {
  frisch();
  const idee = IDEEN[1];
  A.ideeUebernehmen(idee.id);
  A.ideeUebernehmen(idee.id);
  gleich(A.RZ().filter(r => r.id === idee.id).length, 1);
});

gruppe("Ansicht");
t("Der Ideenstrom zeigt Karten, keinen leeren Bereich", () => {
  frisch();
  const html = A.vEntdecken();
  wahr(/themakarte/.test(html), "Themenkarte fehlt");
  wahr(/Übernehmen/.test(html), "kein Übernehmen-Knopf");
  wahr(!/Aufräumen/.test(html), "Aufräumen gehört nicht mehr hierher");
});
t("Sind alle Ideen gesichtet, sagt die App das ehrlich", () => {
  frisch();
  IDEEN.forEach(i => { A.S.ideenWeg[i.id] = Date.now(); });
  const html = A.vEntdecken();
  wahr(/gesichtet/i.test(html), "keine ehrliche Leermeldung");
});
t("Ohne Prospekt erklärt der Angebotsteil, was fehlt", () => {
  frisch();
  A.S.angebote = {};
  A.ideenModus = "angebote";
  const html = A.vEntdecken();
  wahr(/Prospekt/.test(html), "kein Hinweis auf den Prospekt");
  A.ideenModus = "ideen";
});
t("Mit Prospekt stehen passende Ideen im Angebotsteil", () => {
  frisch();
  const heute = new Date(), bis = new Date(Date.now() + 5 * TAG);
  const iso = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  A.S.angebote = { p1: { von: iso(heute), bis: iso(bis), items: ["Kichererbsen 400 g Dose"], quelle: "Test", geholt: Date.now() } };
  const treffer = A.ideenImAngebot();
  wahr(treffer.length, "kein Treffer trotz Kichererbsen im Prospekt");
  wahr(treffer.every(x => x.treffer.length), "Treffer ohne Begründung");
  A.ideenModus = "angebote";
  wahr(/Im Angebot/.test(A.vEntdecken()), "Angebotsmarkierung fehlt");
  A.ideenModus = "ideen";
});
t("Das Aufräumen liegt jetzt unter Mehr", () => {
  frisch();
  A.S.sammlung = { b1: Date.now() - 200 * TAG };
  wahr(A.poolAlt().some(r => r.id === "b1"), "Karteileiche wird nicht erkannt");
  const blatt = A.MEHR_BLATT.aufraeumen();
  wahr(/Aufräumen/.test(blatt), "kein Blatt");
  wahr(/Aussortieren/.test(blatt), "kein Aussortieren-Knopf");
  wahr(/Aufräumen/.test(A.vMehr()), "keine Zeile in der Übersicht");
});
t("Behalten und Aussortieren wirken", () => {
  frisch();
  A.S.sammlung = { b1: Date.now() - 200 * TAG, b2: Date.now() - 200 * TAG };
  A.aufraeumenBehalten("b1");
  wahr(A.S.geprueft.b1, "nicht als geprüft vermerkt");
  wahr(A.poolAlt().every(r => r.id !== "b1"), "steht weiter im Stapel");
  A.aufraeumenWeg("b2");
  wahr(!A.S.sammlung.b2 && A.S.archiv.b2, "nicht ins Archiv gewandert");
});

bilanz();
