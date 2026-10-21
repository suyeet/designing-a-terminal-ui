export type View = 'overview' | 'timeline' | 'approval';
export type TaskStatus = 'done' | 'waiting' | 'queued' | 'running' | 'stopped';
export type EventKind = 'info' | 'success' | 'failure' | 'retry' | 'approval' | 'decision';
export interface Activity {
  id: string;
  time: string;
  kind: EventKind;
  title: string;
  detail: string;
}
export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  duration: string;
  detail: string;
  evidence: string;
}
export const request = Object.freeze({
  id: 'A-17',
  run: 'RUN-042',
  title: 'Update the integration snapshot',
  command: 'npm run test:integration -- --updateSnapshot',
  file: 'tests/__snapshots__/session.integration.snap',
  scope: 'One invocation / one file / RUN-042',
});
export interface State {
  view: View;
  taskIndex: number;
  eventIndex: number;
  failuresOnly: boolean;
  help: boolean;
  dialog: null | {kind: 'approve' | 'deny' | 'reset'; requestId: string; text: string; error: string};
  approval: 'pending' | 'approved' | 'denied';
  run: 'waiting' | 'running' | 'ready' | 'stopped';
  step: number;
  tasks: Task[];
  events: Activity[];
}

export function initialState(): State {
  return {
    view: 'overview', taskIndex: 3, eventIndex: 0, failuresOnly: false, help: false,
    dialog: null, approval: 'pending', run: 'waiting', step: 0,
    tasks: [
      {id: 'scope', title: 'Understand the request', status: 'done', duration: '03m',
        detail: 'Add session expiry handling to the account API.',
        evidence: 'Scope agreed: expired sessions return 401 and clear the session cookie.'},
      {id: 'implement', title: 'Implement session expiry', status: 'done', duration: '11m',
        detail: 'Updated the session guard and cookie cleanup.',
        evidence: 'Simulated changes: src/auth/session.ts, src/auth/cookies.ts.'},
      {id: 'unit', title: 'Verify unit tests', status: 'done', duration: '08m',
        detail: '24/24 tests pass after 2 failed attempts and 2 retries.',
        evidence: 'Attempt 1: timezone mismatch. Attempt 2: expiry boundary. Attempt 3: 24 passed.'},
      {id: 'integration', title: 'Check integration', status: 'waiting', duration: '08m',
        detail: 'A snapshot differs. The agent needs permission to update the baseline.',
        evidence: 'Status remains 401. New output clears the expired session cookie. Inspect A-17.'},
      {id: 'handoff', title: 'Prepare handoff', status: 'queued', duration: '--',
        detail: 'Prepare a review summary after integration verification.',
        evidence: 'No commit, push, merge, or deployment is included in this run.'},
    ],
    events: [
      {id: 'e9', time: '09:30', kind: 'approval', title: 'A-17 needs your decision',
        detail: 'Integration is paused before any baseline change. Review the command, scope, and proposed diff.'},
      {id: 'e8', time: '09:26', kind: 'info', title: 'Integration snapshot differs',
        detail: 'Expected status 401 still matches. Actual response also clears the session cookie. The stored baseline lacks this header.'},
      {id: 'e7', time: '09:22', kind: 'success', title: 'Recovered: 24/24 unit tests pass',
        detail: 'Attempt 3 passed after two targeted fixes. The earlier failures remain in this timeline.'},
      {id: 'e6', time: '09:20', kind: 'retry', title: 'Retry 2 of 2: expiry boundary fixed',
        detail: 'Changed expiry comparison to include the exact expiration instant. Re-ran the unit suite.'},
      {id: 'e5', time: '09:18', kind: 'failure', title: 'Attempt 2 failed: boundary condition',
        detail: 'session.spec.ts: expected 401 at expiresAt, received 200. 23 passed; 1 failed.'},
      {id: 'e4', time: '09:16', kind: 'retry', title: 'Retry 1 of 2: clock normalized',
        detail: 'Normalized test clock to UTC and re-ran the unit suite.'},
      {id: 'e3', time: '09:14', kind: 'failure', title: 'Attempt 1 failed: timezone mismatch',
        detail: 'session.spec.ts: local clock fixture disagreed with UTC expiry. 22 passed; 2 failed.'},
      {id: 'e2', time: '09:03', kind: 'info', title: 'Implementation started',
        detail: 'Working on session expiry handling and clearing stale cookies. No external actions authorized.'},
      {id: 'e1', time: '09:00', kind: 'info', title: 'Run started / you stepped away',
        detail: 'Task: handle expired account sessions. This entire run is a fictional, deterministic fixture.'},
    ],
  };
}

export function visibleEvents(s: State): Activity[] {
  return s.failuresOnly ? s.events.filter(e =>
    e.kind === 'failure' || e.kind === 'retry' || e.id === 'e7') : s.events;
}
export function phrase(s: State): string {
  if (!s.dialog) return '';
  return s.dialog.kind === 'reset' ? 'RESET' : `${s.dialog.kind.toUpperCase()} ${s.dialog.requestId}`;
}
export type Action =
  | {type: 'view'; view: View}
  | {type: 'move'; delta: number}
  | {type: 'filter'}
  | {type: 'help'}
  | {type: 'open'; kind: 'approve' | 'deny' | 'reset'}
  | {type: 'cancel'}
  | {type: 'text'; text: string}
  | {type: 'backspace'}
  | {type: 'confirm'}
  | {type: 'tick'};

function event(s: State, item: Activity): Activity[] {
  return [item, ...s.events];
}
export function reducer(s: State, a: Action): State {
  // A modal owns all input. Navigation cannot accidentally become a decision.
  if (s.dialog && !['cancel', 'text', 'backspace', 'confirm', 'tick'].includes(a.type)) return s;
  if (s.help && !['help', 'cancel', 'tick'].includes(a.type)) return s;
  switch (a.type) {
    case 'view': return {...s, view: a.view};
    case 'help': return {...s, help: !s.help};
    case 'cancel': return {...s, dialog: null, help: false};
    case 'move': {
      if (s.view === 'approval') return s;
      const key = s.view === 'overview' ? 'taskIndex' : 'eventIndex';
      const length = s.view === 'overview' ? s.tasks.length : visibleEvents(s).length;
      return {...s, [key]: Math.max(0, Math.min(length - 1, s[key] + a.delta))};
    }
    case 'filter': return s.view === 'timeline'
      ? {...s, failuresOnly: !s.failuresOnly, eventIndex: 0} : s;
    case 'open':
      if (a.kind !== 'reset' && (s.approval !== 'pending' || s.view !== 'approval')) return s;
      return {...s, dialog: {kind: a.kind, requestId: request.id, text: '', error: ''}};
    case 'text': return s.dialog
      ? {...s, dialog: {...s.dialog, text: (s.dialog.text + a.text.replace(/[^\x20-\x7E]/g, '')).slice(0, 40), error: ''}} : s;
    case 'backspace': return s.dialog
      ? {...s, dialog: {...s.dialog, text: s.dialog.text.slice(0, -1), error: ''}} : s;
    case 'confirm': {
      if (!s.dialog) return s;
      if (s.dialog.text !== phrase(s)) {
        return {...s, dialog: {...s.dialog, error: 'No change made. Type the exact phrase, then Enter.'}};
      }
      if (s.dialog.kind === 'reset') return initialState();
      if (s.approval !== 'pending' || s.dialog.requestId !== request.id) return {...s, dialog: null};
      const approved = s.dialog.kind === 'approve';
      return {
        ...s, dialog: null, approval: approved ? 'approved' : 'denied',
        run: approved ? 'running' : 'stopped', eventIndex: 0,
        tasks: s.tasks.map(t => t.id === 'integration'
          ? {...t, status: approved ? 'running' : 'stopped',
            detail: approved ? 'Simulating the approved snapshot update.' : 'Request denied. Baseline preserved; agent stopped.'} : t),
        events: event(s, {id: 'decision-A-17', time: '09:31', kind: 'decision',
          title: `A-17 ${approved ? 'approved once' : 'denied'} by you`,
          detail: approved
            ? `Recorded for ${request.run}. Scope: ${request.file}. Only simulated events will follow.`
            : 'Baseline unchanged. No automatic retry or alternate command. Start a new demo to explore approval.'}),
      };
    }
    case 'tick': {
      if (s.run !== 'running') return s;
      if (s.step === 0) {
        return {...s, step: 1,
          tasks: s.tasks.map(t => t.id === 'integration'
            ? {...t, status: 'done', duration: '09m', detail: 'Simulated integration checks passed: 8/8.',
              evidence: 'A-17 approved once. One baseline updated in the simulation.'}
            : t.id === 'handoff' ? {...t, status: 'running', detail: 'Preparing your review summary.'} : t),
          events: event(s, {id: 'sim-integration', time: '09:32', kind: 'success',
            title: 'Simulation: integration 8/8 passed',
            detail: 'The approved baseline change was simulated. No file was edited and no command was run.'})};
      }
      return {...s, step: 2, run: 'ready',
        tasks: s.tasks.map(t => t.id === 'handoff'
          ? {...t, status: 'done', duration: '01m', detail: 'Ready for your code review.',
            evidence: 'Review session expiry, cookie cleanup, and the approved baseline. Nothing committed or deployed.'} : t),
        events: event(s, {id: 'sim-ready', time: '09:33', kind: 'success',
          title: 'Ready for human code review',
          detail: 'All simulated checks pass. A human still needs to review the implementation; test success is not a correctness guarantee.'})};
    }
  }
}
