import { describe, expect, it } from "vitest";
import {
  actionMatchesGuidedField,
  currentGuidedField,
  firstGuidedForm,
  markGuidedFieldComplete,
  updateSnapshotAfterAction,
} from "../src/forms/guided-form";
import type { PageSnapshot } from "../src/snapshot/types";

const page: PageSnapshot = {
  url_host: "synthetic.example",
  title: "Synthetic form",
  lang: "en",
  viewport: { w: 800, h: 600, scrollY: 0, scrollMax: 0 },
  headings: [],
  elements: [
    {
      id: "name",
      tag: "input",
      role: null,
      type: "text",
      name: "Resident name",
      hint: null,
      required: true,
      value: "",
      state: ["required", "empty"],
      rect: [0, 0, 100, 30],
      in_view: true,
      form: "form-1",
      sensitive: false,
    },
    {
      id: "password",
      tag: "input",
      role: null,
      type: "password",
      name: "Password",
      hint: null,
      required: false,
      value: "[hidden]",
      state: ["hidden"],
      rect: [0, 0, 100, 30],
      in_view: true,
      form: "form-1",
      sensitive: true,
    },
    {
      id: "service",
      tag: "select",
      role: null,
      type: null,
      name: "Service type",
      hint: null,
      required: true,
      value: "",
      state: ["required", "empty"],
      rect: [0, 0, 100, 30],
      in_view: true,
      form: "form-1",
      sensitive: false,
    },
    {
      id: "submit",
      tag: "button",
      role: null,
      type: "submit",
      name: "Send request",
      hint: null,
      required: false,
      value: "",
      state: [],
      rect: [0, 0, 100, 30],
      in_view: true,
      form: "form-1",
      sensitive: false,
    },
  ],
  text_blocks: [],
  forms: [{ id: "form-1", fields: ["name", "password", "service", "submit"], submit: "submit" }],
  flags: { has_canvas_content: false, is_pdf_viewer: false, truncated: false },
  estimated_tokens: 20,
};

describe("guided form coordinator", () => {
  it("keeps safe fields in DOM order and skips protected/submit fields", () => {
    const flow = firstGuidedForm(page);
    expect(flow?.fieldIds).toEqual(["name", "service"]);
    expect(currentGuidedField(page, flow)?.name).toBe("Resident name");
  });

  it("advances only after a confirmed matching action", () => {
    const flow = firstGuidedForm(page);
    if (flow === null) throw new Error("expected synthetic form");
    const action = { type: "fill" as const, target_id: "name", value: "Synthetic User" };
    expect(actionMatchesGuidedField(action, currentGuidedField(page, flow))).toBe(true);
    const next = markGuidedFieldComplete(flow, action);
    expect(currentGuidedField(page, next)?.id).toBe("service");
    expect(updateSnapshotAfterAction(page, action).elements.find((item) => item.id === "name")?.state).toEqual(["required"]);
  });

  it("resumes from the first unfilled field when a form is already partially filled", () => {
    const halfFilledPage: PageSnapshot = {
      ...page,
      elements: page.elements.map((el) =>
        el.id === "name" ? { ...el, value: "Ramesh Kumar" } : el,
      ),
    };
    const flow = firstGuidedForm(halfFilledPage);
    expect(flow?.completedIds).toEqual(["name"]);
    expect(currentGuidedField(halfFilledPage, flow)?.id).toBe("service");
    expect(currentGuidedField(halfFilledPage, null)?.id).toBe("service");
  });
});
