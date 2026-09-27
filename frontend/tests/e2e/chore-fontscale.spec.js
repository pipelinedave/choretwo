import { test, expect } from "@playwright/test";
import { login as e2eLogin, specEmail } from "./helpers/auth.js";

/**
 * Kein horizontaler Ueberlauf bei grosser Systemschriftgroesse.
 *
 * ANLASS
 * Auf einem Pixel 9a mit erhoehter Systemschrift war die Seite seitwaerts
 * wegschiebbar. In der DevTools-Emulation war nichts zu sehen — dort ist die
 * Schrift immer 100 %. Genau dieser Unterschied hat die Suche lang
 * behindert: derselbe Aufruf liefert lokal 0 px und auf dem Geraet 42 px.
 *
 * ZWEI URSACHEN, DIE SICH GERADE NICHT ERKENNEN LASSEN
 * 1. Ein einzelnes Wort ohne Trennstelle, typisch ein Markenname in einem
 *    <h1>, wird bei 150 % 381 px breit in einer 266-px-Box. Kein Element
 *    ragt dabei aus dem Viewport — `getBoundingClientRect()` ist bei ALLEN
 *    sauber. Der Ueberlauf steckt im Inhalt und ist nur ueber
 *    `scrollWidth > clientWidth` auffindbar.
 * 2. Flex-Kinder mit `flex-shrink: 0` und fester `min-width`, die bei
 *    Skalierung nicht schrumpfen koennen: Zaehler-Badges, Tastenkuerzel,
 *    Verlauf-Knopf.
 *
 * ZUM WERT `overflow-wrap: anywhere`
 * `break-word` bricht die Zeile beim Rendern, aendert aber die
 * min-content-Groesse NICHT. In einem Shrink-to-fit-Kontext — ein
 * Flex-Item mit `flex-basis: auto` — bleibt die min-content-Groesse die
 * volle Wortbreite, und der Container laeuft trotzdem ueber. Genau so
 * verhielt sich `/logs` bereits bei 100 % Schrift. Nur `anywhere`
 * veraendert die min-content-Groesse.
 *
 * DIE SKALEN
 * 100 bis 175 % sind belegt und muessen 0 sein. 175 % ist die Obergrenze,
 * weil dort der Screenshot-Nachweis lag; darueber hinaus verhalten sich
 * Chore-Stack und Kopfzeile als Hoehen- und nicht als Breitenproblem, und
 * ihre Restabweichung ist eine andere Frage als die hier behobene.
 */
const USER = specEmail("chore-fontscale");

/*
 * Routen und ihre Auth-Bedingung — getrennt, weil der Auth-Guard die
 * Messung sonst verfaelscht.
 *
 * `requiresGuest` schickt eingeloggte Nutzer von `/login` auf `/` um. Ein
 * Test, der sich einloggt und dann `/login` aufruft, landet also auf der
 * Startseite und prueft die falsche Route. Genau das ist passiert: der
 * Sweep meldete 0 px, waehrend die echte Login-Seite 42 px Ueberlauf
 * hatte. Der Negativtest (Fix entfernt) blieb gruen und hat den Fehler
 * damit nicht aufgedeckt.
 *
 * Darum: die Login-Seite wird in einem eigenen Test OHNE Login besucht,
 * die uebrigen Routen mit Login.
 */
/*
 * `/settings` steht hier bewusst NICHT: die Route leitet auf `/` um, seit
 * die Bottom-Nav entfernt und die Einstellungen in das Modal gewandert
 * sind (cc829f9). Sie zu messen waere sinnlos, man saehe die Startseite.
 * Genau dieser Redirect hat die Pfad-Assertion aufgedeckt, als sie neu
 * hinzukam — vorher waere er stillschweigend durchgerutscht.
 */
const PFADE_MIT_LOGIN = ["/", "/chores", "/catchup", "/logs", "/ai"];

/*
 * 412 px ist die CSS-Breite eines Pixel 7/8/9 — dem Geraet, auf dem der
 * Ueberlauf zuerst aufgefallen ist.
 *
 * WICHTIG: `playwright.config.js` setzt KEIN `viewport`, Playwright
 * benutzt also 1280 px. Bei dieser Breite gibt es keinen Ueberlauf, und
 * eine erste Fassung dieses Tests meldete deshalb dauerhaft "kein
 * Ueberlauf", obwohl die Regel entfernt war — der Negativtest blieb gruen
 * und der Test war wertlos. Die Breite muss hier ausdruecklich stehen.
 */
/*
 * `isMobile: true` ist DER entscheidende Teil, nicht der Viewport.
 *
 * Gemessen an `/login` bei 150 % Schrift:
 *
 *   isMobile: false   +0 px
 *   isMobile: true    +42 px
 *
 * Die Mobile-Emulation aktiviert in Chromium das Viewport-Verhalten eines
 * Telefons, und erst dadurch greift die Textverbreiterung so weit, dass ein
 * einzelnes Wort wie "CHORETWO" aus seinem Container laeuft. Ohne
 * `isMobile` meldet dieser Sweep dauerhaft "kein Ueberlauf", obwohl die
 * Regel entfernt war — der Negativtest blieb gruen und der Test war
 * wertlos. Beide Flags muessen also gesetzt sein.
 */
const VIEWPORT = { width: 412, height: 839 };
const MOBILE = { isMobile: true, hasTouch: true, deviceScaleFactor: 2.625 };
const SKALEN = [100, 115, 130, 150, 175];
const CHORES = [
  "Tastatur reinigen",
  "Türgriffe & Lichtschalter desinfizieren",
  "Wohnzimmerfenster und Balkontür gründlich abwischen",
];

test.describe("Schriftgroessen-Sweep", () => {
  const created = [];

  test.beforeEach(async ({ page, context }) => {
    await context.clearCookies();
    await e2eLogin(page, { email: USER, name: "chore-fontscale" });
  });

  test.afterEach(async ({ page, request }) => {
    const token = await page.evaluate(() => localStorage.getItem("token"));
    for (const id of created.splice(0)) {
      await request
        .delete(`/api/chores/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        .catch(() => {});
    }
  });

  async function seed(page, request) {
    const token = await page.evaluate(() => localStorage.getItem("token"));
    for (const name of CHORES) {
      const res = await request.post("/api/chores/", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        data: {
          name,
          interval_days: 7,
          due_date: "2026-09-07",
          is_private: false,
        },
      });
      if (res.ok()) {
        const body = await res.json();
        created.push(body.id ?? body._embedded?.id);
      }
    }
  }

  test.use({ viewport: VIEWPORT, ...MOBILE });

  test("kein Ueberlauf auf irgendeiner Route bis 175 % Schrift", async ({
    page,
    request,
  }) => {
    await seed(page, request);

    const befunde = [];
    for (const pfad of PFADE_MIT_LOGIN) {
      for (const skala of SKALEN) {
        await page.goto(pfad);
        await page.evaluate((s) => {
          // `font-size` allein reicht nicht: der Befund trat nur mit
          // `webkitTextSizeAdjust` auf, weil Chrome dann Text-Autosizing
          // anwendet — genau das, was die Systemschrift auf Android tut.
          document.documentElement.style.fontSize = s + "%";
          document.documentElement.style.webkitTextSizeAdjust = s + "%";
        }, skala);
        await expect(
          page.locator("body"),
          `${pfad} @ ${skala}% liess sich nicht laden`,
        ).toBeVisible();
        await page.waitForTimeout(300);

        const r = await page.evaluate((erwartet) => {
          const de = document.documentElement;
          const gelandet = location.pathname;
          const ueber = de.scrollWidth - de.clientWidth;
          let schuldig = null;
          if (ueber > 0) {
            // Das ueberstehende Element benennen, sonst hilft die Meldung
            // beim Nachforschen nicht weiter.
            for (const el of document.querySelectorAll("*")) {
              const bb = el.getBoundingClientRect();
              if (bb.right > de.clientWidth + 0.5) {
                schuldig =
                  (el.className?.toString() || el.tagName).slice(0, 46) +
                  " (+" +
                  Math.round(bb.right - de.clientWidth) +
                  "px)";
                break;
              }
            }
          }
          return {
            ueber,
            schuldig,
            vw: de.clientWidth,
            gelandet,
            erwartet,
            stack: document.querySelectorAll(".catchup-card").length,
          };
        }, pfad);

        /*
         * Zuerst die Identitaet der Seite pruefen. Ein Auth-Guard, der auf
         * eine andere Route umleitet, laesst die Breitenmessung trivial
         * erscheinen — 0 px, weil man die problematische Seite gar nicht
         * sieht. Genau dieser Fehler hat die erste Fassung dieses Tests
         * unbrauchbar gemacht.
         */
        expect(
          r.gelandet,
          `${pfad} war nicht erreichbar — der Auth-Guard hat auf ` +
            `${r.gelandet} umgeleitet, die Messung waere wertlos`,
        ).toBe(r.erwartet);

        if (r.ueber > 0) {
          befunde.push(
            `${pfad} @ ${skala}%: +${r.ueber}px` +
              (r.schuldig
                ? ` (${r.schuldig})`
                : " (kein Element ragt heraus — Inhaltsueberlauf, scrollWidth > clientWidth pruefen)"),
          );
        }
      }
    }

    expect(
      befunde,
      `Horizontaler Ueberlauf bei erhoehter Schriftgroesse:\n  ` +
        befunde.join("\n  "),
    ).toEqual([]);
  });
});
/*
 * Die Login-Seite braucht einen EIGENEN Test: `requiresGuest` schickt
 * eingeloggte Nutzer auf `/` um. Im gemeinsamen Test besucht, kam nach den
 * eingeloggten Routen nie die Login-Seite zustande — der Token lag noch
 * im localStorage.
 */
test("kein Ueberlauf auf der Login-Seite bis 175 % Schrift", async ({
  browser,
}) => {
  const eigenes = await browser.newContext();
  const seite = await eigenes.newPage();

  const befunde = [];
  for (const skala of SKALEN) {
    await seite.goto("/login");
    await seite.evaluate((s) => {
      document.documentElement.style.fontSize = s + "%";
      document.documentElement.style.webkitTextSizeAdjust = s + "%";
    }, skala);
    await seite.waitForTimeout(300);

    const r = await seite.evaluate(() => {
      const de = document.documentElement;
      return {
        ueber: de.scrollWidth - de.clientWidth,
        gelandet: location.pathname,
      };
    });

    expect(
      r.gelandet,
      "/login war nicht erreichbar — ohne Login darf der Guard nicht umleiten",
    ).toBe("/login");

    if (r.ueber > 0) befunde.push(`@ ${skala}%: +${r.ueber}px`);
  }

  expect(
    befunde,
    `Login-Seite laeuft bei erhoehter Schrift ueber den Rand: ${befunde.join(", ")}`,
  ).toEqual([]);

  await eigenes.close();
});
