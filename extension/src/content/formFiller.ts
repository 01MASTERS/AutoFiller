/**
 * @file formFiller.ts
 * Main entry point for synthetic form filling.
 * Modular implementation lives in `./formFiller/`:
 * - events.ts: pointer simulation, full input event sequence, polling helpers
 * - visualFeedback.ts: green glow outline and shadow feedback
 * - simulators/inputSimulator.ts: HTML5 inputs, textareas, and contenteditable editors
 * - simulators/selectSimulator.ts: native <select>, ARIA listboxes, Workday buttons, comboboxes
 * - simulators/selectionReconciler.ts: radio and checkbox reconcilers, hidden inputs, "Other"
 * - simulators/dateSimulator.ts: ISO, natural language, and multi-part date fillers
 * - index.ts: main fillFormFields orchestrator
 */

export * from './formFiller/index.js';
