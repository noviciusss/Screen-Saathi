import type { Action } from "../protocol/types";
import type { PageSnapshot, SnapshotElement } from "../snapshot/types";

export interface GuidedField {
  readonly id: string;
  readonly name: string;
  readonly type: string | null;
  readonly required: boolean;
}

export interface GuidedFormState {
  readonly formId: string;
  readonly fieldIds: readonly string[];
  readonly completedIds: readonly string[];
}

const BLOCKED_TYPES = new Set(["submit", "button", "reset", "password"]);

function isFillable(element: SnapshotElement): boolean {
  return (
    !element.sensitive &&
    !element.state.includes("disabled") &&
    !element.state.includes("hidden") &&
    !BLOCKED_TYPES.has((element.type ?? "").toLowerCase()) &&
    element.tag !== "button"
  );
}

export function firstGuidedForm(snapshot: PageSnapshot): GuidedFormState | null {
  for (const form of snapshot.forms) {
    const fieldIds = form.fields.filter((id) => {
      const element = snapshot.elements.find((candidate) => candidate.id === id);
      return element !== undefined && isFillable(element);
    });
    if (fieldIds.length > 0) {
      const completedIds = fieldIds.filter((id) => {
        const element = snapshot.elements.find((candidate) => candidate.id === id);
        return Boolean(element && element.value && element.value.trim().length > 0);
      });
      return { formId: form.id, fieldIds, completedIds };
    }
  }
  return null;
}

export function currentGuidedField(
  snapshot: PageSnapshot,
  flow: GuidedFormState | null,
): GuidedField | null {
  if (flow === null) {
    for (const form of snapshot.forms) {
      for (const id of form.fields) {
        const element = snapshot.elements.find((candidate) => candidate.id === id);
        if (
          element !== undefined &&
          isFillable(element) &&
          (!element.value || element.value.trim().length === 0)
        ) {
          return {
            id: element.id,
            name: element.name || element.hint || "this field",
            type: element.type,
            required: element.required,
          };
        }
      }
    }
    return null;
  }
  for (const id of flow.fieldIds) {
    if (flow.completedIds.includes(id)) continue;
    const element = snapshot.elements.find((candidate) => candidate.id === id);
    if (element !== undefined && element.value && element.value.trim().length > 0) {
      continue;
    }
    if (element !== undefined && isFillable(element)) {
      return {
        id: element.id,
        name: element.name || element.hint || "this field",
        type: element.type,
        required: element.required,
      };
    }
  }
  return null;
}

export function markGuidedFieldComplete(
  flow: GuidedFormState,
  action: Action,
): GuidedFormState {
  if (flow.completedIds.includes(action.target_id)) {
    return flow;
  }
  if (flow.fieldIds.includes(action.target_id)) {
    return { ...flow, completedIds: [...flow.completedIds, action.target_id] };
  }
  const nextIncomplete = flow.fieldIds.find((id) => !flow.completedIds.includes(id));
  if (nextIncomplete !== undefined) {
    return { ...flow, completedIds: [...flow.completedIds, nextIncomplete] };
  }
  return flow;
}

export function actionMatchesGuidedField(
  action: Action,
  field: GuidedField | null,
): boolean {
  return field !== null && action.target_id === field.id;
}

export function updateSnapshotAfterAction(
  snapshot: PageSnapshot,
  action: Action,
): PageSnapshot {
  return {
    ...snapshot,
    elements: snapshot.elements.map((element) => {
      if (element.id !== action.target_id) return element;
      const value = action.type === "fill"
        ? action.value ?? ""
        : action.type === "select"
          ? action.option ?? element.value
          : element.value;
      const state = element.state.filter((item) => item !== "empty");
      if (value === "") state.push("empty");
      return { ...element, value, state };
    }),
  };
}
