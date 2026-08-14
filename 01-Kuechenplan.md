# Küchenplan

Wochenplanung für Essen, Rezeptsammlung und Einkaufsliste für zwei Personen.
**Version 3.8**, Stand 14. August 2026. Datei rund 340 KB, 4503 Zeilen, 134 Rezepte
und 48 Ideen. Die Testreihen unter `tests/` prüfen 459 Punkte, Aufruf mit `./tests/run.sh`.

Voraussetzung: Lies zuerst `00-Grundlagen-und-Infrastruktur.md`.

---

## 1. Was die App leistet

- Wochenplan mit **21 Feldern** (7 Tage × Frühstück, Mittag, Abend), für **drei Wochen im Voraus**.
- Automatischer Wochenvorschlag nach festen Regeln.
- Rezeptdatenbank mit 134 Rezepten, erweiterbar durch eigene, importierte und aus Blogs geholte.
- Ideenpool mit 48 Vorschlägen, die nicht in der Sammlung stehen – der Inspirationsbereich.
- Einkaufsliste, sortiert nach dem Laufweg durch den Aldi-Süd-Markt.
- Aldi-Prospekte einlesen und Angebote im Vorschlag berücksichtigen.
- Vorratshaltung, Reste-Tage, zusätzliche Gerichte außerhalb des Plans, weitere Listen (dm und Ähnliches).

---

## 2. Ernährungsregeln (fest verdrahtet)

| Regel | Umsetzung |
|---|---|
| Kein Schweinefleisch | In keinem der 134 Rezepte enthalten, per Test abgesichert |
| 1× Fisch, 1× Fleisch pro Woche | `autoWoche()` setzt genau je einen, Rest vegetarisch |
| Darmfreundlich | Feld `bl` (Blähfaktor 0–2) je Rezept |
| Stillzeit | Schalter `S.still`; nie zwei stark blähende Gerichte am selben Tag |
| Nährstoffe nach der Geburt | Feld `nut`: Eisen, Jod, Omega-3, Folat, B12, Calcium, Zink, Ballaststoffe |
| Sortiment Aldi Süd | Alle Zutaten daran ausgerichtet |
| Beilagenvielfalt | Nudeln, Reis, Kartoffeln, Getreide, Brot, Hülsenfrüchte werden gestreut |
| Protein | Ziel 80 g/Person/Tag, siehe Abschnitt 7 |

---

## 3. Aufbau der Datei

Die `index.html` besteht aus einem HTML-Kopf mit CSS und einem einzigen `<script>`-Block.
Der Skriptteil ist in der Reihenfolge zusammengesetzt, in der er ursprünglich aus
Einzeldateien gebaut wurde. Diese Abschnitte findet man an ihren Kommentarköpfen:

| Abschnitt | Inhalt | Suchbegriff zum Finden |
|---|---|---|
| Stammdaten | `ALL`, `ABT`, `NUT`, `MAHL`, `TAGE`, `REZEPTE` (41 Grundrezepte), `VORRAT_STD` | `const ABT=` |
| Asana-Import Teil 1 | 18 Rezepte aus der alten Sammlung (Frühstück, Mittag, Fisch, Fleisch) | `REZEPTE_ASANA_1` |
| Asana-Import Teil 2 | 48 vegetarische Rezepte | `REZEPTE_ASANA_2` |
| Ergänzungen | 8 darmfreundliche Schnellrezepte, `REZEPTE.push(...)` | `REZEPTE_EXTRA` |
| Rezeptarten | `TYP`, `typVon()`, 8 Snacks, 6 Desserts | `const TYP=` |
| Eigene Rezepte | Formular, Zutatenparser, Teilen-Aufnahme, Import/Export | `KAT_INDEX` |
| Vielfalt und Angebote | `KH`, `khVon()`, Angebotszeiträume, `imAngebot()` | `const KH=` |
| Komfort | Bildschirm wachhalten, Kochmodus, Einplanen-Raster, Liste teilen | `wachHalten` |
| Quellen und PDF | pdf.js-Anbindung, Prospektauswertung, Blog-Feeds | `PDFJS_URL` |
| Extras | Zusatzgerichte, weitere Listen, Symbole, Foto-Import | `extraSchluessel` |
| Ideen | `THEMEN` (12 Wochenthemen) und `IDEEN` (48 Vorschläge) | `const THEMEN=` |
| Hauptlogik | Zustand, Sync, alle Ansichten, Wochenvorschlag | `const KEY=` |

Zum Ändern: In der `index.html` die Stelle per `str_replace` ersetzen. Die Datei ist groß,
deshalb gezielt mit `grep -n` suchen statt sie ganz zu lesen.

---

### Symbole

`tools/icon.py` erzeugt `icon-192.png`, `icon-512.png` und `icon-512-maskable.png` neu:
ein Topf mit Deckel und Dampf, weiß auf Kräutergrün. Die beiden „any"-Symbole haben
abgerundete Ecken, das maskable ist randlos und hält das Motiv im inneren
Sicherheitsbereich von 80 Prozent. Braucht Pillow, sonst nichts.

## 4. Datenmodell

Speicherschlüssel: `kuechenplan.v2` (**nicht ändern**, sonst verwaisen alle Daten).
Firebase-Zugangsdaten liegen getrennt unter `kuechenplan.v2.cfg`, die Warteschlange unter
`kuechenplan.v2.q`.

```
S = {
  sammlung:  { rezeptId: zeitstempelAufnahme },      // welche Rezepte "meine" sind
  spaeter:   { rezeptId: zeitstempel },              // einmal weggewischt, kommt nach 30 Tagen wieder
  archiv:    { rezeptId: zeitstempel },              // zweimal weggewischt oder aussortiert
  geprueft:  { rezeptId: zeitstempel },              // im Aufräum-Stapel behalten, 90 Tage Ruhe
  ideenWeg:  { ideeId: zeitstempel },                // weggelegte Idee, kommt nach 120 Tagen wieder
  eigene:    { rezeptId: rezeptObjekt },             // selbst angelegt, importiert oder Schnellgericht
  angebote:  { "p<datum>": {von,bis,items[],quelle,geholt} },   // ein Eintrag je Prospekt
  quellen:   { id: {n,u,an} },                       // Rezeptblogs für die Feed-Ansicht
  extra:     { "w<woche>_<id>": {r,p} },             // Gerichte außerhalb des Wochenplans
  listen:    { id: {n, items:{id:{n,on}}} },         // zusätzliche Einkaufslisten
  plan:      { "w<0|1|2>-<0..6>-<f|m|a>": {r,p} },   // Wochenplan; p=0 bedeutet Restetag
  liste:     { id: {n,q,e,k,on,gekauft,ang,nach,manuell,fuer[]} }, // fuer = Rezept-Kennungen
  listeInfo: { ausVorrat, gebaut, woche },           // was der Vorrat gedeckt hat
  verlauf:   { zeitstempel: {r,kw} },                // abgeschlossene Wochen, max. 80
  vorrat:    { slug: {n,k,da} },                     // Dinge, die immer da sein sollen
  route:     [Abteilungskürzel...],                  // Laufweg durch den Markt
  still:     true|false,
  portionStd: 2
}
```

### Rezeptobjekt

```js
{
  id, n,                      // Kennung, Name
  k: "veg"|"fisch"|"fleisch", // wird aus den Zutaten abgeleitet, siehe artAusZutaten()
  typ: "haupt"|"fruehstueck"|"snack"|"dessert",
  ma: ["f","m","a"],          // passende Mahlzeiten; bei Snack/Dessert leer
  m: [1..12],                 // Saisonmonate
  min: 30,                    // Zubereitungszeit
  p: 25,                      // Protein je Portion in Gramm
  bl: 0|1|2,                  // Blähfaktor
  nut: ["eisen","jod",...],
  why: "…",                   // ein bis zwei Sätze, warum das Rezept hier steht
  z: [[name, mengeProPortion, einheit, abteilung], ...],
  s: ["Schritt 1", ...],
  q: "https://…",             // optional: Originalquelle
  src: "asana"|"eigen"|"schnell"|"idee"  // "schnell" = ohne Rezept eingetragen, nicht in RZ()
}                                        // "idee" = aus dem Ideenpool übernommen
```

**Alle Mengen gelten für eine Portion** und werden beim Einplanen hochgerechnet. Das ist
die wichtigste Konvention der ganzen App.

### Abteilungen (Laufweg)

`og` Obst & Gemüse · `bw` Backwaren · `kr` Kühlregal · `ff` Fleisch & Fisch ·
`tk` Tiefkühl · `tr` Nudeln, Reis & Konserven · `gw` Öl, Gewürze & Backzutaten ·
`gt` Getränke · `so` Sonstiges

Standardreihenfolge `ABT_STD = ["og","bw","kr","ff","tk","tr","gw","gt","so"]`, vom Nutzer
unter „Einkauf → Weiteres → Reihenfolge der Abteilungen" anpassbar, weil Filialen sich
unterscheiden.

`migrieren()` ergänzt fehlende und entfernt unbekannte Abteilungen im gespeicherten
Laufweg. Was die App dennoch nicht zuordnen kann, zeigt `abteilungSicher()` unter
Sonstiges. Beides sichert dieselbe Zusage: **kein Posten verschwindet aus der Ansicht,
während er im Zähler weiterläuft** – die Liste ließe sich sonst nie abschließen.

Welche Abteilung eine Zutat bekommt, entscheidet `katFuer(name)` in drei Stufen:
zuerst der Index aus den mitgelieferten Rezepten (`KAT_INDEX`, exakter Name gewinnt
immer), dann einfache Mehrzahl-Varianten, zuletzt die Wortregeln `KAT_WORT`. Dort
zählt die Reihenfolge: Drogerie steht vor allem („Zahnpasta" ist keine Pasta),
Tiefkühl vor Frischware, Brühe vor Fleisch. Fleisch und Fisch kommen aus
`ZUT_FLEISCH`/`ZUT_FISCH` – **denselben** Ausdrücken, die auch die Rezeptart bestimmen.
Zwei getrennte Listen liefen früher auseinander: „Speck" machte das Rezept zum
Fleischgericht, landete auf der Einkaufsliste aber unter Sonstiges.

---

## 5. Die fünf Ansichten

### Woche
Ganz oben – nur für die laufende Woche – die **Heute-Karte**: die drei Mahlzeiten des
heutigen Tages, jede mit einem Knopf direkt in den Kochmodus. Die Frage um 17 Uhr lautet
nicht „wie sieht die Woche aus", sondern „was koche ich jetzt".

Darunter eine **Statuskarte**: belegte Felder, Fortschritt, eine Zeile mit der Mischung
(vegetarisch / Fisch / Fleisch / Protein) und die drei Knöpfe *Woche vorschlagen*,
*Abschließen*, *Weiteres*. Ein Hinweis steht nur dort, wenn sich daraus etwas tun lässt –
fehlendes Protein mit dem Knopf „Snack ergänzen" daneben.

Dann der Umschalter für drei Wochen und die **sieben Tageskarten, zugeklappt**. Eine Karte
ist damit eine Zeile: Wochentag, was daraufsteht, „2 von 3". Ein Tipp klappt sie auf, dann
stehen dort wie gewohnt die drei Mahlzeiten mit Portionswahl und Löschknopf. Was offen ist,
merkt sich `tagOffen` – wer ein Gericht wählt, findet den Tag danach noch offen vor.
*Alle aufklappen* schaltet alle sieben auf einmal.

Vorher standen 21 Zeilen mit Portionswahl und Löschknopf zwischen der Heute-Karte und dem
Einkaufsknopf. Was selten gebraucht wird, liegt jetzt unter **Weiteres**: Hinweise,
zusätzliche Gerichte, „Frühstück für alle Tage übernehmen", „Zuletzt gekocht" und
„Plan leeren". Auf der Seite selbst bleibt der Weg von *heute* zu *Einkaufsliste erstellen*.

**0 Portionen bedeutet Restetag** und erzeugt keine Einkäufe.

### Rezepte
Suchfeld, Filterreihe, Trefferliste. Karten zeigen bewusst **nur Art und Protein** –
alle anderen Kennzeichen wurden auf Wunsch entfernt. Papierkorb-Knopf je Rezept:
eigene werden gelöscht, mitgelieferte nur aus der Sammlung genommen, beides mit Rückfrage
und Rücknahme.

Filter: Alle · Unter 25 Min · Darmfreundlich · Frühstück · Mittag · Abend · Fisch ·
Fleisch · Vegetarisch · Snacks · Desserts · Aus eurer Liste · Selbst angelegt · Alle Rezepte.

### Entdecken
Der Inspirationsbereich. Er zeigt **nur Vorschläge, die noch nicht in der Sammlung
stehen** – ein Rezept, das man schon hat, ist keine Entdeckung. Drei Reiter:

- **Ideen** – der Pool aus `IDEEN`: 48 Rezepte, die bewusst nicht Teil von `REZEPTE`
  sind. Sie tauchen weder in der Rezeptliste noch im Wochenvorschlag auf, solange
  niemand sie übernommen hat. Oben steht das **Thema der Woche**, darunter die Karten
  dazu; jede mit Begründung, Zutaten und zwei Knöpfen. Der Titel öffnet die ganze Idee
  samt Schritten.
- **Im Angebot** – dieselben Ideen, aber nur die, deren Zutaten im Prospekt dieser
  Woche stehen. Die Karte nennt den Treffer.
- **Aus dem Netz** – wie bisher die neuesten Beiträge der hinterlegten Blogs.

**Übernehmen** legt eine Kopie unter `S.eigene` an (`src:"idee"`) und trägt sie in die
Sammlung ein – ab da ist es ein Rezept wie jedes andere. **Nicht mein Ding** legt sie
für `FRIST.idee` = 120 Tage unter `S.ideenWeg` ab; danach kommt sie wieder, weil sich
Geschmack ändert.

Das **Thema wechselt mit der Kalenderwoche**: `THEMEN[(kwNummer()-1) % 12]`. Zwölf
Themen ergeben einen Zyklus von einem Vierteljahr. Über „Anderes Thema" lässt sich
vorgreifen; die Wahl gilt bis zum nächsten Öffnen der App.

Das frühere **Aufräumen** liegt seit 3.8 unter **Mehr → Aufräumen**. Es zeigt
Sammlungsrezepte, die seit `FRIST.alt` = 60 Tagen dabei und nie oder seit
`FRIST.ungekocht` = 120 Tagen nicht gekocht wurden. Behalten legt sie für
`FRIST.geprueft` = 90 Tage zur Ruhe, Aussortieren schiebt sie ins Archiv – mit
Rücknahme. Das ist Pflege der eigenen Sammlung und gehört nicht in einen Bereich,
der Neues zeigen soll.

### Einkauf
Jede Zeile hat zwei Ziele: links abhaken, rechts auf die **Menge** tippen zeigt, aus
welchen Gerichten der Posten stammt und wie viel davon auf welches Gericht entfällt.
Unter dem Fortschritt steht, wie viele Zutaten der Vorrat gedeckt hat – sonst wundert
man sich, warum das Olivenöl fehlt, und kauft es sicherheitshalber doch.

Reiter für den Wocheneinkauf und beliebig viele eigene Listen. Kopf mit Fortschritt.
Laufplan: nummerierte Stationen entlang der Abteilungsreihenfolge. Jede Zeile trägt nur
den Namen – die Lebensmittel-Emoji sind seit 3.8 raus: Sie sahen auf jedem Gerät anders
aus, ließen sich nicht einfärben und standen ohnehin neben dem Namen, der dasselbe sagt.
Bei einem Treffer im Prospekt kommt die Pille „Angebot" dazu.
Knöpfe: Erledigte ausblenden, Teilen, Bildschirm anlassen, Reihenfolge anpassen.
Eingabefeld für eigene Posten – **auch bei leerer Liste**, und diese Posten überleben
jeden Neuaufbau.

### Mehr
Seit 3.4 eine kurze Übersicht statt einer langen Rolle: Stillzeit-Modus und
Standardportionen stehen direkt da (ein Tipp genügt), alles andere liegt hinter einer
Zeile mit Kennzahl – Vorrat, Angebote, Rezeptquellen, eigene Rezepte, **Aufräumen**,
Archiv, Abgleich.
Die Blätter kommen aus `MEHR_BLATT`, `mehrOeffnen(name)` öffnet, `mehrZeigen()` zeichnet
nach einer Änderung neu, ohne das Blatt zu schließen oder die Rollposition zu verlieren.

---

## 6. Der Wochenvorschlag

`autoWoche()` ist das Herzstück. Ablauf:

1. **Vorhandenes bleibt stehen.** Vorgeschlagen wird nur für freie Felder, bereits
   eingetragene Gerichte zählen bei allen Regeln mit.
2. **Gewählt wird zuerst aus eurer Sammlung.** Reicht sie für eine Mahlzeit nicht –
   eine Woche hat sieben Plätze je Mahlzeit –, wird aus dem Gesamtbestand aufgefüllt,
   bevor ein Gericht wiederholt wird.
3. Fehlt Fisch oder Fleisch, wird je ein zufälliges freies Mittag- oder Abendfeld belegt.
4. Alle übrigen freien Felder bekommen vegetarische Gerichte.
5. `proteinAuffuellen()` tauscht schwache Tage auf – aber nur eigene Vorschläge,
   nie von Hand gesetzte Felder, und nie unter Bruch der Stillzeit-Regel.

### Bewertungsfunktion `punkte(r)`

```
+3    Rezept hat gerade Saison
-2,5  steht in einer anderen geplanten Woche
-2    kürzlich gekocht (letzte 25 Einträge im Verlauf)
-2    stark blähend im Stillzeit-Modus (-0,5 bei mittel)
+4    Zutat steht im Prospekt der Woche
-1,8  je bereits verplanter Beilage derselben Art
+0..2 Zufall
```

### Harte Regeln

- **Innerhalb einer Woche wird nie wiederholt.** In 120 Testläufen null Dubletten.
- Snacks und Desserts erscheinen nie im Tagesplan (`istTagesgericht()`).
- Nie zwei stark blähende Gerichte am selben Tag im Stillzeit-Modus.
- Mindestens ein Gericht, das noch nie gekocht wurde.
- **Von Hand Eingetragenes bleibt unangetastet** – auch beim Protein-Auffüllen.

Die letzten beiden Punkte galten bis Version 3.0 nur auf dem Papier:
`proteinAuffuellen()` tauschte Gerichte ein, ohne Blähfaktor und Stillzeit-Regel
zu prüfen, und fasste dabei auch selbst gesetzte Felder an. Beides ist seit 3.1
behoben und per Test abgesichert; `nimm()` zieht außerdem eine Wiederholung einem
Verstoß gegen die Stillzeit-Regel vor, wie es der Kommentar dort immer schon sagte.

---

## 7. Protein: die harte Grenze

`PROTEINZIEL = 80`, `PROTEIN_MINDEST = 70` Gramm pro Person und Tag.

**Das Ziel ist mit drei Mahlzeiten nicht erreichbar.** Nachgerechnet: Das proteinreichste
vegetarische Frühstück hat 26 g, das beste vegetarische Mittag- und Abendessen je 26 g –
macht 78 g an einem perfekt zusammengestellten Tag. Bei „einmal Fisch, einmal Fleisch pro
Woche" sind fünf von sieben Tagen rein vegetarisch.

Erreicht wird ein Schnitt von **72 g pro Tag**. Die App sagt das offen und bietet einen
Knopf, der den proteinreichsten Snack (Quark mit Beeren, 22 g) mit sieben Portionen als
Zusatz einplant.

**Wichtige Erfahrung:** Ein früherer Versuch, härter auf 80 g zu optimieren, ließ die
Vielfalt von 56 auf 29 verschiedene Gerichte über drei Wochen einbrechen – der Algorithmus
griff immer zu denselben proteinreichsten Rezepten. Deshalb greift die Optimierung nur
unterhalb von 70 g und wählt aus den drei besten Kandidaten zufällig.

**Der wirksamere Hebel wäre, proteinreiche Hauptgerichte zu ergänzen**, nicht am Algorithmus
zu drehen.

---

## 8. Die Einkaufsliste

`listeBauen()` sammelt die Zutaten aller geplanten Gerichte plus aller Extras der Woche,
multipliziert mit den Portionen, fasst gleiche Zutaten zusammen und sortiert nach Laufweg.

Besonderheiten:

- **Vorrat wird ausgelassen.** Zutaten, die im Vorrat als „da" markiert sind, erscheinen
  nicht. Der Abgleich erfolgt über exakte Namen plus einfache Mehrzahlformen, damit
  „Kokosmilch" nicht als „Milch" durchgeht.
- **Vor dem Erstellen** fragt die App den Vorratsstand ab; fehlende Dinge kommen mit auf die Liste.
- **Zweiter Einkauf:** Abgehakte Posten merken sich in `gekauft` die gekaufte Menge.
  Beim erneuten Bauen erscheint nur die Differenz, gekennzeichnet als „Nachkauf".
  Reicht die vorhandene Menge, bleibt der Posten erledigt.
- **Restetage** (`p === 0`) erzeugen keine Einkäufe.
- **Von Hand ergänzte Posten** (`manuell: true`) überleben jeden Neuaufbau.
- **Angebotsmarkierung** wird beim Bauen eingefroren, gilt also für die Woche, für die
  eingekauft wurde.

---

## 9. Aldi-Angebote

### Weg 1: Prospekt-PDF (empfohlen)

Aldi Süd stellt die Prospekte für drei Wochen im Voraus bereit. Unter „Mehr → Angebote →
Prospekt hinzufügen → Prospekt-PDFs einlesen" können **mehrere Dateien gleichzeitig**
gewählt werden. Je Datei wird der Gültigkeitszeitraum aus der Kopfzeile „Gültig von … – …"
gelesen und ein eigener Eintrag angelegt.

Technisch: pdf.js liest die Textebene, Zeilen werden über die y-Koordinate gruppiert,
Werbe- und Preiszeilen herausgefiltert. Aus einem 30-seitigen Prospekt entstehen rund
950 Einträge, davon etwa 100 Lebensmittel. Nicht-Lebensmittel stören nicht, weil sie auf
keine Zutat passen.

Das Jahr steht nirgends im Prospekt – es wird aus der Nähe zum heutigen Datum erschlossen.

### Weg 2: Website

Der Cloudflare Worker liest unter `/angebote` die datumsbasierten Seiten
`aldi-sued.de/angebote/JJJJ-MM-TT` für 14 Tage und extrahiert Produktnamen aus
Links der Form `/produkt/<name>-<artikelnummer>`.

### Weg 3: Von Hand

Prospekt öffnen, Produkte abtippen, Zeitraum setzen. Preise dürfen dranbleiben.

### Abgleich

`imAngebot(rezept, woche)` und `zutatImAngebot(name, woche)` vergleichen **wortweise**:
Angebotswörter ab vier Buchstaben, abzüglich einer Sperrliste mit Markenfüllwörtern
(„meine", „bio", „gold", „frisch" …). Getroffen wird nur in einer Richtung – die Zutat
darf das Angebotswort enthalten, nicht umgekehrt – plus Wortstamm-Vergleich ab sechs
Buchstaben, damit „Hähnchenbrustfilet" auch Hähnchenschenkel findet.

Der Zeitraum eines Prospekts wird gegen die Kalenderwoche der Planwoche geprüft
(`wochenSpanne(w)`, `deckt()`). Jede Woche sieht nur ihren Prospekt.

**Das Label „Angebot" erscheint ausschließlich in der Einkaufsliste**, nicht auf
Rezeptkarten oder im Plan.

---

## 10a. Schnellgerichte – ohne Rezept einplanen

Nicht alles verdient ein Rezept. „Brot mit Käse und Tomaten" oder „Reste von gestern"
lassen sich direkt dort eintragen, wo geplant wird: im Fenster „Gericht wählen" und bei
den Zusatzgerichten steht oben **„✎ Eigenes Gericht eintragen"**. Name genügt, Zutaten
sind freiwillig (eine je Zeile, wie im Rezeptformular).

Alles Weitere leitet die App ab und fragt nicht nach:

| Feld | Woher |
|---|---|
| Zutaten mit Menge, Einheit, Abteilung | `parseZutaten()`, wie beim Import |
| Art (veg/fisch/fleisch) | `artAusZutaten()` |
| Protein | `proteinSchaetzen()` |
| Zubereitungszeit | `dauerSchaetzen()`, ohne Zutaten pauschal 10 Min |
| Mahlzeit | der Platz, in den eingetragen wird |

**Technisch ein Rezept, aber nicht in der Sammlung.** Ein Schnellgericht liegt in
`S.eigene` mit `src:"schnell"`. Dadurch funktionieren Einkaufsliste, Kochmodus,
Wochenabschluss und die Herkunftsanzeige unverändert. Aus `RZ()` ist es ausgeschlossen –
es taucht also **nicht** auf in Rezeptliste, Wochenvorschlag, Entdecken-Stapel und
Resteküche. Für den Zugriff darauf gibt es `RZ_ALLE()` und `SCHNELL()`.

- **Wiederfinden:** eigener Filter „Schnellgerichte" in der Rezeptansicht, dort auch löschen
  (mit Rücknahme über die Meldungsleiste).
- **Ohne Zutaten:** steht nur im Plan, erzeugt keine Einkäufe – für „Reste" oder „bestellt".
- **Aufräumen:** Was seit `SCHNELL_FRIST` (60 Tage) in keinem Plan, keinem Zusatzgericht
  und keinem Verlauf mehr vorkommt, verschwindet beim Wochenabschluss von selbst –
  mit Grabstein, damit der Abgleich es nicht zurückholt.
- **Beförderung:** Ab `SCHNELL_SCHWELLE` (3× gekocht) bietet die App nach dem
  Wochenabschluss an, daraus ein richtiges Rezept zu machen; `schnellAufnehmen()` öffnet
  das Formular mit Name und Zutaten vorbefüllt. Derselbe Knopf steht auf der Karte.

---

## 10. Rezepte hinzufügen: fünf Wege

1. **Entdecken** – aus den 134 mitgelieferten wischen.
2. **Teilen aus dem Browser** – Küchenplan im Android-Teilen-Menü wählen. Das Formular
   öffnet sich vorbefüllt und holt Zutaten automatisch, wenn der Rezept-Leser hinterlegt ist.
3. **Aus dem Netz** – Feeds der hinterlegten Blogs, Übernahme mit einem Tipp.
   Voreingestellt: eat this!, Bianca Zapatka, Kochkarussell, Emmi kocht einfach,
   Valentinas Kochbuch.
4. **Von Hand** – Formular mit Freitext für Zutaten (`200 g Möhren` je Zeile). Der Parser
   erkennt Menge, Einheit und Abteilung; das Abteilungswissen stammt aus 173 Zutaten der
   mitgelieferten Rezepte plus Wortlisten.
5. **Aus Bild** – tesseract.js erkennt Text aus einem Foto oder Bildschirmfoto. Der Text
   landet zur Korrektur in einem Feld und wird dann in Zutaten und Zubereitung aufgeteilt.

Beim Abruf über den Rezept-Leser wird **automatisch auf eine Portion heruntergerechnet**,
außer bei Backwerk (`BACKWERK`-Regex: Kuchen, Torte, Brot, Muffin, Auflauf, Gratin …).

---

## 11. Der Cloudflare Worker („Rezept-Leser")

Eigenes Programm, nicht in der App enthalten. Adresse wird unter „Mehr" eingetragen.
Aktuell: `https://rezeptleser.marco-meindorfer.workers.dev`

| Route | Zweck |
|---|---|
| `/` | Statusmeldung, dass der Leser läuft |
| `/?url=…` | Rezept auslesen: schema.org/Recipe aus der Seite, sonst YouTube-Beschreibung, sonst nur Titel |
| `/angebote?tage=14` | Aldi-Süd-Angebotsseiten der nächsten Tage |
| `/feed?url=…` | RSS oder Atom eines Blogs; sucht selbstständig unter `/feed` |

**Achtung beim Einspielen:** In `worker.js` waren `/angebote` und `/feed` bis
Version 3.0 gar nicht enthalten – der Worker wertete jede Anfrage als Rezeptabruf.
„Von der Website holen“ und „Aus dem Netz“ konnten damit nicht funktionieren.
Beide Routen sind jetzt umgesetzt; der Worker muss also **neu ins Cloudflare-Dashboard
kopiert werden**, sonst bleiben die beiden Funktionen tot. Dazu holt er nur noch
öffentliche Adressen, damit er nicht als Zugang in fremde interne Netze taugt.

Nötig, weil der Browser fremde Seiten nicht direkt abrufen darf (CORS). Kostenloser Tarif:
100.000 Abrufe pro Tag.

Der Worker antwortet immer mit JSON und CORS-Kopf, fängt alle Fehler ab und liefert im
Zweifel eine verständliche Meldung statt einer Ausnahme. Benannte HTML-Entities werden über
eine eigene Tabelle aufgelöst – ohne das kamen deutsche Umlaute zerschossen an.

---

## 12. Bekannte Grenzen

- **Instagram und TikTok** liefern ohne Anmeldung keine Inhalte. Dafür bleibt
  „Rezepttext einfügen".
- **YouTube Shorts** nennen selten Zutaten in der Beschreibung.
- **Bilder aus Google Takeout** und Prospektbilder werden nicht übernommen.
- **Texterkennung aus Fotos** funktioniert bei gedruckten Seiten mit gutem Licht ordentlich,
  bei Handschrift praktisch nie.
- **PDF-Einlesen auf dem Handy** ist speicherintensiv; ein 44-MB-Prospekt dauert spürbar.
- **Prospekt-Viewer von Aldi** (publitas.com) gibt Daten nur mit signierten Parametern
  heraus, ist also nicht automatisierbar. Das PDF dagegen schon.

---

## 12d. Farbkonzept und Rangfolge (3.7)

### Die Farben

Der Grund ist **warmes Papier** (`#F7F6F2`), kein kaltes Systemgrau — eine Küchenapp
soll nicht wie ein Systemdialog wirken. Der dunkle Modus ist entsprechend warm
(`#111110` statt reinem Schwarz).

Darauf **eine Leitfarbe**: ein tiefes Kräutergrün `#1F7A4C` / `#5BC98A`. Es trägt
Fortschritt, Erledigtes und die aktive Leiste — sonst nichts.

Die Kategorien kommen aus der Lebensmittelwelt statt aus der iOS-Systempalette:

| | Hell | Dunkel | wofür |
|---|---|---|---|
| Kräutergrün | `#1F7A4C` | `#5BC98A` | Leitfarbe, vegetarisch, erledigt |
| Schieferblau | `#3B6EA5` | `#7FB0E0` | Fisch |
| Terracotta | `#B0442E` | `#E58C72` | Fleisch |
| Bernstein | `#B4600A` | `#E7A64F` | Angebot, Hinweis |
| Signalrot | `#C4362B` | `#FF6B5E` | **nur** Gefahr |

Die wichtigste Trennung: **Gefahr ist keine Kategorie.** Vorher trug `--beet` beides —
das Kennzeichen „Fleisch" und den Löschknopf. Fleisch ist kein Fehler und darf nicht
so aussehen. Signalrot gibt es jetzt getrennt (`--gefahr`) und nur für Zerstörendes
und den Zähler an der Leiste.

Alle Textfarben liegen über 4,5:1 auf ihrem Grund, in beiden Modi einzeln geprüft.

### Die Rangfolge auf den Bildschirmen

Jeder Bildschirm folgt derselben Ordnung: **Zustand → Handlungen → Inhalt.**

**Woche.** Vorher standen vier Kennzahlenkästchen und drei graue Absätze zwischen dem
heutigen Tag und dem Plan. Jetzt: die Heute-Karte oben (das, was man täglich braucht),
darunter **eine** Zustandskarte — „21 von 21 geplant" mit Fortschrittsbalken, eine Zeile
Mischung, und nur die Hinweise, aus denen sich etwas tun lässt. Die Handlungen sind
darin unten abgesetzt. **Was nichts kostet, wird nicht gemeldet:** die Zeile „kein
Prospekt hinterlegt" stand vorher jede Woche da und war nie eine Nachricht.

**Einkauf.** Dieselbe Zustandskarte, dasselbe Muster — bis zu drei graue Absätze sind
eine Zeile geworden.

**Rezepte.** Die Suche steht jetzt zuoberst; man kommt hierher, um etwas zu finden.
Anlegen und „Was ist noch da?" folgen als Nebenhandlungen, dann die Filter, dann die
Liste. Der Löschknopf ist von jeder Zeile verschwunden — er war das Auffälligste neben
dem Titel, obwohl Löschen selten und zerstörend ist. Er liegt jetzt im Rezept selbst.
Das Plus bleibt: Aufnehmen braucht man aus der Liste heraus wirklich.

**Knöpfe.** Karten und Knöpfe teilen sich nicht mehr dieselbe Fläche: Knöpfe tragen eine
neutrale Füllung, sonst verschwanden sie auf weißen Karten und hoben sich nur durch
einen Schatten ab.

`tests/12-gestaltung.js` prüft das mit: Gefahr und Kategorie sind verschiedene Farben,
der Zustand steht über den Handlungen, die Suche vor den Filtern, keine Leermeldung
über Prospekte, kein Löschknopf auf der Rezeptzeile, und beide Listenbildschirme
benutzen dieselbe Zustandskarte.

---

## 12c. Gestaltung (3.6)

Die Oberfläche folgt den Apple Human Interface Guidelines. Geschrieben ist sie als
CSS-Variablensatz in `:root`, den ein `@media (prefers-color-scheme:dark)`-Block
vollständig ersetzt — jede Farbe ist in beiden Modi definiert, keine nur in einem.

| | Hell | Dunkel |
|---|---|---|
| Fläche | `#F2F2F7` | `#000000` |
| Karten | `#FFFFFF` | `#1C1C1E` |
| Leitfarbe | `#248A3D` | `#30D158` |
| Fisch | `#0071E3` | `#0A84FF` |
| Fleisch | `#D70015` | `#FF453A` |
| Angebot | `#B25000` | `#FF9F0A` |

**Eine Leitfarbe.** Grün trägt Fortschritt, Erfolg und die aktive Leiste. Blau, Rot und
Orange erscheinen nur, wo sie etwas bedeuten: Fisch, Fleisch, Angebot. Kennzeichen
liegen auf grauer Fläche und tragen die Farbe nur in der Schrift — vorher hatte jede
Art ihren eigenen farbigen Hintergrund, und die Rezeptliste war ein Flickenteppich.

**Eine Auswahl-Optik.** Reiter, Filterknöpfe und Umschalter benutzen dasselbe Muster:
graue Bahn, heller Schalter, wie die Systemsegmente. Vorher war die Auswahl mal ein
schwarz gefülltes Element, mal ein Rahmen.

**Schrift.** Die Systemschrift (San Francisco auf Apple-Geräten), bewusst **kein
Webfont** — die App muss offline starten. Zahlen laufen über
`font-variant-numeric: tabular-nums` in gleicher Breite; die frühere Schreibmaschinen-
schrift für Mengen und Beschriftungen ist weg, ebenso die Versalien in Zeilen wie
„3 VON 3 · 62 G". Die Größen folgen der iOS-Staffel: 32 Titel, 17 Grundtext,
15 Nebentext, 13 Fußnote.

**Flächen statt Rahmen.** Karten haben im hellen Modus einen weichen Schatten und
keinen Rahmen, im dunklen eine Haarlinie. Trennlinien sind 0,5 px.

**Bedienzeichen sind Vektoren** (`IKON`): Haken, Kreuz, Pfeile, Papierkorb, Plus, Herz.
Sie sehen auf jedem Gerät gleich aus und lassen sich einfärben. **Die Lebensmittel-Emoji
auf der Einkaufsliste bleiben** — die sind Inhalt und helfen beim Überfliegen im Markt.

**Antippflächen ab 44 Punkten**, Tab-Leiste durchscheinend mit Weichzeichner,
Systemleisten oben und unten über `env(safe-area-inset-*)` freigehalten, keine
Animationen für alle, die Bewegung reduziert haben.

**Weniger Knöpfe.** Über dem Wochenplan standen vier, jetzt zwei plus „Weiteres …"
(`wocheMehr()`) — dasselbe Muster wie beim Einkauf seit 3.4.

`tests/12-gestaltung.js` (18 Prüfungen) hält das nach: jede benutzte Variable ist
definiert, der dunkle Modus lässt keine Farbe stehen und erfindet keine dazu,
Eingabefelder sind mindestens 16 px groß (sonst zoomt iOS beim Tippen), Antippflächen
und Systemleisten stimmen, kein fremder Webfont, keine Emoji als Knopfbeschriftung,
keine festen Farbwerte im Markup, keine Steuerzeichen im Quelltext.

---

## 12b. Der Abgleich zwischen zwei Handys (3.5)

Gemeldet war: „Dinge, die der andere Benutzer geändert hat, werden nicht übernommen."
Beim Durchspielen aller Fälle zeigte sich ein scharf umrissenes Muster.
**Änderungen kamen immer an. Löschungen nie.**

### Warum

`zusammenfuehren()` sah einen Eintrag, den nur noch die eigene Seite kennt, und behielt
ihn. Das ist richtig, wenn man ihn gerade selbst angelegt hat, und falsch, wenn die
andere Seite ihn gerade gelöscht hat — von außen sind beide Fälle nicht zu unterscheiden.
Behalten wurde immer. Schlimmer noch: danach lud das Gerät seinen Stand hoch, und die
Löschung war auch auf dem anderen Handy wieder weg. Betroffen war alles außer Rezepten,
die ihre Grabsteine (`S.geloescht`) seit jeher haben: Plan-Plätze, Einkaufsposten, ganze
geleerte Listen, geleerte Wochen, Vorratsprodukte, Zusatzlisten, Zusatzgerichte,
Prospekte, Rezeptquellen.

### Was jetzt passiert

Grabsteine für alles: `S.weg` mit Schlüsseln der Form `<feld>__<id>` und dem Zeitpunkt
der Löschung. `mut()` pflegt sie von allein — löscht man einen Eintrag, entsteht der
Grabstein, legt man ihn wieder an, verschwindet er. Wird eine ganze Sammlung ersetzt
(Einkaufsliste neu bauen, Woche leeren), bekommt jeder verschwundene Schlüssel einen.

Beim Zusammenführen entscheidet der Grabstein, was ein Eintrag ist, den nur eine Seite
kennt: Ohne Grabstein neu angelegt → behalten. Mit Grabstein, der jünger ist als der
Eintrag → gelöscht. Ist der Eintrag jünger (jemand hat danach wieder etwas angelegt),
gewinnt der Eintrag. Die Frist ist 60 Tage — ein Grabstein muss nur überleben, bis das
andere Gerät wieder online war.

### Damit das überhaupt entscheidbar ist

Ein Zeitstempel gehört an den ganzen Eintrag. Fünf Stellen schrieben vorher einzelne
Unterfelder (`quellen/<id>/an`, `listen/<id>/items/<id>/on`, `vorrat/<id>/da` …) — solche
Schreibvorgänge tragen keinen Zeitstempel, und das Zusammenführen konnte zwei Stände
nicht auseinanderhalten. Jetzt wird immer der ganze Eintrag geschrieben.
`stempel()` liest außerdem eine reine Zahl als Zeitpunkt: in `sammlung`, `archiv`,
`spaeter` und `geprueft` **ist** der Wert der Zeitpunkt.

### Nebenbefunde

- `S.listeInfo` steht nicht in `leer()` und ging bei jedem Zusammenführen verloren —
  samt dem Hinweis, wie viel der Vorrat gedeckt hat. Wird jetzt mitgenommen.
- `wochenSpanne()` und `isoHeute()` bauten den Kalendertag über `toISOString()`, also
  nach UTC. Östlich von UTC+12 fiel die Ortszeit 12 Uhr auf den Vortag und die
  Wochenspanne begann sonntags. Jetzt aus den örtlichen Feldern (`isoTag()`).
  Für Deutschland ohne Wirkung, die Prüfungen laufen jetzt aber in jeder Zeitzone.
- `quelleSchalten()` rief `window.__qBody()` ungeprüft auf.

### Wie es geprüft wird

`tests/11-zwei-geraete.js` (29 Prüfungen) spielt jeden Fall mit **zwei Geräten** durch:
Beide starten gleich, B ändert etwas über die echten App-Funktionen, A bekommt B's Stand
und führt zusammen. Die letzte Gruppe geht noch einen Schritt weiter und stellt A das zu,
was B **tatsächlich an die Datenbank geschickt hat**, als Ereignisstrom — also der Weg,
den Firebase geht. Dazu die Gegenprobe: offline Angelegtes darf nicht verschwinden,
offline Gelöschtes nicht zurückkommen.

---

## 12a. Was in Version 3.4 behoben wurde

Sechs gemeldete oder dabei gefundene Fehler, alle per Test abgesichert
(`tests/10-korrekturen.js`, 62 Prüfungen):

1. **Die Art eines Rezepts ließ sich nicht ändern.** `rezeptNorm()` rief bei jedem Lesen
   `artAusZutaten()` auf und überschrieb damit die Wahl im Formular. Wer „veganes Hack"
   eintrug, bekam für immer ein Fleischgericht. Jetzt setzt ein Tipp auf die Art das
   Kennzeichen `kFest`; die Automatik greift nur noch, wo niemand selbst entschieden hat.
   Das Formular sagt, wenn Wahl und Zutaten auseinandergehen – und dass die Wahl gilt.
2. **Fleisch landete unter Sonstiges.** Die Wortliste der Einkaufsabteilungen kannte nur
   „Hähnchen, Rind, Pute" – Speck, Schinken, Salami, Wurst, Gyros, Kasseler, Frikadellen,
   Hering und Makrele fielen durch. „Schweinebauch" wurde sogar zum Getränk, weil darin
   `wein` steckt, und „Zahnpasta" zur Nudel. Siehe Abschnitt 4, Abteilungen.
3. **Offline Abgehaktes ging verloren.** Traf beim Wiederverbinden der Fernstand ein,
   ersetzte `zusammenfuehren()` den lokalen Stand – Einträge ohne Zeitstempel gewannen
   immer von fern – und `senden("",S)` leerte danach die Warteschlange. Ein ganzer
   Einkauf im Funkloch war damit weg. Jetzt legt `wartendeAnwenden()` alles noch
   Wartende nach dem Mischen wieder obenauf, und Einträge in `liste`, `plan`, `vorrat`
   und `extra` bekommen beim Schreiben ein `ts`, damit echter Streit nach Zeit entschieden
   wird statt nach Zufall.
4. **Blätter reichten unter den Bildschirmrand.** `max-height:92vh` misst am Handy ohne
   die ein- und ausfahrende Browserleiste; der Schließen-Knopf war nicht erreichbar.
   Jetzt `92dvh` mit `vh` als Rückfall. Dazu `overscroll-behavior:contain`, sonst schob
   ein Wisch am Ende des Blattes die Seite dahinter weiter.
5. **Posten mit unbekannter Abteilung verschwanden**, wurden aber weiter mitgezählt –
   siehe Abschnitt 4.
6. **`prompt()` für neue Listen** blockierte die Seite und sah in der installierten App
   aus wie eine Fremdmeldung. Jetzt ein Blatt wie überall sonst. Dabei fiel auf, dass
   Rückmeldungen (`#meldung`, z-index 45) hinter offenen Blättern (z-index 50) lagen –
   sie wirkten wie „nichts passiert". Jetzt liegt die Meldung mit 60 über allem.

**Aufgeräumt:** Über der Einkaufsliste standen sieben Knöpfe; geblieben sind zwei
(„Erledigte ausblenden" und „Weiteres …"), das Eingabefeld ist nach oben gerückt.
Teilen, Laufweg, Bildschirm anlassen und die beiden Zurücksetzen-Wege liegen im Blatt.

---

## 13. Was in Version 3.2 dazugekommen ist

Elf Verbesserungen an der Bedienung, alle per Test abgesichert (`tests/08-neuerungen.js`):

1. **Heute-Karte** über dem Wochenplan – siehe Abschnitt 5.
2. **Suche über Zutaten.** `trefferHtml()` filterte nur über `r.n`; „Zucchini" fand
   deshalb nur Titel mit Zucchini, nicht die Gerichte, in denen sie steckt. Treffer im
   Namen stehen weiterhin vorn, bei einem reinen Zutatentreffer nennt die Karte die Zutat.
3. **Vorratsabfrage auf das Nötige eingedampft.** Gefragt wird nur nach dem, was in den
   Gerichten dieser Woche vorkommt (`vorratGebraucht()`); der Rest ist einen Tipp entfernt.
4. **„Wofür ist das?"** in der Einkaufsliste – jeder Posten merkt sich beim Bauen in
   `fuer` die Gerichte, aus denen er stammt.
5. **Frühstück für alle Tage** übernehmen, mit Rücknahme. Bei 21 Frühstücken für 21 Plätze
   in drei Wochen ist die Wiederholung ohnehin unvermeidlich.
6. **Nur Gekochtes kommt in den Verlauf.** Bis 3.1 schob `wocheAbschliessen()` alle 21
   Gerichte hinein – auch die Tage, an denen es dann Pizza gab. Da der Verlauf die
   Bewertung steuert („kürzlich gekocht": −2), rechnete der Vorschlag mit Gerichten, die
   nie auf dem Tisch standen. Jetzt wird vorher abgehakt, Restetage sind vorangewählt ab.
7. **Saison sichtbar.** `punkte()` gibt +3 für Saison; im Rezept stand davon nichts.
8. **„Zuletzt vor N Tagen"** auf der Rezeptkarte statt der Kalenderwoche.
9. **Was der Vorrat gespart hat** – Anzahl verschiedener Zutaten, nicht ihrer Vorkommen.
10. **Resteküche** (`resteKueche()`): Zutaten antippen, die weg müssen, und Gerichte
    sehen, die sie verwenden – sortiert nach Zahl der Treffer, dann nach Zeit.
11. **Einkaufen zu zweit.** Hakt die Gegenseite etwas ab, erscheint eine kurze Meldung;
    mehrere kurz hintereinander werden zu einer zusammengefasst.

## 14. Offene Ideen

- Proteinreiche Hauptgerichte ergänzen, um den Schnitt über 72 g zu heben.
- Mehr Frühstücksrezepte – aktuell 21 bei 21 Frühstücksplätzen in drei Wochen, dadurch
  unvermeidliche Wiederholung zwischen den Wochen.
- Firebase Authentication statt Pfadlängen-Regel.
- Nährwerte über Protein hinaus (die `nut`-Kennzeichen sind bisher nur Etiketten).
- Automatische Erkennung, ob ein Rezept gekocht wurde, statt „Woche abschließen".
