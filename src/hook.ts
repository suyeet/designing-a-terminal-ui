#!/usr/bin/env node
import {appendEvent, normalizeHook} from './codex-events.js';

// Dedicated hook entry point: no UI, model calls, network, or approval output.
// A bounded input and deadline prevent a logging problem from delaying Codex.
const timeout = setTimeout(() => {process.stdout.write('{}\n'); process.exit(0);}, 1500);
try {
  const project = process.argv[2];
  if (!project) throw new Error('Missing project');
  let text = '';
  for await (const chunk of process.stdin) {
    text += chunk.toString();
    if (Buffer.byteLength(text) > 2 * 1024 * 1024) throw new Error('Input limit');
  }
  const item = normalizeHook(JSON.parse(text), project);
  if (item) appendEvent(project, item);
} catch {
  // Observation is best effort. Never return a blocking exit code or expose
  // potentially sensitive raw input in errors.
} finally {
  clearTimeout(timeout);
  process.stdout.write('{}\n');
}
