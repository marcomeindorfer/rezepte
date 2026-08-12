/* Die Gestaltung folgt den Apple Human Interface Guidelines. Was sich davon
   maschinell nachhalten lässt, steht hier – damit eine spätere Änderung nicht
   still eine Farbe, eine Antippfläche oder den dunklen Modus verliert. */
load("tests/harness.js");

const QUELLE = read("index.html");
const STIL = QUELLE.slice(QUELLE.indexOf("<style>"), QUELLE.indexOf("</style>"));
const RUMPF = QUELLE.slice(QUELLE.indexOf("</style>"));

/* Alle Deklarationen im :root-Block, getrennt nach hellem und dunklem Modus */
function tokens(dunkel) {
  const re = dunkel
    ? /@media \(prefers-color-scheme:dark\)\{:root\{([\s\S]*?)\}\}/
    : /^:root\{([\s\S]*?)\n\}/m;
  const m = STIL.match(re);
  if (!m) return {};
  const raus = {};
  m[1].replace(/\/\*[\s\S]*?\*\//g, " ")
      .split(";").forEach(d => {
    const p = d.split(":");
    if (p.length >= 2 && p[0].trim().startsWith("--")) raus[p[0].trim()] = p.slice(1).join(":").trim();
  });
  return raus;
}
const hell = tokens(false), dunkel = tokens(true);

gruppe("Farbvariablen");

t("Der helle Modus setzt überhaupt Variablen", () => {
  wahr(Object.keys(hell).length > 12, "nur " + Object.keys(hell).length + " gefunden");
});

t("Jede benutzte Variable ist auch definiert", () => {
  const benutzt = new Set((STIL.match(/var\(--[a-z0-9-]+/g) || []).map(x => x.slice(4)));
  (RUMPF.match(/var\(--[a-z0-9-]+/g) || []).forEach(x => benutzt.add(x.slice(4)));
  const fehlt = [...benutzt].filter(v => !(v in hell));
  gleich(fehlt, [], "nicht definiert");
});

t("Der dunkle Modus lässt keine Farbe stehen", () => {
  /* Farben müssen umschalten. Maße, Schriften und Radien gelten für beide. */
  const farbig = k => /^--(paper|card|card-2|fill|fill-2|ink|ink-2|ink-3|line|line-2|herb|herb-bg|sea|sea-bg|beet|beet-bg|sun|sun-bg|schatten)$/.test(k);
  const fehlt = Object.keys(hell).filter(farbig).filter(k => !(k in dunkel));
  gleich(fehlt, [], "im dunklen Modus nicht neu gesetzt");
});

t("Der dunkle Modus erfindet keine Variable dazu", () => {
  const fremd = Object.keys(dunkel).filter(k => !(k in hell));
  gleich(fremd, [], "nur im dunklen Modus definiert");
});

t("Hell und dunkel sind wirklich verschieden", () => {
  ["--paper", "--card", "--ink"].forEach(k =>
    wahr(hell[k] !== dunkel[k], k + " ist in beiden Modi gleich"));
});

gruppe("Bedienbarkeit auf dem Handy");

t("Eingabefelder sind mindestens 16px groß, sonst zoomt iOS beim Tippen", () => {
  const felder = STIL.match(/input\[type=text\][^{]*\{([^}]*)\}/);
  wahr(felder && +(felder[1].match(/font-size:(\d+)/) || [])[1] >= 16, "zu klein");
  const ta = STIL.match(/\ntextarea\{([^}]*)\}/);
  wahr(ta && +(ta[1].match(/font-size:(\d+)/) || [])[1] >= 16, "Textfeld zu klein");
});

t("Knöpfe und Zeilen sind groß genug zum Antippen", () => {
  const mind = (sel, px) => {
    const m = STIL.match(new RegExp(sel.replace(/[.[\]]/g, "\\$&") + "\\{([^}]*)\\}"));
    wahr(m, sel + " fehlt");
    const h = +(m[1].match(/min-height:(\d+)/) || [])[1];
    wahr(h >= px, sel + " nur " + h + "px");
  };
  mind(".btn", 44);
  mind(".zeile", 44);
  mind(".item", 44);
  wahr(+(STIL.match(/--nav-h:(\d+)/) || [])[1] >= 44, "Navigationsleiste zu flach");
});

t("Systemleisten oben und unten bleiben frei", () => {
  wahr(/env\(safe-area-inset-top\)/.test(STIL), "oben fehlt");
  wahr(/env\(safe-area-inset-bottom\)/.test(STIL), "unten fehlt");
});

t("Blätter messen die wirklich sichtbare Höhe und fangen den Wisch ab", () => {
  const regel = (STIL.match(/\.sheet-in\{[^}]*\}/) || [""])[0];
  wahr(/max-height:\s*\d+vh/.test(regel), "vh als Rückfall");
  wahr(/max-height:\s*\d+dvh/.test(regel), "dvh fehlt");
  wahr(/overscroll-behavior:\s*contain/.test(regel), "overscroll-behavior fehlt");
});

t("Wer Bewegung reduziert, bekommt keine", () => {
  wahr(/prefers-reduced-motion:reduce/.test(STIL));
});

gruppe("Ruhige Oberfläche");

t("Keine Schrift von einem fremden Server", () => {
  wahr(!/@font-face|fonts\.googleapis|fonts\.gstatic/.test(QUELLE), "Webfont eingebunden");
  wahr(/-apple-system/.test(STIL), "Systemschrift fehlt");
});

t("Bedienzeichen sind Vektoren, keine Emoji", () => {
  /* Lebensmittel-Emoji auf der Einkaufsliste sind Inhalt und ausdrücklich erlaubt –
     sie stehen in SYMBOLE. Verboten sind Emoji als Knopfbeschriftung. */
  const knoepfe = RUMPF.match(/aria-label="[^"]*">[^<$]*</g) || [];
  const mitEmoji = knoepfe.filter(k => /[\u{1F300}-\u{1FAFF}\u{2190}-\u{21FF}\u{2700}-\u{27BF}]/u.test(k));
  gleich(mitEmoji, [], "Emoji als Knopfbeschriftung");
  wahr(/const IKON=\{/.test(RUMPF), "Symbolsatz fehlt");
});

t("Die Lebensmittel-Emoji der Einkaufsliste bleiben erhalten", () => {
  wahr(A.symbolFuer("Möhren").length > 0, "Möhren ohne Symbol");
  wahr(/SYMBOLE/.test(RUMPF), "Symboltabelle fehlt");
});

t("Farben stehen in Variablen, nicht fest im Markup", () => {
  const feste = (RUMPF.match(/(background|color|border-color)\s*:\s*#[0-9a-fA-F]{3,8}/g) || []);
  gleich(feste, [], "feste Farbwerte im Markup");
});

t("Es gibt genau eine Leitfarbe", () => {
  /* Grün trägt Fortschritt, Erfolg und die aktive Leiste. Blau, Rot und Orange
     erscheinen nur, wo sie etwas bedeuten. */
  gleich(hell["--akz"], "var(--herb)", "Leitfarbe nicht gesetzt");
  const navAktiv = STIL.match(/nav button\[aria-current="page"\]\{([^}]*)\}/);
  wahr(navAktiv && /var\(--herb\)/.test(navAktiv[1]), "Navigation nutzt nicht die Leitfarbe");
});

t("Kennzeichen tragen graue Flächen, nur die Schrift ist farbig", () => {
  const tag = (STIL.match(/\n\.tag\{([^}]*)\}/) || ["", ""])[1];
  wahr(/background:var\(--fill\)/.test(tag), "Kennzeichen haben eine bunte Fläche");
});

t("Die Auswahl sieht überall gleich aus", () => {
  ["\\.chip\\[aria-pressed=\"true\"\\]", "\\.pickrow button\\[aria-pressed=\"true\"\\]",
   "\\.toggle button\\[aria-pressed=\"true\"\\]"].forEach(sel => {
    const m = STIL.match(new RegExp(sel + "\\{([^}]*)\\}"));
    wahr(m && /background:var\(--card\)/.test(m[1]), sel + " weicht ab");
  });
});

t("Keine Steuerzeichen im Quelltext", () => {
  /* JavaScriptCore verzeiht sie, Chrome bricht daran ab – einmal passiert. */
  const treffer = QUELLE.match(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g);
  gleich(treffer, null, "Steuerzeichen gefunden");
});

bilanz();
