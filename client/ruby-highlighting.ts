import { tokenizeRuby, type RubyTokenKind } from "../shared/ruby-tokenizer";

const MONOKAI_RUBY_COLORS: Record<RubyTokenKind, string> = {
  keyword: "#f92672",
  storage: "#66d9ef",
  string: "#e6db74",
  constant: "#ae81ff",
  function: "#a6e22e",
  type: "#66d9ef",
  comment: "#75715e",
  parameter: "#fd971f",
};
const RUBY_FILE_PATTERN = /(\.(rb|rake|ru|gemspec|jbuilder)|(^|\/)(Gemfile|Rakefile|Guardfile))$/;

interface HighlightedCode {
  text: string;
  ranges: Array<[Highlight, Range]>;
}

function highlightName(kind: RubyTokenKind): string {
  return `expand-file-edits-ruby-${kind}`;
}

export const RUBY_HIGHLIGHT_CSS = Object.entries(MONOKAI_RUBY_COLORS)
  .map(([kind, color]) => `::highlight(${highlightName(kind as RubyTokenKind)}) { color: ${color}; }`)
  .join("\n");

export function isRubyFile(path: string): boolean {
  return RUBY_FILE_PATTERN.test(path);
}

function textNodesWithOffsets(element: Element): Array<{ node: Text; start: number }> {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const nodes: Array<{ node: Text; start: number }> = [];
  let offset = 0;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node as Text;
    nodes.push({ node: text, start: offset });
    offset += text.data.length;
  }
  return nodes;
}

function positionAt(nodes: Array<{ node: Text; start: number }>, offset: number): [Text, number] {
  let index = nodes.length - 1;
  while (index > 0 && nodes[index].start > offset) index -= 1;
  const { node, start } = nodes[index];
  return [node, Math.min(offset - start, node.data.length)];
}

export function createRubyHighlighter() {
  const highlights = new Map<RubyTokenKind, Highlight>();
  for (const kind of Object.keys(MONOKAI_RUBY_COLORS) as RubyTokenKind[]) {
    const highlight = new Highlight();
    highlights.set(kind, highlight);
    CSS.highlights.set(highlightName(kind), highlight);
  }

  const highlightedCode = new Map<Element, HighlightedCode>();
  let seenThisPass = new Set<Element>();

  const clear = (element: Element) => {
    for (const [highlight, range] of highlightedCode.get(element)?.ranges ?? []) highlight.delete(range);
    highlightedCode.delete(element);
  };

  const isCurrent = (element: Element, text: string) => {
    const existing = highlightedCode.get(element);
    if (!existing || existing.text !== text) return false;
    return existing.ranges.every(([, range]) => range.startContainer.isConnected);
  };

  return {
    beginPass() {
      seenThisPass = new Set();
    },

    highlight(element: Element, skipLeadingCharacter: boolean) {
      seenThisPass.add(element);
      const text = element.textContent ?? "";
      if (isCurrent(element, text)) return;
      clear(element);
      const nodes = textNodesWithOffsets(element);
      if (nodes.length === 0) return;
      const ranges: Array<[Highlight, Range]> = [];
      for (const token of tokenizeRuby(text, skipLeadingCharacter ? 1 : 0)) {
        const range = document.createRange();
        range.setStart(...positionAt(nodes, token.from));
        range.setEnd(...positionAt(nodes, token.to));
        const highlight = highlights.get(token.kind)!;
        highlight.add(range);
        ranges.push([highlight, range]);
      }
      highlightedCode.set(element, { text, ranges });
    },

    endPass() {
      for (const element of [...highlightedCode.keys()]) {
        if (!seenThisPass.has(element) || !element.isConnected) clear(element);
      }
    },

    dispose() {
      for (const kind of highlights.keys()) CSS.highlights.delete(highlightName(kind));
      highlightedCode.clear();
    },
  };
}
