import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, appendFileSync, symlinkSync, existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {appendEvent, eventFile, normalizeHook, readFeed} from '../src/codex-events.js';

function workspace() {
  const root = mkdtempSync(path.join(tmpdir(), 'relay-codex-'));
  return {root, cleanup: () => rmSync(root, {recursive: true, force: true})};
}
const payload = (root: string, extra = {}) => ({
  session_id: 'test-session', cwd: root, hook_event_name: 'PreToolUse',
  tool_name: 'Bash', tool_input: {command: 'secret-token'}, prompt: 'private prompt',
  transcript_path: '/private/transcript', ...extra,
});
test('hook normalization retains metadata only and rejects foreign projects', () => {
  const w = workspace();
  try {
    const item = normalizeHook(payload(w.root), w.root)!;
    assert.equal(item.type, 'PreToolUse');
    assert.equal(item.tool, 'Bash');
    assert.doesNotMatch(JSON.stringify(item), /secret-token|private|test-session/);
    assert.equal(normalizeHook(payload(tmpdir()), w.root), null);
    assert.equal(normalizeHook(payload(w.root, {hook_event_name: 'UnknownEvent'}), w.root), null);
    assert.equal(normalizeHook({cwd: w.root}, w.root), null);
  } finally {w.cleanup();}
});
test('only explicit error metadata becomes failure; returned does not imply success', () => {
  const w = workspace();
  try {
    const base = payload(w.root, {hook_event_name: 'PostToolUse'});
    assert.equal(normalizeHook({...base, tool_response: {exit_code: 1}}, w.root)!.outcome, 'failed');
    assert.equal(normalizeHook({...base, tool_response: {isError: true}}, w.root)!.outcome, 'failed');
    assert.equal(normalizeHook({...base, tool_response: 'failed tests in free text'}, w.root)!.outcome, 'returned');
  } finally {w.cleanup();}
});
test('feed handles incomplete and corrupt records without mixing sessions', () => {
  const w = workspace();
  try {
    const one = normalizeHook(payload(w.root), w.root)!;
    const two = normalizeHook(payload(w.root, {session_id: 'another-session'}), w.root)!;
    appendEvent(w.root, one); appendEvent(w.root, two);
    appendFileSync(eventFile(w.root), 'not-json\n{"incomplete"');
    const feed = readFeed(w.root);
    assert.equal(feed.events.length, 2);
    assert.notEqual(feed.events[0]!.session, feed.events[1]!.session);
    assert.match(feed.warning, /1 unreadable/);
    assert.equal(feed.full, false);
  } finally {w.cleanup();}
});
test('linked data directories cannot redirect event writes', () => {
  const w = workspace(); const other = workspace();
  try {
    symlinkSync(other.root, path.join(w.root, '.relay'));
    assert.throws(() => appendEvent(w.root, normalizeHook(payload(w.root), w.root)!), /symlink/);
    assert.match(readFeed(w.root).warning, /Cannot read/);
  } finally {w.cleanup(); other.cleanup();}
});
test('compiled connector preserves other hooks, is idempotent, and disconnects only Relay', () => {
  const w = workspace();
  const cli = path.resolve('dist/cli.js');
  try {
    mkdirSync(path.join(w.root, '.codex'));
    const file = path.join(w.root, '.codex', 'hooks.json');
    const original = {description: 'User config', hooks: {Stop: [{hooks: [{type: 'command', command: 'my-original-hook'}]}]}};
    writeFileSync(file, JSON.stringify(original));
    const run = (command: string) => execFileSync(process.execPath, [cli, command, `--project=${w.root}`], {encoding: 'utf8'});
    const preview = execFileSync(process.execPath, [cli, 'connect', '--preview', `--project=${w.root}`], {encoding: 'utf8'});
    assert.match(preview, /Relay: record local activity/);
    assert.equal(readFileSync(file, 'utf8'), JSON.stringify(original));
    assert.match(run('connect'), /review and trust/);
    const connected = readFileSync(file, 'utf8');
    assert.match(connected, /my-original-hook/);
    run('connect');
    assert.equal(readFileSync(file, 'utf8'), connected);
    run('disconnect');
    assert.deepEqual(JSON.parse(readFileSync(file, 'utf8')), original);
  } finally {w.cleanup();}
});
test('hook commands quote project paths and do not evaluate shell characters', () => {
  const w = workspace();
  try {
    const project = path.join(w.root, "project ' $(touch unexpected-file)");
    mkdirSync(project);
    execFileSync(process.execPath, [path.resolve('dist/cli.js'), 'connect', `--project=${project}`]);
    const config = JSON.parse(readFileSync(path.join(project, '.codex/hooks.json'), 'utf8'));
    const output = execFileSync('/bin/sh', ['-c', config.hooks.Stop[0].hooks[0].command], {
      input: JSON.stringify(payload(project, {hook_event_name: 'Stop'})),
      encoding: 'utf8', cwd: w.root,
    });
    assert.deepEqual(JSON.parse(output), {});
    assert.equal(readFeed(project).events.length, 1);
    assert.equal(existsSync(path.join(w.root, 'unexpected-file')), false);
  } finally {w.cleanup();}
});
test('compiled hook writes real-format input and returns no approval decision', () => {
  const w = workspace();
  const hook = path.resolve('dist/hook.js');
  try {
    for (const type of ['UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'PermissionRequest', 'Stop']) {
      const output = execFileSync(process.execPath, [hook, w.root], {
        input: JSON.stringify(payload(w.root, {hook_event_name: type})), encoding: 'utf8',
      });
      assert.deepEqual(JSON.parse(output), {});
    }
    assert.equal(readFeed(w.root).events.length, 5);
    assert.doesNotMatch(readFileSync(eventFile(w.root), 'utf8'), /secret-token|private prompt/);
    assert.deepEqual(JSON.parse(execFileSync(process.execPath, [hook, w.root], {
      input: 'bad-json', encoding: 'utf8',
    })), {});
  } finally {w.cleanup();}
});
