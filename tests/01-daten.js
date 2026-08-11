/* Datenprüfung: alle Rezepte auf vollständige und plausible Felder.
   Ein Fehler hier heißt: die App zeigt irgendwo Unsinn an oder stürzt ab. */
load("tests/harness.js");

const R_ALLE = A.REZEPTE;
const ABT = A.ABT, MAHL = A.MAHL, NUT = A.NUT, ALL = A.ALL;

gruppe("Bestand");
t("Rezepte sind vorhanden", () => wahr(R_ALLE.length >= 130, R_ALLE.length + " Rezepte"));
t("Kennungen sind eindeutig", () => {
  const gesehen = {}, doppelt = [];
  R_ALLE.forEach(r => { if (gesehen[r.id]) doppelt.push(r.id); gesehen[r.id] = 1; });
  gleich(doppelt, []);
});
t("Namen sind eindeutig", () => {
  const gesehen = {}, doppelt = [];
  R_ALLE.forEach(r => { const s = r.n.toLowerCase().trim(); if (gesehen[s]) doppelt.push(r.n); gesehen[s] = 1; });
  gleich(doppelt, []);
});

gruppe("Pflichtfelder je Rezept");
function jedes(name, pruef) {
  t(name, () => {
    const schlecht = [];
    R_ALLE.forEach(r => { const m = pruef(r); if (m) schlecht.push(r.id + " (" + r.n + "): " + m); });
    if (schlecht.length) throw new Error(schlecht.length + " Rezepte, u.a.\n       " + schlecht.slice(0, 6).join("\n       "));
  });
}
jedes("Name vorhanden", r => (typeof r.n === "string" && r.n.trim()) ? null : "kein Name");
jedes("Art ist veg, fisch oder fleisch", r => ["veg", "fisch", "fleisch"].includes(r.k) ? null : "k=" + r.k);
jedes("Zubereitungszeit plausibel", r => (typeof r.min === "number" && r.min >= 3 && r.min <= 240) ? null : "min=" + r.min);
jedes("Protein plausibel", r => (typeof r.p === "number" && r.p >= 0 && r.p <= 80) ? null : "p=" + r.p);
jedes("Blähfaktor 0, 1 oder 2", r => [0, 1, 2].includes(r.bl) ? null : "bl=" + r.bl);
jedes("Saisonmonate gültig", r => {
  if (!Array.isArray(r.m) || !r.m.length) return "keine Monate";
  const falsch = r.m.filter(x => !(Number.isInteger(x) && x >= 1 && x <= 12));
  return falsch.length ? "Monate " + falsch : null;
});
jedes("Nährstoffkennzeichen bekannt", r => {
  const falsch = (r.nut || []).filter(x => !NUT[x]);
  return falsch.length ? "unbekannt: " + falsch : null;
});
jedes("Begründung vorhanden", r => (typeof r.why === "string" && r.why.trim().length > 5) ? null : "why fehlt");
jedes("Zubereitungsschritte vorhanden", r => (Array.isArray(r.s) && r.s.length && r.s.every(x => typeof x === "string" && x.trim())) ? null : "keine Schritte");

gruppe("Zutaten");
jedes("Zutaten vorhanden und vollständig", r => {
  if (!Array.isArray(r.z) || !r.z.length) return "keine Zutaten";
  const falsch = r.z.filter(x => !Array.isArray(x) || x.length < 4 || !x[0]);
  return falsch.length ? falsch.length + " unvollständig: " + JSON.stringify(falsch[0]) : null;
});
jedes("Mengen sind Zahlen größer null", r => {
  const falsch = (r.z || []).filter(x => Array.isArray(x) && !(typeof x[1] === "number" && x[1] > 0));
  return falsch.length ? falsch.map(x => x[0] + "=" + x[1]).slice(0, 3).join(", ") : null;
});
jedes("Abteilung ist bekannt", r => {
  const falsch = (r.z || []).filter(x => Array.isArray(x) && !ABT[x[3]]);
  return falsch.length ? falsch.map(x => x[0] + "→" + x[3]).slice(0, 3).join(", ") : null;
});
jedes("Mengen gelten für eine Portion", r => {
  /* Alles über 400 g/ml je Portion ist mit hoher Wahrscheinlichkeit für zwei gerechnet */
  const gross = (r.z || []).filter(x => Array.isArray(x) && ["g", "ml"].includes(x[2]) && x[1] > 400);
  return gross.length ? gross.map(x => x[0] + " " + x[1] + x[2]).join(", ") : null;
});

gruppe("Ernährungsregeln");
const SCHWEIN = /schwein|kassler|kasseler|leberk(ä|ae)s|schinken|speck|bacon|salami|bratwurst|mettwurst|lyoner|wiener|frankfurter|nackensteak|schweineschnitzel|pancetta|guanciale|chorizo/i;
t("Kein Schweinefleisch in Zutaten", () => {
  const treffer = [];
  R_ALLE.forEach(r => (r.z || []).forEach(x => { if (Array.isArray(x) && SCHWEIN.test(x[0])) treffer.push(r.n + ": " + x[0]); }));
  gleich(treffer, []);
});
t("Kein Schweinefleisch in Namen und Schritten", () => {
  const treffer = [];
  R_ALLE.forEach(r => {
    if (SCHWEIN.test(r.n)) treffer.push("Name: " + r.n);
    (r.s || []).forEach(s => { if (SCHWEIN.test(s)) treffer.push(r.n + " (Schritt): " + s.slice(0, 40)); });
  });
  gleich(treffer, []);
});
t("Deklarierte Art passt zu den Zutaten", () => {
  const falsch = [];
  R_ALLE.forEach(r => {
    const abgeleitet = A.artAusZutaten(r.z, r.k);
    if (abgeleitet !== r.k) falsch.push(r.id + " " + r.n + ": deklariert " + r.k + ", Zutaten sagen " + abgeleitet);
  });
  if (falsch.length) throw new Error(falsch.length + " Abweichungen:\n       " + falsch.slice(0, 8).join("\n       "));
});

gruppe("Mahlzeiten und Arten");
jedes("Mahlzeiten sind bekannt", r => {
  const falsch = (r.ma || []).filter(x => !MAHL[x]);
  return falsch.length ? "unbekannt: " + falsch : null;
});
t("Tagesgerichte haben mindestens eine Mahlzeit", () => {
  const ohne = R_ALLE.filter(r => A.istTagesgericht(r) && (!r.ma || !r.ma.length));
  gleich(ohne.map(r => r.id + " " + r.n), []);
});
t("Snacks und Desserts stehen nie im Tagesplan", () => {
  const falsch = R_ALLE.filter(r => ["snack", "dessert"].includes(A.typVon(r)) && A.istTagesgericht(r));
  gleich(falsch.map(r => r.n), []);
});
t("Für jede Mahlzeit gibt es genug Auswahl", () => {
  const knapp = [];
  ["f", "m", "a"].forEach(mk => {
    const n = R_ALLE.filter(r => A.istTagesgericht(r) && (r.ma || []).includes(mk)).length;
    if (n < 21) knapp.push(mk + ": nur " + n + " für 21 Plätze in drei Wochen");
  });
  if (knapp.length) throw new Error(knapp.join("; "));
});
t("Es gibt Fisch- und Fleischgerichte für Mittag und Abend", () => {
  ["fisch", "fleisch"].forEach(art => {
    ["m", "a"].forEach(mk => {
      const n = R_ALLE.filter(r => r.k === art && A.istTagesgericht(r) && (r.ma || []).includes(mk)).length;
      wahr(n >= 3, art + "/" + mk + ": nur " + n);
    });
  });
});

gruppe("Beilagen und Vorrat");
t("Jedes Hauptgericht bekommt eine Beilagenart zugeordnet", () => {
  const arten = {};
  R_ALLE.filter(A.istTagesgericht).forEach(r => { const b = A.khVon(r); arten[b] = (arten[b] || 0) + 1; });
  wahr(Object.keys(arten).length >= 3, "nur " + Object.keys(arten).length + " Beilagenarten: " + JSON.stringify(arten));
});
t("Standardvorrat ist wohlgeformt", () => {
  const falsch = A.VORRAT_STD.filter(v => !v || !v.n || !A.ABT[v.k]);
  gleich(falsch, []);
});
t("Laufweg enthält jede Abteilung genau einmal", () => {
  const std = A.ABT_STD;
  gleich([...std].sort(), Object.keys(ABT).sort(), "Laufweg deckt alle Abteilungen");
  gleich(std.length, new Set(std).size, "keine Dubletten");
});

bilanz();
