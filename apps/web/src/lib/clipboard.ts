/**
 * Clipboard helper. Wraps the async Clipboard API so copy affordances degrade
 * silently in non-secure contexts. Never used for secrets that must not leak
 * into a shared clipboard — callers decide what to copy.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Clipboard unavailable (non-secure context): no action, no false success.
  }
  return false;
}
