import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
import {render} from 'ink-testing-library';
import {renderToString} from 'ink';
import {App, Dashboard} from '../src/App.js';
import {initialState, reducer} from '../src/model.js';
import type {State, View} from '../src/model.js';
import {themeNames} from '../src/theme.js';

const pause = () => delay(60);
test('keyboard: inspect, cancel, reject accidental Enter, approve and follow progress', async () => {
  const app = render(<App size={{columns: 100, rows: 26}} tickMs={150}/>);
  try {
    await pause();
    assert.match(app.lastFrame()!, /Welcome back/);
    app.stdin.write('\r');
    await pause();
    assert.match(app.lastFrame()!, /Proposed diff/);
    app.stdin.write('a');
    await pause();
    app.stdin.write('\r');
    await pause();
    assert.match(app.lastFrame()!, /No change made/);
    app.stdin.write('\u001b');
    await pause();
    assert.match(app.lastFrame()!, /PENDING/);
    app.stdin.write('a');
    await pause();
    app.stdin.write('APPROVE A-17');
    await pause();
    app.stdin.write('\r');
    await pause();
    assert.match(app.lastFrame()!, /APPROVED/);
    await delay(400);
    app.stdin.write('1');
    await pause();
    assert.match(app.lastFrame()!, /READY FOR CODE REVIEW/);
    assert.match(app.lastFrame()!, /5\/5 tasks done/);
  } finally {app.unmount(); app.cleanup();}
});
test('keyboard: Tab, failure filter, selection, denial, and restart', async () => {
  const app = render(<App size={{columns: 100, rows: 26}}/>);
  try {
    await pause();
    app.stdin.write('\t');
    await pause();
    assert.match(app.lastFrame()!, /Activity timeline/);
    app.stdin.write('f');
    await pause();
    assert.match(app.lastFrame()!, /FILTER: failures \+ recovery/);
    app.stdin.write('j');
    await pause();
    assert.match(app.lastFrame()!, /2\/5/);
    app.stdin.write('3');
    await pause();
    app.stdin.write('d');
    await pause();
    app.stdin.write('DENY A-17');
    await pause();
    app.stdin.write('\r');
    await pause();
    assert.match(app.lastFrame()!, /STOPPED BY YOU/);
    app.stdin.write('r');
    await pause();
    app.stdin.write('RESET');
    await pause();
    app.stdin.write('\r');
    await pause();
    assert.match(app.lastFrame()!, /Welcome back/);
    assert.match(app.lastFrame()!, /WAITING FOR YOU/);
  } finally {app.unmount(); app.cleanup();}
});
test('small terminals cannot approve, even with an open dialog', async () => {
  let seed = reducer(initialState(), {type: 'view', view: 'approval'});
  seed = reducer(seed, {type: 'open', kind: 'approve'});
  const app = render(<App seed={seed} size={{columns: 60, rows: 20}}/>);
  try {
    await pause();
    app.stdin.write('APPROVE A-17');
    app.stdin.write('\r');
    await pause();
    app.rerender(<App seed={seed} size={{columns: 100, rows: 26}}/>);
    await pause();
    assert.match(app.lastFrame()!, /CONFIRM APPROVE/);
    app.stdin.write('\u001b');
    await pause();
    assert.match(app.lastFrame()!, /PENDING/);
  } finally {app.unmount(); app.cleanup();}
});
test('key content fits supported terminal sizes in every view and modal', () => {
  for (const theme of themeNames) {
  for (const columns of [72, 80, 100, 120]) {
    for (const view of ['overview', 'timeline', 'approval'] as View[]) {
      const state = reducer(initialState(), {type: 'view', view});
      const frame = renderToString(<Dashboard theme={theme} state={state} columns={columns} rows={24}/>, {columns});
      assert.ok(frame.split('\n').length <= 24, `${columns}/${view}: too tall`);
      assert.ok(frame.split('\n').every(line => Array.from(line).length <= columns), `${columns}/${view}: too wide`);
      if (view === 'approval') {
        assert.match(frame, /Simulation only/);
        assert.match(frame, /Review denial/);
        assert.match(frame, /Max-Age=0/);
      }
    }
    let state: State = reducer(initialState(), {type: 'view', view: 'approval'});
    state = reducer(state, {type: 'open', kind: 'approve'});
    const frame = renderToString(<Dashboard theme={theme} state={state} columns={columns} rows={24}/>, {columns});
    assert.match(frame, /Esc.*Cancel/);
    assert.match(frame, /in-memory demo decision/);
  }
  }
});

test('theme shortcut preserves navigation and remains text inside confirmation dialogs', async () => {
  const app = render(<App size={{columns: 100, rows: 26}}/>);
  try {
    await pause();
    app.stdin.write('2');
    app.stdin.write('j');
    await pause();
    const selection = app.lastFrame()!.match(/\[f\] change · (\d+\/\d+)/)?.[1];
    app.stdin.write('t');
    await pause();
    assert.match(app.lastFrame()!, /agent activity · Ocean/);
    assert.ok(app.lastFrame()!.includes(`[f] change · ${selection}`));
    app.stdin.write('3');
    app.stdin.write('a');
    await pause();
    app.stdin.write('t');
    await pause();
    assert.match(app.lastFrame()!, /> t/);
    assert.match(app.lastFrame()!, /agent activity · Ocean/);
    app.stdin.write('\u001b');
    await pause();
    app.stdin.write('t');
    await pause();
    assert.match(app.lastFrame()!, /agent activity · Orchid/);
    assert.match(app.lastFrame()!, /PENDING/);
  } finally {app.unmount(); app.cleanup();}
});
