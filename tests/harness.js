/* Testumgebung für Küchenplan.
   Lädt den <script>-Block aus index.html in eine nachgebaute Browser-Umgebung.
   Alle Bezeichner der obersten Ebene werden anschließend unter globalThis.A
   erreichbar gemacht – als Getter/Setter, damit auch veränderliche Werte
   (S, cfg, tab, queue …) gelesen und gesetzt werden können.

   globalThis.imScope(code) wertet Code im Geltungsbereich der App aus. Das ist
   für den Klick-Durchlauf nötig: Ein onclick-Attribut sieht sonst keine der
   App-Funktionen. */

var APP_DATEI = APP_DATEI || "index.html";

/* ---------- Speicher ---------- */
var speicher = {};
var localStorage = {
  getItem: k => (k in speicher ? speicher[k] : null),
  setItem: (k, v) => { speicher[k] = String(v); },
  removeItem: k => { delete speicher[k]; },
  clear: () => { speicher = {}; },
  get length() { return Object.keys(speicher).length; },
  key: i => Object.keys(speicher)[i]
};
var sessionStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

/* ---------- DOM ---------- */
var elemente = {};
function neuesElement(tag) {
  const el = {
    tagName: (tag || "div").toUpperCase(),
    innerHTML: "", textContent: "", value: "", checked: false, disabled: false,
    scrollTop: 0, scrollHeight: 0, offsetHeight: 0, files: [], src: "", href: "", download: "",
    style: {}, dataset: {}, children: [], hidden: false,
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    attribute: {},
    setAttribute(n, v) { this.attribute[n] = String(v); },
    getAttribute(n) { return n in this.attribute ? this.attribute[n] : null; },
    removeAttribute(n) { delete this.attribute[n]; },
    appendChild(k) { this.children.push(k); return k; },
    removeChild(k) { this.children = this.children.filter(x => x !== k); return k; },
    insertBefore(k) { this.children.unshift(k); return k; },
    addEventListener() {}, removeEventListener() {},
    click() {}, focus() {}, blur() {}, select() {}, scrollIntoView() {},
    querySelector: () => null, querySelectorAll: () => [],
    closest: () => null, remove() {}, contains: () => false,
    getBoundingClientRect: () => ({ top: 0, left: 0, width: 300, height: 40, bottom: 40, right: 300 })
  };
  return el;
}
var document = {
  getElementById(id) { return (elemente[id] = elemente[id] || neuesElement("div")); },
  createElement: tag => neuesElement(tag),
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener() {}, removeEventListener() {},
  visibilityState: "visible",
  activeElement: null,
  body: neuesElement("body"),
  documentElement: neuesElement("html"),
  head: neuesElement("head"),
  title: ""
};

/* ---------- Zeitgeber ---------- */
var timerId = 1, timers = [];
function setTimeout(fn, ms) { timers.push({ id: timerId, fn, ms }); return timerId++; }
function clearTimeout(id) { timers = timers.filter(t => t.id !== id); }
function setInterval(fn, ms) { return setTimeout(fn, ms); }
function clearInterval(id) { clearTimeout(id); }
function requestAnimationFrame(fn) { return setTimeout(fn, 16); }
function cancelAnimationFrame(id) { clearTimeout(id); }
/* Läuft alle fälligen Zeitgeber einmal ab – für Tests, die auf Verzögertes warten */
function timersLaufen() { const t = timers; timers = []; t.forEach(x => { try { x.fn(); } catch (e) {} }); }

/* ---------- Netz ---------- */
var netz = { calls: [], failing: false, failNth: null, n: 0, status: null, antwort: null };
function fetch(url, opt) {
  netz.n++;
  netz.calls.push({ url: String(url), method: (opt && opt.method) || "GET", body: opt && opt.body });
  if (netz.failing || (netz.failNth != null && netz.n === netz.failNth)) return Promise.reject(new Error("netz aus"));
  const koerper = netz.antwort == null ? "null" : (typeof netz.antwort === "string" ? netz.antwort : JSON.stringify(netz.antwort));
  return Promise.resolve({
    ok: !netz.status || (netz.status >= 200 && netz.status < 300),
    status: netz.status || 200,
    headers: { get: () => "application/json" },
    text: () => Promise.resolve(koerper),
    json: () => Promise.resolve(netz.antwort == null ? null : (typeof netz.antwort === "string" ? JSON.parse(netz.antwort) : netz.antwort)),
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    blob: () => Promise.resolve({})
  });
}

/* ---------- Live-Verbindung ----------
   Name bewusst sperrig: die App hat selbst eine Funktion „quellen“, die eine
   gleichnamige Testsammlung überschreiben würde. */
var esListe = [];
function EventSource(url) {
  this.url = url; this.hoerer = {}; this.geschlossen = false;
  this.addEventListener = (typ, fn) => { (this.hoerer[typ] = this.hoerer[typ] || []).push(fn); };
  this.close = () => { this.geschlossen = true; };
  this.feuern = (typ, daten) => (this.hoerer[typ] || []).forEach(f => f({ data: JSON.stringify(daten) }));
  esListe.push(this);
}
const letzteQuelle = () => esListe[esListe.length - 1];

/* ---------- Sonstige Browser-Teile ---------- */
var navigator = {
  onLine: true, userAgent: "jsc-test", language: "de-DE",
  share: () => Promise.resolve(),
  clipboard: { writeText: () => Promise.resolve() },
  wakeLock: { request: () => Promise.resolve({ release: () => Promise.resolve(), addEventListener() {} }) }
};
var location = { origin: "https://test.example", pathname: "/index.html", search: "", hash: "", href: "https://test.example/index.html", reload() {}, assign() {} };
var history = { pushState() {}, replaceState() {}, back() {}, length: 1 };
var crypto = { getRandomValues: a => { for (var i = 0; i < a.length; i++) a[i] = (i * 37 + 11) % 256; return a; } };
/* JavaScriptCore kennt kein URL – für die Tests reicht ein einfacher Zerleger */
function URL(u, basis) {
  const s = String(u);
  const mm = s.match(/^([a-z]+:)\/\/([^/?#]+)([^?#]*)(\?[^#]*)?(#.*)?$/i) || [];
  this.href = s; this.protocol = mm[1] || "https:"; this.host = mm[2] || ""; this.hostname = (mm[2] || "").split(":")[0];
  this.origin = (mm[1] || "https:") + "//" + (mm[2] || ""); this.pathname = mm[3] || "/";
  this.search = mm[4] || ""; this.hash = mm[5] || "";
  this.searchParams = { get: () => null, has: () => false, set: () => {} };
  this.toString = () => s;
}
URL.createObjectURL = () => "blob:test";
URL.revokeObjectURL = () => {};
function URLSearchParams(s) {
  const paare = String(s || "").replace(/^\?/, "").split("&").filter(Boolean)
    .map(p => p.split("=").map(x => { try { return decodeURIComponent(x.replace(/\+/g, " ")); } catch (e) { return x; } }));
  this.get = k => { const f = paare.find(p => p[0] === k); return f ? (f[1] === undefined ? "" : f[1]) : null; };
  this.has = k => paare.some(p => p[0] === k);
  this.set = () => {}; this.append = () => {};
  this.forEach = fn => paare.forEach(p => fn(p[1], p[0]));
}
function Blob(teile, opt) { this.teile = teile; this.type = (opt && opt.type) || ""; this.size = 0; }
function File(teile, name, opt) { Blob.call(this, teile, opt); this.name = name; }
function FileReader() {
  this.readAsText = () => { this.result = ""; if (this.onload) this.onload({ target: this }); };
  this.readAsDataURL = () => { this.result = "data:,"; if (this.onload) this.onload({ target: this }); };
  this.readAsArrayBuffer = () => { this.result = new ArrayBuffer(0); if (this.onload) this.onload({ target: this }); };
}
function Worker() { this.postMessage = () => {}; this.terminate = () => {}; this.addEventListener = () => {}; }
var meldungen = { alert: [], confirm: [], prompt: [] };
var confirmAntwort = true, promptAntwort = "";
function alert(t) { meldungen.alert.push(String(t)); }
function confirm(t) { meldungen.confirm.push(String(t)); return confirmAntwort; }
function prompt(t) { meldungen.prompt.push(String(t)); return promptAntwort; }
function scrollTo() {}
function addEventListener() {}
function removeEventListener() {}
function matchMedia() { return { matches: false, addEventListener() {}, addListener() {} }; }
var innerWidth = 390, innerHeight = 844, devicePixelRatio = 2;
var window = globalThis;
globalThis.window = globalThis;
globalThis.self = globalThis;

/* ---------- App laden ---------- */
var html = read(APP_DATEI);
var m = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/) || html.match(/<script>([\s\S]*)<\/script>/);
if (!m) { print("FEHLER: kein <script>-Block gefunden"); quit(1); }
var quellText = m[1];

/* Alle Bezeichner der obersten Ebene einsammeln (Zeilenanfang ohne Einrückung).
   Wichtig: „let a=1, b=2, c=3“ deklariert drei Namen – wer nur den ersten nimmt,
   misst später an einer Attrappe statt an der echten Variablen. */
var namen = new Set();
var re = /^(?:const|let|var|function|async function)\s+([A-Za-z_$][\w$]*)/gm;
var treffer;
while ((treffer = re.exec(quellText))) namen.add(treffer[1]);

var reZeile = /^(?:const|let|var)\s+([^\n]*)$/gm;
while ((treffer = reZeile.exec(quellText))) {
  const zeile = treffer[1];
  let tiefe = 0, start = 0, stuecke = [];
  for (let i = 0; i < zeile.length; i++) {
    const c = zeile[i];
    if ("([{".includes(c)) tiefe++;
    else if (")]}".includes(c)) tiefe--;
    else if ((c === "," || c === ";") && tiefe === 0) { stuecke.push(zeile.slice(start, i)); start = i + 1; }
  }
  stuecke.push(zeile.slice(start));
  /* Nur auswerten, wenn die Zeile ausgeglichen endet – sonst geht die Deklaration weiter */
  if (tiefe === 0) stuecke.forEach(s => {
    const m2 = s.match(/^\s*([A-Za-z_$][\w$]*)\s*(?:=[^=]|$)/);
    if (m2) namen.add(m2[1]);
  });
}
var zugriff = [...namen].map(n => `get ${n}(){return ${n}}, set ${n}(v){${n}=v}`).join(",\n  ");

var quelle = quellText + `
;globalThis.__A = {
  ${zugriff}
};
globalThis.imScope = function(code){ return eval(code); };
`;

/* Namen der Testumgebung, die von der App überschrieben werden könnten */
var vorher = { netz: netz, elemente: elemente, esListe: esListe, meldungen: meldungen, speicher: speicher };

(0, eval)(quelle);

var ueberschrieben = Object.keys(vorher).filter(k => globalThis[k] !== vorher[k]);
if (ueberschrieben.length) {
  print("FEHLER: die App überschreibt Namen der Testumgebung: " + ueberschrieben.join(", "));
  quit(2);
}

/* Zugriff auf einen Namen, den es in der App nicht gibt, ist fast immer ein Tippfehler
   im Test – oder ein Bezeichner, den die Sammelroutine übersehen hat. Beides soll
   auffallen, statt still an einer Attrappe zu messen. */
globalThis.A = new Proxy(globalThis.__A, {
  get(z, k) {
    if (typeof k === "string" && !(k in z)) throw new Error("Unbekannter Bezeichner in der App: " + k);
    return z[k];
  },
  set(z, k, v) {
    if (typeof k === "string" && !(k in z)) throw new Error("Unbekannter Bezeichner in der App: " + k);
    z[k] = v; return true;
  }
});

/* ---------- Mini-Testframework ---------- */
var ok = 0, fehler = [], nurGruppe = null;
function t(name, fn) {
  try { fn(); ok++; print("  ok   " + name); }
  catch (e) { fehler.push(name + " → " + e.message); print("  FEHL " + name + "\n       " + (e && e.message)); }
}
function gleich(a, b, was) {
  var x = JSON.stringify(a), y = JSON.stringify(b);
  if (x !== y) throw new Error((was ? was + ": " : "") + "erwartet " + y + ", bekommen " + x);
}
function wahr(b, was) { if (!b) throw new Error(was || "sollte wahr sein"); }
function gruppe(titel) { print("\n== " + titel + " =="); }
function bilanz() {
  print("\n" + ok + " bestanden, " + fehler.length + " fehlgeschlagen");
  if (fehler.length) { print("\nFehlgeschlagen:"); fehler.forEach(f => print("  - " + f)); quit(1); }
}
Object.assign(globalThis, { t, gleich, wahr, gruppe, bilanz, netz, speicher, elemente, esListe, letzteQuelle, meldungen, timersLaufen, neuesElement });
