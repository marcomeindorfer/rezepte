# Grundlagen und Infrastruktur

Gemeinsame Basis der beiden Apps **Küchenplan** und **Marco's brain**.
Stand: 10. August 2026.

---

## 0. Wenn du in einem neuen Chat weitermachst

Lade zu Beginn hoch:

1. Diese drei Doku-Dateien.
2. Die aktuelle `index.html` der App, an der gearbeitet werden soll (aus dem GitHub-Repository).
3. Bei Arbeiten am Küchenplan zusätzlich `worker.js` (aus dem Cloudflare-Dashboard kopierbar).

Damit ist der Kontext vollständig. Die Quelldateien, aus denen ich die `index.html`
ursprünglich zusammengebaut habe (`b2_data.js`, `c2_logic.js` und so weiter), existieren
nicht mehr – **es wird direkt in der einen `index.html` weitergearbeitet.** Der Aufbau der
Datei ist in den App-Dokumentationen beschrieben, damit man sich darin zurechtfindet.

---

## 1. Personen und Zweck

Nutzer sind **Marco** und seine Partnerin. Ein Kind ist unterwegs beziehungsweise gerade
geboren – daraus ergeben sich mehrere Anforderungen, die durchgängig gelten:

- Bedienung häufig **einhändig**, oft unterwegs, oft in Eile.
- Ernährung **darmfreundlich**, kein Schweinefleisch, einmal Fisch und einmal Fleisch pro
  Woche, sonst vegetarisch, Nährstoffe für die Zeit nach der Geburt und während des Stillens.
- Eingekauft wird bei **Aldi Süd**.
- Beide Geräte müssen denselben Stand sehen.

---

## 2. Technisches Grundmuster beider Apps

Beide Apps folgen exakt demselben Aufbau:

- **Eine einzige HTML-Datei.** Kein Bündelungswerkzeug, kein Framework, keine
  Abhängigkeiten beim Start. HTML, CSS und JavaScript in einer Datei.
- **Reines JavaScript.** Ansichten werden als Zeichenketten erzeugt und über
  `element.innerHTML` gesetzt. Ereignisse hängen als `onclick`-Attribute im erzeugten HTML.
- **Zustand in einem Objekt `S`.** Jede Änderung geht durch die Funktion `mut(pfad, wert)`,
  die drei Dinge tut: lokal setzen, in `localStorage` sichern, an Firebase schicken.
- **Progressive Web App.** `manifest.json` plus `sw.js` (Service Worker) machen sie
  installierbar und offline lauffähig. Der Service Worker arbeitet nach dem Muster
  „erst Netz, bei Misserfolg Zwischenspeicher", damit Updates sofort wirken.
- **Sprache durchgängig Deutsch**, auch bei Variablen- und Funktionsnamen.

### Warum keine Bibliotheken

Die Einkaufsliste muss im Supermarkt ohne Empfang funktionieren. Alles, was beim Start
nachgeladen wird, ist ein Risiko. Zwei Ausnahmen laden bewusst erst bei Bedarf nach und
sind nur online nutzbar:

- **pdf.js** `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js` – für das
  Einlesen der Aldi-Prospekte.
- **tesseract.js** `https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/5.1.0/tesseract.min.js`
  – für Texterkennung aus Bildern.

---

## 3. Hosting

Beide Apps liegen in **eigenen öffentlichen GitHub-Repositories** und werden über
**GitHub Pages** ausgeliefert.

| App | Repository | Adresse |
|---|---|---|
| Küchenplan | `kuechenplan` | `https://marco-meindorfer.github.io/kuechenplan/` |
| Marco's brain | `tagwerk` (Ordnername kann abweichen) | `https://marco-meindorfer.github.io/<repo>/` |

**Wichtig:** GitHub Pages funktioniert bei kostenlosen Konten **nur mit öffentlichen
Repositories**. Öffentlich ist dabei ausschließlich der Programmcode – die Daten liegen im
Browserspeicher des Geräts und in Firebase, nicht in der Datei.

Beide Apps tragen im Kopfbereich:
```html
<meta name="robots" content="noindex, nofollow, noarchive, nosnippet, noimageindex">
<meta name="googlebot" content="noindex, nofollow">
```
Damit tauchen sie in keiner Suchmaschine auf. Eine `robots.txt` wäre wirkungslos, weil sie
im Wurzelverzeichnis der Domain liegen müsste, das GitHub gehört.

### Wenn echter Zugriffsschutz gewünscht ist

Die einzige kostenlose Option ist **Cloudflare Pages plus Cloudflare Access**: Pages hostet
statische Seiten gratis, Access setzt eine Anmeldung per E-Mail-Code davor und ist bis
50 Nutzer kostenlos. Netlify und Vercel bieten Passwortschutz nur in Bezahltarifen,
GitHub Pages nur mit Enterprise.

### Update einspielen

1. Neue `index.html` herunterladen.
2. Im Repository „Add file" → „Upload files", Datei hineinziehen, „Commit changes".
3. Ein bis zwei Minuten warten (Reiter „Actions" zeigt den Fortschritt).
4. Auf dem Handy die App vollständig schließen und neu öffnen.

Zeigt das Handy weiterhin die alte Fassung, liegt es am Zwischenspeicher: Chrome →
Einstellungen → Datenschutz → Browserdaten löschen → nur „Bilder und Dateien im Cache".

Die Versionsnummer steht in beiden Apps unter „Mehr" ganz unten.

**Änderungen an `manifest.json`** werden von Android erst bei einer Neuinstallation
ausgewertet. Für einen neuen App-Namen muss das Icon gelöscht und die App neu installiert
werden; die Daten bleiben erhalten, weil sie an der Adresse hängen.

---

## 4. Firebase

Beide Apps nutzen **dasselbe Firebase-Projekt**, aber **verschiedene Codes**, wodurch die
Daten vollständig getrennt sind.

- Produkt: **Realtime Database**, nicht Firestore.
- Region: **europe-west1 (Belgien)**.
- Tarif: **Spark**, kostenlos, keine Kreditkarte. 1 GB Speicher, 10 GB Übertragung im Monat.
- Kein SDK. Die Apps sprechen die **REST-Schnittstelle** direkt an:
  - Schreiben: `PUT`/`DELETE` auf `<db>/haushalte/<code>/<pfad>.json`
  - Live-Empfang: `EventSource` auf `<db>/haushalte/<code>.json`

### Sicherheitsregeln (unverändert gültig)

```json
{
  "rules": {
    "haushalte": {
      "$id": {
        ".read": "$id.length >= 20",
        ".write": "$id.length >= 20"
      }
    }
  }
}
```

Auf oberster Ebene ist alles gesperrt, niemand kann die vorhandenen Haushalte auflisten.
Zugriff gibt es nur unterhalb eines Pfads mit mindestens 20 Zeichen – das ist der
Haushaltscode. Ein zufälliger 24-Zeichen-Code aus einem 33er-Alphabet ist praktisch nicht
zu erraten.

**Ehrliche Einordnung:** Das ist Schutz durch Unkenntnis des Pfads, keine Authentifizierung.
Wer den Code kennt, kommt an die Daten. Für Einkaufslisten und Rezepte angemessen; wenn in
Marco's brain dauerhaft Sensibles landet, wäre **Firebase Authentication mit anonymer
Anmeldung** der nächste Schritt – dann prüfen die Regeln eine echte Identität statt einer
Pfadlänge. Das ist bisher bewusst nicht umgesetzt.

### Einrichtung auf einem weiteren Gerät

App öffnen → „Mehr" → dieselbe Datenbank-URL und **denselben** Code eintragen → speichern.
Dort **weder** „Code erzeugen" **noch** „Diesen Stand hochladen" antippen.

---

## 5. Der Sync-Mechanismus im Detail

Das ist der Teil, der am meisten Ärger gemacht hat. Wer daran arbeitet, sollte alles hier
gelesen haben.

### Ablauf

1. `verbinden()` öffnet eine `EventSource` auf den Haushaltspfad.
2. Firebase schickt als Erstes ein `put`-Ereignis mit Pfad `/` und dem **kompletten** Stand.
3. Jedes Wurzel-Update läuft durch `zusammenfuehren(fern)` – **nie** durch blindes Ersetzen.
4. Danach kommen einzelne `put`- und `patch`-Ereignisse für Teilpfade, die direkt
   übernommen werden.

### Zusammenführen

`zusammenfuehren()` mischt eintragsweise:

- Einträge, die es nur auf einer Seite gibt, bleiben erhalten.
- Bei gleicher Kennung gewinnt der **jüngere Zeitstempel** (`geaendert`, `ts`, `erstellt`).
- Anschließend wird der gemischte Stand hochgeschoben, aber nur wenn er sich vom
  empfangenen unterscheidet – sonst entstünde eine Endlosschleife.

Die Liste der gemischten Felder wird **automatisch aus `leer()` abgeleitet**
(Funktion `SAMMELFELDER()`). Das ist kein Detail, sondern die Lehre aus einem Fehler:
Eine handgepflegte Liste hatte `listen`, `extra`, `quellen` und `angebote` vergessen, die
dadurch bei jedem Abgleich auf leer zurückgesetzt wurden.

### Die Warteschlange (überarbeitet)

Jede Änderung geht durch `einreihen()` in die Warteschlange und von dort der Reihe nach
über `flush()` zur Datenbank. Drei Eigenschaften, die vorher fehlten und je einen echten
Datenverlust verursacht haben:

- **Ein Eintrag verlässt die Schlange erst nach bestätigtem Erfolg.** Vorher nahm `flush()`
  die ganze Schlange heraus; brach die Verbindung beim zweiten Eintrag ab, waren alle
  folgenden ersatzlos weg.
- **Je Pfad wartet nur der jüngste Stand.** Vorher stauten sich hunderte überholte Fassungen
  desselben Pfades, bis der Deckel bei 500 die ältesten verwarf – womöglich noch ungesendete
  andere Pfade.
- **Dauerhafte Fehler werden erkannt und gemeldet.** Bei 401/403 (Regeln) oder 404 (falsche
  URL) hört die App auf zu senden und schreibt den Grund im Klartext unter „Mehr".

### Zeitstempel bei jeder Änderung

Beim Zusammenführen entscheidet der Zeitstempel, welche Fassung gewinnt. Wer nur ein
einzelnes Feld schreibt, ohne einen zu hinterlassen, macht seine Änderung angreifbar: Die
alte Fassung kann durch ein anderes Feld (etwa `fertig`) den jüngeren Stempel tragen und
gewinnen. Deshalb führt **jede** Änderung einen reinen Abgleichsstempel `ts` mit, und
`stempel()` nimmt den **jüngsten** aller Zeitstempel statt des erstbesten.

### Selbstheilung

- Bricht die Verbindung ab, wird mit wachsendem Abstand neu versucht, gedeckelt bei
  30 Sekunden – außer bei einem dauerhaften Fehler, da hilft Wiederholen nicht.
- Alle 30 Sekunden und beim Zurückkehren aus dem Hintergrund prüft `syncPruefen()`.
- Ereignisse aus der Leitung werden abgesichert gelesen: ein einzelnes kaputtes `put`
  darf die Verbindung nicht lahmlegen.
- Statuswerte: `lokal`, `verbindet`, `live`, `wartet`, `getrennt`, `verweigert`, `fehlt`.

### Grabsteine: gelöscht bleibt gelöscht

Früher konnten Löschungen zurückkehren. Löschte man auf Gerät A etwas, während B offline
war, brachte B es beim Verbinden zurück – B wusste nur „ich habe hier etwas, das drüben
fehlt", und eine Abwesenheit kann gegen einen vorhandenen Eintrag nichts ausrichten. Genau
so ist eine gelöschte Notiz mehrfach wieder aufgetaucht.

Seitdem hinterlässt jedes Löschen eine Notiz über sich selbst, in `S.tot`:

```
tot: { "notizen:nab12cd": 1755500000000 }     Kennung mit Doppelpunkt, Zeitpunkt
```

- Der Schlüssel trägt statt `/` einen `:`, weil Firebase-Pfade sonst eine Ebene tiefer gingen.
- Beim Zusammenführen fällt jeder Eintrag heraus, dessen Grabstein **echt jünger** ist als
  sein jüngster Zeitstempel. Bei Gleichstand bleibt der Eintrag: fälschlich behalten ist der
  harmlosere der beiden Irrtümer.
- Ohne Grabstein wird nichts gelöscht – Einträge aus alten Fassungen tragen gar keinen
  Zeitstempel, sonst wären sie alle betroffen.
- Wird derselbe Eintrag wirklich wieder angelegt („Rückgängig"), bekommt er einen frischen
  Stempel, ist damit jünger als der Grabstein, und der Grabstein wird gelöst und mitgeteilt.
- Kommt trotzdem ein gelöschter Eintrag über die Leitung, wird er nicht aufgenommen, sondern
  die Löschung geht noch einmal an die Gegenseite.
- Nach **90 Tagen** räumt `totAufraeumen()` den Grabstein weg. Bis dahin hat ihn jedes Gerät
  gesehen; der Datenbestand wächst also nicht dauerhaft.

Wichtig für neuen Code: **Nie eine ganze Sammlung überschreiben, um darin zu löschen.**
`mut("aufgaben", restOhneEinige)` erzeugt keinen Grabstein und überschreibt nebenbei alles,
was das andere Gerät gerade angelegt hat. Einzeln löschen, dann stimmt beides.

---

## 6. Fallen, die schon zugeschnappt sind

Diese Fehler sind alle real aufgetreten. Wer neuen Code schreibt, sollte sie kennen.

### Firebase speichert keine leeren Listen

Ein Rezept mit `s: []` verliert beim Sync das Feld komplett. Beim Lesen stürzt dann jede
Ansicht ab, die darauf zugreift. **Lösung:** Alles, was aus der Datenbank kommt, wird beim
Lesen normalisiert (`rezeptNorm()` im Küchenplan). Nie davon ausgehen, dass ein Feld existiert.

### Zeitbasierte Kennungen kollidieren

`Date.now().toString(36)` liefert zweimal denselben Wert, wenn zwei Einträge in derselben
Millisekunde entstehen – beim schnellen Eintippen also regelmäßig. Der zweite überschreibt
den ersten. **Lösung:** `neueId(prefix)` mit zusätzlichem Zähler. Dasselbe gilt für
Sortierpositionen (`naechstePos()`).

### Schrägstriche in Datenschlüsseln

Der Schrägstrich trennt Datenpfade. Ein Schlüssel `0/2-a` erzeugte in `mut("plan/0/2-a")`
eine verschachtelte Struktur statt eines flachen Eintrags – Gerichte verschwanden nach dem
Eintragen. **Lösung:** Schlüsselformat `w0-2-a`. Firebase verbietet außerdem
`.`, `$`, `#`, `[`, `]` in Schlüsseln.

### Vollständiges Neuzeichnen zerstört den Tastaturfokus

`oninput="…;render()"` baut die Ansicht neu auf, das Eingabefeld verschwindet, die Tastatur
klappt zu. **Lösung:** Nur den Trefferbereich austauschen (`teilRender()`, `notizTeil()`),
das Eingabefeld unangetastet lassen.

### `\s` in regulären Ausdrücken frisst Zeilenumbrüche

Beim Zerlegen von Angebotslisten verschluckte `\d+[.,]\d+\s*€` den Umbruch nach dem Preis
und klebte zwei Zeilen zusammen. **Lösung:** `[ \t]*` statt `\s*`.

### Teilstring-Vergleiche erzeugen absurde Treffer

„Gartenschlauch" enthält „lauch" und markierte Lauch-Rezepte als Angebot. **Lösung:**
Nur eine Richtung vergleichen (Zutat enthält Angebotswort, nicht umgekehrt), plus
Wortstamm-Vergleich ab sechs Buchstaben.

### Kürzende Hilfsfunktionen in der Volltextsuche

`slug()` schnitt nach 60 Zeichen ab, wodurch in langen Notizen ab Zeile drei nichts mehr
auffindbar war. **Lösung:** `normText()` ohne Kürzung für Suche, `slug()` nur für Schlüssel.

### Fremde Hintergrundprozesse blockiert der Browser

pdf.js lädt seinen Worker von cdnjs – Chrome auf Android lehnt das wegen fremder Herkunft ab.
**Lösung:** Eine kleine lokale Blob-Datei erzeugen, die per `importScripts` den fremden
Code nachlädt.

### `capture="environment"` sperrt die Dateiauswahl

Das Attribut zwingt das Gerät, sofort die Kamera zu öffnen. Wer aus der Galerie wählen will,
kommt nicht heran. **Lösung:** Attribut weglassen, dann bietet das System Kamera, Galerie
und Dateien an.

### Die Suche nach oben durch `parentNode` endet im Nichts

Beim Ziehen und Ablegen lief die Suche nach der Zeile bis zum `document`, das kein
`getAttribute` besitzt. **Lösung:** Existenz der Methode prüfen und Tiefe begrenzen.

### Ein Neuzeichnen mitten im Ziehen tauscht das Element unter dem Finger

`render()` ersetzt `#view` vollständig. Läuft es während eines Zugs – weil eine Meldung
ausläuft, das andere Gerät etwas schickt oder eine Minute vergeht –, hängt der Zug an einem
Element, das nicht mehr im Dokument steht: Er lässt sich nicht mehr abschließen und
hinterlässt Klassen an Zeilen, die es nicht mehr gibt. **Lösung:** `dndSperre` setzt
`render()` für die Dauer des Zugs aus und merkt sich das Versäumte in `dndNachholen`.

### Zwei Stellen, die denselben Namen ausrechnen, driften auseinander

Der Griff einer Notiz nennt den Kasten, in dem gezogen wird. Die Kartenfunktion rechnete
diesen Namen selbst noch einmal aus – und kam bei „Eigene Reihenfolge" auf `nbox_heute`,
während die Liste dort ungruppiert in `nbox` steht. Der Griff zeigte ins Leere, Ziehen tat
nichts mehr, und zwar genau ab dem ersten erfolgreichen Zug, weil der die Sortierung
umstellt. **Lösung:** Der Kasten wird übergeben, nicht zweimal hergeleitet.

---

## 7. Wie getestet wird

Getestet wird mit einem **nachgebauten Browser**: `localStorage`, `document.getElementById`,
`EventSource` und `fetch` werden durch Attrappen ersetzt, dann wird der Skriptteil der
`index.html` ausgewertet. Ausgeführt wird das mit **JavaScriptCore**, das auf jedem Mac unter
`/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc` liegt – es muss
nichts installiert werden. Aufruf: `./tests/run.sh`.

**Der nachgebaute Browser ersetzt den echten nicht.** JavaScriptCore hat eine ungültige
Zeichenklasse in einem regulären Ausdruck anstandslos geschluckt, während Chrome die ganze
Datei mit einem `SyntaxError` verwarf – die App startete dort überhaupt nicht mehr, obwohl
alle Prüfungen grün waren. Seitdem prüft eine Testreihe zusätzlich, dass keine wörtlichen
Steuerzeichen im Quelltext stehen, und am Ende wird die App einmal im Browser geöffnet.

Bewährt haben sich vier Arten von Prüfungen:

1. **Datenprüfung** – alle Rezepte auf vollständige Felder, gültige Abteilungen, kein
   Schweinefleisch, plausible Zeiten.
2. **Regelprüfung mit vielen Durchläufen** – etwa 60 bis 300 Wochenvorschläge erzeugen und
   statistisch auswerten (Fisch/Fleisch-Verhältnis, Beilagenvielfalt, Protein, Dubletten).
3. **Klick-Durchlauf** – jede Ansicht in jeder Variante rendern, per regulärem Ausdruck
   **alle** `onclick`/`oninput`/`onchange`-Attribute herausziehen und einzeln aufrufen.
   Zuletzt: 924 Bedienelemente im Küchenplan, 204 in Marco's brain, jeweils ohne Ausnahme.
   Wichtig: Der Aufruf muss mit direktem `eval` im selben Geltungsbereich erfolgen, sonst
   sieht er die App-Funktionen nicht.
4. **Mehrgeräte-Simulation** – zwei bis fünf App-Instanzen in getrennten VM-Kontexten gegen
   eine nachgebaute Datenbank, die Ereignisse an alle Hörer verteilt.

Zusätzlich ein statischer Blick auf Handy-Tauglichkeit: Sichtbereich, Systemleisten,
Eingabefelder mit mindestens 16px gegen automatisches Zoomen auf iOS, Antippflächen von
mindestens 44px, keine festen Breiten über 330px, dunkler Modus, `prefers-reduced-motion`.

**Was diese Tests nicht ersetzen:** Aussehen, Textumbrüche, Gestenverhalten, tatsächliche
Geschwindigkeit auf dem Gerät.

---

## 8. Gestaltungsgrundsätze

- **Deutsch, konkret, ohne Werbesprache.** Hinweistexte erklären den Grund, nicht nur die
  Handlung („Sauerkraut nur kurz erwärmen, sonst sind die Milchsäurebakterien weg").
- **Keine Bestätigungsdialoge, wo eine Rücknahme reicht.** Gelöschtes zeigt sieben Sekunden
  lang eine Leiste mit „Rückgängig". Nur bei endgültigem Löschen gibt es zusätzlich eine
  kurze Rückfrage.
- **Ehrliche Leermeldungen.** Wenn nichts gefunden wurde, steht das da, samt Grund – statt
  ersatzweise etwas Falsches anzuzeigen.
- **Mitgelieferte Schriften.** Inter und Instrument Serif liegen als woff2 im Ordner
  `fonts` und stehen im Service Worker, werden also mitinstalliert. Kein Aufruf nach außen,
  offline vollständig da, auf jedem Gerät dasselbe Bild. Beide unter der SIL Open Font
  License, siehe `fonts/LIZENZ.txt`. Wer die Dateien vergisst hochzuladen, bekommt die
  Systemschrift – die App bleibt benutzbar, sieht aber anders aus.
- **Dunkler Modus** über `prefers-color-scheme` in beiden Apps.
- **Farben** über CSS-Variablen, nie fest im Markup.
