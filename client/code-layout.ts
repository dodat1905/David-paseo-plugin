const NUMBER_ATTRIBUTE = "data-expand-file-edits-number";
const DIGITS_PROPERTY = "--expand-file-edits-digits";
const MINIMUM_DIGITS = 2;
const HUNK_HEADER = /^@@ -(\d+)(?:,\d+)? \+(\d+)/;

export function codeLayoutCss(toolSelector: string): string {
  const digitsWidth = `calc(var(${DIGITS_PROPERTY}, ${MINIMUM_DIGITS}) * 1ch)`;
  return `
${toolSelector} :has(> [data-pmono]) { width: 100% !important; min-width: 0 !important; max-width: 100% !important; flex-shrink: 1 !important; }
${toolSelector} [data-pmono] { min-width: 0 !important; max-width: 100% !important; flex-shrink: 1 !important; align-self: stretch !important; }
${toolSelector} [data-pmono], ${toolSelector} [data-pmono] * { white-space: pre-wrap !important; overflow-wrap: anywhere !important; }
[${NUMBER_ATTRIBUTE}] { position: relative; padding-left: calc(${digitsWidth} + 2ch) !important; }
[${NUMBER_ATTRIBUTE}]::after { content: attr(${NUMBER_ATTRIBUTE}); position: absolute; top: 0; left: 0; width: ${digitsWidth}; text-align: right; color: #75715e; user-select: none; }
`;
}

function setDigits(container: HTMLElement, digits: number) {
  const value = String(Math.max(MINIMUM_DIGITS, digits));
  if (container.style.getPropertyValue(DIGITS_PROPERTY) !== value) container.style.setProperty(DIGITS_PROPERTY, value);
}

function setNumber(element: Element | null, number: string) {
  if (element && element.getAttribute(NUMBER_ATTRIBUTE) !== number) element.setAttribute(NUMBER_ATTRIBUTE, number);
}

export function numberWriteLines(details: Element) {
  const container = details.querySelector("[data-pmono]");
  if (!(container instanceof HTMLElement) || container.children.length === 0) return;
  setDigits(container, String(container.children.length).length);
  [...container.children].forEach((line, index) => setNumber(line, String(index + 1)));
}

function diffContainer(details: Element): HTMLElement | null {
  const container = details.querySelector("[data-pmono]");
  return container instanceof HTMLElement ? container : null;
}

export function hasHunkHeaders(details: Element): boolean {
  const container = diffContainer(details);
  return !!container && [...container.children].some((line) => HUNK_HEADER.test(line.textContent ?? ""));
}

export function newSideText(details: Element): string {
  const container = diffContainer(details);
  if (!container) return "";
  return [...container.children]
    .map((line) => line.textContent ?? "")
    .filter((text) => !text.startsWith("-") && !text.startsWith("@@") && !text.startsWith("\\"))
    .map((text) => text.slice(1))
    .join("\n");
}

export function numberDiffLines(details: Element, startLine: number | null = null) {
  const container = diffContainer(details);
  if (!container) return;
  const lines = [...container.children];
  let oldLine = startLine ?? 0;
  let newLine = startLine ?? 0;
  let hasHunkHeader = startLine !== null;
  const numbers = lines.map((line) => {
    const text = line.textContent ?? "";
    const header = HUNK_HEADER.exec(text);
    if (header) {
      oldLine = Number(header[1]);
      newLine = Number(header[2]);
      hasHunkHeader = true;
      return "";
    }
    if (!hasHunkHeader || text.startsWith("\\")) return "";
    if (text.startsWith("-")) return String(oldLine++);
    if (text.startsWith("+")) return String(newLine++);
    oldLine += 1;
    return String(newLine++);
  });
  if (!hasHunkHeader) return;
  setDigits(container, Math.max(...numbers.map((number) => number.length)));
  lines.forEach((line, index) => setNumber(line.firstElementChild, numbers[index]));
}
