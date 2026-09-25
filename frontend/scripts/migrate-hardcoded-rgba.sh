#!/usr/bin/env bash
# Einmal-Migration der harten rgba()-Werte auf semantische Tokens (Befund 3).
# Jede Zeile: <alter Wert>  ->  <neuer Wert>. Reihenfolge unkritisch, die
# Muster sind disjunkt.
set -euo pipefail
cd "$(dirname "$0")/../src"

FILES=$(find . -name "*.vue" -o -name "*.css" | grep -v "styles/variables.css")

apply() {
  local from="$1" to="$2" count
  before=$(grep -cF -- "$from" $FILES 2>/dev/null | awk -F: '{s+=$2} END {print s+0}' || true)
  # shellcheck disable=SC2086
  sed -i "s|$from|$to|g" $FILES
  after=$(grep -cF -- "$from" $FILES 2>/dev/null | awk -F: '{s+=$2} END {print s+0}' || true)
  count=$((before - after))
  printf '  %-52s %2d Treffer  ->  %s\n' "${from:0:52}" "$count" "${to:0:58}"
}

echo "=== Frosted-Glass-Haarlinien (weiss) ==="
apply 'rgba(255, 255, 255, 0.7)'  'var(--color-border-glass)'
apply 'rgba(255, 255, 255, 0.8)'  'var(--color-border-glass)'
apply 'rgba(255, 255, 255, 0.65)' 'var(--color-border-glass-subtle)'
apply 'rgba(255, 255, 255, 0.6)'  'var(--color-border-glass-subtle)'

echo "=== Transluzente Flaechen (weiss) ==="
apply 'rgba(255, 255, 255, 0.5)'  'color-mix(in srgb, var(--color-surface) 50%, transparent)'
apply 'rgba(255, 255, 255, 0.4)'  'color-mix(in srgb, var(--color-on-accent) 40%, transparent)'
apply 'rgba(255, 255, 255, 0.3)'  'var(--color-surface-overlay-soft)'

echo "=== Ink-getoente State-Fills und Kanten ==="
apply 'rgba(31, 45, 44, 0.45)' 'var(--color-overlay-scrim)'
apply 'rgba(31, 45, 44, 0.35)' 'var(--color-overlay-scrim)'
apply 'rgba(31, 45, 44, 0.25)' 'color-mix(in srgb, var(--color-text) 25%, transparent)'
apply 'rgba(31, 45, 44, 0.2)'  'color-mix(in srgb, var(--color-text) 20%, transparent)'
apply 'rgba(31, 45, 44, 0.18)' 'color-mix(in srgb, var(--color-text) 18%, transparent)'
apply 'rgba(31, 45, 44, 0.15)' 'color-mix(in srgb, var(--color-text) 15%, transparent)'
apply 'rgba(31, 45, 44, 0.12)' 'color-mix(in srgb, var(--color-text) 12%, transparent)'
apply 'rgba(31, 45, 44, 0.1)'  'color-mix(in srgb, var(--color-text) 10%, transparent)'
apply 'rgba(31, 45, 44, 0.08)' 'color-mix(in srgb, var(--color-text) 8%, transparent)'
apply 'rgba(31, 45, 44, 0.07)' 'rgb(var(--md-sys-color-shadow-rgb) / 0.07)'
apply 'rgba(31, 45, 44, 0.11)' 'rgb(var(--md-sys-color-shadow-rgb) / 0.11)'
apply 'rgba(31, 45, 44, 0.16)' 'rgb(var(--md-sys-color-shadow-rgb) / 0.16)'

echo "=== Primary-Tints (Light-Primary, im Dark Mode falsch) ==="
apply 'rgba(47, 111, 111, 0.2)'  'var(--color-focus-ring)'
apply 'rgba(47, 111, 111, 0.12)' 'var(--color-primary-subtle)'
apply 'rgba(47, 111, 111, 0.1)'  'var(--color-primary-subtle)'

echo "=== Danger-/Success-Tints ==="
apply 'rgba(231, 99, 99, 0.15)'  'var(--color-danger-subtle)'
apply 'rgba(72, 187, 120, 0.3)' 'color-mix(in srgb, var(--color-success) 30%, transparent)'
apply 'rgba(72, 187, 120, 0.15)' 'color-mix(in srgb, var(--color-success) 15%, transparent)'

echo "=== Schwarze Scrims und Schatten (follow the theme) ==="
apply 'rgba(0, 0, 0, 0.5)'  'var(--color-overlay-scrim)'
apply 'rgba(0, 0, 0, 0.4)'  'var(--color-overlay-scrim)'
apply 'rgba(0, 0, 0, 0.15)' 'color-mix(in srgb, var(--color-text) 15%, transparent)'
apply 'rgba(0, 0, 0, 0.1)'  'rgb(var(--md-sys-color-shadow-rgb) / 0.1)'
apply 'rgba(0, 0, 0, 0.08)' 'color-mix(in srgb, var(--color-text) 8%, transparent)'
apply 'rgba(0, 0, 0, 0.3)'  'rgb(var(--md-sys-color-shadow-rgb) / 0.3)'

echo ""
echo "=== Restliche rgba-Literale in src/ ==="
grep -rnoE "rgba?\([^)]*\)" --include="*.vue" --include="*.css" . | grep -v "rgb(var(" | sort -t: -k1,1 -k2,2n || echo "  (keine)"
