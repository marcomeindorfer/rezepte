/* Schnellgerichte: eintragen ohne Rezept anzulegen. */
load("tests/harness.js");

function frisch() {
  A.S = A.leer();
  A.cfg = { db: "", hid: "", leser: "" };
  A.queue = []; A.tab = "woche"; A.planWoche = 0; A.filter = "alle"; A.suche = "";
  A.S.plan = {}; A.S.liste = {}; A.S.extra = {}; A.S.verlauf = {}; A.S.vorrat = {};
  Object.keys(elemente).forEach(k => delete elemente[k]);
  netz.calls = []; meldungen.alert.length = 0;
}
const anlegen = (n, z, mk) => A.schnellAnlegen(n, z, mk || "a");

gruppe("Anlegen");
t("Name genügt – alles Weitere leitet die App ab", () => {
  frisch();
  const id = anlegen("Brot mit Käse", "");
  const r = A.R(id);
  wahr(r, "Gericht existiert");
  gleich(r.n, "Brot mit Käse");
  gleich(r.k, "veg", "Art abgeleitet");
  gleich(r.z, [], "keine Zutaten");
  wahr(r.min > 0, "Zeit gesetzt");
  wahr(Array.isArray(r.m) && r.m.length === 12, "ganzjährig");
});
t("Zutaten werden zerlegt wie im Rezeptformular", () => {
  frisch();
  const id = anlegen("Brot mit Käse", "4 Scheiben Vollkornbrot\n80 g Gouda\n2 Tomaten");
  const r = A.R(id);
  gleich(r.z.length, 3);
  gleich(r.z[0].slice(0, 3), ["Vollkornbrot", 4, "Scheibe"]);
  gleich(r.z[1].slice(0, 3), ["Gouda", 80, "g"]);
  gleich(r.z[2].slice(0, 3), ["Tomaten", 2, "Stk"]);
  gleich(r.z[1][3], "kr", "Abteilung geraten");
});
t("Die Art ergibt sich aus den Zutaten", () => {
  frisch();
  gleich(A.R(anlegen("Lachsbrot", "100 g Lachs\n2 Scheiben Brot")).k, "fisch");
  gleich(A.R(anlegen("Hähnchenpfanne", "150 g Hähnchenbrustfilet")).k, "fleisch");
  gleich(A.R(anlegen("Gemüsepfanne", "200 g Zucchini")).k, "veg");
});
t("Das Protein wird aus den Zutaten geschätzt", () => {
  frisch();
  const mitEiweiss = A.R(anlegen("Quarkschale", "250 g Quark"));
  const ohne = A.R(anlegen("Gurkenteller", "200 g Gurke"));
  wahr(mitEiweiss.p > ohne.p, "Quark bringt mehr Protein als Gurke: " + mitEiweiss.p + " vs " + ohne.p);
  wahr(mitEiweiss.p > 10, "plausibler Wert, bekommen " + mitEiweiss.p);
});
/* Seit 4.1 kennen Rezepte den Unterschied zwischen Mittag und Abend nicht mehr:
   Was kein Frühstück ist, ist eine Hauptspeise und passt zu beidem. */
t("Ein Schnellgericht ist Frühstück oder Hauptspeise", () => {
  frisch();
  gleich(A.R(anlegen("Müsli", "", "f")).ma, ["f"]);
  gleich(A.R(anlegen("Suppe", "", "m")).ma, ["m", "a"], "mittags eingetragen, abends genauso brauchbar");
  gleich(A.R(anlegen("Auflauf", "", "a")).ma, ["m", "a"]);
});
t("Ohne Namen entsteht nichts", () => {
  frisch();
  gleich(anlegen("   ", "200 g Möhren"), null);
  gleich(Object.keys(A.S.eigene).length, 0);
});
t("Kennungen sind eindeutig, auch in derselben Millisekunde", () => {
  frisch();
  const ids = [];
  for (let i = 0; i < 200; i++) ids.push(anlegen("Gericht " + i, ""));
  gleich(new Set(ids).size, 200);
});

gruppe("Bleibt aus der Sammlung heraus");
t("Ein Schnellgericht steht nicht in der Rezeptliste", () => {
  frisch();
  const id = anlegen("Brot mit Käse", "");
  wahr(A.RZ().every(r => r.id !== id), "nicht in RZ()");
  wahr(A.RZ_ALLE().some(r => r.id === id), "aber auffindbar");
  wahr(A.SCHNELL().some(r => r.id === id), "im eigenen Bestand");
});
t("Der Wochenvorschlag greift nicht darauf zurück", () => {
  frisch();
  A.S.sammlung = {};
  for (let i = 0; i < 30; i++) anlegen("Schnell " + i, "100 g Möhren", "m");
  A.S.plan = {};
  A.autoWoche();
  const geplant = Object.values(A.S.plan).map(e => e.r);
  const schnellIds = new Set(A.SCHNELL().map(r => r.id));
  gleich(geplant.filter(id => schnellIds.has(id)), [], "kein Schnellgericht vorgeschlagen");
});
t("Entdecken und Aufräumen zeigen sie nicht", () => {
  frisch();
  const id = anlegen("Brot mit Käse", "");
  wahr(A.ideenPool().every(i => i.id !== id), "nicht im Ideenstrom");
  wahr(A.poolAlt().every(r => r.id !== id), "nicht unter Aufräumen");
});
t("Die Resteküche schlägt sie nicht vor", () => {
  frisch();
  anlegen("Zucchinibrot", "200 g Zucchini");
  A.resteWahl = ["Zucchini"];
  const treffer = A.resteTreffer();
  wahr(treffer.every(x => !A.istSchnell(x.r)), "keine Schnellgerichte");
  A.resteWahl = [];
});
t("Einplanen nimmt sie nicht in die Sammlung auf", () => {
  frisch();
  const id = anlegen("Brot mit Käse", "", "a");
  A.setSlot("w0-0-a", id);
  gleich(A.S.plan["w0-0-a"].r, id, "steht im Plan");
  wahr(!A.S.sammlung[id], "nicht in der Sammlung");
});
t("Der eigene Filter zeigt sie", () => {
  frisch();
  anlegen("Brot mit Käse", "");
  A.filter = "schnell";
  const html = A.trefferHtml();
  wahr(/Brot mit Käse/.test(html), "gefunden");
  wahr(/Schnell<\/span>/.test(html), "gekennzeichnet");
  A.filter = "alle";
  wahr(!/Brot mit Käse/.test(A.trefferHtml()), "im Normalfilter nicht");
});

gruppe("Wirkt wie ein Rezept, wo es soll");
t("Die Zutaten landen auf der Einkaufsliste", () => {
  frisch();
  const id = anlegen("Brot mit Käse", "80 g Gouda\n2 Tomaten", "a");
  A.setSlot("w0-0-a", id);
  A.S.plan["w0-0-a"] = { r: id, p: 3 };
  A.listeBauen();
  const posten = Object.values(A.S.liste);
  const gouda = posten.find(i => i.n === "Gouda");
  wahr(gouda, "Gouda auf der Liste");
  gleich(gouda.q, 240, "auf drei Portionen hochgerechnet");
});
t("Ohne Zutaten entstehen keine Einkäufe", () => {
  frisch();
  const id = anlegen("Reste von gestern", "", "a");
  A.S.plan["w0-0-a"] = { r: id, p: 2 };
  A.listeBauen();
  gleich(Object.keys(A.S.liste).length, 0);
});
t("Die Herkunftsanzeige nennt das Schnellgericht beim Namen", () => {
  frisch();
  const id = anlegen("Brot mit Käse", "80 g Gouda", "a");
  A.S.plan["w0-0-a"] = { r: id, p: 2 };
  A.listeBauen();
  const posten = Object.keys(A.S.liste)[0];
  A.postenWoher(posten);
  wahr(/Brot mit Käse/.test(elemente.sheet.innerHTML));
});
t("Der Wochenplan zeigt es wie jedes andere Gericht", () => {
  frisch();
  const id = anlegen("Brot mit Käse", "80 g Gouda", "a");
  A.S.plan["w0-0-a"] = { r: id, p: 2 };
  A.tab = "woche"; A.render();
  wahr(/Brot mit Käse/.test(elemente.view.innerHTML), "steht im Plan");
});
t("Es zählt bei Protein und Wochenkennzahlen mit", () => {
  frisch();
  const id = anlegen("Quarkschale", "250 g Quark", "f");
  A.S.plan["w0-0-f"] = { r: id, p: 2 };
  wahr(A.proteinTag(0, 0) > 0, "Protein fließt ein");
  gleich(A.planStat(0).belegt, 1);
});
t("Der Kochmodus lässt sich öffnen", () => {
  frisch();
  const id = anlegen("Brot mit Käse", "80 g Gouda", "a");
  A.kochModus(id, 2);
  wahr(/Brot mit Käse/.test(elemente.sheet.innerHTML));
  wahr(/160 g/.test(elemente.sheet.innerHTML), "Mengen hochgerechnet");
});

gruppe("Aufräumen");
t("Was noch im Plan steht, bleibt", () => {
  frisch();
  const id = anlegen("Brot mit Käse", "", "a");
  A.S.eigene[id].erstellt = Date.now() - 200 * 86400000;
  A.S.plan["w0-0-a"] = { r: id, p: 2 };
  A.schnellAufraeumen();
  wahr(A.S.eigene[id], "bleibt erhalten");
});
t("Was gekocht wurde, bleibt ebenfalls", () => {
  frisch();
  const id = anlegen("Brot mit Käse", "", "a");
  A.S.eigene[id].erstellt = Date.now() - 200 * 86400000;
  A.S.verlauf = { [Date.now()]: { r: id, kw: "KW 30" } };
  A.schnellAufraeumen();
  wahr(A.S.eigene[id], "bleibt erhalten");
});
t("Ungenutztes verschwindet nach 60 Tagen", () => {
  frisch();
  const id = anlegen("Einmal und nie wieder", "", "a");
  A.S.eigene[id].erstellt = Date.now() - 90 * 86400000;
  gleich(A.schnellAufraeumen(), 1);
  wahr(!A.S.eigene[id], "entfernt");
  wahr(A.S.geloescht[id], "mit Grabstein, damit der Abgleich es nicht zurückholt");
});
t("Frisch Angelegtes bleibt unangetastet", () => {
  frisch();
  const id = anlegen("Gerade eben", "", "a");
  gleich(A.schnellAufraeumen(), 0);
  wahr(A.S.eigene[id]);
});
t("Löschen lässt sich zurücknehmen", () => {
  frisch();
  const id = anlegen("Versehentlich", "", "a");
  A.schnellWeg(id);
  wahr(!A.S.eigene[id], "gelöscht");
  wahr(/Rückgängig/.test(elemente.meldung.innerHTML), "Rücknahme angeboten");
  A.meldungAusfuehren();
  wahr(A.S.eigene[id], "wieder da");
  wahr(!A.S.geloescht[id], "Grabstein gelöst");
});

gruppe("Aus Schnell wird Rezept");
t("Ab dreimal gekocht wird die Aufnahme vorgeschlagen", () => {
  frisch();
  const id = anlegen("Brot mit Käse", "80 g Gouda", "a");
  gleich(A.schnellVorschlag(), null, "vorher nicht");
  A.S.verlauf = { 1: { r: id, kw: "KW 1" }, 2: { r: id, kw: "KW 2" }, 3: { r: id, kw: "KW 3" } };
  const k = A.schnellVorschlag();
  wahr(k && k.id === id, "jetzt vorgeschlagen");
});
t("Der Vorschlag erscheint nach dem Wochenabschluss", () => {
  frisch();
  const id = anlegen("Brot mit Käse", "80 g Gouda", "a");
  A.S.verlauf = { 1: { r: id, kw: "KW 1" }, 2: { r: id, kw: "KW 2" } };
  A.S.plan["w0-0-a"] = { r: id, p: 2 };
  A.wocheAbschliessen();
  A.wocheAbschliessenJetzt();
  wahr(/schon 3× gekocht/.test(elemente.meldung.innerHTML), "Meldung: " + elemente.meldung.innerHTML.slice(0, 80));
  wahr(/Als Rezept aufnehmen/.test(elemente.meldung.innerHTML), "mit Angebot");
});
t("Die Aufnahme öffnet das Formular vorbefüllt", () => {
  frisch();
  const id = anlegen("Brot mit Käse", "80 g Gouda\n2 Tomaten", "a");
  A.schnellAufnehmen(id);
  gleich(A.nf.n, "Brot mit Käse");
  wahr(/80 g Gouda/.test(A.nf.zText), "Zutaten übernommen");
  wahr(/2 Stk Tomaten|2 Tomaten/.test(A.nf.zText), "zweite Zutat dabei");
  wahr(A.nf.status.length > 10, "Hinweis für den Nutzer");
});
t("Die Karte bietet die Aufnahme ab drei Malen an", () => {
  frisch();
  const id = anlegen("Brot mit Käse", "", "a");
  A.filter = "schnell";
  wahr(!/als Rezept aufnehmen/.test(A.trefferHtml()), "vorher nicht");
  A.S.verlauf = { 1: { r: id, kw: "a" }, 2: { r: id, kw: "b" }, 3: { r: id, kw: "c" } };
  wahr(/3× gekocht · als Rezept aufnehmen/.test(A.trefferHtml()), "jetzt schon");
  A.filter = "alle";
});

gruppe("Eingabe in der Oberfläche");
t("Der Platz-Wähler bietet das Formular an", () => {
  frisch();
  A.waehle("w0-1-m", "m");
  const html = elemente.sheet.innerHTML;
  wahr(/Eigenes Gericht eintragen/.test(html), "Block vorhanden");
  wahr(/id="sgn"/.test(html) && /id="sgz"/.test(html), "beide Felder");
});
t("Eintragen setzt das Gericht in den Platz", () => {
  frisch();
  A.waehle("w0-1-m", "m");
  document.getElementById("sgn").value = "Nudeln mit Pesto";
  document.getElementById("sgz").value = "125 g Nudeln\n2 EL Pesto";
  A.schnellInPlatz("w0-1-m", "m");
  const e = A.S.plan["w0-1-m"];
  wahr(e, "Platz belegt");
  gleich(A.R(e.r).n, "Nudeln mit Pesto");
  gleich(A.R(e.r).ma, ["m", "a"], "als Hauptspeise passt es zu beiden Plätzen");
});
t("Ohne Namen wird nichts eingetragen, sondern erklärt", () => {
  frisch();
  A.waehle("w0-1-m", "m");
  document.getElementById("sgn").value = "";
  A.schnellInPlatz("w0-1-m", "m");
  wahr(!A.S.plan["w0-1-m"], "Platz bleibt leer");
  wahr(/Namen/.test(elemente.meldung.innerHTML), "mit Hinweis");
});
t("Auch als Zusatzgericht möglich", () => {
  frisch();
  A.extraWaehlen();
  wahr(/Eigenes Gericht eintragen/.test(elemente.sheet.innerHTML), "Block vorhanden");
  document.getElementById("sgn").value = "Kuchen für Sonntag";
  document.getElementById("sgz").value = "200 g Mehl";
  A.schnellAlsExtra();
  const extras = A.extraListe(0);
  gleich(extras.length, 1);
  gleich(A.R(extras[0].r).n, "Kuchen für Sonntag");
});
t("Die Rückmeldung sagt, ob Einkäufe entstehen", () => {
  frisch();
  A.waehle("w0-2-a", "a");
  document.getElementById("sgn").value = "Reste"; document.getElementById("sgz").value = "";
  A.schnellInPlatz("w0-2-a", "a");
  wahr(/keine Einkäufe/.test(elemente.meldung.innerHTML), "ohne Zutaten");
  A.waehle("w0-3-a", "a");
  document.getElementById("sgn").value = "Brot"; document.getElementById("sgz").value = "2 Scheiben Brot";
  A.schnellInPlatz("w0-3-a", "a");
  wahr(/Einkaufsliste/.test(elemente.meldung.innerHTML), "mit Zutaten");
});

bilanz();
