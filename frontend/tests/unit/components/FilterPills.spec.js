import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import FilterPills from "@/components/chores/FilterPills.vue";

describe("FilterPills - new features", () => {
  it("renders a clear button when filter is not all", () => {
    const wrapper = mount(FilterPills, {
      props: { currentFilter: "today", counts: { today: 3 } },
    });
    const clearBtn = wrapper.find(".clear-btn");
    expect(clearBtn.isVisible()).toBe(true);
  });

  it("hides the clear button when filter is all", () => {
    const wrapper = mount(FilterPills, {
      props: { currentFilter: "all", counts: {} },
    });
    const clearBtn = wrapper.find(".clear-btn");
    expect(clearBtn.exists()).toBe(false);
  });

  it("emits clearFilter when the clear button is clicked", async () => {
    const wrapper = mount(FilterPills, {
      props: { currentFilter: "overdue", counts: { overdue: 2 } },
    });
    const clearBtn = wrapper.find(".clear-btn");
    await clearBtn.trigger("click");
    expect(wrapper.emitted("clearFilter")).toBeTruthy();
  });

  it("assigns a color to each pill", () => {
    const wrapper = mount(FilterPills, {
      props: { currentFilter: "all", counts: {} },
    });
    const pills = wrapper.findAll(".chip");
    expect(pills[0].attributes("style")).toContain("--chip-color");
    expect(pills[1].attributes("style")).toContain("--chip-color");
  });

  it("highlights the active pill with chip color", () => {
    const wrapper = mount(FilterPills, {
      props: { currentFilter: "today", counts: { today: 5 } },
    });
    const pills = wrapper.findAll(".chip");
    const active = pills.find((p) => p.classes("active"));
    expect(active).toBeTruthy();
    expect(active.attributes("style")).toContain("--chip-color");
  });
});
