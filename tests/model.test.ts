import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialState, reducer, visibleEvents} from '../src/model.js';
import type {State} from '../src/model.js';

function decide(kind: 'approve' | 'deny'): State {
  let s = reducer(initialState(), {type: 'view', view: 'approval'});
  s = reducer(s, {type: 'open', kind});
  s = reducer(s, {type: 'text', text: `${kind.toUpperCase()} A-17`});
  return reducer(s, {type: 'confirm'});
}
test('returning developer sees recovered failures and one pending gate', () => {
  const s = initialState();
  assert.equal(s.run, 'waiting');
  assert.equal(s.tasks.filter(t => t.status === 'done').length, 3);
  assert.equal(s.events.filter(e => e.kind === 'failure').length, 2);
  assert.equal(s.events.filter(e => e.kind === 'retry').length, 2);
  assert.deepEqual(reducer(s, {type: 'tick'}), s);
});
test('decisions require the review view and an exact phrase', () => {
  let s = initialState();
  assert.equal(reducer(s, {type: 'open', kind: 'approve'}), s);
  s = reducer(s, {type: 'view', view: 'approval'});
  s = reducer(s, {type: 'open', kind: 'approve'});
  s = reducer(s, {type: 'confirm'});
  s = reducer(s, {type: 'confirm'});
  assert.equal(s.approval, 'pending');
  assert.match(s.dialog!.error, /No change/);
  s = reducer(s, {type: 'text', text: 'APPROVE A-18'});
  assert.equal(reducer(s, {type: 'confirm'}).approval, 'pending');
});
test('cancel preserves the gate and modal consumes navigation', () => {
  let s = reducer(initialState(), {type: 'view', view: 'approval'});
  s = reducer(s, {type: 'open', kind: 'approve'});
  assert.equal(reducer(s, {type: 'view', view: 'overview'}), s);
  s = reducer(s, {type: 'text', text: 'APPROVE A-17'});
  s = reducer(s, {type: 'cancel'});
  assert.equal(s.approval, 'pending');
  assert.equal(s.dialog, null);
  assert.equal(reducer(s, {type: 'confirm'}), s);
});
test('approval is consumed once and reaches review, never deployment', () => {
  let s = decide('approve');
  assert.equal(s.run, 'running');
  assert.equal(reducer(s, {type: 'open', kind: 'approve'}), s);
  s = reducer(s, {type: 'tick'});
  assert.equal(s.tasks[3]!.status, 'done');
  assert.equal(s.tasks[4]!.status, 'running');
  s = reducer(s, {type: 'tick'});
  assert.equal(s.run, 'ready');
  assert.equal(s.tasks.filter(t => t.status === 'done').length, 5);
  assert.equal(s.events.filter(e => e.id === 'decision-A-17').length, 1);
  assert.equal(reducer(s, {type: 'tick'}), s);
});
test('denial stops the agent; time and repeated decisions cannot resume it', () => {
  const s = decide('deny');
  assert.equal(s.run, 'stopped');
  assert.equal(s.tasks[3]!.status, 'stopped');
  assert.equal(reducer(s, {type: 'tick'}), s);
  assert.equal(reducer(s, {type: 'open', kind: 'approve'}), s);
});
test('stale request binding cannot authorize a different request', () => {
  let s = reducer(initialState(), {type: 'view', view: 'approval'});
  s = reducer(s, {type: 'open', kind: 'approve'});
  s = {...s, dialog: {...s.dialog!, requestId: 'A-18', text: 'APPROVE A-18'}};
  s = reducer(s, {type: 'confirm'});
  assert.equal(s.approval, 'pending');
  assert.equal(s.run, 'waiting');
});
test('filters preserve recovery context and selection stays in bounds', () => {
  let s = reducer(initialState(), {type: 'view', view: 'timeline'});
  s = reducer(s, {type: 'move', delta: 100});
  assert.equal(s.eventIndex, 8);
  s = reducer(s, {type: 'filter'});
  assert.equal(s.eventIndex, 0);
  assert.equal(visibleEvents(s).length, 5);
  assert.equal(visibleEvents(s)[0]!.kind, 'success');
  assert.equal(reducer(s, {type: 'move', delta: -100}).eventIndex, 0);
});
test('restart requires confirmation and creates a fresh fixture', () => {
  let s = decide('deny');
  s = reducer(s, {type: 'open', kind: 'reset'});
  assert.equal(reducer(s, {type: 'confirm'}).approval, 'denied');
  s = reducer(s, {type: 'text', text: 'RESET'});
  assert.deepEqual(reducer(s, {type: 'confirm'}), initialState());
});
