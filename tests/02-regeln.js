/* Regelprüfung: viele Wochenvorschläge erzeugen und statistisch auswerten. */
load("tests/harness.js");

const LAEUFE = +(globalThis.LAEUFE || 120);

function frisch(opt) {
  A.S = A.leer();
  A.cfg = { db: "", hid: "", leser: "" };
  A.planWoche = 0;
  A.S.still = opt && opt.still !== undefined ? opt.still : true;
  if (opt && opt.volleSammlung) A.S.sammlung = Object.fromEntries(A.REZEPTE.map(r => [r.id, Date.now()]));
  A.queue = [];
}
const wochenSlots = w => { const a = []; for (let d = 0; d < 7; d++) for (const mk of ["f", "m", "a"]) a.push("w" + w + "-" + d + "-" + mk); return a; };
function wocheLesen(w) {
  return wochenSlots(w).map(k => ({ k, e: A.S.plan[k], r: A.S.plan[k] && A.R(A.S.plan[k].r) })).filter(x => x.e);
}

/* ---- ein großer Durchlauf, danach werden die gesammelten Zahlen bewertet ---- */
const stat = {
  laeufe: 0, unvollstaendig: [], dubletten: [], ohneFisch: 0, ohneFleisch: 0,
  zuvielFisch: 0, zuvielFleisch: 0, snackImPlan: [], blaehDoppelt: [], unbekannt: [],
  proteinSchnitt: [], verschiedene: [], nullPortionen: 0
};
frisch({ volleSammlung: true });
for (let i = 0; i < LAEUFE; i++) {
  A.S.plan = {};
  A.autoWoche();
  stat.laeufe++;
  const w = wocheLesen(0);
  if (w.length !== 21) stat.unvollstaendig.push(w.length);
  const ids = w.map(x => x.e.r);
  const doppelt = ids.filter((x, n) => ids.indexOf(x) !== n);
  if (doppelt.length) stat.dubletten.push(doppelt);
  const fehlend = w.filter(x => !x.r);
  if (fehlend.length) stat.unbekannt.push(fehlend.map(x => x.e.r));
  const fisch = w.filter(x => x.r && x.r.k === "fisch").length;
  const fleisch = w.filter(x => x.r && x.r.k === "fleisch").length;
  if (!fisch) stat.ohneFisch++; if (fisch > 1) stat.zuvielFisch++;
  if (!fleisch) stat.ohneFleisch++; if (fleisch > 1) stat.zuvielFleisch++;
  w.forEach(x => { if (x.r && ["snack", "dessert"].includes(A.typVon(x.r))) stat.snackImPlan.push(x.r.n); });
  for (let d = 0; d < 7; d++) {
    const stark = w.filter(x => +x.k.split("-")[1] === d && x.r && x.r.bl === 2).length;
    if (stark > 1) stat.blaehDoppelt.push("Tag " + d + ": " + stark);
  }
  stat.proteinSchnitt.push(A.proteinSchnitt(0));
  stat.verschiedene.push(new Set(ids).size);
  if (w.some(x => x.e.p === 0)) stat.nullPortionen++;
}
const mittel = a => a.reduce((x, y) => x + y, 0) / a.length;

gruppe("Wochenvorschlag: " + LAEUFE + " Durchläufe");
print("  Protein im Schnitt: " + Math.round(mittel(stat.proteinSchnitt)) + " g/Tag" +
  " · verschiedene Gerichte je Woche: " + (Math.round(mittel(stat.verschiedene) * 10) / 10) +
  " · Tage unter 70 g: " + Math.round(stat.proteinSchnitt.filter(x => x < 70).length / LAEUFE * 100) + " % der Wochen");
t("Alle 21 Felder werden belegt", () => gleich(stat.unvollstaendig, []));
t("Innerhalb einer Woche wird kein Gericht wiederholt", () => gleich(stat.dubletten.slice(0, 3), []));
t("Jedes geplante Gericht ist auffindbar", () => gleich(stat.unbekannt.slice(0, 3), []));
t("Jede Woche enthält Fisch", () => gleich(stat.ohneFisch, 0));
t("Jede Woche enthält Fleisch", () => gleich(stat.ohneFleisch, 0));
t("Nicht mehr als einmal Fisch pro Woche", () => gleich(stat.zuvielFisch, 0));
t("Nicht mehr als einmal Fleisch pro Woche", () => gleich(stat.zuvielFleisch, 0));
t("Keine Snacks oder Desserts im Tagesplan", () => gleich([...new Set(stat.snackImPlan)], []));
t("Im Stillzeit-Modus nie zwei stark blähende Gerichte am selben Tag", () => gleich(stat.blaehDoppelt.slice(0, 5), []));
t("Portionen werden gesetzt, nicht null", () => gleich(stat.nullPortionen, 0));
t("Proteinschnitt liegt im dokumentierten Bereich", () => {
  const m = Math.round(mittel(stat.proteinSchnitt));
  wahr(m >= 68 && m <= 95, "Schnitt " + m + " g je Tag (dokumentiert: rund 72)");
});
t("Vielfalt: mindestens 18 verschiedene Gerichte je Woche", () => {
  const m = Math.round(mittel(stat.verschiedene) * 10) / 10;
  wahr(m >= 18, "im Schnitt nur " + m + " verschiedene");
});

gruppe("Harte Regeln im Einzelfall");
t("Bereits Eingetragenes bleibt unangetastet", () => {
  frisch({ volleSammlung: true });
  const fest = A.REZEPTE.find(r => A.istTagesgericht(r) && r.ma.includes("m") && r.k === "veg");
  A.S.plan = { "w0-2-m": { r: fest.id, p: 4 } };
  A.autoWoche();
  gleich(A.S.plan["w0-2-m"].r, fest.id, "Gericht bleibt");
  gleich(A.S.plan["w0-2-m"].p, 4, "Portionen bleiben");
});
t("Ein Restetag mit 0 Portionen überlebt den Vorschlag", () => {
  frisch({ volleSammlung: true });
  const fest = A.REZEPTE.find(r => A.istTagesgericht(r) && r.ma.includes("a"));
  A.S.plan = { "w0-3-a": { r: fest.id, p: 0 } };
  A.autoWoche();
  gleich(A.S.plan["w0-3-a"].p, 0, "bleibt Restetag");
});
t("Andere Wochen bleiben beim Vorschlag stehen", () => {
  frisch({ volleSammlung: true });
  const fest = A.REZEPTE.find(r => A.istTagesgericht(r) && r.ma.includes("m"));
  A.planWoche = 0;
  A.S.plan = { "w1-0-m": { r: fest.id, p: 2 }, "w2-4-a": { r: fest.id, p: 2 } };
  A.autoWoche();
  wahr(A.S.plan["w1-0-m"] && A.S.plan["w2-4-a"], "Wochen 1 und 2 unverändert");
  gleich(Object.keys(A.S.plan).filter(k => k.startsWith("w0-")).length, 21);
});
t("Vorschlag läuft auch für Woche 1 und 2", () => {
  [1, 2].forEach(w => {
    frisch({ volleSammlung: true });
    A.planWoche = w;
    A.autoWoche();
    gleich(wocheLesen(w).length, 21, "Woche " + w);
  });
  A.planWoche = 0;
});
t("Vorschlag kommt auch mit winziger Sammlung zurecht", () => {
  frisch();
  A.S.sammlung = { b1: Date.now() };
  A.S.plan = {};
  A.autoWoche();
  gleich(wocheLesen(0).length, 21, "füllt aus dem Gesamtbestand auf");
});
/* Der Regelfall bei einer frischen Installation: nur die Startsammlung.
   Sie hat 5 Frühstücke und je 7 Gerichte für Mittag und Abend – zu wenig für
   21 Plätze. Ohne Auffüllen stünde dasselbe Gericht zweimal in einer Woche. */
t("Auch mit der Startsammlung wird nichts wiederholt", () => {
  for (let i = 0; i < 25; i++) {
    frisch();                       /* leer() bringt die Startsammlung mit */
    A.S.plan = {};
    A.autoWoche();
    const ids = wocheLesen(0).map(x => x.e.r);
    const doppelt = ids.filter((x, n) => ids.indexOf(x) !== n);
    gleich(doppelt, [], "Durchlauf " + i);
  }
});
t("Mit der Startsammlung bleiben Fisch- und Fleischregel erhalten", () => {
  for (let i = 0; i < 25; i++) {
    frisch();
    A.S.plan = {};
    A.autoWoche();
    const w = wocheLesen(0);
    gleich(w.filter(x => x.r && x.r.k === "fisch").length, 1, "Fisch, Durchlauf " + i);
    gleich(w.filter(x => x.r && x.r.k === "fleisch").length, 1, "Fleisch, Durchlauf " + i);
  }
});
t("Gerichte aus eurer Sammlung haben Vorrang", () => {
  frisch({ volleSammlung: true });
  A.S.plan = {};
  A.autoWoche();
  const fremd = wocheLesen(0).filter(x => !A.S.sammlung[x.e.r]);
  gleich(fremd.length, 0, "bei voller Sammlung wird nichts Fremdes geholt");
});
t("Ohne Stillzeit-Modus läuft der Vorschlag ebenfalls", () => {
  frisch({ volleSammlung: true, still: false });
  A.S.plan = {};
  A.autoWoche();
  gleich(wocheLesen(0).length, 21);
});
t("Drei Wochen am Stück bleiben abwechslungsreich", () => {
  frisch({ volleSammlung: true });
  A.S.plan = {};
  [0, 1, 2].forEach(w => { A.planWoche = w; A.autoWoche(); });
  A.planWoche = 0;
  const alle = [0, 1, 2].flatMap(w => wocheLesen(w).map(x => x.e.r));
  gleich(alle.length, 63, "63 Felder");
  const verschieden = new Set(alle).size;
  wahr(verschieden >= 40, "nur " + verschieden + " verschiedene Gerichte über drei Wochen");
});

bilanz();
