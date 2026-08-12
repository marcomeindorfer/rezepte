/* Zwei Handys am selben Haushalt.
   Jeder Test spielt denselben Ablauf durch: beide starten gleich, Gerät B ändert
   etwas, Gerät A bekommt B's Gesamtstand über die Leitung und führt zusammen.
   Genau dieser Weg lief auseinander – Änderungen kamen an, Löschungen nie. */
load("tests/harness.js");

function neuerHaushalt(aufbau) {
  A.S = A.leer();
  A.S.plan = {}; A.S.liste = {}; A.S.eigene = {}; A.S.vorrat = {};
  A.S.listen = {}; A.S.extra = {}; A.S.archiv = {}; A.S.sammlung = {};
  A.S.quellen = {}; A.S.weg = {};
  A.cfg = { db: "https://test.example", hid: "h".repeat(24), leser: "" };
  A.queue = [];
  if (aufbau) aufbau();
  return kopie(A.S);
}
const kopie = x => JSON.parse(JSON.stringify(x));

/* Setzt das Gerät auf einen Stand und lässt es etwas tun */
function geraetTut(stand, was) {
  A.S = kopie(stand); A.queue = [];
  if (was) was();
  return kopie(A.S);
}

/* Der ganze Ablauf in einem Aufruf */
function beideGeraete(start, wasBtut) {
  const stand = neuerHaushalt(start);
  const vonB = geraetTut(stand, wasBtut);
  A.S = kopie(stand); A.queue = [];
  A.zusammenfuehren(vonB);
  return A.S;
}

/* ---------------------------------------------------------------- */
gruppe("Was die andere Person gelöscht hat, bleibt gelöscht");

t("Ein Gericht aus dem Plan genommen", () => {
  const S = beideGeraete(
    () => { A.S.plan = { "w0-1-a": { r: "b1", p: 2, ts: 1000 } }; },
    () => A.mut("plan/w0-1-a", null, false));
  wahr(!S.plan["w0-1-a"], "Das Gericht steht wieder im Plan");
});

t("Ein Posten von der Einkaufsliste gestrichen", () => {
  const S = beideGeraete(
    () => { A.S.liste = { brot: { n: "Brot", q: 1, e: "Stk", k: "bw", ts: 1000 } }; },
    () => A.mut("liste/brot", null, false));
  wahr(!S.liste.brot, "Der Posten ist wieder da");
});

t("Die ganze Einkaufsliste geleert", () => {
  const S = beideGeraete(
    () => { A.S.liste = {
      brot: { n: "Brot", q: 1, e: "Stk", k: "bw", ts: 1000 },
      milch: { n: "Milch", q: 1, e: "l", k: "kr", ts: 1000 } }; },
    () => A.mut("liste", {}, false));
  gleich(Object.keys(S.liste).length, 0, "Die Liste ist wieder voll");
});

t("Die Woche geleert", () => {
  const S = beideGeraete(
    () => { A.S.plan = { "w0-1-a": { r: "b1", p: 2, ts: 1000 },
                         "w0-2-a": { r: "b2", p: 2, ts: 1000 } }; },
    () => A.leereWoche());
  gleich(Object.keys(S.plan).length, 0, "Der Plan ist wieder gefüllt");
});

t("Ein Vorratsprodukt entfernt", () => {
  const S = beideGeraete(
    () => { A.S.vorrat = { milch: { n: "Milch", k: "kr", da: true, ts: 1000 } }; },
    () => A.mut("vorrat/milch", null, false));
  wahr(!S.vorrat.milch, "Das Produkt ist wieder im Vorrat");
});

t("Eine Zusatzliste gelöscht", () => {
  const S = beideGeraete(
    () => { A.S.listen = { l1: { n: "dm", items: {}, ts: 1000 } }; },
    () => A.mut("listen/l1", null, false));
  wahr(!S.listen.l1, "Die Liste ist wieder da");
});

t("Ein Zusatzgericht entfernt", () => {
  const S = beideGeraete(
    () => { A.S.extra = { e1: { r: "b1", p: 2, w: 0, ts: 1000 } }; },
    () => A.mut("extra/e1", null, false));
  wahr(!S.extra.e1, "Das Zusatzgericht ist wieder da");
});

t("Ein Prospekt gelöscht", () => {
  const S = beideGeraete(
    () => { A.S.angebote = { p1: { von: "", bis: "", items: ["Brot"], ts: 1000 } }; },
    () => A.mut("angebote/p1", null, false));
  wahr(!S.angebote.p1, "Das Prospekt ist wieder da");
});

/* ---------------------------------------------------------------- */
gruppe("Was die andere Person geändert hat, kommt an");

t("Ein neu eingeplantes Gericht", () => {
  const S = beideGeraete(null, () => A.mut("plan/w0-1-a", { r: "b2", p: 2 }, false));
  gleich(S.plan["w0-1-a"].r, "b2");
});

t("Ein getauschtes Gericht", () => {
  const S = beideGeraete(
    () => { A.S.plan = { "w0-1-a": { r: "b1", p: 2, ts: 1000 } }; },
    () => A.mut("plan/w0-1-a", { r: "b2", p: 2 }, false));
  gleich(S.plan["w0-1-a"].r, "b2");
});

t("Ein abgehakter Posten", () => {
  const S = beideGeraete(
    () => { A.S.liste = { brot: { n: "Brot", q: 1, e: "Stk", k: "bw", on: false, ts: 1000 } }; },
    () => A.posten("brot", true));
  gleich(S.liste.brot.on, true);
});

t("Ein neues Vorratsprodukt", () => {
  const S = beideGeraete(null, () => A.mut("vorrat/mehl", { n: "Mehl", k: "tr", da: true }, false));
  wahr(!!S.vorrat.mehl);
});

t("Eine umbenannte Zusatzliste", () => {
  const S = beideGeraete(
    () => { A.S.listen = { l1: { n: "dm", items: {}, ts: 1000 } }; },
    () => A.mut("listen/l1", { n: "Drogerie", items: {} }, false));
  gleich(S.listen.l1.n, "Drogerie");
});

t("Ein abgehakter Posten in einer Zusatzliste", () => {
  const S = beideGeraete(
    () => { A.S.listen = { l1: { n: "dm", items: { i1: { n: "Zahnpasta", on: false } }, ts: 1000 } }; },
    () => A.zusatzHaken("l1", "i1", true));
  gleich(S.listen.l1.items.i1.on, true, "Nur ganze Einträge tragen einen Zeitstempel");
});

t("Eine abgeschaltete Rezeptquelle", () => {
  const S = beideGeraete(
    () => { A.S.quellen = { q1: { n: "Blog", u: "https://x.example", an: true, ts: 1000 } }; },
    () => A.quelleSchalten("q1", false));
  gleich(S.quellen.q1.an, false);
});

t("Ein neues eigenes Rezept", () => {
  const S = beideGeraete(null,
    () => A.mut("eigene/u1", { id: "u1", n: "Neu", k: "veg", z: [], s: [] }, false));
  wahr(!!S.eigene.u1);
});

/* ---------------------------------------------------------------- */
gruppe("Eigene Änderungen gehen dabei nicht verloren");

t("Offline Angelegtes überlebt den Fernstand", () => {
  const stand = neuerHaushalt(() => { A.S.plan = { "w0-1-a": { r: "b1", p: 2, ts: 1000 } }; });
  A.S = kopie(stand); A.queue = [];
  netz.failing = true;
  A.mut("plan/w0-3-a", { r: "b5", p: 2 }, false);
  A.zusammenfuehren(kopie(stand));          /* B weiß davon nichts */
  drainMicrotasks(); netz.failing = false;
  wahr(!!A.S.plan["w0-3-a"], "Das offline angelegte Gericht ist weg");
});

t("Offline Gelöschtes kommt nicht zurück", () => {
  const stand = neuerHaushalt(() => { A.S.plan = { "w0-1-a": { r: "b1", p: 2, ts: 1000 } }; });
  A.S = kopie(stand); A.queue = [];
  netz.failing = true;
  A.mut("plan/w0-1-a", null, false);
  A.zusammenfuehren(kopie(stand));
  drainMicrotasks(); netz.failing = false;
  wahr(!A.S.plan["w0-1-a"], "Das offline Gelöschte ist wieder da");
});

t("Wer später neu anlegt, gewinnt gegen die Löschung", () => {
  /* A löscht, B legt danach an derselben Stelle etwas Neues an. Das Neuere zählt. */
  const stand = neuerHaushalt(() => { A.S.plan = { "w0-1-a": { r: "b1", p: 2, ts: 1000 } }; });
  const nachA = geraetTut(stand, () => A.mut("plan/w0-1-a", null, false));
  A.S = kopie(nachA); A.queue = [];
  const vonB = { ...kopie(stand), plan: { "w0-1-a": { r: "b9", p: 2, ts: Date.now() + 5000 } } };
  A.zusammenfuehren(vonB);
  gleich(A.S.plan["w0-1-a"].r, "b9", "Das Neuere muss gewinnen");
});

t("Wer wieder anlegt, räumt den Grabstein weg", () => {
  neuerHaushalt(() => { A.S.plan = { "w0-1-a": { r: "b1", p: 2, ts: 1000 } }; });
  A.mut("plan/w0-1-a", null, false);
  wahr(A.S.weg["plan__w0-1-a"] > 0, "kein Grabstein gesetzt");
  A.mut("plan/w0-1-a", { r: "b2", p: 2 }, false);
  wahr(A.S.weg["plan__w0-1-a"] === undefined, "Grabstein blieb liegen");
});

t("Der Hinweis zum Vorrat überlebt das Zusammenführen", () => {
  const stand = neuerHaushalt();
  A.S = kopie(stand);
  A.S.listeInfo = { ausVorrat: 7, gebaut: Date.now(), woche: 0 };
  A.queue = [];
  A.zusammenfuehren(kopie(stand));
  gleich(A.S.listeInfo && A.S.listeInfo.ausVorrat, 7);
});

/* ---------------------------------------------------------------- */
gruppe("Grabsteine bleiben klein");

t("Ein Listen-Neubau setzt nur für wirklich Entferntes einen Grabstein", () => {
  neuerHaushalt(() => {
    A.S.liste = { a: { n: "A", ts: 1 }, b: { n: "B", ts: 1 }, c: { n: "C", ts: 1 } };
  });
  A.mut("liste", { a: { n: "A" }, d: { n: "D" } }, false);
  gleich(Object.keys(A.S.weg).sort(), ["liste__b", "liste__c"], "falsche Grabsteine");
});

t("Grabsteine verfallen nach der Frist", () => {
  neuerHaushalt();
  A.S.weg = { "plan__alt": Date.now() - (A.WEG_FRIST + 1) * A.TAG,
              "plan__neu": Date.now() };
  A.grabsteineAufraeumen();
  gleich(Object.keys(A.S.weg), ["plan__neu"]);
});

/* ---------------------------------------------------------------- */
gruppe("Über die Leitung: B schreibt, A hängt live daran");

/* Kein nachgebauter Fernstand, sondern der echte Weg: was Gerät B an die
   Datenbank schickt, wird A als Ereignis zugestellt – so wie Firebase es tut. */
function ueberDieLeitung(stand, wasBtut) {
  drainMicrotasks();
  A.S = kopie(stand); A.queue = []; netz.calls = []; netz.failing = false;
  wasBtut();
  drainMicrotasks();
  const ereignisse = netz.calls
    .filter(c => c.method === "PUT" || c.method === "DELETE")
    .map(c => {
      const hinter = String(c.url).split("/haushalte/")[1] || "";
      const ohneCode = hinter.split("/").slice(1).join("/").replace(/\.json$/, "");
      return { path: "/" + ohneCode, data: c.method === "DELETE" ? null : JSON.parse(c.body) };
    });
  wahr(ereignisse.length > 0, "B hat gar nichts geschickt");
  A.S = kopie(stand); A.queue = []; netz.calls = [];
  A.verbinden();
  const leitung = letzteQuelle();
  ereignisse.forEach(e => leitung.feuern("put", e));
  return A.S;
}

t("Ein Gericht, das B einplant, steht bei A im Plan", () => {
  const S = ueberDieLeitung(neuerHaushalt(), () => A.mut("plan/w0-1-a", { r: "b2", p: 2 }, false));
  gleich(S.plan["w0-1-a"].r, "b2");
});

t("Ein Gericht, das B aus dem Plan nimmt, ist bei A weg", () => {
  const S = ueberDieLeitung(
    neuerHaushalt(() => { A.S.plan = { "w0-1-a": { r: "b1", p: 2, ts: 1000 } }; }),
    () => A.mut("plan/w0-1-a", null, false));
  wahr(!S.plan["w0-1-a"], "Das Gericht steht bei A noch im Plan");
});

t("Was B im Markt abhakt, ist bei A abgehakt", () => {
  const S = ueberDieLeitung(
    neuerHaushalt(() => { A.S.liste = { brot: { n: "Brot", q: 1, e: "Stk", k: "bw", on: false, ts: 1000 } }; }),
    () => A.posten("brot", true));
  gleich(S.liste.brot.on, true);
});

t("Ein Posten, den B ergänzt, taucht bei A auf", () => {
  const S = ueberDieLeitung(neuerHaushalt(), () => {
    document.getElementById("mi").value = "Klopapier";
    A.manuell();
  });
  wahr(Object.values(S.liste).some(i => i.n === "Klopapier"), "Der Posten fehlt bei A");
});

t("Ein Vorratsprodukt, das B auf „fehlt“ stellt, steht bei A auf „fehlt“", () => {
  const S = ueberDieLeitung(
    neuerHaushalt(() => { A.S.vorrat = { milch: { n: "Milch", k: "kr", da: true, ts: 1000 } }; }),
    () => A.vorratSetzen("milch", false));
  gleich(S.vorrat.milch.da, false);
});

t("Nach dem Ereignisstrom stimmt auch der Gesamtabgleich noch", () => {
  /* Erst live zugestellt, dann verbindet A neu und führt B's Stand zusammen.
     Dabei darf nichts von dem, was gerade angekommen ist, wieder umkippen. */
  const stand = neuerHaushalt(() => {
    A.S.plan = { "w0-1-a": { r: "b1", p: 2, ts: 1000 } };
    A.S.liste = { brot: { n: "Brot", q: 1, e: "Stk", k: "bw", on: false, ts: 1000 } };
  });
  const vonB = geraetTut(stand, () => {
    A.mut("plan/w0-1-a", null, false);
    A.posten("brot", true);
  });
  const nachLive = ueberDieLeitung(stand, () => {
    A.mut("plan/w0-1-a", null, false);
    A.posten("brot", true);
  });
  A.S = kopie(nachLive); A.queue = [];
  A.zusammenfuehren(vonB);
  wahr(!A.S.plan["w0-1-a"], "Das Gelöschte kam beim Abgleich zurück");
  gleich(A.S.liste.brot.on, true, "Der Haken ging beim Abgleich verloren");
});

bilanz();
