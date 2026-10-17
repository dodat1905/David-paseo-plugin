const OPEN_FILE_BUTTON_SELECTOR = '[data-testid="tool-call-open-file"]';
const MODIFIER_ATTRIBUTE = "data-expand-file-edits-modifier";

function isOpenModifier(event: MouseEvent | KeyboardEvent): boolean {
  return event.metaKey || event.ctrlKey;
}

export function openFileClickCss(badgeSelector: string): string {
  return `
[${MODIFIER_ATTRIBUTE}] ${badgeSelector} > [role="button"]:has(${OPEN_FILE_BUTTON_SELECTOR}) { cursor: pointer; }
[${MODIFIER_ATTRIBUTE}] ${badgeSelector} > [role="button"]:has(${OPEN_FILE_BUTTON_SELECTOR}) [dir="auto"]:hover { text-decoration: underline; }
`;
}

export function installOpenFileClick(badgeSelector: string): () => void {
  const root = document.documentElement;

  const trackModifier = (event: KeyboardEvent) => {
    root.toggleAttribute(MODIFIER_ATTRIBUTE, isOpenModifier(event));
  };
  const clearModifier = () => root.removeAttribute(MODIFIER_ATTRIBUTE);

  const openFileOnModifierClick = (event: MouseEvent) => {
    if (!isOpenModifier(event) || !(event.target instanceof Element)) return;
    if (event.target.closest(OPEN_FILE_BUTTON_SELECTOR)) return;
    const header = event.target.closest(`${badgeSelector} > [role="button"]`);
    const openFileButton = header?.querySelector(OPEN_FILE_BUTTON_SELECTOR);
    if (!(openFileButton instanceof HTMLElement)) return;
    event.preventDefault();
    event.stopPropagation();
    openFileButton.click();
  };

  window.addEventListener("keydown", trackModifier, true);
  window.addEventListener("keyup", trackModifier, true);
  window.addEventListener("blur", clearModifier);
  window.addEventListener("click", openFileOnModifierClick, true);

  return () => {
    window.removeEventListener("keydown", trackModifier, true);
    window.removeEventListener("keyup", trackModifier, true);
    window.removeEventListener("blur", clearModifier);
    window.removeEventListener("click", openFileOnModifierClick, true);
    clearModifier();
  };
}
