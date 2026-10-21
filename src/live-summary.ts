import type {ObservedEvent} from './codex-events.js';

// Arrival order is authoritative. Do not pair calls by tool name or infer
// recovery, pending approvals, test results, or task completion from silence.
export function summarizeTurn(events: ObservedEvent[], session: string) {
  const scoped = events.filter(event => event.session === session);
  let boundary = 0;
  scoped.forEach((event, index) => {
    if (event.type === 'UserPromptSubmit' || event.type === 'SessionStart') boundary = index;
  });
  const recent = scoped.slice(boundary);
  return {
    hasTurnStart: recent[0]?.type === 'UserPromptSubmit',
    records: recent.length,
    toolStarts: recent.filter(event => event.type === 'PreToolUse').length,
    toolReturns: recent.filter(event => event.type === 'PostToolUse').length,
    failures: recent.filter(event => event.type === 'PostToolUse' && event.outcome === 'failed').length,
    approvalRequests: recent.filter(event => event.type === 'PermissionRequest').length,
  };
}
