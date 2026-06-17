export interface PlaceholderFillInput {
  key: string;
  text: string;
  lastSent: string;
  historyOpen: boolean;
  defaultPlaceholder: string;
}

/**
 * Resolve whether pressing ArrowRight should fill the placeholder text into
 * the input, and what value to fill. Returns null when it should not trigger.
 *
 * Extracted as a pure function so the decision is unit-testable without
 * rendering the whole ChatHub component.
 */
export function resolveArrowRightFill(input: PlaceholderFillInput): string | null {
  // Only →, only when the input is empty, and only while the history popup is closed.
  if (input.key !== 'ArrowRight') return null;
  if (input.historyOpen) return null;
  if (input.text !== '') return null;
  return input.lastSent || input.defaultPlaceholder;
}
