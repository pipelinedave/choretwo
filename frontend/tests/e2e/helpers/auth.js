/**
 * E2E-Auth-Helper: JWT-Injection statt OIDC-Flow.
 *
 * WARUM (nicht `page.click('button[type="submit"]')`):
 * Die E2E-Suite lief urspruenglich gegen den Microservice-Stack, in dem der
 * Go auth-service den Dex-OIDC-Flow bediente:
 *   /login -> .btn-login -> /api/auth/login -> mock-login-page -> submit
 *            -> /auth-callback?token=... -> /
 * Der Python-Monolith stellt `/api/auth/login` NICHT bereit — der Endpunkt
 * gehoert dem auth-service. Ohne Container-Laufzeit (kein docker/podman) ist
 * der Go-Dienst nicht startbar, und alle 18 Specs brachen schon im Login ab
 * (`TimeoutError: waiting for locator('button[type="submit"]')`).
 *
 * Der Monolith validiert JWTs dagegen direkt (`monolith/auth.py:validate_token`).
 * Deshalb erzeugen wir hier einen gueltigen HS256-Token und legen ihn direkt in
 * localStorage — das ist der uebliche Weg, wenn der IdP ein externer Dienst ist.
 * Der Produktivcode bleibt unberuehrt; nur die Test-Vorbereitung aendert sich.
 *
 * SIGNATUR-PFLICHT: `validate_token` prueft issuer UND audience, nicht nur die
 * email. Ohne `iss`/`aud` kommt 401 {"error":"Invalid or expired token."}.
 *   JWT_ISSUER   default "choretwo-auth-service"   (monolith/auth.py:25)
 *   JWT_AUDIENCE default "choretwo"                (monolith/auth.py:26)
 *
 * Kein `jsonwebtoken`-Paket: HMAC-SHA256 kommt aus Nodes eingebautem `crypto`.
 * Damit keine neue Runtime-Abhaengigkeit in package.json.
 */
import { createHmac } from "node:crypto";

/** Muss zu JWT_SECRET des laufenden Monolith passen. */
export const E2E_JWT_SECRET =
  process.env.E2E_JWT_SECRET ?? "choretwo-dev-jwt-secret-change-in-production";
const E2E_JWT_ISSUER =
  process.env.E2E_JWT_ISSUER ?? "choretwo-auth-service";
const E2E_JWT_AUDIENCE = process.env.E2E_JWT_AUDIENCE ?? "choretwo";

const b64url = (obj) =>
  Buffer.from(JSON.stringify(obj)).toString("base64url");

/**
 * Baut einen gueltigen HS256-JWT mit email-Claim.
 *
 * @param {string} email - Nutzer-E-Mail; bestimmt, welche Chores der User sieht
 *                         (Mandantentrennung ueber `user_email`).
 * @param {object} [extra] - zusaetzliche Claims, z.B. `name`.
 * @returns {string} Serialisierter JWT.
 */
export function makeToken(email, extra = {}) {
  const header = b64url({ alg: "HS256", typ: "JWT" });
  const payload = b64url({
    email,
    iss: E2E_JWT_ISSUER,
    aud: E2E_JWT_AUDIENCE,
    exp: Math.floor(Date.now() / 1000) + 60 * 60,
    ...extra,
  });
  const signature = createHmac("sha256", E2E_JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest("base64url");
  return `${header}.${payload}.${signature}`;
}

/**
 * E-Mail je Spec-Datei. Ohne dasSeen legen alle Specs Chores unter derselben
 * Adresse an und mischen sich gegenseitig in den CatchUp-Stack — die Tests
 * sind nur mit `workers: 1` stabil (Begruendung in playwright.config.js).
 */
export function specEmail(specName) {
  return `e2e-${specName}@test.local`;
}

/**
 * Meldet einen User ohne Token an und belegt, dass der Route-Guard greift.
 * Nuetzt den Pfad, den der Login-Button nicht mehr hat.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} [expectUrl] - Ziel, auf das umgeleitet werden soll.
 */
export async function expectRedirectToLogin(page, expectUrl = "/login") {
  await page.goto("/");
  await page.waitForURL(`**${expectUrl}`, { timeout: 10000 });
  await expectLoginPageVisible(page);
}

/**
 * Meldet einen User an, indem der Token VOR der ersten Navigation in
 * localStorage gelegt wird.
 *
 * `addInitScript` laeuft bei JEDER Navigation der Page — noetig, weil die
 * Specs mehrfach navigieren und ein spaeter gesetzter Token den Vue-Router-Guard
 * (der den Token beim Init liest) verpassen wuerde. `clearCookies()` setzt
 * localStorage nicht zurueck, deshalb wird hier bewusst nicht gecleart.
 *
 * @param {import('@playwright/test').Page} page
 * @param {object} [opts]
 * @param {string} [opts.email] - E-Mail des Test-Users.
 * @param {string} [opts.name]  - Anzeigename.
 * @param {string} [opts.url]   - Start-URL nach dem Login (Default "/").
 * @returns {Promise<string>} Der injizierte Token.
 */
export async function login(page, opts = {}) {
  const {
    email = specEmail("default"),
    name = "E2E User",
    url = "/",
  } = opts;

  const token = makeToken(email, { name });
  await page.addInitScript(
    ([t, u]) => {
      window.localStorage.setItem("token", t);
      window.localStorage.setItem("user", JSON.stringify(u));
    },
    [token, { email, name }],
  );

  await page.goto(url);
  await page.waitForFunction(() => !!window.localStorage.getItem("token"), null, {
    timeout: 10000,
  });
  return token;
}

/**
 * Login + Token als Request-Authorization-Header, fuer `request`-Calls in den
 * Tests (Chore-Anlegen ueber die API statt ueber die UI).
 *
 * @param {import('@playwright/test').APIRequestContext} request
 * @param {import('@playwright/test').Page} page
 * @param {object} [opts] - siehe {@link login}
 * @returns {Promise<string>} Der Token fuer `headers: { Authorization }`.
 */
export async function loginToken(request, page, opts = {}) {
  void request; // Signatur-Kompatibilitaet; der Token kommt aus localStorage
  return login(page, opts);
}

/** Prüft, dass die Login-Seite wirklich sichtbar gerendert ist. */
export async function expectLoginPageVisible(page) {
  const url = page.url();
  if (!/\/login/.test(url)) {
    throw new Error(
      `expected to be on /login, but was on ${url} — Route-Guard evtl. defekt?`,
    );
  }
  // Der Login-Button traegt in allen Modi die Klasse `btn-login`
  // (Supabase-Magic-Link und Legacy-Dex).
  await page.locator(".btn-login").first().waitFor({ state: "visible" });
}
