import type { PluginClientContext } from "@getpaseo/plugin/client";
import { Platform } from "react-native";
import { codeLayoutCss, hasHunkHeaders, newSideText, numberDiffLines, numberWriteLines } from "./client/code-layout";
import { diffStyleCss, styleDiffLines } from "./client/diff-style";
import { installOpenFileClick, openFileClickCss } from "./client/open-file-click";
import { RUBY_HIGHLIGHT_CSS, createRubyHighlighter, isRubyFile } from "./client/ruby-highlighting";
import { editLocationRpc } from "./shared/edit-location";

const EXPANDED_TOOL_LABELS = new Set(["Edit", "Write"]);
const COMPACT_LAYOUT_MAX_WIDTH = 720;
const BADGE_SELECTOR = '[data-testid="tool-call-badge"]';
const FILE_TOOL_ATTRIBUTE = "data-expand-file-edits-tool";
const SYNTAX_COLOR_ATTRIBUTE = "data-expand-file-edits-syntax";
const CODE_SPAN_SELECTOR = `:is([data-pmono], ${BADGE_SELECTOR}) span:not([${SYNTAX_COLOR_ATTRIBUTE}])`;
const DRACULA_TO_MONOKAI: Record<string, string> = {
  "rgb(255, 121, 198)": "#f92672",
  "rgb(241, 250, 140)": "#e6db74",
  "rgb(189, 147, 249)": "#ae81ff",
  "rgb(80, 250, 123)": "#a6e22e",
  "rgb(139, 233, 253)": "#66d9ef",
  "rgb(98, 114, 164)": "#75715e",
};
const MONOKAI_CSS = Object.values(DRACULA_TO_MONOKAI)
  .map((color) => `[${SYNTAX_COLOR_ATTRIBUTE}="${color.slice(1)}"] { color: ${color} !important; }`)
  .join("\n");

const PLUGIN_CSS = `
${BADGE_SELECTOR} :has(> [data-pmono]) { padding-right: 0 !important; }
${diffStyleCss(`[${FILE_TOOL_ATTRIBUTE}]`)}
${codeLayoutCss(`[${FILE_TOOL_ATTRIBUTE}]`)}
${MONOKAI_CSS}
${RUBY_HIGHLIGHT_CSS}
${openFileClickCss(BADGE_SELECTOR)}
`;

function headerTexts(header: Element): string[] {
  return [...header.querySelectorAll('[dir="auto"]')]
    .map((text) => text.textContent?.trim() ?? "")
    .filter((text) => text.length > 0);
}

function isCollapsed(badge: Element): boolean {
  return badge.children.length === 1;
}

function recolorSyntaxTokens() {
  for (const span of document.querySelectorAll(CODE_SPAN_SELECTOR)) {
    const monokai = DRACULA_TO_MONOKAI[getComputedStyle(span).color];
    span.setAttribute(SYNTAX_COLOR_ATTRIBUTE, monokai ? monokai.slice(1) : "");
  }
}

export default function contribute(client: PluginClientContext) {
  if (Platform.OS !== "web" || typeof document === "undefined") return () => {};

  const pluginStyles = document.createElement("style");
  pluginStyles.textContent = PLUGIN_CSS;
  document.head.appendChild(pluginStyles);

  const removeOpenFileClick = installOpenFileClick(BADGE_SELECTOR);
  const rubyHighlighter = createRubyHighlighter();
  const autoExpanded = new WeakSet<Element>();
  const editStartLines = new Map<string, number | null>();
  let scheduled = 0;

  const editStartLine = (path: string, details: Element): number | null => {
    if (hasHunkHeaders(details)) return null;
    const newText = newSideText(details);
    if (newText.trim().length === 0) return null;
    const key = `${path}\u0000${newText}`;
    if (!editStartLines.has(key)) {
      editStartLines.set(key, null);
      client
        .rpc(editLocationRpc, { path, newText })
        .then(({ startLine }) => {
          editStartLines.set(key, startLine);
          if (startLine !== null) schedule();
        })
        .catch(() => {});
    }
    return editStartLines.get(key) ?? null;
  };

  const highlightRubyDetails = (label: string, details: Element) => {
    if (label === "Edit") {
      for (const line of details.querySelectorAll("[data-pmono] > div")) {
        if (!line.textContent?.startsWith("@@")) rubyHighlighter.highlight(line, true);
      }
    } else {
      for (const line of details.querySelectorAll("[data-pmono] > *")) rubyHighlighter.highlight(line, false);
    }
  };

  const updateFileChanges = () => {
    scheduled = 0;
    recolorSyntaxTokens();
    rubyHighlighter.beginPass();
    const canExpand = window.innerWidth >= COMPACT_LAYOUT_MAX_WIDTH;
    for (const badge of document.querySelectorAll(BADGE_SELECTOR)) {
      const header = badge.firstElementChild;
      if (!(header instanceof HTMLElement) || header.getAttribute("role") !== "button") continue;
      const [label = "", path = ""] = headerTexts(header);
      if (!EXPANDED_TOOL_LABELS.has(label)) continue;
      if (badge.getAttribute(FILE_TOOL_ATTRIBUTE) !== label) badge.setAttribute(FILE_TOOL_ATTRIBUTE, label);
      if (!isCollapsed(badge)) {
        if (label === "Edit") {
          styleDiffLines(badge.children[1]);
          numberDiffLines(badge.children[1], editStartLine(path, badge.children[1]));
        } else {
          numberWriteLines(badge.children[1]);
        }
        if (isRubyFile(path)) highlightRubyDetails(label, badge.children[1]);
        continue;
      }
      if (!canExpand || autoExpanded.has(badge)) continue;
      if (header.getAttribute("aria-disabled") === "true") continue;
      autoExpanded.add(badge);
      header.click();
    }
    rubyHighlighter.endPass();
  };

  const schedule = () => {
    if (!scheduled) scheduled = requestAnimationFrame(updateFileChanges);
  };

  const observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-disabled"] });
  schedule();

  return () => {
    observer.disconnect();
    removeOpenFileClick();
    pluginStyles.remove();
    rubyHighlighter.dispose();
    if (scheduled) cancelAnimationFrame(scheduled);
  };
}
