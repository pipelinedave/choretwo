import { test, expect } from "@playwright/test";
import { login as e2eLogin, specEmail } from "./helpers/auth.js";

/**
 * Waechst, dass die ChoreCards auf schmalen Geraeten benutzbar bleiben.
 *
 * ANLASS
 * Auf einem Geraet waren die Karten rechts abgeschnitten: Titel und
 * Faelligkeitsangabe liefen aus dem Bild, die Kopfzeile ebenfalls. Zwei
 * voneinander unabhaengige Ursachen steckten dahinter, beide
 * vorbestehend und beide BEIM ABSCHNEIDEN DER KARTEN sichtbar geworden:
 *
 * 1. Der Header war ein Flex-Container ohne Umbruch, `.brand` ohne
 *    `min-width: 0`. Logo (145 px) plus vier Buttons (184 px) ergaben
 *    329 px min-content. Bei 320 px Viewport wurde die Seite dadurch
 *    345 px breit — und die Karten sind `width: 100%`, erbten diese Breite
 *    und liefen rechts heraus. Behoben in AppHeader.vue.
 *
 * 2. Von 252 px nutzbarer Kartenbreite gingen 56 px an das Motiv und
 *    127 px an `.chore-right`, das `flex-shrink: 0` hat. `.chore-left`
 *    blieben 45 px, und mit `word-break: break-word` brach jedes einzelne
 *    Zeichen um: die Karte wurde mehrere hundert Pixel hoch. Behoben in
 *    ChoreCard.vue durch eine eigene Zeile fuer den Titel.
 *
 * ZWEI DINGE, DIE DIESER TEST AUSDRUECKLICH NICHT PRUEFT
 *
 * 1. Die Filter-Pills. `.filter-pills` ist `overflow-x: auto`, ragt also
 *    absichtlich ueber den Rand. Ohne diese Ausklammerung schlaegt der
 *    Test immer an und beweist nichts.
 * 2. Die Kartenhoehe. Sie haengt am Chore-Namen und ist damit kein
 *    Invariant. Geprueft wird die Breite, aus der die Entartung entsteht.
 *
 * ZUM VIEWPORT
 * Die Breite wird ueber `test.use` auf Describe-Ebene gesetzt, NICHT ueber
 * `page.setViewportSize` mitten im Test. Bei letzterem liess sich die Messung
 * unter Last gegen die noch alte Breite laufen und schlug dann grundlos an.
 */
const USER = specEmail("chore-layout");

/** Namen aus dem Sichtbericht, plus absichtlich lange Worst-Case-Namen. */
const NAMES = [
  "Tastatur reinigen",
  "Türgriffe & Lichtschalter desinfizieren",
  "Rasieren",
  "Fernbedienungen reinigen",
  "Gesichtsmaske verwenden",
  "Wohnzimmerfenster und Balkontür gründlich abwischen",
  "Druckerpatrone tauschen",
];

const BREITEN = [280, 320, 360, 390, 412];

/** Legt den Testbestand an und raeumt ihn nachher ab. */
async function seed(page, request, created) {
  const token = await page.evaluate(() => localStorage.getItem("token"));
  for (const name of NAMES) {
    const res = await request.post("/api/chores/", {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      data: {
        name,
        interval_days: 12,
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

async function clear(request, page, created) {
  const token = await page.evaluate(() => localStorage.getItem("token"));
  for (const id of created.splice(0)) {
    await request
      .delete(`/api/chores/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .catch(() => {});
  }
}

test.describe("ChoreCard-Layout", () => {
  const created = [];

  test.beforeEach(async ({ page, context }) => {
    await context.clearCookies();
    await e2eLogin(page, { email: USER, name: "chore-layout" });
  });

  test.afterEach(async ({ page, request }) => {
    await clear(request, page, created);
  });

  /** Misst alles, was ohne die Pill-Leiste ueber den Viewport ragt. */
  async function ueberlaeufe(page) {
    return page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const treffer = [];
      for (const el of document.querySelectorAll("*")) {
        if (el.closest(".filter-pills")) continue;
        const r = el.getBoundingClientRect();
        if (r.right > vw + 0.5) {
          treffer.push({
            sel: (el.className?.toString() || el.tagName).slice(0, 50),
            width: Math.round(r.width),
            over: Math.round(r.right - vw),
          });
        }
      }
      treffer.sort((a, b) => b.over - a.over);
      return { vw, treffer };
    });
  }

  for (const breite of BREITEN) {
    test.describe(`${breite}px`, () => {
      test.use({ viewport: { width: breite, height: 844 } });

      test("ragt nicht ueber den Viewport hinaus", async ({
        page,
        request,
      }) => {
        await seed(page, request, created);
        await page.goto("/chores");
        await expect(page.locator(".chore-card").first()).toBeVisible();
        // Auf die Karten warten, nicht auf eine Stoppuhr: unter Last ist
        // ein fester Timeout die haeufigste Fehlerquelle in Layouttests.
        await expect(page.locator(".chore-title").first()).toBeVisible();

        const { vw, treffer } = await ueberlaeufe(page);

        expect(
          treffer,
          `Bei ${breite}px (gemessen ${vw}px) ragt Folgendes ueber den ` +
            `Rand: ` +
            treffer
              .slice(0, 5)
              .map((t) => `${t.sel} (w=${t.width}, +${t.over}px)`)
              .join(", "),
        ).toEqual([]);
      });
    });
  }

  test.describe("320px", () => {
    test.use({ viewport: { width: 320, height: 844 } });

    test("degeneriert der Titel nicht zu einem Zeichen pro Zeile", async ({
      page,
      request,
    }) => {
      await seed(page, request, created);
      await page.goto("/chores");
      await expect(page.locator(".chore-title").first()).toBeVisible();

      const r = await page.evaluate(() => {
        const titel = document.querySelector(".chore-title");
        const karte = titel.closest(".chore-card");
        const links = karte.querySelector(".chore-left");
        const cs = getComputedStyle(titel);
        const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2;
        return {
          vw: document.documentElement.clientWidth,
          lines: Math.round(titel.getBoundingClientRect().height / lh),
          // `.chore-left` und NICHT `.chore-title`: der Titel ist ein
          // Flex-Item in `.chore-left` und misst darum seine Inhaltsbreite
          // (140 px fuer "Tastatur reinigen"), nicht die zugeteilte. Genau
          // dieser Fehler hat den ersten Version dieses Tests grundlos
          // scheitern lassen.
          width: Math.round(links.getBoundingClientRect().width),
          cardWidth: Math.round(karte.getBoundingClientRect().width),
        };
      });

      // Ohne den Fix: 38 Zeilen fuer den laengsten Namen und eine
      // Titelbreite von 45 px. Drei Zeilen sind vertretbar, ein Zeichen pro
      // Zeile nicht.
      expect(
        r.lines,
        `Titel braucht ${r.lines} Zeilen bei ${r.width}px Breiche ` +
          `(Viewport ${r.vw}px)`,
      ).toBeLessThanOrEqual(3);

      /*
       * Die Breite ist das eigentliche Invariant, die Hoehe nicht: sie
       * haengt am Chore-Namen, und der Bestand enthaelt mit
       * "Wohnzimmerfenster und Balkontuer gruendlich abwischen" bewusst
       * einen dreizeiligen Titel. Bei 45 px Breite war `.chore-left` nur
       * noch ein Drittel der Karte; der Titel muss sie dominieren.
       */
      const anteil = r.width / r.cardWidth;
      expect(
        anteil,
        `Titel nur ${Math.round(anteil * 100)}% der Kartenbreite ` +
          `(${r.width}px von ${r.cardWidth}px) — er wurde wieder eingequetscht`,
      ).toBeGreaterThan(0.6);
    });

    test("behaelt die Faelligkeitsangabe vollstaendig sichtbar", async ({
      page,
      request,
    }) => {
      // Abgeschnitten wurde laut Sichtbericht die Angabe "Overdue by …" samt
      // Intervall-Badge. Also nicht nur "kein Ueberlauf", sondern: das
      // rechte Element der Karte liegt vollstaendig im Viewport.
      await seed(page, request, created);
      await page.goto("/chores");
      await expect(page.locator(".chore-card").first()).toBeVisible();

      const r = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        const karte = document.querySelector(".chore-card");
        const rechts = karte.querySelector(".chore-right");
        return {
          vw,
          rechtsRight: Math.round(rechts.getBoundingClientRect().right),
        };
      });

      expect(
        r.rechtsRight,
        `.chore-right ragt bei 320px um ${r.rechtsRight - r.vw}px ueber den Rand`,
      ).toBeLessThanOrEqual(r.vw);
    });
  });
});
