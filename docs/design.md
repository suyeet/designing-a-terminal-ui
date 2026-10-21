# Design assumptions

## Design question

Can a developer return after 30 minutes, understand the run, distinguish recovered failures from a current blocker, and make an informed decision without reconstructing the entire log?

This is a hypothesis-driven prototype. No interviews or usability studies have been conducted for Relay. The reference case study motivates the problem; its research and outcomes do not belong to this project.

## Working assumptions

| Assumption | Consequence in this prototype | What to test |
| --- | --- | --- |
| Returning users need a summary before a log | Overview opens first and selects the waiting task | Can someone explain the current state in 10 seconds? |
| Failure counts are useful if recovery is explicit | “2 failed attempts / 2 retries / recovered” stays visible | Do people mistake historical failure for a broken run? |
| Task completion is non-linear | Discrete task states; no completion percentage or ETA | Do “3/5 tasks done” and durations imply equal effort? |
| Permission requires context | Command, file, diff, scope, and risk share one screen | Can people state what they are authorizing? |
| A repeated Enter should never authorize | A separate modal requires an exact request phrase | Is the extra friction justified for this change? |
| Denial should be understandable | Preserve the baseline and stop the run | Do users expect a replan path instead? |
| A terminal is a familiar work surface | Number keys, Tab, arrows, j/k, visible help | Can new TUI users navigate without coaching? |

## Information hierarchy

The persistent header identifies the task, scenario interval, simulation status, and current run state. The overview answers what changed and what needs attention. The timeline explains why through inspectable evidence. The approval screen describes the consequence of a decision.

The summary distinguishes two failed **attempts** from the number of failing **tests** within each attempt. The timeline preserves both failures even after recovery. The failure filter deliberately includes retry and recovery events to retain context.

The approval scenario concerns a changed test baseline. A passing test after an update is not sufficient proof of correctness: the user should judge whether clearing the cookie matches the requested behavior. The risk is stated beside the proposal.

## Interaction choices

- An accent identifies the selected view or item. Amber identifies a waiting decision. Green means completed simulated checks; red identifies failures and removed diff lines. Live tool returns alone do not establish success.
- Text labels accompany color. Terminal theme inherits the terminal background. Ocean uses navy and ice blue; Orchid uses plum and lavender. Both supply readable foreground and muted text colors. `NO_COLOR=1` removes colors and backgrounds.
- Theme switching uses `t` outside confirmation dialogs and preserves navigation and decisions. Theme choice lasts for the current launch; `--theme` selects the startup palette.
- The default state has no auto-moving activity. Users can inspect it at their own pace.
- Approval advances two visible simulated steps. Denial stays stopped. Neither leads to a real command.
- Modal input cannot trigger navigation, restart, or another decision. Escape always cancels.
- Both approval and denial require confirmation to make their consequences visible. A future test should compare this with immediate denial, which may be more usable.
- Small terminals cannot make decisions while risk/context might be hidden. At supported dimensions all approval content remains visible.
- The wide overview reveals extra task evidence; smaller layouts keep the essential summary and selected-task explanation.

## Intentional boundaries and open questions

There is no pause/resume control: the only pause is the authorization gate. There is no fabricated confidence score, token cost, estimated completion time, or progress animation while waiting.

For production, the next questions include multiple simultaneous requests, new events arriving while someone reads older history, reconnecting to stale state, revocation, changed commands after review, denial with feedback, and accessibility with real screen readers. The prototype does not establish that these have been solved.

## Reference

[Kaja Škerlj, “Designing a terminal UI”](https://www.kajaskerlj.com/work/terminal-ui), accessed 20 October 2026. The transferable idea is to organize long-running activity around the developer’s questions. Relay adds an explicit human decision and a returning-user scenario. No visual assets or code were copied.
