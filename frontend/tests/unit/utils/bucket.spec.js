import { describe, it, expect } from "vitest";
import {
  bucketChores,
  normalizeToLocalDate,
  isDoneToday,
} from "@/utils/choreBuckets";

describe("bucketChores", () => {
  const baseDate = new Date("2026-05-15T12:00:00Z");

  const makeChore = (overrides = {}) => ({
    id: 1,
    name: "Test Chore",
    dueDate: null,
    archived: false,
    ...overrides,
  });

  it("puts a chore due today into the today bucket", () => {
    const today = "2026-05-15";
    const result = bucketChores([makeChore({ dueDate: today })], baseDate);
    expect(result.buckets.today).toHaveLength(1);
    expect(result.buckets.today[0]).toBe(result.buckets.all[0]);
  });

  it("puts a chore in the overdue bucket when dueDate is before today", () => {
    const overdue = "2026-05-10";
    const result = bucketChores([makeChore({ dueDate: overdue })], baseDate);
    expect(result.buckets.overdue).toHaveLength(1);
  });

  it("puts a chore due tomorrow into the tomorrow bucket", () => {
    const tomorrow = "2026-05-16";
    const result = bucketChores([makeChore({ dueDate: tomorrow })], baseDate);
    expect(result.buckets.tomorrow).toHaveLength(1);
  });

  it("puts a chore 3 days away into the thisWeek bucket", () => {
    const in3Days = "2026-05-18";
    const result = bucketChores([makeChore({ dueDate: in3Days })], baseDate);
    expect(result.buckets.thisWeek).toHaveLength(1);
  });

  it("puts a chore 8 days away into the upcoming bucket", () => {
    const in8Days = "2026-05-23";
    const result = bucketChores([makeChore({ dueDate: in8Days })], baseDate);
    expect(result.buckets.upcoming).toHaveLength(1);
  });

  it("skips archived chores", () => {
    const result = bucketChores([makeChore({ archived: true })], baseDate);
    expect(result.buckets.all).toHaveLength(0);
  });

  it("skips chores without a dueDate", () => {
    const result = bucketChores([makeChore({ dueDate: null })], baseDate);
    expect(result.buckets.all).toHaveLength(0);
  });

  it("returns an all bucket with all non-archived chores", () => {
    const chores = [
      makeChore({ dueDate: "2026-05-15" }),
      makeChore({ dueDate: "2026-05-10" }),
      makeChore({ dueDate: "2026-05-20" }),
      makeChore({ archived: true }),
    ];
    const result = bucketChores(chores, baseDate);
    expect(result.buckets.all).toHaveLength(3);
  });

  it("counts match bucket lengths", () => {
    const chores = [
      makeChore({ dueDate: "2026-05-10" }), // overdue
      makeChore({ dueDate: "2026-05-15" }), // today
      makeChore({ dueDate: "2026-05-16" }), // tomorrow
      makeChore({ dueDate: "2026-05-18" }), // thisWeek
      makeChore({ dueDate: "2026-05-23" }), // upcoming
    ];
    const result = bucketChores(chores, baseDate);
    expect(result.counts.overdue).toBe(1);
    expect(result.counts.today).toBe(1);
    expect(result.counts.tomorrow).toBe(1);
    expect(result.counts.thisWeek).toBe(1);
    expect(result.counts.upcoming).toBe(1);
    expect(result.counts.all).toBe(5);
  });

  it("assigns each chore to exactly one time bucket", () => {
    bucketChores(
      [makeChore({ dueDate: "2026-05-10" })],
      baseDate,
    ).buckets.overdue.forEach((c) => expect(c).toBeTruthy());
    bucketChores(
      [makeChore({ dueDate: "2026-05-15" })],
      baseDate,
    ).buckets.today.forEach((c) => expect(c).toBeTruthy());
    bucketChores(
      [makeChore({ dueDate: "2026-05-16" })],
      baseDate,
    ).buckets.tomorrow.forEach((c) => expect(c).toBeTruthy());
    bucketChores(
      [makeChore({ dueDate: "2026-05-18" })],
      baseDate,
    ).buckets.thisWeek.forEach((c) => expect(c).toBeTruthy());
    bucketChores(
      [makeChore({ dueDate: "2026-05-23" })],
      baseDate,
    ).buckets.upcoming.forEach((c) => expect(c).toBeTruthy());
  });
});

describe("isDoneToday", () => {
  // Regression (2026-09-26): die Funktion verglich `last_done` (lokales
  // YYYY-MM-DD aus dem Backend) gegen `now.toISOString().split("T")[0]` — UTC.
  // Ab 22:00 Ortszeit (UTC+1) bzw. 23:00 (UTC+2) ist der UTC-Tag bereits der
  // Vortag, und eine HEUTE erledigte Chore galt als "nicht heute erledigt".
  // Im CatchUp-Stack blieb sie dadurch stehen: der Swipe-Done schien zu
  // wirken (die API lieferte done=true), die Karte blieb aber liegen und der
  // Fortschrittszaehler bewegte sich nicht.
  //
  // Der Test faellt den Bug deterministisch, ohne auf die Uhrzeit des
  // Testlaufs zu vertrauen: der Referenz-Zeitpunkt ist 00:30 lokal, was in
  // UTC bereits der Vortag ist (Deutschland UTC+2, also 22:30 am Vortag).
  const afterMidnightLocal = new Date(2026, 8, 26, 0, 30, 0);

  it("treats a chore completed after local midnight as done today (UTC is yesterday)", () => {
    // Vorbedingung des Bugs: der UTC-Tag weicht vom lokalen ab.
    expect(afterMidnightLocal.toISOString().split("T")[0]).toBe("2026-09-25");
    expect(
      isDoneToday({ done: true, last_done: "2026-09-26" }, afterMidnightLocal),
    ).toBe(true);
  });

  it("treats a chore completed on the previous local day as not done today", () => {
    expect(
      isDoneToday({ done: true, last_done: "2026-09-25" }, afterMidnightLocal),
    ).toBe(false);
  });

  it("is false for a not-done chore even with a recent last_done", () => {
    expect(
      isDoneToday(
        { done: false, last_done: "2026-09-26" },
        afterMidnightLocal,
      ),
    ).toBe(false);
  });

  it("handles the camelCase spelling as well", () => {
    expect(
      isDoneToday(
        { done: true, lastDone: "2026-09-26" },
        afterMidnightLocal,
      ),
    ).toBe(true);
  });

  it("returns done when last_done is missing entirely (stale done flag)", () => {
    // Semantik aus SESSION_STATE.md: "done" ohne last_done zaehlt als offen.
    // Der Vorfilter in catchUpStack.js laesst solche Chores bewusst im Stack.
    expect(isDoneToday({ done: true }, afterMidnightLocal)).toBe(true);
    expect(isDoneToday({ done: false }, afterMidnightLocal)).toBe(false);
  });
});
