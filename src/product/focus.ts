/** Focus the current screen without leaving assistive technology on a removed control. */
export function focusElement(element: HTMLElement | null) {
  if (!element || !element.isConnected || element.closest('[inert], [aria-hidden="true"]')) return;
  if (!element.matches('button,input,select,textarea,a[href],summary,[tabindex],[contenteditable="true"]')) element.tabIndex = -1;
  if (document.activeElement !== element) element.focus({ preventScroll: true });
}

export function focusActiveHeading() {
  const heading = [...document.querySelectorAll<HTMLElement>('.cw-overlay h1, [data-testid="walking-heading"], [data-testid="walking-map-title"]')]
    .find(element => !element.closest('[inert], [aria-hidden="true"]') && element.getClientRects().length > 0);
  if (heading) {
    document.title = `${heading.textContent} · CrossWise`;
    focusElement(heading);
  }
}
