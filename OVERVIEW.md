David's Paseo plugin makes Claude Code tool calls easier to read and follow in the agent timeline. It joins four features: expanded file edits, better shell commands, Claude sign-in per agent, and a composer that keeps the cursor.

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

A Background pill in the composer of each Claude agent shows how many background commands are running. It shows only while at least one command runs. Press it to see the running and finished background commands of the session. Tap a command to see its full text, status, output size and the end of its output.

The daemon side reads the Claude Code session transcript under `~/.claude/projects` (or `CLAUDE_CONFIG_DIR`) and the task output files that the transcript names. It reads only output files that the agent's own transcript names, and it sends nothing off the machine.

Limits: the shell features work only for Claude agents. A background command shows as lost when its agent closes before the command reports an end.

## Claude sign-in per agent

Choose how each Claude Code agent signs in, and restart that agent from the composer. Type these commands in the composer of the agent you want to change. Nothing is sent to the agent.

- `/token fmcp_...` saves your Factopia admin MCP token. Do this once.
- `/token list` lists the Factopia users that have a Claude connection.
- `/token <name>` runs this agent on the Claude token of that Factopia user and restarts it. A name is the email name, the account name, or the id.
- `/token sk-ant-...` runs this agent on a pasted Claude OAuth token and restarts it.
- `/token clear` deletes this agent's token and restarts it on your Claude CLI login.
- `/token` shows which sign-in this agent uses.
- `/login` deletes this agent's token, opens a terminal that runs `claude auth login`, and restarts the agent when the sign-in completes.
- `/restart` restarts this agent's session.

These commands need an agent. A draft composer does not show them.

A Factopia token refreshes without action from you. When the agent opens, the plugin gets the current token from Factopia. Every 5 minutes, it checks each idle agent and restarts it when Factopia has a new token. When a turn fails with an expired or revoked token, it gets a new token, restarts the agent, and sends your last message again, once in 10 minutes.

Factopia refreshes a token that expires in less than 3 hours. A refresh revokes the old token of that account, which can stop a Factopia run that uses it.

Tokens and the Factopia MCP token stay on the daemon machine in `~/.paseo/claude-auth/`, readable only by your user. The plugin shows only the last four characters of a token. A restart interrupts a turn in progress. Subagents that Paseo starts as separate agents do not inherit the token. Set `FACTOPIA_URL` in the daemon environment to use another Factopia server.

## Composer focus

The plugin keeps the cursor in the agent message input, like a terminal agent CLI.

When you type a letter while no text field, terminal or editor has focus, the plugin moves the cursor to the message input and the letter lands there. When you click an empty part of the app, the cursor goes back to the message input. A click that selects text, a click on a button, and any open dialog or menu keep the focus where it is. Cmd+V (Ctrl+V on Windows and Linux) pastes into the message input when no text field has focus. The `?` and Space keys keep their Paseo shortcut meaning.

Composer focus works on desktop and web only. On iOS and Android it does nothing.
