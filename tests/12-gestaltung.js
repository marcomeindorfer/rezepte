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
  const farbig = k => /^--(paper|card|card-2|fill|fill-2|ink|ink-2|ink-3|line|line-2|herb|herb-bg|sea|sea-bg|beet|beet-bg|sun|sun-bg|gefahr|schatten)$/.test(k);
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

t("Es gibt überhaupt keine Emoji, nur Vektoren", () => {
  /* Bis 3.7 trug jede Zeile der Einkaufsliste ein Lebensmittel-Emoji. Sie sahen auf
     jedem Gerät anders aus, ließen sich nicht einfärben und trugen im Markt nichts
     bei – der Name steht ohnehin daneben. Jetzt gilt die Regel ohne Ausnahme. */
  const emoji = [...RUMPF].filter(c => c.codePointAt(0) > 0x1F000);
  gleich(emoji.slice(0, 8), [], "Emoji im Markup");
  wahr(/const IKON=\{/.test(RUMPF), "Symbolsatz fehlt");
});

t("Die Einkaufszeile zeigt nur den Namen", () => {
  wahr(!/symbolFuer/.test(RUMPF), "Symbolfunktion noch vorhanden");
  wahr(!/const SYMBOLE=/.test(RUMPF), "Symboltabelle noch vorhanden");
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

gruppe("Rangfolge auf den Bildschirmen");

function frisch() {
  A.S = A.leer(); A.S.plan = {}; A.S.liste = {}; A.S.eigene = {};
  A.cfg = { db: "", hid: "", leser: "" };
  A.planWoche = 0; A.filter = "alle"; A.suche = ""; A.einkaufAnsicht = "woche";
  A.erledigtWeg = false; A.routeOffen = false;
}
const knoepfe = h => (h.match(/<button/g) || []).length;

t("Gefahr und Kategorie sind zwei verschiedene Farben", () => {
  /* Fleisch ist kein Fehler und darf nicht rot wie ein Löschknopf aussehen. */
  wahr(hell["--gefahr"], "keine eigene Gefahrenfarbe");
  wahr(hell["--gefahr"] !== hell["--beet"], "Gefahr und Fleisch sind dieselbe Farbe");
  const badge = (STIL.match(/\.badge\{([^}]*)\}/) || ["", ""])[1];
  wahr(/var\(--gefahr\)/.test(badge), "Der Zähler nutzt die Kategoriefarbe");
  wahr(/var\(--beet\)/.test((STIL.match(/\.t-fleisch\{([^}]*)\}/) || ["", ""])[1]),
    "Fleisch nutzt nicht mehr seine eigene Farbe");
});

t("Vor dem Wochenplan steht nur, was zur Woche gehört", () => {
  frisch();
  A.autoWoche();
  const oben = A.vWoche().split('<div class="sect"><h2>Plan</h2>')[0];
  /* Die Knöpfe der Heute-Karte sind Inhalt (Gericht öffnen, kochen) und zählen
     nicht als Beiwerk. Gemeint ist die Handlungsreihe der Zustandskarte. */
  const reihe = (oben.match(/padding-top:12px">([\s\S]*?)<\/div>/) || ["", ""])[1];
  wahr(knoepfe(reihe) <= 3, "zu viele Handlungen: " + knoepfe(reihe));
  /* Zustand zuerst, Handlungen darunter – nicht umgekehrt */
  wahr(oben.indexOf("von 21 geplant") < oben.indexOf("Woche vorschlagen"),
    "Die Aktionen stehen über dem Zustand");
  wahr(oben.indexOf("Heute") < oben.indexOf("von 21 geplant"),
    "Der heutige Tag steht nicht oben");
});

t("Was nichts kostet, wird nicht gemeldet", () => {
  frisch();
  /* Ohne Prospekt gab es früher jede Woche die Zeile „kein Prospekt hinterlegt" */
  wahr(!/kein Prospekt/.test(A.vWoche()), "Leermeldung über Prospekte");
});

t("Auf dem Rezeptbildschirm kommt die Suche zuerst", () => {
  frisch();
  const h = A.vRezepte();
  wahr(h.indexOf('id="sq"') < h.indexOf('class="chips"'), "Filter vor der Suche");
  wahr(h.indexOf('id="sq"') < h.indexOf("Eigenes Rezept anlegen"), "Anlegen vor der Suche");
});

t("Die Rezeptzeile bietet nicht das Löschen als erstes an", () => {
  frisch();
  A.S.eigene = { t1: { id: "t1", n: "Test", k: "veg", typ: "haupt", ma: ["a"], m: A.ALL,
    min: 20, p: 20, bl: 0, nut: [], why: "Test.", z: [["Mehl", 100, "g", "tr"]], s: [] } };
  A.S.sammlung = { t1: Date.now() };
  const h = A.trefferHtml();
  wahr(/Test/.test(h), "Rezept fehlt");
  wahr(!/aria-label="Entfernen"/.test(h), "Entfernen steht wieder auf der Zeile");
});

t("Die Einkaufsliste zeigt den Zustand, dann die Handlungen, dann die Posten", () => {
  frisch();
  A.S.liste = { brot: { n: "Brot", q: 1, e: "Stk", k: "bw", on: false } };
  const h = A.vEinkauf();
  const bis = h.split('<div class="route">')[0];
  wahr(knoepfe(bis) <= 6, "zu viel über der Liste: " + knoepfe(bis) + " Knöpfe");
  wahr(bis.indexOf("erledigt") < bis.indexOf("Weiteres"), "Handlungen vor dem Zustand");
});

t("Wochenplan und Einkauf benutzen dieselbe Zustandskarte", () => {
  frisch();
  A.autoWoche();
  A.S.liste = { brot: { n: "Brot", q: 1, e: "Stk", k: "bw", on: false } };
  [A.vWoche(), A.vEinkauf()].forEach(h => {
    wahr(/<div class="progress">/.test(h), "Fortschrittsbalken fehlt");
    wahr(/border-top:0\.5px solid var\(--line\);padding-top:12px/.test(h),
      "Die Handlungen sind nicht abgesetzt");
  });
});

bilanz();
