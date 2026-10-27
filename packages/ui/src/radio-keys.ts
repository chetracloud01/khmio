import type { KeyboardEvent } from "react";

// A group of choices read out as radio buttons (WAI-ARIA radio group): Tab
// reaches the chosen one only, and the arrow keys move to the next choice
// and pick it. Shared by ChoiceCards and SegmentedControl's "choice" mode.

const STEPS: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

/** Which choice Tab lands on: the chosen one, or the first while none is chosen. */
export function radioTabIndex<V extends string>(values: readonly V[], current: V | null, value: V): 0 | -1 {
  const focusable = current !== null && values.includes(current) ? current : values[0];
  return value === focusable ? 0 : -1;
}

/** Put on the group: arrow keys pick the next or previous choice and move focus to it. */
export function radioKeyDown<V extends string>(event: KeyboardEvent<HTMLElement>, values: readonly V[], current: V | null, onChange: (value: V) => void) {
  const step = STEPS[event.key];
  if (!step || values.length === 0) return;
  event.preventDefault();
  const at = current === null ? -1 : values.indexOf(current);
  const index = at === -1 ? (step > 0 ? 0 : values.length - 1) : (at + step + values.length) % values.length;
  const next = values[index];
  if (next === undefined) return;
  onChange(next);
  event.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]')[index]?.focus();
}
