import { describe, it, expect } from "vitest";
import { buildCatchUpStack } from "@/utils/catchUpStack";

describe("buildCatchUpStack", () => {
  const baseDate = new Date("2026-05-15T12:00:00Z");

  const makeChore = (overrides = {}) => ({
    id: 1,
    name: "Test Chore",
    dueDate: null,
    done: false,
    archived: false,
    ...overrides,
  });

  it("excludes done chores from the stack", () => {
    const result = buildCatchUpStack([makeChore({ done: true })], baseDate);
    expect(result.stack).toHaveLength(0);
  });

  it("excludes archived chores from the stack", () => {
    const result = buildCatchUpStack([makeChore({ archived: true })], baseDate);
    expect(result.stack).toHaveLength(0);
  });

  it("returns an empty stack when no chores", () => {
    const result = buildCatchUpStack([], baseDate);
    expect(result.stack).toHaveLength(0);
    expect(result.total).toBe(0);
    expect(result.remaining).toBe(0);
  });

  it("sorts by urgency: overdue before today before tomorrow", () => {
    const chores = [
      makeChore({ id: 3, dueDate: "2026-05-16", name: "Tomorrow" }),
      makeChore({ id: 1, dueDate: "2026-05-10", name: "Overdue" }),
      makeChore({ id: 2, dueDate: "2026-05-15", name: "Today" }),
    ];
    const result = buildCatchUpStack(chores, baseDate);
    expect(result.stack.map((c) => c.id)).toEqual([1, 2, 3]);
    expect(result.stack[0].name).toBe("Overdue");
    expect(result.stack[1].name).toBe("Today");
    expect(result.stack[2].name).toBe("Tomorrow");
  });

  it("sorts within overdue bucket by date (oldest first)", () => {
    const chores = [
      makeChore({ id: 2, dueDate: "2026-05-12", name: "Later Overdue" }),
      makeChore({ id: 1, dueDate: "2026-05-10", name: "Most Overdue" }),
    ];
    const result = buildCatchUpStack(chores, baseDate);
    expect(result.stack.map((c) => c.id)).toEqual([1, 2]);
    expect(result.stack[0].name).toBe("Most Overdue");
  });

  it("includes thisWeek and upcoming in correct order", () => {
    const chores = [
      makeChore({ id: 5, dueDate: "2026-05-25", name: "Far" }),
      makeChore({ id: 4, dueDate: "2026-05-20", name: "ThisWeek" }),
      makeChore({ id: 3, dueDate: "2026-05-16", name: "Tomorrow" }),
      makeChore({ id: 1, dueDate: "2026-05-10", name: "Overdue" }),
      makeChore({ id: 2, dueDate: "2026-05-15", name: "Today" }),
    ];
    const result = buildCatchUpStack(chores, baseDate);
    expect(result.stack.map((c) => c.id)).toEqual([1, 2, 3, 4, 5]);
  });

  it("totals match stack length", () => {
    const chores = [
      makeChore({ id: 1, dueDate: "2026-05-10" }),
      makeChore({ id: 2, dueDate: "2026-05-15" }),
      makeChore({ id: 3, dueDate: "2026-05-20" }),
    ];
    const result = buildCatchUpStack(chores, baseDate);
    expect(result.total).toBe(3);
    expect(result.remaining).toBe(3);
    expect(result.stack.length).toBe(3);
  });

  it("handles mixed done/archived/active chores", () => {
    const chores = [
      makeChore({ id: 1, dueDate: "2026-05-10", done: true }),
      makeChore({ id: 2, dueDate: "2026-05-15", archived: true }),
      makeChore({ id: 3, dueDate: "2026-05-12", name: "Active" }),
    ];
    const result = buildCatchUpStack(chores, baseDate);
    expect(result.stack).toHaveLength(1);
    expect(result.stack[0].id).toBe(3);
  });
});
