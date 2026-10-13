/** Limit entrance work to the current viewport; long lists remain visible and
 * immediately usable without waiting for an off-screen stagger sequence. */
export function visibleMotionTargets(selector: string): HTMLElement[] {
  const elements = document.querySelectorAll<HTMLElement>(selector);
  const visible: HTMLElement[] = [];
  for (const element of elements) {
    const rect = element.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0 && rect.bottom >= 0 && rect.top <= innerHeight
      && rect.right >= 0 && rect.left <= innerWidth) visible.push(element);
    if (visible.length === 16) break;
  }
  return visible;
}
