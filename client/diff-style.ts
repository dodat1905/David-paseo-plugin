const LINE_ATTRIBUTE = "data-expand-file-edits-line";
const WORD_ATTRIBUTE = "data-expand-file-edits-word";
const LINE_TYPES: Record<string, string> = { "+": "add", "-": "remove", "@": "hunk" };
const PASEO_WORD_HIGHLIGHTS: Record<string, string> = {
  "rgba(46, 160, 67, 0.4)": "add",
  "rgba(248, 81, 73, 0.35)": "remove",
};

export function diffStyleCss(badgeSelector: string): string {
  const details = `${badgeSelector} > :nth-child(2)`;
  return `
${details} { background-color: #272822 !important; }
${details} div:not([${LINE_ATTRIBUTE}]) { background-color: transparent !important; }
[${LINE_ATTRIBUTE}] > * { display: block; color: #f8f8f2 !important; }
[${LINE_ATTRIBUTE}="remove"] { background-color: #3d0b0b !important; }
[${LINE_ATTRIBUTE}="add"] { background-color: #0d2236 !important; }
[${LINE_ATTRIBUTE}="context"] { background-color: transparent !important; }
[${LINE_ATTRIBUTE}="hunk"] > * { color: #75715e !important; }
[${LINE_ATTRIBUTE}]:not([${LINE_ATTRIBUTE}="hunk"]) > * { text-indent: -1ch; }
:is([${LINE_ATTRIBUTE}="remove"], [${LINE_ATTRIBUTE}="add"]) > *::first-letter { color: transparent !important; }
[${LINE_ATTRIBUTE}] span { background-color: transparent !important; }
[${LINE_ATTRIBUTE}] span[${WORD_ATTRIBUTE}="remove"] { background-color: #6b1f1f !important; }
[${LINE_ATTRIBUTE}] span[${WORD_ATTRIBUTE}="add"] { background-color: #1f4466 !important; }
`;
}

export function styleDiffLines(details: Element) {
  for (const line of details.querySelectorAll(`[data-pmono] > div:not([${LINE_ATTRIBUTE}])`)) {
    for (const span of line.querySelectorAll("span")) {
      span.setAttribute(WORD_ATTRIBUTE, PASEO_WORD_HIGHLIGHTS[getComputedStyle(span).backgroundColor] ?? "");
    }
    line.setAttribute(LINE_ATTRIBUTE, LINE_TYPES[line.textContent?.charAt(0) ?? ""] ?? "context");
  }
}
