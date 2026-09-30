/**
 * Aktionssemantik des Activity-Logs (utils/logAction.js).
 *
 * Die beiden Log-Oberflaechen — LogOverlay auf Home und LogItem auf
 * /logs — beziehen ihre Klassen, Icons und Farbcodes aus dieser Datei.
 * Der Test ist darum kein Detail, sondern die Absicherung der
 * Zusage "beide sprechen dieselbe Codesprache": was hier falsch
 * klassifiziert wird, faellt auf BEIDEN Seiten sichtbar falsch auf.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  resolveLogAction,
  logActionClass,
  logActionIcon,
  logActionText,
  LOG_ACTION_IDS,
} from "@/utils/logAction";

/* Absoluter Pfad statt `../../../node_modules/...`: Vitest wechselt das
   cwd nicht in den Projektordner, der relative Aufruf schlug deshalb
   mit ENOENT fehl. */
const MDI_CSS = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../node_modules/@mdi/font/css/materialdesignicons.css",
);

describe("resolveLogAction: die haeufigsten Aktionen", () => {
  it("erkennt erledigt ueber beide Schreibweisen des Stores", () => {
    // Der Log-Store setzt je nach Quelle `marked_done` ODER
    // `chore:completed` (log.js, getActionDescription). `marked_done`
    // wurde vorher gar nicht erkannt — die haeufigste Aktion der App
    // blieb dadurch ohne Farbe und ohne Icon.
    expect(resolveLogAction("chore:completed").id).toBe("completed");
    expect(resolveLogAction("marked_done").id).toBe("completed");
  });

  it("erkennt created, updated, archived und deleted", () => {
    expect(resolveLogAction("chore:created").id).toBe("created");
    expect(resolveLogAction("chore:updated").id).toBe("updated");
    expect(resolveLogAction("chore:archived").id).toBe("archived");
    expect(resolveLogAction("chore:deleted").id).toBe("deleted");
  });

  it("unterscheidet unarchived von archived", () => {
    // DER Regressionsfall: "chore:unarchived" enthaelt das Wort
    // "archived". Mit `archived` vor `unarchived` in der Kette war
    // jede Restoring-Aktion als "archived" beschriftet und eingefaerbt,
    // und `.log-unarchived` war toter Code.
    expect(resolveLogAction("chore:unarchived").id).toBe("unarchived");
    expect(resolveLogAction("chore:archived").id).toBe("archived");
  });

  it("gibt unarchived ein eigenes Icon, nicht das von archived", () => {
    expect(resolveLogAction("chore:unarchived").icon).not.toBe(
      resolveLogAction("chore:archived").icon,
    );
  });

  it("erkennt auch die Beschreibung 'restored' des Stores", () => {
    expect(resolveLogAction("restored").id).toBe("unarchived");
  });

  it("ordnet undo dem Ruecknehmen zu, nicht dem Archivieren", () => {
    expect(resolveLogAction("undo").id).toBe("undone");
  });

  it("sortiert Import und Export ohne Kollision ein", () => {
    expect(resolveLogAction("import").id).toBe("imported");
    expect(resolveLogAction("export").id).toBe("exported");
  });
});

describe("resolveLogAction: Robustheit", () => {
  it("faellt fuer unbekannte Aktionen auf einen neutralen Code zurueck", () => {
    // Kein weisses Loch: der Fallback traegt Klasse und Icon, damit die
    // Zeile nie ohne Farbsignal bleibt.
    const r = resolveLogAction("irgendwas_neues");
    expect(r.id).toBe("activity");
    expect(r.cls).toBe("log-activity");
    expect(r.icon).toBe("mdi-history");
  });

  it("wirft bei null, undefined und leerem String nicht", () => {
    // `action.includes(...)` auf einem fehlenden Aktionsstring war ein
    // TypeError. normalizeEntry (log.js) setzt `action` auf null, wenn
    // der Log-Eintrag keinen traegt — der Fall kommt also vor.
    for (const v of [null, undefined, ""]) {
      expect(() => resolveLogAction(v)).not.toThrow();
      expect(resolveLogAction(v).id).toBe("activity");
    }
  });

  it("ist unabhaengig von Gross-/Kleinschreibung", () => {
    expect(resolveLogAction("CHORE:COMPLETED").id).toBe("completed");
    expect(resolveLogAction("Chore:Archived").id).toBe("archived");
  });
});

describe("Klassen und Icons", () => {
  it("bildet jede ID auf eine log-<id>-Klasse ab", () => {
    for (const id of LOG_ACTION_IDS) {
      expect(resolveLogAction(`chore:${id}`).cls).toBe(`log-${id}`);
    }
  });

  it("vergibt fuer jede Aktion ein Icon", () => {
    for (const id of LOG_ACTION_IDS) {
      expect(resolveLogAction(`chore:${id}`).icon).toMatch(/^mdi-/);
    }
  });

  it("nennt keine Icons, die es in der eingebundenen MDI-Version nicht gibt", () => {
    // `mdi-archive-open` war so ein Fall: in @mdi/font gibt es diese
    // Klasse nicht, sie wurde als leeres Glyph gerendert. Verhindert,
    // dass ein Tippfehler still als leeres Kästchen endet.
    const css = readFileSync(MDI_CSS, "utf8");
    for (const id of LOG_ACTION_IDS) {
      const icon = resolveLogAction(`chore:${id}`).icon;
      expect(css, `${icon} fehlt in @mdi/font`).toContain(`.${icon}::before`);
    }
    // Auch der Fallback gehoert geprueft.
    expect(css).toContain(`.${resolveLogAction("x").icon}::before`);
  });

  it("liefert fuer jeden Input dieselbe Klasse wie ueber logActionClass", () => {
    for (const a of ["marked_done", "chore:created", "chore:unarchived", "x"]) {
      expect(logActionClass(a)).toBe(resolveLogAction(a).cls);
      expect(logActionIcon(a)).toBe(resolveLogAction(a).icon);
    }
  });
});

describe("logActionText", () => {
  it("beschreibt jede Aktion im Verb", () => {
    expect(logActionText("marked_done")).toBe("completed");
    expect(logActionText("chore:created")).toBe("created");
    expect(logActionText("chore:updated")).toBe("updated");
    expect(logActionText("chore:archived")).toBe("archived");
    expect(logActionText("chore:unarchived")).toBe("unarchived");
    expect(logActionText("chore:deleted")).toBe("deleted");
    expect(logActionText("undo")).toBe("undid");
  });

  it("sagt bei unarchived NICHT 'archived'", () => {
    // Gleicher Regressionsfall wie bei resolveLogAction, nur fuer den
    // Text: eine Restoring-Aktion wurde als "archived" beschrieben.
    expect(logActionText("chore:unarchived")).not.toBe("archived");
  });

  it("faellt auf den neutralen Satz zurueck", () => {
    expect(logActionText("quatsch")).toBe("did something to");
    expect(logActionText(null)).toBe("did something to");
  });

  it("bleibt mit der Farbcodierung konsistent", () => {
    // Code und Satz muessen dieselbe Aktion benennen. Der Satz steht
    // bewusst in einer eigenen Liste (logActionText) und nicht im Code —
    // dieser Test ist die Zusage, dass die beiden nicht auseinanderlaufen.
    const PAIRS = [
      ["chore:completed", "completed"],
      ["chore:created", "created"],
      ["chore:updated", "updated"],
      ["chore:unarchived", "unarchived"],
      ["chore:archived", "archived"],
      ["chore:deleted", "deleted"],
    ];
    for (const [action, expected] of PAIRS) {
      expect(logActionText(action), action).toBe(expected);
      expect(resolveLogAction(action).id, action).toBe(expected);
    }
  });
});
