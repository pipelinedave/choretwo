/**
 * Einmal-Migration der E2E-Specs von Dex-OIDC-Login auf JWT-Injection.
 * Idempotent: bereits migrierte Specs werden uebersprungen.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";

const SPECS = [
  "chore-crud",
  "debug-logs",
  "filter-pills",
  "settings-ai",
  "settings-appearance",
  "settings-navigation",
  "settings-notifications",
  "swipe-gestures",
  "swipe-interactions",
  "undo-fix-verify",
  "undo-marked-done-bug",
  "undo-marked-done-fix",
  "undo-marked-done",
  "auth-logout",
];

// Spezifische Blöcke, die vom generischen Muster NICHT erfasst werden.
const CUSTOM = {
  "filter-pills":
    /await page\.goto\("\/api\/auth\/login"\);[\s\S]*?await page\.click\('button\[type="submit"\]'\);/,
};

// Generische Muster: Login-Klick-Kette inkl. Cookie-Reset.
const GENERIC = [
  // beforeEach-Variante mit clearCookies + addCookies
  /(?:[ \t]*)await context\.clearCookies\(\);\n[ \t]*await context\.addCookies\(\[\]\);\n(?:[ \t]*\/\/[^\n]*\n)*[ \t]*await page\.goto\("\/login"\);\n[ \t]*await page\.click\("\.btn-login"\);\n[ \t]*await page\.click\('button\[type="submit"\]'\);\n[ \t]*await page\.waitForURL\("\/".*?\);\n/,
  // page.context().clearCookies()-Variante
  /(?:[ \t]*)await page\.context\(\)\.clearCookies\(\);\n[ \t]*await page\.goto\("\/login"\);\n[ \t]*await page\.click\("\.btn-login"\);\n[ \t]*await page\.click\('button\[type="submit"\]'\);\n[ \t]*await page\.waitForURL\("\/".*?\);\n/,
  // nackte Kette ohne Cookie-Reset
  /(?:[ \t]*)await page\.goto\("\/login"\);\n[ \t]*await page\.click\("\.btn-login"\);\n[ \t]*await page\.click\('button\[type="submit"\]'\);\n[ \t]*await page\.waitForURL\("\/".*?\);\n/,
  // nackte Kette, gefolgt von Token-Auslesen
  /(?:[ \t]*)await page\.goto\("\/login"\);\n[ \t]*await page\.click\("\.btn-login"\);\n[ \t]*await page\.click\('button\[type="submit"\]'\);\n/,
];

const report = [];

for (const name of SPECS) {
  const file = `tests/e2e/${name}.spec.js`;
  let src = readFileSync(file, "utf8");
  const before = src;

  if (src.includes("e2eLogin")) {
    report.push(`  ${name.padEnd(26)} SKIP (bereits migriert)`);
    continue;
  }

  const indentOf = (marker) => {
    const m = src.match(new RegExp(`^([ \\t]*)${marker}`, "m"));
    return m ? m[1] : "      ";
  };

  // 1) Spezifische Bloecke
  let replaced = 0;
  if (CUSTOM[name]) {
    const indent = indentOf('await page.goto("/api/auth/login")');
    const re = new RegExp(CUSTOM[name].source, "g");
    const count = (src.match(re) || []).length;
    if (count) {
      src = src.replace(
        re,
        `${indent}await e2eLogin(page, { email: USER, name: "${name}" });`,
      );
      replaced += count;
    }
  }

  // 2) Generische Muster, mehrfach anwenden
  for (const re of GENERIC) {
    const g = new RegExp(re.source, "g");
    const count = (src.match(g) || []).length;
    if (!count) continue;
    // Einmal das Padding ermitteln, dann alle Treffer ersetzen
    const sample = src.match(g)[0];
    const indent = sample.match(/^[ \t]*/)[0];
    src = src.replace(
      g,
      `${indent}await e2eLogin(page, { email: USER, name: "${name}" });\n`,
    );
    replaced += count;
  }

  if (replaced === 0) {
    report.push(`  ${name.padEnd(26)} NICHT GEFUNDEN — manuell pruefen!`);
    continue;
  }

  // 3) USER-Konstante + Import einfuegen
  if (!src.includes("const USER =")) {
    const describeLine = src.match(/test\.describe\(/);
    const anchor = describeLine
      ? src.slice(0, describeLine.index)
      : src.slice(0, src.indexOf("\n\n") + 2);
    const ins = `\n// Eigene Test-Adresse pro Spec — verhindert, dass sich die Chores\n// dieser Spec mit denen anderer Specs in der geteilten Test-DB mischen.\nconst USER = specEmail("${name}");\n`;
    src = src.replace(anchor, anchor + ins);
  }

  // Import an die bestehende @playwright/test-Zeile haengen
  src = src.replace(
    /import \{([^}]*)\} from "@playwright\/test";/,
    (m, names) =>
      `import {${names}} from "@playwright/test";\nimport { login as e2eLogin, specEmail } from "./helpers/auth.js";`,
  );

  // Verbliebene Login-Reste melden
  const leftovers = (src.match(/type="submit"|mock-login-page|auth-callback/g) || []).length;

  writeFileSync(file, src, "utf8");
  report.push(
    `  ${name.padEnd(26)} ${replaced} Block(e) ersetzt${leftovers ? `  ⚠ ${leftovers} Rest(e)` : ""}`,
  );
}

console.log("=== Migration ===");
report.forEach((l) => console.log(l));
