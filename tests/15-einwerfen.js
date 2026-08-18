/* Einwerfen: ein ganzer Rezeptblock aus unordentlicher Quelle wird zerlegt.
   Die vier Fälle stehen für die vier Wege, auf denen Rezepte ankommen:
   Videobeschreibung, Blogseite, abgetippte Notiz, Fließtext aus einer Nachricht. */
load("tests/harness.js");

function frisch() {
  A.S = A.leer(); A.cfg = { db: "", hid: "", leser: "" }; A.queue = [];
}
const ordne = t => A.textEinordnen(t);
const teil = (r, art) => r.liste.filter(x => x.art === art).map(x => x.t);
const zutaten = r => teil(r, "zutat");
const schritte = r => teil(r, "schritt");
const enthaelt = (liste, teilstring) => liste.some(z => z.includes(teilstring));

const TIKTOK = `CREAMY GNOCCHI 🍝😍 speichern nicht vergessen!!
Werbung | enthält Markennennung

Ihr braucht:
500g Gnocchi
200 ml Sahne
2 Knoblauchzehen
1 Handvoll Spinat

Und so gehts:
Gnocchi in der Pfanne anbraten, mit Sahne ablöschen und den Spinat unterheben 🤤
Dauert bei mir 15 Minuten!!

#gnocchi #schnellerezepte
Folgt mir für mehr @kochenmitlisa`;

gruppe("Videobeschreibung");
t("Zutaten vor der Zubereitungs-Überschrift gehen nicht verloren", () => {
  frisch();
  const z = zutaten(ordne(TIKTOK));
  gleich(z.length, 4, "alle vier Zutaten");
  wahr(enthaelt(z, "Gnocchi") && enthaelt(z, "Sahne") && enthaelt(z, "Spinat"), "namentlich dabei");
});
t("„Ihr braucht“ wird als Zutaten-Überschrift verstanden", () => {
  frisch();
  const r = ordne("Ihr braucht:\nSalz\nPfeffer");
  gleich(zutaten(r).length, 2);
});
t("Der Titel verliert Bildzeichen und den Aufruf zum Speichern", () => {
  frisch();
  gleich(ordne(TIKTOK).funde.titel, "CREAMY GNOCCHI");
});
t("Die Dauer aus einem Nebensatz wird übernommen", () => {
  frisch();
  gleich(ordne(TIKTOK).funde.minuten, 15);
});
t("Hashtags, Werbung und Kontonamen bleiben draußen", () => {
  frisch();
  const alles = zutaten(ordne(TIKTOK)).concat(schritte(ordne(TIKTOK))).join(" ");
  wahr(!/#gnocchi/.test(alles), "keine Hashtags");
  wahr(!/Werbung/.test(alles), "keine Werbung");
  wahr(!/kochenmitlisa/.test(alles), "kein Konto");
});
t("Bildzeichen verschwinden auch aus den Schritten", () => {
  frisch();
  wahr(!/🤤/.test(schritte(ordne(TIKTOK)).join(" ")));
});

const BLOG = `Startseite » Rezepte » Vegetarisch
Zum Rezept springen

Ofengemüse mit Feta

4.8 von 127 Bewertungen

Vorbereitungszeit 15 Minuten
Kochzeit 35 Minuten
Gesamtzeit 50 Minuten
Portionen 4 Portionen
Kalorien 420 kcal

Zutaten
1x 2x 3x
600 g Kartoffeln festkochend
2 rote Paprika
200 g Feta

Zubereitung
Den Backofen auf 200 °C vorheizen.
Kartoffeln waschen und in Spalten schneiden.

Nährwerte
Kalorien: 420kcal | Eiweiß: 14g`;

gruppe("Blogseite");
t("Der Rezepttitel gewinnt gegen Brotkrumen und Bewertung", () => {
  frisch();
  gleich(ordne(BLOG).funde.titel, "Ofengemüse mit Feta");
});
t("Die Gesamtzeit schlägt die Einzelzeiten", () => {
  frisch();
  gleich(ordne(BLOG).funde.minuten, 50);
});
t("Die Portionsangabe wird auch hinter dem Wort gefunden", () => {
  frisch();
  gleich(ordne(BLOG).funde.portionen, 4);
});
t("Der Mengen-Umrechner der Seite ist keine Zutat", () => {
  frisch();
  wahr(!enthaelt(zutaten(ordne(BLOG)), "2x"));
});
t("Nährwerte und Knopfbeschriftungen bleiben draußen", () => {
  frisch();
  const r = ordne(BLOG);
  const drin = zutaten(r).concat(schritte(r)).join(" ");
  wahr(!/kcal/i.test(drin) && !/Zum Rezept springen/.test(drin));
});
t("Zutaten und Schritte landen vollständig im richtigen Topf", () => {
  frisch();
  const r = ordne(BLOG);
  gleich(zutaten(r).length, 3);
  gleich(schritte(r).length, 2);
});

gruppe("Abgetippte Notiz");
t("Ohne jede Überschrift wird trotzdem sauber getrennt", () => {
  frisch();
  const r = ordne(`Linsensuppe wie von Oma
1 Tasse rote Linsen
2 Möhren
1 l Gemüsebrühe

Zwiebel und Möhren klein schneiden, in Öl anschwitzen.
Linsen und Brühe dazu, 20 min köcheln lassen.`);
  gleich(r.funde.titel, "Linsensuppe wie von Oma");
  gleich(zutaten(r).length, 3);
  gleich(schritte(r).length, 2);
});
t("Eine Zeitangabe innerhalb eines Schritts ist nicht die Gesamtdauer", () => {
  frisch();
  const r = ordne("200 g Linsen\nLinsen und Brühe dazu, 20 min köcheln lassen.");
  gleich(r.funde.minuten, 0, "20 Minuten Köcheln sind nicht die Gesamtzeit");
  gleich(schritte(r).length, 1, "der Schritt bleibt erhalten");
});

gruppe("Fließtext aus einer Nachricht");
t("Aufgezählte Zutaten werden aus dem Satz gelöst", () => {
  frisch();
  const r = ordne("Für die Pasta brauchst du 300 g Spaghetti, 150 g Pancetta, 3 Eier und Pfeffer. Die Nudeln kochst du al dente. Danach den Pancetta auslassen.");
  const z = zutaten(r);
  gleich(z.length, 4);
  wahr(enthaelt(z, "300 g Spaghetti") && enthaelt(z, "Pfeffer"), "erste und letzte Zutat dabei");
  wahr(schritte(r).length >= 2, "die Sätze werden zu einzelnen Schritten");
});
t("Ein Satz ohne Mengen wird nicht zerpflückt", () => {
  frisch();
  const r = ordne("Du brauchst Geduld, Zeit und einen großen Topf. Wasser aufsetzen und salzen.");
  gleich(zutaten(r).length, 0, "keine erfundenen Zutaten");
});
t("Steht schon eine echte Zutatenzeile da, bleibt der Satz ein Schritt", () => {
  frisch();
  const r = ordne("300 g Mehl\nDu brauchst 2 Eier, 100 ml Milch und Salz, das verrührst du.");
  wahr(enthaelt(zutaten(r), "300 g Mehl"), "die Zeile bleibt Zutat");
});

gruppe("Übernahme ins Formular");
t("Aus dem Prüfblatt wandern Zutaten, Schritte, Titel, Dauer und Portionen ins Rezept", () => {
  frisch();
  A.neuesRezept();
  A.pruefStart(BLOG);
  A.pruefUebernehmen();
  const nf = A.nf;
  gleich(nf.n, "Ofengemüse mit Feta");
  gleich(nf.min, 50);
  gleich(nf.port, 4);
  wahr(/Feta/.test(nf.zText), "Zutaten übernommen");
  wahr(/Backofen/.test(nf.sText), "Schritte übernommen");
});
t("Ein leeres Einwurffeld meldet sich, statt ein leeres Prüfblatt zu zeigen", () => {
  frisch();
  A.neuesRezept();
  A.nf.roh = "Hallo";
  A.einwurfAuswerten();
  wahr(/zu wenig/.test(A.nf.status), "es kommt ein Hinweis");
});

gruppe("Mengen in Worten");
const zut = z => A.parseZutat(z);
t("Zahlwörter werden zu Mengen", () => {
  frisch();
  gleich(zut("zwei Zwiebeln").slice(0, 3), ["Zwiebeln", 2, "Stk"]);
  gleich(zut("drei Eier").slice(0, 3), ["Eier", 3, "Stk"]);
});
t("Alltagsmaße gelten als Einheit", () => {
  frisch();
  gleich(zut("eine Handvoll Nüsse").slice(0, 3), ["Nüsse", 1, "Handvoll"]);
  gleich(zut("ein Schuss Olivenöl").slice(0, 3), ["Olivenöl", 1, "Schuss"]);
  gleich(zut("ein Päckchen Backpulver").slice(0, 3), ["Backpulver", 1, "Packung"]);
});
t("Halbe Mengen werden gerechnet", () => {
  frisch();
  gleich(zut("ein halber Bund Petersilie").slice(0, 3), ["Petersilie", 0.5, "Bund"]);
});
t("Unbestimmte Angaben verschwinden aus dem Namen, ohne eine Menge zu erfinden", () => {
  frisch();
  gleich(zut("etwas Kreuzkümmel").slice(0, 3), ["Kreuzkümmel", 0, ""]);
  gleich(zut("nach Belieben Chili").slice(0, 3), ["Chili", 0, ""]);
  gleich(zut("je 100 g Möhren").slice(0, 3), ["Möhren", 100, "g"]);
});
t("Ein Satz, der mit einem Zahlwort anfängt, bleibt ein Schritt", () => {
  frisch();
  const r = ordne("200 g Mehl\nEine Stunde ruhen lassen.");
  wahr(enthaelt(schritte(r), "Eine Stunde ruhen lassen."), "die Stunde ist keine Zutat");
});

gruppe("Mehrere Zutaten in einer Zeile");
t("Aufgereihte Gewürze werden getrennt", () => {
  frisch();
  gleich(A.zutatZeileTeilen("Salz Pfeffer Muskat"), ["Salz", "Pfeffer", "Muskat"]);
  gleich(A.zutatZeileTeilen("Salz und Pfeffer"), ["Salz", "Pfeffer"]);
  gleich(A.zutatZeileTeilen("Zwiebel, Knoblauch, Möhre"), ["Zwiebel", "Knoblauch", "Möhre"]);
});
t("Beschreibende Zusätze werden nicht abgetrennt", () => {
  frisch();
  ["Kartoffeln festkochend", "Paprikapulver edelsüß", "Petersilie, gehackt",
   "Tomaten in Scheiben", "Öl zum Braten", "Parmesan zum drüberstreuen"]
    .forEach(z => gleich(A.zutatZeileTeilen(z), null, z));
});
t("Zwei Wörter ohne Trennzeichen bleiben zusammen", () => {
  frisch();
  gleich(A.zutatZeileTeilen("Rote Bete"), null);
  gleich(A.zutatZeileTeilen("Feta Käse"), null, "sonst zerfiele jede zweiteilige Zutat");
});
t("Mit Menge bleibt die Zeile eine Zutat", () => {
  frisch();
  gleich(A.zutatZeileTeilen("200 g Salz und Pfeffer"), null, "sonst ginge die Menge verloren");
});
t("Im Prüfblatt steht, dass getrennt wurde", () => {
  frisch();
  const r = ordne("Zutaten\nSalz Pfeffer Muskat");
  const z = r.liste.filter(x => x.art === "zutat");
  gleich(z.length, 3);
  wahr(z.every(x => /getrennt/.test(x.grund)), "mit Begründung");
});

/* Beide Fälle sind erst im Browser aufgefallen, nicht in den Modulprüfungen:
   die Bindung klebte zwei Zutatenzeilen zusammen, und der Titel behielt das
   angehängte „speichern". */
gruppe("Was der Browsertest zutage gebracht hat");
t("Zwei Zutatenzeilen mit Wortmenge werden nicht zusammengeklebt", () => {
  frisch();
  const r = ordne("Ihr braucht:\nzwei Handvoll Kirschtomaten\nein Schuss Olivenöl");
  gleich(zutaten(r), ["zwei Handvoll Kirschtomaten", "ein Schuss Olivenöl"]);
});
t("Ein angehängtes „speichern!!“ fällt aus dem Titel", () => {
  frisch();
  gleich(ordne("Ofen-Feta-Pasta 🔥 speichern!!\n\nZutaten\n250 g Nudeln").funde.titel, "Ofen-Feta-Pasta");
});
t("Ein Titel, der nur aus dem Wort bestünde, bleibt stehen", () => {
  frisch();
  gleich(A.titelSaeubern("Speichern"), "Speichern", "sonst hieße das Rezept nichts");
});

bilanz();
