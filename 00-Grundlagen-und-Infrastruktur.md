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

### Die Warteschlange (seit Küchenplan 3.1 überarbeitet)

Jede Änderung geht durch `einreihen()` in die Warteschlange und von dort der Reihe
nach über `flush()` zur Datenbank. Drei Eigenschaften, die vorher fehlten und je
einen echten Datenverlust verursacht haben:

- **Ein Eintrag verlässt die Schlange erst nach bestätigtem Erfolg.** Vorher nahm
  `flush()` die ganze Schlange heraus und arbeitete sie ab; brach die Verbindung
  beim zweiten Eintrag ab, waren alle folgenden ersatzlos weg.
- **Je Pfad wartet nur der jüngste Stand.** Vorher stauten sich beim Abhaken
  hunderte überholte Fassungen desselben Pfades, bis der Deckel bei 500 die
  ältesten – und damit womöglich noch ungesendete andere Pfade – verwarf.
- **Dauerhafte Fehler werden erkannt und gemeldet.** Antwortet die Datenbank mit
  401/403 (Regeln) oder 404 (falsche URL), hört die App auf zu senden und schreibt
  den Grund im Klartext unter „Mehr“. Vorher lief sie stumm weiter.

### Selbstheilung

- Bricht die Verbindung ab, wird mit wachsendem Abstand neu versucht, gedeckelt bei
  30 Sekunden – außer bei einem dauerhaften Fehler, da hilft Wiederholen nicht.
- Alle 30 Sekunden und beim Zurückkehren aus dem Hintergrund prüft `syncPruefen()`.
- Ereignisse aus der Leitung werden abgesichert gelesen: ein einzelnes kaputtes
  `put` darf die Verbindung nicht lahmlegen.
- Statuswerte: `lokal`, `verbindet`, `live`, `wartet`, `getrennt`, `verweigert`, `fehlt`.

### Bekannte Grenze

**Löschungen können zurückkehren.** Löschst du auf Gerät A etwas, während B offline ist,
bringt B es beim Verbinden zurück – B weiß nur „ich habe hier etwas, das drüben fehlt".
Die Alternative wären Grabsteine, die den Datenbestand dauerhaft aufblähen. Bewusste
Entscheidung: Eine wiederauftauchende Aufgabe ist ärgerlich, eine verschwundene wäre schlimmer.

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

### Bruchzeichen in Rezeptmengen

`½ TL Zimt` lief durch den Zutatenparser, ohne dass eine Zahl erkannt wurde – die
ganze Zeile landete als Zutatenname auf der Einkaufsliste. Dasselbe bei `1 ½`,
`1/2` und `1-2`. **Lösung:** `mengeLesen()` versteht Bruchzeichen, Bruchschreibweise
mit Schrägstrich, gemischte Brüche und Bereichsangaben (davon den unteren Wert).

### CSS-Variablen, die es nicht gibt, fallen lautlos aus

`var(--gold)` war an zwei Stellen im Einsatz, aber nirgends definiert – die
„Angebot"-Pille in der Einkaufsliste verlor dadurch ihre Farbe, ohne dass etwas
kaputt aussah. **Lösung:** korrekt auf `--sun` gezeigt, plus eine Prüfung, die
jede benutzte Variable gegen die definierten abgleicht.

### Deutsche Beugung in Wortlisten

Die Sperrliste für Angebotswörter pflegte Paare von Hand: „fein"/„feine",
„deutscher"/„deutsche" – und übersah „frische". **Lösung:** Vor dem Vergleich die
Adjektivendung abschneiden (`angebotStamm()`), statt jede Form aufzuzählen.

### Die Suche nach oben durch `parentNode` endet im Nichts

Beim Ziehen und Ablegen lief die Suche nach der Zeile bis zum `document`, das kein
`getAttribute` besitzt. **Lösung:** Existenz der Methode prüfen und Tiefe begrenzen.

---

## 7. Wie getestet wird

Es gibt keinen Browser in der Entwicklungsumgebung. Getestet wird mit einem
**nachgebauten Browser**: `localStorage`, `document.getElementById`, `EventSource` und
`fetch` werden durch Attrappen ersetzt, dann wird der Skriptteil der `index.html`
ausgewertet.

Ausgeführt wird das mit **JavaScriptCore**, das auf jedem Mac unter
`/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc` liegt –
es muss nichts installiert werden, Node ist nicht nötig. Im Küchenplan liegen die
Reihen unter `tests/`:

```sh
./tests/run.sh              # alle Reihen, aktuell 214 Prüfungen
./tests/run.sh 02           # nur eine Reihe
LAEUFE=500 ./tests/run.sh   # mehr Durchläufe für den Wochenvorschlag
```

Zwei Dinge, die sich in der Testumgebung selbst gerächt haben und dort jetzt
laut scheitern statt still falsch zu messen:

- `let a=1, b=2` deklariert **zwei** Namen. Wer beim Einsammeln der Bezeichner nur
  den ersten nimmt, misst später an einer Attrappe statt an der echten Variablen –
  die Warteschlange sah dadurch scheinbar leer aus, obwohl sie volllief.
- Heißt eine Hilfsvariable des Tests wie eine Funktion der App (`quellen`),
  überschreibt die App sie beim Laden. Die Testumgebung prüft das jetzt und bricht ab.

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
- **Systemschriften.** Keine Webfonts, weil sie offline fehlen würden.
- **Dunkler Modus** über `prefers-color-scheme` in beiden Apps.
- **Farben** über CSS-Variablen, nie fest im Markup.
