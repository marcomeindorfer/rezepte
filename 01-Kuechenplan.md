# Küchenplan

Wochenplanung für Essen, Rezeptsammlung und Einkaufsliste für zwei Personen.
**Version 3.1**, Stand 11. August 2026. Datei rund 252 KB, 3375 Zeilen,
165 Funktionen, 134 Rezepte. Die Testreihen unter `tests/` prüfen 214 Punkte,
Aufruf mit `./tests/run.sh`.

Voraussetzung: Lies zuerst `00-Grundlagen-und-Infrastruktur.md`.

---

## 1. Was die App leistet

- Wochenplan mit **21 Feldern** (7 Tage × Frühstück, Mittag, Abend), für **drei Wochen im Voraus**.
- Automatischer Wochenvorschlag nach festen Regeln.
- Rezeptdatenbank mit 134 Rezepten, erweiterbar durch eigene, importierte und aus Blogs geholte.
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
| Hauptlogik | Zustand, Sync, alle Ansichten, Wochenvorschlag | `const KEY=` |

Zum Ändern: In der `index.html` die Stelle per `str_replace` ersetzen. Die Datei ist groß,
deshalb gezielt mit `grep -n` suchen statt sie ganz zu lesen.

---

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
  eigene:    { rezeptId: rezeptObjekt },             // selbst angelegt oder importiert
  angebote:  { "p<datum>": {von,bis,items[],quelle,geholt} },   // ein Eintrag je Prospekt
  quellen:   { id: {n,u,an} },                       // Rezeptblogs für die Feed-Ansicht
  extra:     { "w<woche>_<id>": {r,p} },             // Gerichte außerhalb des Wochenplans
  listen:    { id: {n, items:{id:{n,on}}} },         // zusätzliche Einkaufslisten
  plan:      { "w<0|1|2>-<0..6>-<f|m|a>": {r,p} },   // Wochenplan; p=0 bedeutet Restetag
  liste:     { id: {n,q,e,k,on,gekauft,ang,nach,manuell} },     // aktuelle Einkaufsliste
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
  src: "asana"|"eigen"        // optional: Herkunft
}
```

**Alle Mengen gelten für eine Portion** und werden beim Einplanen hochgerechnet. Das ist
die wichtigste Konvention der ganzen App.

### Abteilungen (Laufweg)

`og` Obst & Gemüse · `bw` Backwaren · `kr` Kühlregal · `ff` Fleisch & Fisch ·
`tk` Tiefkühl · `tr` Nudeln, Reis & Konserven · `gw` Öl, Gewürze & Backzutaten ·
`gt` Getränke · `so` Sonstiges

Standardreihenfolge `ABT_STD = ["og","bw","kr","ff","tk","tr","gw","gt","so"]`, vom Nutzer
unter „Einkauf → Reihenfolge" anpassbar, weil Filialen sich unterscheiden.

---

## 5. Die fünf Ansichten

### Woche
Umschalter für drei Wochen mit Kalenderwochen. Darüber vier Kennzahlen: Fisch, Fleisch,
Vegetarisch, belegte Felder. Darunter Hinweise zu Protein und zum Prospekt der Woche.
Sieben Tageskarten mit je drei Feldern, der heutige Tag hervorgehoben. Portionen pro
Gericht einstellbar, **0 Portionen bedeutet Restetag** und erzeugt keine Einkäufe.
Abschnitt „Zusätzlich" für Gerichte außerhalb des Plans.

### Rezepte
Suchfeld, Filterreihe, Trefferliste. Karten zeigen bewusst **nur Art und Protein** –
alle anderen Kennzeichen wurden auf Wunsch entfernt. Papierkorb-Knopf je Rezept:
eigene werden gelöscht, mitgelieferte nur aus der Sammlung genommen, beides mit Rückfrage
und Rücknahme.

Filter: Alle · Unter 25 Min · Darmfreundlich · Frühstück · Mittag · Abend · Fisch ·
Fleisch · Vegetarisch · Snacks · Desserts · Aus eurer Liste · Selbst angelegt · Alle Rezepte.

### Entdecken
Drei Modi:
- **Neu** – Wischstapel mit unbekannten Rezepten. Rechts merken, links zurückstellen.
  Erstes Zurückstellen legt 30 Tage auf Eis, zweites archiviert.
- **Aufräumen** – Rezepte aus der Sammlung, die seit 60 Tagen dabei und nie oder seit
  120 Tagen nicht gekocht wurden. Rechts behalten (90 Tage Ruhe), links aussortieren.
- **Aus dem Netz** – neueste Beiträge der hinterlegten Blogs, Übernahme mit einem Tipp.

Fristen: `FRIST = {spaeter:30, alt:60, ungekocht:120, geprueft:90}` (Tage).

### Einkauf
Reiter für den Wocheneinkauf und beliebig viele eigene Listen. Kopf mit Fortschritt.
Laufplan: nummerierte Stationen entlang der Abteilungsreihenfolge. Jede Zeile mit
Lebensmittelsymbol, bei Treffer im Prospekt zusätzlich die Pille „Angebot".
Knöpfe: Erledigte ausblenden, Teilen, Bildschirm anlassen, Reihenfolge anpassen.
Eingabefeld für eigene Posten – **auch bei leerer Liste**, und diese Posten überleben
jeden Neuaufbau.

### Mehr
Standardportionen, Stillzeit-Modus, Angebote, Rezeptquellen, eigene Rezepte samt
Import/Export, Rezept-Leser, Vorrat, Sync, Rückblick, Zurücksetzen, Versionsnummer.

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

## 13. Offene Ideen

- Proteinreiche Hauptgerichte ergänzen, um den Schnitt über 72 g zu heben.
- Mehr Frühstücksrezepte – aktuell 21 bei 21 Frühstücksplätzen in drei Wochen, dadurch
  unvermeidliche Wiederholung zwischen den Wochen.
- Firebase Authentication statt Pfadlängen-Regel.
- Nährwerte über Protein hinaus (die `nut`-Kennzeichen sind bisher nur Etiketten).
- Automatische Erkennung, ob ein Rezept gekocht wurde, statt „Woche abschließen".
