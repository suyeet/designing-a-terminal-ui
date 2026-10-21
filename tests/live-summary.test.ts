import {test} from 'node:test';
import assert from 'node:assert/strict';
import {summarizeTurn} from '../src/live-summary.js';
import type {ObservedEvent} from '../src/codex-events.js';

const event = (type: ObservedEvent['type'], extras: Partial<ObservedEvent> = {}): ObservedEvent => ({
  version: 1, id: 'fixture', at: '2026-10-21T09:00:00Z', session: 'one', type, ...extras,
});

test('summary separates turns and sessions even with interleaved events', () => {
  const events = [event('UserPromptSubmit'), event('PostToolUse', {outcome: 'failed'}),
    event('PermissionRequest'), event('Stop'), event('UserPromptSubmit'),
    event('PreToolUse'), event('PostToolUse', {outcome: 'failed', session: 'two'}),
    event('PostToolUse', {outcome: 'returned'}), event('Stop')];
  assert.deepEqual(summarizeTurn(events, 'one'), {
    hasTurnStart: true, records: 4, toolStarts: 1, toolReturns: 1, failures: 0, approvalRequests: 0,
  });
});

test('later returns and stops do not erase failures or approval observations', () => {
  const summary = summarizeTurn([event('UserPromptSubmit'),
    event('PostToolUse', {outcome: 'failed'}), event('PermissionRequest'),
    event('PostToolUse', {outcome: 'returned'}), event('Stop')], 'one');
  assert.equal(summary.failures, 1);
  assert.equal(summary.approvalRequests, 1);
  assert.equal(summary.toolReturns, 2);
});

test('missing turn boundaries are treated as recent records; session start resets the scope', () => {
  assert.equal(summarizeTurn([event('PostToolUse')], 'one').hasTurnStart, false);
  assert.equal(summarizeTurn([], 'one').records, 0);
  const summary = summarizeTurn([event('UserPromptSubmit'), event('PermissionRequest'),
    event('SessionStart'), event('PreToolUse')], 'one');
  assert.equal(summary.hasTurnStart, false);
  assert.equal(summary.approvalRequests, 0);
  assert.equal(summary.toolStarts, 1);
});
