Opens Edit and Write tool calls in the agent timeline automatically and makes them easier to read. Reasoning and other tool calls keep their default collapsed state, so it works well with "Always expand reasoning" turned off.

Each Edit or Write row opens once when it appears. If you collapse it, it stays collapsed. Rows open only at widths of 720 pixels or more; on narrow layouts Paseo shows tool details in a sheet.

Edit and Write rows also get:

- A Monokai look: a dark background, dark red removed lines and dark blue added lines without the - and + signs, and soft highlights on changed words.
- Monokai syntax colors. Set Appearance > Syntax theme to Dracula; the plugin recolors Dracula tokens to Monokai. Ruby files get their own highlighter, because Paseo does not highlight Ruby.
- Word wrap for long lines.
- Line numbers. Write rows count from line 1. For Edit rows the plugin reads the edited file on the daemon host to find where the new text is. An Edit shows no numbers when the text is not in the file any more or appears more than once.

Cmd+click (Ctrl+click on Linux and Windows) on a tool call header opens the file, like the open file button.
