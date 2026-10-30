// What the API answers, read with these schemas by api() in lib/api.ts, so a
// screen never works on a shape it only assumed. They check the shape, not
// the input rules (a save is checked by the form's own schema): an answer
// keeps loading even after a rule is tightened. Extra fields are dropped.

// Grouped by area; every screen imports them through lib/api.ts.
export * from "./shapes";
export * from "./shop";
export * from "./orders";
export * from "./stock";
export * from "./reports";
