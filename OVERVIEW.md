David's Paseo plugin makes Claude Code tool calls easier to read and follow in the agent timeline. It joins two features: expanded file edits and better shell commands.

## File edits

Edit and Write tool calls open automatically. Reasoning and other tool calls keep their default collapsed state, so it works well with "Always expand reasoning" turned off.

Each Edit or Write row opens once when it appears. If you collapse it, it stays collapsed. Rows open only at widths of 720 pixels or more; on narrow layouts Paseo shows tool details in a sheet.

Edit and Write rows also get:

- A Monokai look: a dark background, dark red removed lines and dark blue added lines without the - and + signs, and soft highlights on changed words.
- Monokai syntax colors. Set Appearance > Syntax theme to Dracula; the plugin recolors Dracula tokens to Monokai. Ruby files get their own highlighter, because Paseo does not highlight Ruby.
- Word wrap for long lines.
- Line numbers. Write rows count from line 1. For Edit rows the plugin reads the edited file on the daemon host to find where the new text is. An Edit shows no numbers when the text is not in the file any more or appears more than once.

Cmd+click (Ctrl+click on Linux and Windows) on a tool call header opens the file, like the open file button.

## Shell commands

The Shell row wraps long commands and output, so you do not scroll sideways. An expanded row stops at 420 pixels and scrolls vertically. A command that Claude started in the background shows its live state on the row: running, done, failed or stopped.

A Background pill in the composer of each Claude agent shows how many background commands are running, or how many ended in the last ten minutes. Press it to see the running and finished background commands of the session. Tap a command to see its full text, status, output size and the end of its output.

The daemon side reads the Claude Code session transcript under `~/.claude/projects` (or `CLAUDE_CONFIG_DIR`) and the task output files that the transcript names. It reads only output files that the agent's own transcript names, and it sends nothing off the machine.

Limits: the shell features work only for Claude agents. A background command shows as lost when its agent closes before the command reports an end.
