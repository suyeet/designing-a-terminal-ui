import assert from 'node:assert/strict';
import {execFileSync, spawnSync} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';

// Exercise the artifact users actually install, outside the source checkout.
// Offline mode uses the cache populated by npm ci; no registry publication.
const temp = mkdtempSync(path.join(tmpdir(), 'relay-package-'));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
try {
  const result = execFileSync(npm, [
    'pack', '--ignore-scripts', '--json', '--pack-destination', temp,
  ], {encoding: 'utf8'});
  const [packed] = JSON.parse(result);
  const files = packed.files.map(file => file.path);
  assert.ok(files.includes('dist/cli.js'), 'Compiled CLI is included');
  assert.ok(files.includes('LICENSE'), 'License is included');
  assert.ok(!files.some(file => /^(src|tests|node_modules)\//.test(file)), 'Only runtime files are packed');

  const prefix = path.join(temp, 'install');
  execFileSync(npm, [
    'install', '--prefix', prefix, '--offline', '--ignore-scripts', '--no-audit', '--no-fund',
    path.join(temp, packed.filename),
  ], {stdio: 'pipe'});
  const installed = path.join(prefix, 'node_modules', 'relay-agent-monitor');
  const manifest = JSON.parse(readFileSync(path.join(installed, 'package.json'), 'utf8'));
  assert.equal(manifest.bin.relay, 'dist/cli.js');
  const bin = path.join(prefix, 'node_modules', '.bin', 'relay');
  const run = args => execFileSync(bin, args, {
    encoding: 'utf8', cwd: temp, env: {...process.env, NO_COLOR: '1'}, timeout: 15000,
  });
  assert.equal(run(['--version']).trim(), `relay ${manifest.version}`);
  assert.match(run(['--help']), /relay --demo/);
  assert.match(run(['--demo', '--snapshot']), /Welcome back/);
  for (const theme of ['terminal', 'ocean', 'orchid']) {
    const snapshot = run(['--demo', '--snapshot', `--theme=${theme}`]);
    assert.ok(snapshot.toLowerCase().includes(`agent activity · ${theme}`));
    assert.ok(!snapshot.includes('\u001b['), 'NO_COLOR suppresses theme escape codes');
    assert.ok(run(['--live', '--snapshot', `--theme=${theme}`]).toLowerCase().includes(`local feed · ${theme}`));
  }
  const badTheme = spawnSync(bin, ['--theme=unknown', '--snapshot'], {encoding: 'utf8', cwd: temp});
  assert.equal(badTheme.status, 1);
  assert.match(badTheme.stderr, /Choose one theme/);
  assert.match(run(['--snapshot', '--view=approval']), /Proposed diff/);
  assert.match(run([]), /Static preview/);
  assert.match(run(['connect', `--project=${temp}`]), /review and trust/);
  const hook = path.join(installed, 'dist', 'hook.js');
  const hookOutput = execFileSync(process.execPath, [hook, temp], {
    input: JSON.stringify({session_id: 'package-smoke-fixture', cwd: temp, hook_event_name: 'UserPromptSubmit'}),
    encoding: 'utf8',
  });
  assert.deepEqual(JSON.parse(hookOutput), {});
  assert.match(run(['--live', '--snapshot', `--project=${temp}`]), /New turn started/);
  assert.match(run(['disconnect', `--project=${temp}`]), /Removed Relay hooks/);
  const bad = spawnSync(bin, ['--not-a-real-option'], {encoding: 'utf8', cwd: temp, timeout: 15000});
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /Unknown option/);
  console.log('Package smoke check passed: packed, installed offline, and ran the relay command outside the project.');
} finally {
  rmSync(temp, {recursive: true, force: true});
}
