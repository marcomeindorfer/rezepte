/* Die abfotografierte Kochbuchseite – der Fall, an dem der Foto-Import bisher
   gescheitert ist. Nachgestellt wird die Seite „Nusskuchen mit Möhren und
   Sauerrahm“ so, wie tesseract sie liefert: als Wörter mit Koordinaten, quer
   über zwei Spalten, mit Trennstrichen am Zeilenende.

   Geprüft wird nicht die Texterkennung selbst – die braucht einen Browser –,
   sondern alles danach: Spalten finden, Zeilen bauen, Trennungen auflösen,
   Kopfdaten lesen, Fremdes aussortieren. */
load("tests/harness.js");

/* Aus einer Textzeile Wörter mit Kästchen machen. Die Breite wächst mit der
   Wortlänge, damit die Spaltenlücke entsteht wie auf echtem Papier. */
function zeile(x, y, text, hoehe) {
  const h = hoehe || 26;
  const woerter = [];
  let x0 = x;
  text.split(" ").forEach(w => {
    const b = w.length * 9 + 4;
    woerter.push({ text: w, conf: 88, x0, x1: x0 + b, y0: y, y1: y + h });
    x0 += b + 7;
  });
  return woerter;
}
function spalte(x, ab, zeilen, schritt) {
  const raus = [];
  zeilen.forEach((t, i) => raus.push(...zeile(x, ab + i * (schritt || 42), t)));
  return raus;
}

/* Linke Spalte: Titel, sechs nummerierte Schritte, danach der Ernährungskasten
   und die Seitenzahl – beides gehört nicht ins Rezept. */
const LINKS = [
  "NUSSKUCHEN",
  "MIT MÖHREN UND SAUERRAHM",
  "1. Den Backofen auf 180 °C vorheizen. Die Form mit Back-",
  "papier auslegen.",
  "2. Die Möhren putzen, schälen und auf der Gemüsereibe fein",
  "raspeln, danach auf Küchenpapier abtropfen lassen.",
  "3. In einer Rührschüssel die weiche Butter, Zucker, Gewürze",
  "und 1 Prise Salz mit den Quirlen des Handrührgeräts etwa",
  "5 Minuten cremig rühren. Die Eier einzeln dazugeben und",
  "jeweils etwa ½ Minute gut unterrühren. Gemahlene und",
  "gehackte Nüsse, Mehl und Backpulver mischen. Abwech-",
  "selnd mit saurer Sahne und Möhrenraspeln unterrühren.",
  "4. Den Teig in die Form füllen und etwas glatt streichen. Den",
  "Kuchen im Ofen auf der mittleren Schiene 50 bis 55 Minu-",
  "ten backen (Stäbchenprobe machen!).",
  "5. Danach den Kuchen aus dem Ofen nehmen und auf einem",
  "Kuchengitter etwa 10 Minuten abkühlen lassen, dann mit-",
  "hilfe des Backpapiers vorsichtig stürzen. Das Backpapier",
  "abziehen und den Kuchen etwa 1 Stunde abkühlen lassen.",
  "6. Zum Garnieren die Schokolade grob hacken und in einer",
  "Metallschüssel über dem heißen Wasserbad unter Rühren",
  "schmelzen. Den Kuchen damit beträufeln, mit den Hasel-",
  "nussblättchen bestreuen und fest werden lassen.",
  "Die Ernährungs-Docs",
  "Dieser Kuchen geht als gesunde Süßigkeit durch. Denn mit Möhren, Nüssen, Voll-",
  "kornmehl, Eiern und saurer Sahne vereint er so viele günstige Zutaten, dass diese den",
  "Zucker und die Butter locker aufwiegen.",
  "204 Süßes"
];
/* Rechte Spalte: Kopfdaten, Zutatenliste, Nährwerte */
const RECHTS = [
  "Für 1 Kastenform",
  "(ca. 25 cm Länge; 18 Scheiben)",
  "Zubereitung: 30 Minuten",
  "Backen: 55 Minuten",
  "Abkühlen: 1 Stunde",
  "200 g Möhren",
  "100 g weiche Butter",
  "50 g Vollrohrzucker",
  "(z. B. Muscovado)",
  "½ TL Zimtpulver",
  "½ TL gemahlene Vanille",
  "1 Msp. Nelkenpulver, Salz",
  "6 Eier (Größe M)",
  "200 g gemahlene Haselnusskerne",
  "100 g gehackte Haselnusskerne",
  "100 g Dinkel-Vollkornmehl",
  "4 TL Weinsteinbackpulver",
  "100 g saure Sahne (10 % Fett)",
  "50 g Bitterschokolade",
  "(mind. 70 % Kakaoanteil)",
  "20 g grob gehackte Haselnusskerne",
  "Pro Scheibe: ca. 245 kcal,",
  "7 g EW, 19 g F, 10 g KH, 3 g BST"
];
const seite = () => [...spalte(90, 100, LINKS), ...spalte(900, 110, RECHTS)];

const text = () => A.buchseiteLesen(seite(), "");
const gelesen = () => A.textEinordnen(text());
const teilVon = (e, art) => e.liste.filter(x => x.art === art).map(x => x.t);

gruppe("Die Seite auseinandernehmen");
t("Die Spaltenlücke wird gefunden", () => {
  const x = A.spaltenLuecke(seite());
  wahr(x > 700 && x < 900, "Lücke bei " + Math.round(x) + " statt zwischen den Spalten");
});
t("Die Zutatenspalte wird als solche erkannt", () => {
  const o = A.seiteOrdnen(seite());
  wahr(o, "die Seite gilt als einspaltig");
  wahr(o.zutaten.some(z => /200 g Möhren/.test(z.t)), "Möhren stehen nicht in der Zutatenspalte");
  wahr(o.schritte.some(z => /^1\./.test(z.t)), "die Schritte stehen nicht in der Schrittspalte");
});
t("Ein Zettel ohne Spalten bleibt ein Zettel", () => {
  const einspaltig = spalte(100, 100, ["200 g Möhren", "100 g Butter", "Alles verrühren und backen."]);
  gleich(A.spaltenLuecke(einspaltig), 0, "da war keine Spalte");
});

gruppe("Trennstriche und Titel");
t("Am Zeilenende getrennte Wörter werden wieder eins", () => {
  gleich(A.trennungenFuegen(["Die Form mit Back-", "papier auslegen."]),
    ["Die Form mit Backpapier auslegen."]);
  gleich(A.trennungenFuegen(["50 bis 55 Minu-", "ten backen."]), ["50 bis 55 Minuten backen."]);
});
t("Ein Bindestrich vor einem großen Buchstaben bleibt stehen", () => {
  gleich(A.trennungenFuegen(["100 g Dinkel-", "Vollkornmehl"]), ["100 g Dinkel-Vollkornmehl"]);
});
t("Ein Titel über zwei Zeilen bleibt ein Titel", () => {
  gleich(A.titelzeilenFuegen(["NUSSKUCHEN", "MIT MÖHREN UND SAUERRAHM", "Für 1 Kastenform"]),
    ["NUSSKUCHEN MIT MÖHREN UND SAUERRAHM", "Für 1 Kastenform"]);
});
t("Ein Zusatz unter der Zutat gehört an die Zutat", () => {
  gleich(A.zutatenzeilenFuegen(["50 g Vollrohrzucker", "(z. B. Muscovado)", "½ TL Zimtpulver"]),
    ["50 g Vollrohrzucker (z. B. Muscovado)", "½ TL Zimtpulver"]);
});
t("Was hinter dem letzten Schritt steht, gehört nicht mehr dazu", () => {
  const raus = A.schritteBuendeln([
    "1. Backofen vorheizen.", "2. Kuchen backen und abkühlen lassen.",
    "Die Ernährungs-Docs", "Dieser Kuchen geht als gesunde Süßigkeit durch.", "204 Süßes"]);
  gleich(raus.length, 2, "es sind mehr als die zwei Schritte übrig geblieben");
});

gruppe("Die ganze Seite");
t("Titel, Portionen und Zeit werden gelesen", () => {
  const f = gelesen().funde;
  gleich(f.titel, "NUSSKUCHEN MIT MÖHREN UND SAUERRAHM");
  gleich(f.portionen, 18, "18 Scheiben sind die Portionen");
  gleich(f.minuten, 85, "30 Minuten Zubereitung plus 55 Minuten Backen");
});
t("Alle Zutaten stehen als Zutat da", () => {
  const zut = teilVon(gelesen(), "zutat");
  const soll = ["200 g Möhren", "100 g weiche Butter", "50 g Vollrohrzucker (z. B. Muscovado)",
    "½ TL Zimtpulver", "½ TL gemahlene Vanille", "6 Eier (Größe M)",
    "200 g gemahlene Haselnusskerne", "100 g gehackte Haselnusskerne",
    "100 g Dinkel-Vollkornmehl", "4 TL Weinsteinbackpulver", "100 g saure Sahne (10 % Fett)",
    "50 g Bitterschokolade (mind. 70 % Kakaoanteil)", "20 g grob gehackte Haselnusskerne"];
  soll.forEach(z => wahr(zut.includes(z), "fehlt: " + z));
  wahr(zut.some(z => /Nelkenpulver/.test(z)), "Nelkenpulver fehlt");
});
t("Aus den Zutaten werden Mengen, Einheiten und Abteilungen", () => {
  const zut = A.parseZutaten(teilVon(gelesen(), "zutat").join("\n"));
  const finde = n => zut.find(z => z[0].indexOf(n) === 0);
  gleich(finde("Möhren").slice(1, 3), [200, "g"]);
  gleich(finde("Zimtpulver").slice(1, 3), [0.5, "TL"]);
  gleich(finde("Eier").slice(1, 3), [6, "Stk"]);
  gleich(finde("Möhren")[3], "og", "Möhren gehören zu Obst und Gemüse");
  gleich(zut.filter(z => z[3] === "so").length, 0, "keine Zutat darf ohne Abteilung bleiben");
});
t("Sechs Schritte, jeder in einem Stück", () => {
  const schr = teilVon(gelesen(), "schritt");
  gleich(schr.length, 6, "erwartet sechs Schritte, bekommen: " + schr.length);
  schr.forEach((z, i) => wahr(z.indexOf((i + 1) + ".") === 0, "Schritt " + (i + 1) + " fängt falsch an: " + z));
  wahr(/Backpapier auslegen/.test(schr[0]), "der Trennstrich in „Back-papier“ steht noch");
  wahr(/55 Minuten backen/.test(schr[3]), "der Trennstrich in „Minu-ten“ steht noch");
  wahr(/mithilfe des Backpapiers/.test(schr[4]), "der Trennstrich in „mit-hilfe“ steht noch");
});
t("Ernährungskasten, Nährwerte und Seitenzahl bleiben draußen", () => {
  const e = gelesen();
  const drin = teilVon(e, "zutat").concat(teilVon(e, "schritt")).join(" ");
  ["Ernährungs-Docs", "gesunde Süßigkeit", "204", "kcal", "BST"].forEach(x =>
    wahr(drin.indexOf(x) < 0, "„" + x + "“ hat es ins Rezept geschafft"));
});
t("Aus dem Prüfblatt wird ein Rezept, das die App kennt", () => {
  A.S = A.leer();
  A.neuesRezept();
  A.pruefStart(text());
  A.pruefUebernehmen();
  gleich(A.nf.n, "NUSSKUCHEN MIT MÖHREN UND SAUERRAHM");
  gleich(A.nf.port, 18);
  gleich(A.nf.min, 85);
  gleich(A.parseZutaten(A.nf.zText).length, 14, "es sollten vierzehn Zutatenzeilen sein");
  gleich(A.parseSchritte(A.nf.sText).length, 6);
});

gruppe("Was die Erkennung an Zahlen verdirbt");
t("Eine Zahl, die auf 9 endet, bleibt heil", () => {
  gleich(A.ocrReparieren("19 g Butter"), "19 g Butter");
  gleich(A.ocrReparieren("249 g Mehl"), "249 g Mehl");
});
t("Ein alleinstehendes 9 nach einer Zahl war ein g", () => {
  gleich(A.ocrReparieren("250 9 Möhren"), "250 g Möhren");
});

gruppe("Was die Texterkennung liefert");
t("Wörter werden aus beiden Bauformen von tesseract gelesen", () => {
  const w = { text: "Möhren", confidence: 91, bbox: { x0: 1, y0: 2, x1: 3, y1: 4 } };
  gleich(A.tessWoerter({ words: [w] }).length, 1, "flache Form");
  gleich(A.tessWoerter({ blocks: [{ paragraphs: [{ lines: [{ words: [w] }] }] }] }).length, 1, "verschachtelte Form");
  gleich(A.tessWoerter({ words: [{ text: "  ", bbox: { x0: 1, y0: 2, x1: 3, y1: 4 } }] }).length, 0, "Leeres zählt nicht");
  gleich(A.tessWoerter(null).length, 0, "nichts stürzt nicht ab");
});
t("Die falsche Ausrichtung fällt in der Bewertung durch", () => {
  const kaese = [{ text: "l|", conf: 95, x0: 0, y0: 0, x1: 5, y1: 9 }];
  const echt = "Den Backofen auf Grad vorheizen".split(" ")
    .map((x, i) => ({ text: x, conf: 88, x0: i * 40, y0: 0, x1: i * 40 + 30, y1: 20 }));
  wahr(A.ocrGuete(echt) > A.ocrGuete(kaese), "gedrehte Seite gewinnt");
  gleich(A.ocrGuete([]), 0);
});

gruppe("Wenn die Erkennung Fetzen liefert");
t("Eine Versalzeile bleibt der Titel, auch neben Erkennungsfetzen", () => {
  const e = A.textEinordnen(["NUSSKUCHEN MIT MOEHREN UND SAUERRAHM", "En NOT", "Zutaten",
    "200 g Möhren", "Zubereitung", "1. Alles verrühren und backen."].join("\n"));
  gleich(e.funde.titel, "NUSSKUCHEN MIT MOEHREN UND SAUERRAHM");
});
t("Ohne Versalzeile gewinnt weiterhin die Nähe zu den Zutaten", () => {
  const e = A.textEinordnen(["Kochkarussell", "Cremige Gnocchi mit Spinat", "Zutaten",
    "200 g Gnocchi", "Zubereitung", "1. Alles verrühren."].join("\n"));
  gleich(e.funde.titel, "Cremige Gnocchi mit Spinat");
});

gruppe("Rauschen und Schräglage");
t("Fetzen ohne Buchstaben fliegen raus, Bruchzeichen bleiben", () => {
  const w = (t, c, h) => ({ text: t, conf: c === undefined ? 88 : c, x0: 0, y0: 0, x1: 40, y1: h || 26 });
  const roh = [...Array(14)].map(() => w("Möhren")).concat([w("½"), w("~~", 90), w("Butter", 12), w("Salz", 88, 90)]);
  const raus = A.wortRauschen(roh).map(x => x.text);
  wahr(raus.includes("½"), "das Bruchzeichen ist die halbe Zutatenzeile");
  wahr(!raus.includes("~~"), "Zeichensalat gehört nicht dazu");
  wahr(!raus.includes("Butter"), "zu unsicher gelesen");
  wahr(!raus.includes("Salz"), "aus der Zeilenhöhe gefallen");
});
t("Eine schief fotografierte Seite wird als schief erkannt", () => {
  /* Zwei Spalten, sauber gesetzt, dann um vier Grad gekippt */
  const gerade = [];
  for (let z = 0; z < 20; z++) for (let sp = 0; sp < 2; sp++)
    for (let i = 0; i < 4; i++) gerade.push({ text: "Wort", conf: 88,
      x0: sp * 600 + i * 90, x1: sp * 600 + i * 90 + 70, y0: z * 60, y1: z * 60 + 26 });
  const t4 = Math.tan(4 * Math.PI / 180);
  const schief = gerade.map(w => ({ ...w, y0: w.y0 + w.x0 * t4, y1: w.y1 + w.x0 * t4 }));
  wahr(Math.abs(A.schraeglage(gerade)) <= 0.5, "gerade Seite gilt als schief: " + A.schraeglage(gerade));
  const g = A.schraeglage(schief);
  wahr(g >= 3 && g <= 5, "erwartet rund 4 Grad, gemessen: " + g);
});

/* ===== Das echte Foto =====
   Diese beiden Listen sind kein Nachbau: Es ist wortwörtlich das, was
   tesseract am 3. September 2026 aus dem Foto einer gehaltenen, gewölbten
   Kochbuchseite gelesen hat, nachdem die Seite freigestellt, gedreht und in
   ihre zwei Spalten zerschnitten war. Mit allen Lesefehlern.

   Geprüft wird deshalb nicht, ob die Zeichen stimmen – das tun sie nicht und
   werden sie bei einem Handyfoto nie ganz. Geprüft wird, ob aus diesem Text ein
   Rezept mit der richtigen Gestalt wird: fünfzehn Zutatenzeilen, sechs
   Schritte, die Zeiten, und der Ernährungskasten draußen. */
const ECHT_LINKS = ["F 4", "FA W — (EEE TEENS", "N SSL den [LT Ti 4", "NM u SAN [ HIER",
  "Il - = =]", "AT EUER LTE SE", "(5 | || | [X | Ka al N > Ca I I - MU ei LAN 1}",
  "]l. Den Backofen au) 184, °C vorheizen. Die Morm mit Bac!ı-",
  "papier zuslogen.",
  "z. Die Möhren putzen, schälen und au! der GC emüsereibe fein",
  "raspeln, danach auf Küchenpapter al;tropfen Inssen.",
  "2 In ziner Rührschüss. 1 die weiche Butter, Zucker, CE würze",
  "und i Priss Salz mt den Quirlen ‚es Handrhrgeräts etwa",
  "5 wlinuten eromig vühre Di. Fier,einzeln dazugeben und",
  "jeweils ztiya 4 Minute gut unte rühren. Ge „ahlene un",
  "gehackte Nüsse. Mehl und Bi ckpulver.misc en. Abwech-",
  "selnd mit saurer Sahne und Möhren <speln unter ühren.",
  "©. Den Teigin die Form füllen znd etwas glatt str.ich.n, Ben",
  "Kucher im Ofen auf der mittleren “chiene 50 bis 55 Min. -",
  "ten backen (Stäbchen prol;e machen!).",
  "5. Danach de Kuche aus dem Cfen chmen un] auf einem",
  "Je. che: gitter etwa 10. Minuten hkühlen Iıssen, dann mir-",
  "hilfe des Backpapniers vorsichtig stürzen. Das Back ‚apie:",
  "abzieh2n und den Kuzhen etwa 1 stunde abkühle:: lassen.",
  "6. Zum Camnieren die Schokolarle grob hacken und in einer",
  "Metallsc' üsse! übe: dem 'ıeißen \"Wasserbad unter Rühren",
  "schmelzen. cn Kuchen damit betränfel mit den Hasel-",
  "nussblättehen bestreuzn un fest werden lassen,",
  "© Die Ernöhnmngs-Bocs",
  "Die;er Kucken zeht als gesunde vüßigkeit durch, Denn mit Mölien",
  "kornmehl, Ziern und sauren Sahne vereinten so viele günstige Zutat",
  "204 Süßes"];
const ECHT_RECHTS = ["= . YARSE 1 Da", "RL", "+ SB", "PS",
  "Für ] Xastsnform", "(ca. 25 cm Länge; 18 Schzibe.)",
  "Zu bereiiuäg: 30 Minuten", "Backen: 55 Minuten", "AbkEkühlan: 1Stunds",
  "Z26C 9 Möhren", "iDIg waiche Butter", "50.9 Vollrohrzusker", "(2.B. Muscovade)",
  "VL dimtgulver", "”% TIL gemcehlene Vanill=", "1Msp. Nelkenpulvern Sclz",
  "© Eier (Größz MI", "200g ceinahlene Haselnusskerne", "100 g.gehack!: Haselnusskerne",
  "100g Dirkel-VMollkornmehl", "AUIL Weinsteinbackpulver", "100 y saure Sahne (14.% Sett)",
  "£0Q9 Bitte:schckolade", "(lud. 70% Kakcoanteil)", "205 grob gehuckte Hasel:.usskerns",
  "Pro Sch>ibe: cz. 245 kcal,", "/gEN. 129g 10.9 KH, 34 85T",
  ", Nüssen, Voll-", "ei dass diese den", "it Pflanzenprotein"];
const echtText = () => A.buchText(A.spaltenOrdnen(
  ECHT_LINKS.map(t => ({ t })), ECHT_RECHTS.map(t => ({ t })), []));
const echt = () => A.textEinordnen(echtText());

gruppe("Das echte Foto, so wie es gelesen wurde");
t("Die Zutatenspalte wird als solche erkannt", () => {
  const o = A.spaltenOrdnen(ECHT_LINKS.map(t => ({ t })), ECHT_RECHTS.map(t => ({ t })), []);
  wahr(o.zutaten.some(z => /Möhren/.test(z.t) && /9|g/.test(z.t)), "die Mengen stehen nicht in der Zutatenspalte");
  wahr(o.schritte.some(z => /Backofen/.test(z.t)), "die Schritte stehen nicht in der Schrittspalte");
});
t("Alle vierzehn Zutatenzeilen kommen an", () => {
  const zut = echt().liste.filter(x => x.art === "zutat").map(x => x.t);
  gleich(zut.length, 14, "bekommen: " + zut.length + " → " + zut.join(" | "));
  wahr(zut.some(z => /Vollrohrzusker/.test(z) && /Muscovade/.test(z)), "der Zusatz gehört an die Zeile davor");
  wahr(zut.some(z => /schckolade/.test(z) && /Kakcoanteil/.test(z)), "auch bei der Schokolade");
  wahr(zut.some(z => /Eier/.test(z)), "die Eier fehlen – aus der „6“ wurde ein „©“");
  wahr(zut.some(z => /waiche Butter/.test(z) && !/Möhren/.test(z)), "Butter und Möhren kleben zusammen");
});
/* Fünf statt sechs: Aus „3.“ hat die Erkennung „2 “ ohne Punkt gemacht, und ohne
   Punkt wird bewusst nicht getrennt. Schritt 2 und 3 stehen deshalb in einem
   Absatz – im Prüfblatt eine Sache von zwei Sekunden. */
t("Die Schritte stehen als ganze Absätze da", () => {
  const schr = echt().liste.filter(x => x.art === "schritt").map(x => x.t);
  gleich(schr.length, 5, "bekommen: " + schr.length);
  wahr(/papier zuslogen/.test(schr[0]), "der Trennstrich am Zeilenende steht noch: " + schr[0]);
  wahr(/Rührschüss/.test(schr[1]), "Schritt 3 ist verloren gegangen: " + schr[1]);
  wahr(/ten backen/.test(schr[2]), "„55 Min. -/ten backen“ ist nicht zusammengefügt: " + schr[2]);
  wahr(/nussblättehen/.test(schr[4]), "der letzte Schritt ist unvollständig: " + schr[4]);
});
t("Die Zeiten werden zusammengezählt, Warten zählt nicht", () => {
  gleich(echt().funde.minuten, 85, "30 Minuten Zubereitung plus 55 Minuten Backen");
});
t("Ernährungskasten, Nährwerte und Seitenzahl bleiben draußen", () => {
  const e = echt();
  const drin = e.liste.filter(x => x.art !== "weg").map(x => x.t).join(" ");
  ["Ernöhnmngs", "gesunde", "204", "kcal", "85T", "Pflanzenprotein", "dass diese den"].forEach(x =>
    wahr(drin.indexOf(x) < 0, "„" + x + "“ hat es ins Rezept geschafft"));
});
t("Kein Bruchstück in Großbuchstaben wird zum Titel", () => {
  wahr(!/AT EUER/.test(echt().funde.titel || ""), "ein Erkennungsfetzen ist der Titel geworden");
});

bilanz();
