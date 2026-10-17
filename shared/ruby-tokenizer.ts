export type RubyTokenKind = "keyword" | "storage" | "string" | "constant" | "function" | "type" | "comment" | "parameter";

export interface RubyToken {
  kind: RubyTokenKind;
  from: number;
  to: number;
}

const STORAGE_WORDS = new Set(["def", "class", "module"]);
const LANGUAGE_CONSTANTS = new Set(["nil", "true", "false", "self", "__FILE__", "__LINE__", "__method__", "__dir__"]);
const KEYWORDS = new Set([
  "alias", "and", "begin", "break", "case", "defined?", "do", "else", "elsif", "end", "ensure", "for", "if", "in",
  "next", "not", "or", "raise", "redo", "rescue", "retry", "return", "super", "then", "undef", "unless", "until",
  "when", "while", "yield", "include", "extend", "prepend", "private", "protected", "public", "require",
  "require_relative", "attr_reader", "attr_writer", "attr_accessor", "lambda", "proc", "loop",
]);
const OPERATOR_CHARACTERS = new Set(["=", "!", "<", ">", "+", "-", "*", "/", "%", "&", "|", "^", "~", "?"]);
const BLOCK_OPENERS = new Set(["{", "do"]);

const WORD = /[A-Za-z_][A-Za-z0-9_]*[?!]?/y;
const SYMBOL = /:[A-Za-z_][A-Za-z0-9_]*[?!=]?/y;
const NUMBER = /\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][+-]?\d+)?/y;
const GLOBAL_OR_INSTANCE_VARIABLE = /[@$]{1,2}[A-Za-z0-9_]+/y;

function matchAt(pattern: RegExp, text: string, index: number): number {
  pattern.lastIndex = index;
  return pattern.test(text) ? pattern.lastIndex : index;
}

function closingQuote(text: string, index: number): number {
  const quote = text[index];
  let cursor = index + 1;
  while (cursor < text.length && text[cursor] !== quote) {
    cursor += text[cursor] === "\\" ? 2 : 1;
  }
  return Math.min(cursor + 1, text.length);
}

export function tokenizeRuby(text: string, start = 0): RubyToken[] {
  const tokens: RubyToken[] = [];
  let cursor = start;
  let expectMethodName = false;
  let parameterListEnd: string | null = null;
  let previousSignificant = "";

  const push = (kind: RubyTokenKind, from: number, to: number) => tokens.push({ kind, from, to });

  while (cursor < text.length) {
    const character = text[cursor];

    if (/\s/.test(character)) {
      cursor += 1;
      continue;
    }

    if (character === "#") {
      const lineEnd = text.indexOf("\n", cursor);
      const end = lineEnd === -1 ? text.length : lineEnd;
      push("comment", cursor, end);
      cursor = end;
      continue;
    }

    if (character === '"' || character === "'" || character === "`") {
      const end = closingQuote(text, cursor);
      push("string", cursor, end);
      cursor = end;
      previousSignificant = "string";
      continue;
    }

    if (character === ":" && text[cursor + 1] === ":") {
      cursor += 2;
      previousSignificant = "::";
      continue;
    }

    if (character === ":") {
      const end = matchAt(SYMBOL, text, cursor);
      if (end > cursor) {
        push("constant", cursor, end);
        cursor = end;
        previousSignificant = "symbol";
        continue;
      }
    }

    if (/\d/.test(character)) {
      const end = matchAt(NUMBER, text, cursor);
      push("constant", cursor, end);
      cursor = end;
      previousSignificant = "number";
      continue;
    }

    if (character === "@" || character === "$") {
      const end = matchAt(GLOBAL_OR_INSTANCE_VARIABLE, text, cursor);
      if (end > cursor) {
        cursor = end;
        previousSignificant = "variable";
        continue;
      }
    }

    if (/[A-Za-z_]/.test(character)) {
      const end = matchAt(WORD, text, cursor);
      const word = text.slice(cursor, end);
      const afterDot = previousSignificant === ".";

      if (expectMethodName) {
        if (word === "self" && text[end] === ".") {
          push("constant", cursor, end);
          cursor = end + 1;
          continue;
        }
        push("function", cursor, end);
        expectMethodName = false;
        if (text[end] === "(") parameterListEnd = ")";
      } else if (parameterListEnd) {
        push(LANGUAGE_CONSTANTS.has(word) ? "constant" : "parameter", cursor, end);
      } else if (!afterDot && text[end] === ":" && text[end + 1] !== ":") {
        push("constant", cursor, end + 1);
        cursor = end + 1;
        previousSignificant = "symbol";
        continue;
      } else if (afterDot) {
        previousSignificant = word;
        cursor = end;
        continue;
      } else if (STORAGE_WORDS.has(word)) {
        push("storage", cursor, end);
        if (word === "def") expectMethodName = true;
      } else if (LANGUAGE_CONSTANTS.has(word)) {
        push("constant", cursor, end);
      } else if (KEYWORDS.has(word)) {
        push("keyword", cursor, end);
      } else if (/^[A-Z]/.test(word)) {
        push("type", cursor, end);
      }
      previousSignificant = word;
      cursor = end;
      continue;
    }

    if (parameterListEnd && character === parameterListEnd) {
      parameterListEnd = null;
    } else if (character === "|" && BLOCK_OPENERS.has(previousSignificant)) {
      parameterListEnd = "|";
    } else if (character === "&" && text[cursor + 1] === ".") {
      cursor += 2;
      previousSignificant = ".";
      continue;
    } else if (OPERATOR_CHARACTERS.has(character) && !parameterListEnd) {
      push("keyword", cursor, cursor + 1);
    } else if (character === "=" && parameterListEnd) {
      push("keyword", cursor, cursor + 1);
    }

    previousSignificant = character;
    cursor += 1;
  }

  return tokens;
}
