/* Zwei Zusagen dieser Version: „Aus dem Netz" liefert auch Älteres und holt von
   allein nach – und ein Bio-Angebot ist überall als solches zu erkennen. */
load("tests/harness.js");

const TAG = 86400000;
const iso = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");

function frisch() {
  A.S = A.leer();
  A.cfg = { ...A.cfg, leser: "https://leser.example.workers.dev" };
  A.feedStand = { laden: false, eintraege: [], fehler: [], geholt: 0 };
  A.tab = "entdecken"; A.ideenModus = "netz";
  A.archivVersatz = 0;
}
const eintrag = (o) => Object.assign({ titel: "Ein Rezept", link: "https://blog.de/" + Math.random().toString(36).slice(2), datum: Date.now(), text: "", art: "neu", quelle: "Blog" }, o);

gruppe("Zwischenspeicher und Nachladen");
t("Der letzte Stand wird gespeichert und wiedergefunden", () => {
  frisch();
  A.feedStand = { laden: false, eintraege: [eintrag({ titel: "Linsensuppe" })], fehler: [], geholt: Date.now() };
  A.netzSchreiben();
  A.feedStand = { laden: false, eintraege: [], fehler: [], geholt: 0 };
  A.netzLesen();
  gleich(A.feedStand.eintraege.length, 1, "nichts wiedergefunden");
  gleich(A.feedStand.eintraege[0].titel, "Linsensuppe");
});
t("Ein frischer Stand wird nicht neu geholt", () => {
  frisch();
  A.feedStand = { laden: false, eintraege: [eintrag()], fehler: [], geholt: Date.now() };
  wahr(!A.netzAlt(), "gilt als alt, obwohl gerade geholt");
});
t("Nach zwölf Stunden gilt der Stand als alt", () => {
  frisch();
  A.feedStand = { laden: false, eintraege: [eintrag()], fehler: [], geholt: Date.now() - 13 * 3600000 };
  wahr(A.netzAlt(), "gilt als frisch, obwohl 13 Stunden alt");
});
t("Ohne Rezept-Leser wird nichts nachgeladen", () => {
  frisch();
  A.cfg = { ...A.cfg, leser: "" };
  A.netzPruefen();
  wahr(!A.feedStand.laden, "versucht trotzdem zu laden");
});

gruppe("Neues und Älteres");
t("Frisches und Archiv werden getrennt gehalten", () => {
  frisch();
  A.feedStand = {
    laden: false, geholt: Date.now(), fehler: [],
    eintraege: [
      eintrag({ titel: "Ganz neu", art: "neu" }),
      eintrag({ titel: "Von 2019", art: "archiv" }),
      eintrag({ titel: "Von 2020", art: "archiv" })
    ]
  };
  gleich(A.netzNeu().map(e => e.titel), ["Ganz neu"]);
  gleich(A.archivAuswahl(6).length, 2, "Archiv nicht gefunden");
});
t("Die Archivauswahl bleibt innerhalb eines Tages stabil", () => {
  frisch();
  A.feedStand = {
    laden: false, geholt: Date.now(), fehler: [],
    eintraege: Array.from({ length: 30 }, (_, i) => eintrag({ titel: "Alt " + i, link: "https://blog.de/alt-" + i, art: "archiv" }))
  };
  const a = A.archivAuswahl(6).map(e => e.titel);
  const b = A.archivAuswahl(6).map(e => e.titel);
  gleich(a, b, "zwei Aufrufe, zwei Ergebnisse");
  gleich(a.length, 6);
  gleich(new Set(a).size, 6, "Dubletten in der Auswahl");
});
t("Andere zeigen liefert eine andere Auswahl", () => {
  frisch();
  A.feedStand = {
    laden: false, geholt: Date.now(), fehler: [],
    eintraege: Array.from({ length: 40 }, (_, i) => eintrag({ titel: "Alt " + i, link: "https://blog.de/alt-" + i, art: "archiv" }))
  };
  const vorher = A.archivAuswahl(6).map(e => e.titel);
  A.archivNeuMischen();
  const nachher = A.archivAuswahl(6).map(e => e.titel);
  wahr(JSON.stringify(vorher) !== JSON.stringify(nachher), "dieselbe Auswahl trotz Mischen");
});
t("Derselbe Titel kommt in einer Auswahl nur einmal vor", () => {
  frisch();
  A.feedStand = {
    laden: false, geholt: Date.now(), fehler: [],
    /* dasselbe Gericht bei fünf Blogs – unterschiedliche Adressen, gleicher Titel */
    eintraege: Array.from({ length: 5 }, (_, i) => eintrag({ titel: "Pilzrisotto mit Zitrone", link: "https://blog" + i + ".de/pilzrisotto", art: "archiv" }))
      .concat(Array.from({ length: 5 }, (_, i) => eintrag({ titel: "Anderes " + i, link: "https://blog.de/anderes-" + i, art: "archiv" })))
  };
  const titel = A.archivAuswahl(6).map(e => e.titel);
  gleich(titel.length, new Set(titel).size, "doppelter Titel in der Auswahl: " + titel.join(", "));
});
t("Was schon in der Sammlung liegt, wird nicht als Archivfund angeboten", () => {
  frisch();
  A.S.eigene = { e1: { id: "e1", n: "Schon da", k: "veg", ma: ["a"], m: A.ALL, min: 20, p: 20, bl: 0, nut: [], why: "x", z: [["Reis", 70, "g", "tr"]], s: ["kochen"], q: "https://blog.de/alt-1" } };
  A.S.sammlung = { e1: Date.now() };
  A.feedStand = {
    laden: false, geholt: Date.now(), fehler: [],
    eintraege: Array.from({ length: 5 }, (_, i) => eintrag({ titel: "Alt " + i, link: "https://blog.de/alt-" + i, art: "archiv" }))
  };
  const auswahl = A.archivAuswahl(6).map(e => e.link);
  wahr(!auswahl.includes("https://blog.de/alt-1"), "bereits Übernommenes wird wieder vorgeschlagen");
});
t("Die Ansicht nennt beide Abschnitte", () => {
  frisch();
  A.feedStand = {
    laden: false, geholt: Date.now() - 3600000, fehler: [],
    eintraege: [eintrag({ titel: "Ganz neu", art: "neu" }), eintrag({ titel: "Alt", art: "archiv" })]
  };
  const html = A.vNetz();
  wahr(/Frisch aus den Blogs/.test(html), "Abschnitt für Neues fehlt");
  wahr(/Vielleicht übersehen/.test(html), "Abschnitt für Älteres fehlt");
  wahr(/vor 1 Stunde/.test(html), "Standanzeige fehlt: " + html.slice(0, 200));
});
t("Ohne Leser erklärt die Ansicht, was fehlt", () => {
  frisch();
  A.cfg = { ...A.cfg, leser: "" };
  wahr(/Rezept-Leser fehlt/.test(A.vNetz()));
});

t("Beim Holen fallen doppelte Adressen und Titel heraus", () => {
  frisch();
  A.S.quellen = { q1: { n: "A", u: "https://a.de", an: true }, q2: { n: "B", u: "https://b.de", an: true } };
  const antwort = { eintraege: [
    { titel: "Pilzrisotto mit Zitrone", link: "https://x.de/pilzrisotto", datum: 3, art: "neu" },
    { titel: "Pilzrisotto mit Zitrone!", link: "https://y.de/pilzrisotto", datum: 2, art: "neu" },
    { titel: "Etwas anderes", link: "https://x.de/anderes/", datum: 1, art: "neu" },
    { titel: "Etwas anderes", link: "https://x.de/anderes?utm=1", datum: 1, art: "archiv" }
  ] };
  const echt = globalThis.fetch;
  globalThis.fetch = () => Promise.resolve({ json: () => Promise.resolve(antwort) });
  try {
    A.feedsHolen(true);
    drainMicrotasks();          /* die Zusagen einlösen, t() selbst ist synchron */
    const titel = A.feedStand.eintraege.map(e => e.titel);
    gleich(titel.length, 2, "nicht entdoppelt: " + titel.join(" | "));
    wahr(!A.feedStand.laden, "bleibt im Ladezustand hängen");
    wahr(A.feedStand.geholt > 0, "kein Zeitstempel gesetzt");
  } finally { globalThis.fetch = echt; }
});
t("Eine Quelle ohne Antwort wird als Fehler gemeldet, die andere zählt", () => {
  frisch();
  A.S.quellen = { q1: { n: "Kaputt", u: "https://a.de", an: true }, q2: { n: "Heil", u: "https://b.de", an: true } };
  const echt = globalThis.fetch;
  globalThis.fetch = (u) => String(u).includes("a.de")
    ? Promise.reject(new Error("weg"))
    : Promise.resolve({ json: () => Promise.resolve({ eintraege: [{ titel: "Da", link: "https://b.de/da", datum: 1, art: "neu" }] }) });
  try {
    A.feedsHolen(true);
    drainMicrotasks();
    gleich(A.feedStand.fehler, ["Kaputt"]);
    gleich(A.feedStand.eintraege.length, 1, "heile Quelle ging mit unter");
  } finally { globalThis.fetch = echt; }
});


gruppe("Bio erkennen");
t("Bio wird als eigenes Wort erkannt", () => {
  wahr(A.istBio("Bio-Möhren 1 kg"), "Bio-Möhren");
  wahr(A.istBio("BIO Vollmilch 3,8 %"), "Großschreibung");
  wahr(A.istBio("Naturland Hafermilch"), "Naturland");
  wahr(A.istBio("Demeter Joghurt"), "Demeter");
  wahr(A.istBio("Öko-Eier"), "Öko");
});
t("Zusammengeschriebenes Bio zählt mit", () => {
  wahr(A.istBio("Biomilch 1 l"), "Biomilch");
  wahr(A.istBio("Bioland Weizenmehl"), "Bioland");
  wahr(A.istBio("Kartoffeln, Bioqualität"), "Bioqualität");
});
t("Wörter, die Bio nur enthalten, zählen nicht", () => {
  wahr(!A.istBio("Biskuitrolle"), "Biskuit");
  wahr(!A.istBio("Kombinationsangebot"), "Kombination");
  wahr(!A.istBio("Champignons 250 g"), "gewöhnliches Produkt");
  wahr(!A.istBio(""), "leer");
  wahr(!A.istBio(null), "nichts");
});

gruppe("Bio im Angebot");
function mitProspekt(items) {
  frisch();
  const heute = new Date(), bis = new Date(Date.now() + 5 * TAG);
  A.S.angebote = { p1: { von: iso(heute), bis: iso(bis), items, quelle: "Test", geholt: Date.now() } };
}
t("Bio-Posten werden aus dem Prospekt herausgezogen", () => {
  mitProspekt(["Bio-Möhren 1 kg", "Hähnchenbrust 500 g", "Bio Naturjoghurt 500 g"]);
  gleich(A.bioAngebote(0).length, 2);
});
t("Die Einkaufsliste kennzeichnet Bio anders als ein gewöhnliches Angebot", () => {
  mitProspekt(["Bio-Möhren 1 kg", "Zwiebeln 2 kg"]);
  A.S.liste = {
    a: { n: "Möhren", q: 300, e: "g", k: "og", on: false, ang: "Bio-Möhren 1 kg" },
    b: { n: "Zwiebeln", q: 2, e: "Stk", k: "og", on: false, ang: "Zwiebeln 2 kg" }
  };
  A.tab = "einkauf"; A.einkaufAnsicht = "woche";
  const html = A.vEinkauf();
  wahr(/Bio im Angebot/.test(html), "keine Bio-Kennzeichnung");
  wahr(/pill bio/.test(html), "keine eigene Gestaltung");
  wahr(/>Angebot</.test(html), "gewöhnliches Angebot fehlt");
  wahr(/1 davon Bio/.test(html), "Zählung im Kopf fehlt: " + (html.match(/note[^>]*>([^<]*Prospekt[^<]*)</) || [])[1]);
});
t("Der Wochenhinweis nennt die Zahl der Bio-Angebote", () => {
  mitProspekt(["Bio-Möhren 1 kg", "Bio-Hafermilch", "Nudeln 500 g"]);
  const h = A.wochenHinweise().map(x => x.t).join(" ");
  wahr(/Davon 2 in Bio/.test(h), "gefunden: " + h);
});
t("Das Angebotsblatt führt Bio zuerst auf", () => {
  mitProspekt(["Nudeln 500 g", "Bio-Möhren 1 kg"]);
  const blatt = A.MEHR_BLATT.angebote();
  wahr(/Bio im Angebot/.test(blatt), "kein Bio-Abschnitt");
  wahr(blatt.indexOf("Bio-Möhren") < blatt.indexOf("Prospekt hinzufügen"), "Bio steht nicht oben");
});
t("Ohne Bio sagt das Blatt das ehrlich", () => {
  mitProspekt(["Nudeln 500 g", "Zwiebeln 2 kg"]);
  wahr(/nichts in Bio/.test(A.MEHR_BLATT.angebote()), "keine ehrliche Meldung");
});
t("Die Mehr-Übersicht zeigt Bio statt der Prospektzahl", () => {
  mitProspekt(["Bio-Möhren 1 kg"]);
  wahr(/1 Bio im Angebot/.test(A.vMehr()), "Bio nicht in der Übersicht");
});
t("Im Entdecken-Angebotsteil stehen Bio-Treffer oben und grün", () => {
  mitProspekt(["Bio Kichererbsen 400 g", "Nudeln 500 g"]);
  A.tab = "entdecken"; A.ideenModus = "angebote";
  const treffer = A.ideenImAngebot();
  wahr(treffer.length, "kein Treffer");
  const html = A.vEntdecken();
  wahr(/Bio im Angebot:/.test(html), "keine Bio-Zeile auf der Karte");
  A.ideenModus = "ideen";
});
t("Ein Posten ohne Bio bleibt bernsteinfarben gekennzeichnet", () => {
  mitProspekt(["Nudeln 500 g"]);
  A.S.liste = { a: { n: "Nudeln", q: 500, e: "g", k: "tr", on: false, ang: "Nudeln 500 g" } };
  A.tab = "einkauf"; A.einkaufAnsicht = "woche";
  const html = A.vEinkauf();
  wahr(!/pill bio/.test(html), "fälschlich als Bio gekennzeichnet");
  wahr(/var\(--sun\)/.test(html), "gewöhnliche Angebotsfarbe fehlt");
});

bilanz();
