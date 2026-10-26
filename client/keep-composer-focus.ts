import { Platform } from "react-native";

// This plugin typechecks without the DOM library. Declare only what this module uses.
interface PageElement {
  readonly tagName: string;
  readonly isConnected: boolean;
  matches(selector: string): boolean;
  closest(selector: string): PageElement | null;
  getClientRects(): { readonly length: number };
  focus(options?: { preventScroll?: boolean }): void;
}

interface PageEvent {
  readonly target: PageElement | null;
  readonly defaultPrevented: boolean;
}

interface PageKeyEvent extends PageEvent {
  readonly key: string;
  readonly metaKey: boolean;
  readonly ctrlKey: boolean;
  readonly altKey: boolean;
  readonly isComposing: boolean;
}

interface PagePasteEvent extends PageEvent {
  readonly clipboardData: { getData(format: string): string } | null;
  preventDefault(): void;
}

interface PagePointerEvent extends PageEvent {
  readonly button: number;
  readonly detail: number;
}

type PageListener = (event: never) => void;

declare const document: {
  readonly activeElement: PageElement | null;
  querySelectorAll(selector: string): ArrayLike<PageElement>;
  addEventListener(type: string, listener: PageListener, capture: boolean): void;
  removeEventListener(type: string, listener: PageListener, capture: boolean): void;
  execCommand(command: string, showUi: boolean, value: string): boolean;
};

declare const window: {
  getSelection(): { readonly isCollapsed: boolean } | null;
  setTimeout(callback: () => void, delay: number): number;
  clearTimeout(id: number): void;
};

const COMPOSER_INPUT = '[data-testid="message-input-root"] textarea';
const EDITABLE =
  'input, textarea, select, [contenteditable=""], [contenteditable="true"], .xterm, .cm-editor, .monaco-editor';
const OVERLAY = '[role="dialog"], [aria-modal="true"], [role="menu"], [role="listbox"]';
const PASEO_BARE_KEYS = new Set(["?", " "]);

function isVisible(element: PageElement): boolean {
  return element.isConnected && element.getClientRects().length > 0;
}

function anyVisible(selector: string): boolean {
  return Array.from(document.querySelectorAll(selector)).some(isVisible);
}

function isEditable(element: PageElement | null): boolean {
  return element !== null && element.closest(EDITABLE) !== null;
}

function hasTextSelection(): boolean {
  const selection = window.getSelection();
  return selection !== null && !selection.isCollapsed;
}

function isPasteShortcut(event: PageKeyEvent): boolean {
  const commandKey = event.metaKey || event.ctrlKey;
  return commandKey && !event.altKey && event.key.toLowerCase() === "v";
}

/** Watches the page and moves the cursor back into the agent message input. */
export function keepComposerFocused(): () => void {
  if (Platform.OS !== "web") return () => {};

  let lastComposer: PageElement | null = null;
  let pendingRefocus: number | null = null;

  const findComposer = (): PageElement | null => {
    if (lastComposer && isVisible(lastComposer)) return lastComposer;
    return Array.from(document.querySelectorAll(COMPOSER_INPUT)).find(isVisible) ?? null;
  };

  const focusComposer = (): boolean => {
    if (anyVisible(OVERLAY)) return false;
    const composer = findComposer();
    if (!composer) return false;
    composer.focus({ preventScroll: true });
    return true;
  };

  const onFocusIn = (event: PageEvent) => {
    if (event.target?.matches(COMPOSER_INPUT)) lastComposer = event.target;
  };

  const onKeyDown = (event: PageKeyEvent) => {
    if (event.defaultPrevented || event.isComposing) return;
    if (isPasteShortcut(event)) {
      if (!isEditable(document.activeElement)) focusComposer();
      return;
    }
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key.length !== 1 || PASEO_BARE_KEYS.has(event.key)) return;
    if (isEditable(document.activeElement)) return;
    focusComposer();
  };

  const onPaste = (event: PagePasteEvent) => {
    if (event.defaultPrevented || isEditable(event.target) || isEditable(document.activeElement)) return;
    const text = event.clipboardData?.getData("text/plain") ?? "";
    if (!text || !focusComposer()) return;
    event.preventDefault();
    document.execCommand("insertText", false, text);
  };

  const onPointerUp = (event: PagePointerEvent) => {
    if (event.button !== 0 || event.detail > 1) return;
    if (event.target?.closest(OVERLAY)) return;
    if (pendingRefocus !== null) window.clearTimeout(pendingRefocus);
    pendingRefocus = window.setTimeout(() => {
      pendingRefocus = null;
      const active = document.activeElement;
      const focusLeftPage = !active || active.tagName === "BODY" || active.tagName === "HTML";
      if (!focusLeftPage || hasTextSelection()) return;
      focusComposer();
    }, 0);
  };

  document.addEventListener("focusin", onFocusIn, true);
  document.addEventListener("keydown", onKeyDown, true);
  document.addEventListener("paste", onPaste, true);
  document.addEventListener("pointerup", onPointerUp, true);

  return () => {
    if (pendingRefocus !== null) window.clearTimeout(pendingRefocus);
    document.removeEventListener("focusin", onFocusIn, true);
    document.removeEventListener("keydown", onKeyDown, true);
    document.removeEventListener("paste", onPaste, true);
    document.removeEventListener("pointerup", onPointerUp, true);
  };
}
