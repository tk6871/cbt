// Let the focused widget and any open dialog handle their own arrow keys.
export function pageNavigationStep(event:KeyboardEvent): -1 | 0 | 1 {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return 0;
  if (event.defaultPrevented || event.repeat || event.isComposing ||
      event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return 0;
  const target=event.target;
  if (target instanceof HTMLElement && (target.isContentEditable || target.closest(
    'input,textarea,select,canvas,video,audio,iframe,[role="textbox"],[role="slider"],[role="spinbutton"],[role="tablist"],[role="radiogroup"],[role="listbox"],[role="menu"],[role="tree"],.study-float'
  ))) return 0;
  if (Array.from(document.querySelectorAll<HTMLElement>('dialog[open],[role="dialog"],[role="alertdialog"],[aria-modal="true"]'))
    .some(dialog=>dialog.getClientRects().length>0)) return 0;
  return event.key === 'ArrowLeft' ? -1 : 1;
}
