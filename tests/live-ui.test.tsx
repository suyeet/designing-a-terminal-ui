import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {renderToString} from 'ink';
import {render} from 'ink-testing-library';
import {LiveApp, LiveDashboard} from '../src/LiveApp.js';
import {appendEvent, normalizeHook, readFeed} from '../src/codex-events.js';

test('live empty state is honest about connection and contains no simulated progress', () => {
  const frame = renderToString(<LiveDashboard project="/missing-relay-project" feed={{events: [], warning: '', full: false}} index={0}/>);
  assert.match(frame, /WAITING FOR FIRST CODEX EVENT/);
  assert.doesNotMatch(frame, /24\/24|A-17|3\/5/);
});
test('live UI receives updates and never exposes approve/deny controls', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'relay-live-'));
  const app = render(<LiveApp project={root} pollMs={30} size={{columns: 100, rows: 26}}/>);
  try {
    await delay(80);
    appendEvent(root, normalizeHook({cwd: root, session_id: 'live-test', hook_event_name: 'PermissionRequest', tool_name: 'Bash'}, root)!);
    await delay(120);
    assert.match(app.lastFrame()!, /Approval requested in Codex/);
    app.stdin.write('a');
    await delay(80);
    assert.doesNotMatch(app.lastFrame()!, /CONFIRM APPROVE/);
    assert.match(app.lastFrame()!, /Resolve this in Codex/);
    app.stdin.write('t');
    await delay(80);
    assert.match(app.lastFrame()!, /LOCAL FEED · Ocean/);
    assert.match(app.lastFrame()!, /Resolve this in Codex/);
    for (const columns of [72, 80, 100, 120]) {
      const frame = renderToString(<LiveDashboard theme="orchid" project={root} feed={readFeed(root)} index={0} columns={columns} rows={24}/>, {columns});
      assert.ok(frame.split('\n').length <= 24);
      assert.match(frame, /RECENT ACTIVITY/);
      assert.match(frame, /1 approval request observed; check status in Codex/);
      assert.match(frame, /results unverified/);
      assert.match(frame, /Resolve this in Codex/);
      assert.match(frame, /Approvals stay in Codex/);
    }
  } finally {app.unmount(); app.cleanup(); rmSync(root, {recursive: true, force: true});}
});
