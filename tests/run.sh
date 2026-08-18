#!/bin/sh
# Führt alle Prüfungen des Marco's brain aus – ohne Browser, ohne Installation.
# Genutzt wird JavaScriptCore, das auf jedem Mac bereits vorhanden ist.
#
#   ./tests/run.sh              alle Testreihen
#   ./tests/run.sh 02           nur die Reihe, deren Name mit 02 beginnt
#   LAEUFE=500 ./tests/run.sh   mehr Durchläufe für den Wochenvorschlag
#
# Schlägt etwas fehl, endet das Skript mit Code 1.

cd "$(dirname "$0")/.."

JSC="/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc"
if [ ! -x "$JSC" ]; then
  echo "JavaScriptCore nicht gefunden unter $JSC" >&2
  exit 2
fi

muster="${1:-}"
status=0
gesamt=0

for datei in tests/[0-9]*.js; do
  name=$(basename "$datei")
  case "$name" in
    "$muster"*) ;;
    *) [ -n "$muster" ] && continue ;;
  esac
  printf "\n\033[1m▸ %s\033[0m\n" "$name"
  if [ -n "$LAEUFE" ]; then
    ausgabe=$("$JSC" -e "globalThis.LAEUFE=$LAEUFE;" -f "$datei" 2>&1)
  else
    ausgabe=$("$JSC" "$datei" 2>&1)
  fi
  ergebnis=$?
  echo "$ausgabe"
  [ $ergebnis -ne 0 ] && status=1
  zeile=$(echo "$ausgabe" | grep -E "^[0-9]+ bestanden" | tail -1)
  anzahl=$(echo "$zeile" | grep -oE "^[0-9]+")
  [ -n "$anzahl" ] && gesamt=$((gesamt + anzahl))
done

printf "\n\033[1m%s Prüfungen bestanden.\033[0m\n" "$gesamt"
[ $status -ne 0 ] && printf "\033[31mEs sind Prüfungen fehlgeschlagen.\033[0m\n"
exit $status
