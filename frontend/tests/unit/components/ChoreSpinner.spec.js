import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import ChoreSpinner from "@/components/layout/ChoreSpinner.vue";
import LoadingSpinner from "@/components/layout/LoadingSpinner.vue";
import { pickSpinner, SPINNER_VARIANTS } from "@/lib/spinnerPick";

describe("ChoreSpinner.vue", () => {
  it("renders with default hero mode and default label", () => {
    const wrapper = mount(ChoreSpinner, {
      props: { variant: "broom" },
    });
    expect(wrapper.find(".is-hero").exists()).toBe(true);
    expect(wrapper.find(".stage-broom").exists()).toBe(true);
    expect(wrapper.text()).toContain("Chores werden gefegt…");
  });

  it("renders with inline mode without hero stage", () => {
    const wrapper = mount(ChoreSpinner, {
      props: { inline: true, variant: "rocket_task", label: "Startet…" },
    });
    expect(wrapper.find(".is-inline").exists()).toBe(true);
    expect(wrapper.find(".anim-stage").exists()).toBe(false);
    expect(wrapper.text()).toContain("Startet…");
    expect(wrapper.text()).toContain("🚀");
  });

  it("supports context-based resolution", () => {
    const wrapper = mount(ChoreSpinner, {
      props: { context: "ai" },
    });
    expect(wrapper.find(".chore-spinner-container").exists()).toBe(true);
  });
});

describe("LoadingSpinner backward-compatibility wrapper", () => {
  it("renders ChoreSpinner inside LoadingSpinner", () => {
    const wrapper = mount(LoadingSpinner, {
      props: { message: "Bitte warten…", context: "chores" },
    });
    expect(wrapper.findComponent(ChoreSpinner).exists()).toBe(true);
    expect(wrapper.text()).toContain("Bitte warten…");
  });
});

describe("spinnerPick library", () => {
  it("never returns undefined and avoids immediate duplicates", () => {
    const pick1 = pickSpinner("chores");
    const pick2 = pickSpinner("chores");
    expect(pick1.variant).toBeDefined();
    expect(pick2.variant).toBeDefined();
    expect(SPINNER_VARIANTS.some((v) => v.id === pick1.variant)).toBe(true);
  });
});
