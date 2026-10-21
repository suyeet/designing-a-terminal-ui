# Codex desktop connection

Relay 0.2 adds an observer for local Codex sessions. The interface is:

```text
Codex lifecycle hook → dist/hook.js → project/.relay/events.jsonl → Relay live view
```

No server, API key, transcript scraping, database access, or network service is
involved. This does not connect to an existing desktop session through the SDK.

## Setup

Install Relay, then run `relay connect` from the project directory used by your
Codex chat. Or pass `--project="/absolute/path"` explicitly. From a source checkout
build first and use `node dist/cli.js connect --project="/absolute/path"`.

The command adds handlers to `.codex/hooks.json`. Existing unrelated handlers
remain intact. An existing file is backed up next to it before a change. Each
handler invokes your installed Node executable and Relay hook file using quoted
absolute paths. If you move or reinstall Relay, run `connect` again.

Codex requires review and trust of new or changed hooks. Review the exact
configuration through your client's hook review flow. The documented CLI flow
uses `/hooks`; desktop availability and presentation depend on the installed
version. Relay never changes trust records or bypasses this requirement.

Start or resume a **local** Codex chat in the configured project after trust
review. Reload the chat/application if its configuration was already loaded.
Then run `relay --live --project="/absolute/path"` and ask Codex to inspect a file.
The first event verifies delivery; having a hook file does not.

## What you can see

- Session start/resume and session end.
- New user turns, tool starts, and tool returns.
- Explicit tool failure metadata when supplied by Codex.
- An approval-request notification directing you back to Codex.
- Turn stop and interruption.

The feed uses receiver timestamps and arrival order. It shows up to 500 recent
records within the last 512 KiB; session navigation covers those records. A turn
stopping does not establish task success. A tool returning does not establish
successful execution. If an error is only present in free-text output, this
version deliberately does not infer failure from that text.

The receiver is best effort. It bounds input at 2 MiB, returns within roughly
1.5 seconds, and returns an empty JSON object rather than a decision. An
unwritable feed or oversized event can be dropped. These are observations,
not a complete live state or enforcement mechanism.

## Local data

Stored fields: schema version, event UUID, receive time, hashed session ID,
event type, sanitized tool name, and optional failure/returned label.

No prompt, raw command, file contents, assistant response, transcript path, or
raw tool output is stored. The receiver filters events to the selected project
or its subdirectories. The data directory is created with owner-only access;
the event file is created with mode 0600. Existing access permissions are not
rewritten. Relay refuses symlinked data directories and event files.

The file stops accepting events at roughly 8 MiB. Archive or remove
`.relay/events.jsonl` to start fresh. Add `.relay/` and local hook backups to the
project's `.gitignore` before sharing it. Relay does not modify that project's
Git ignore rules automatically.

## Disconnect

Run `relay disconnect --project="/absolute/path"`. It removes Relay's handlers
only. Reload Codex to discard already-loaded hooks. Existing metadata stays
local; remove the `.relay` directory if you no longer want it.

## If no events arrive

1. Check that the chat's working directory is the configured project or a child.
2. Review/trust the hook definition and the project config layer in Codex.
3. Reload the local chat after configuration changes.
4. Check whether your client/runtime supports the documented hooks. Managed
   settings can disable them; Relay does not override those settings.
5. Check the executable paths in `.codex/hooks.json` if Relay or Node moved.
6. Check directory access and whether the feed is full.

Do not interpret the waiting screen as a working connection. Cloud-orchestrated
chats may not support these local command hooks.

## Sources and verification

Based on the [official Codex hook documentation](https://learn.chatgpt.com/docs/hooks),
accessed 20 October 2026. Codex supplies lifecycle events as JSON to command
hooks, supports project configuration, and requires trust before non-managed
hooks run. Local-only sessions are the intended target.

Automated tests exercise documented-format inputs, retention filtering,
malformed records, incremental updates, installation, and non-authorizing output.
These synthetic tests do not prove that a particular desktop installation has
delivered an event. That final verification requires hook trust and a real turn
from the user's Codex client.
