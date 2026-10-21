import {createHash, randomUUID} from 'node:crypto';
import {appendFileSync, closeSync, constants, existsSync, fstatSync, lstatSync, mkdirSync, openSync, readSync, realpathSync, statSync} from 'node:fs';
import path from 'node:path';

export const hookEvents = ['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse',
  'PermissionRequest', 'Stop', 'Interrupt', 'SessionEnd'] as const;
export type HookEvent = typeof hookEvents[number];
export interface ObservedEvent {
  version: 1;
  id: string;
  at: string;
  session: string;
  type: HookEvent;
  tool?: string;
  outcome?: 'failed' | 'returned';
}
export const maxLogBytes = 8 * 1024 * 1024;
export const eventFile = (project: string) => path.join(project, '.relay', 'events.jsonl');
const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const label = (value: unknown) => typeof value === 'string'
  ? value.replace(/[^a-zA-Z0-9_.:-]/g, '').slice(0, 100) : '';

// Keep metadata only. Never retain prompt, transcript path, command, arguments,
// file contents, assistant messages, or raw tool output.
export function normalizeHook(input: unknown, project: string, now = new Date()): ObservedEvent | null {
  const value = record(input);
  if (!hookEvents.includes(value.hook_event_name as HookEvent) ||
    typeof value.session_id !== 'string' || !value.session_id || typeof value.cwd !== 'string') return null;
  const root = realpathSync(project);
  let cwd: string;
  try {cwd = realpathSync(value.cwd);} catch {return null;}
  if (cwd !== root && !cwd.startsWith(root + path.sep)) return null;
  const item: ObservedEvent = {
    version: 1, id: randomUUID(), at: now.toISOString(),
    session: createHash('sha256').update(value.session_id).digest('hex').slice(0, 16),
    type: value.hook_event_name as HookEvent,
  };
  if (['PreToolUse', 'PostToolUse', 'PermissionRequest'].includes(item.type)) {
    item.tool = label(value.tool_name) || 'unknown';
  }
  if (item.type === 'PostToolUse') {
    const response = record(value.tool_response);
    item.outcome = response.isError === true ||
      (typeof response.exit_code === 'number' && response.exit_code !== 0) ? 'failed' : 'returned';
  }
  return item;
}

export function appendEvent(project: string, item: ObservedEvent): void {
  const folder = path.join(project, '.relay');
  if (existsSync(folder) && lstatSync(folder).isSymbolicLink()) throw new Error('Relay data directory must not be a symlink.');
  mkdirSync(folder, {recursive: true, mode: 0o700});
  const fd = openSync(eventFile(project), constants.O_WRONLY | constants.O_CREAT | constants.O_APPEND | constants.O_NOFOLLOW, 0o600);
  try {
    if (fstatSync(fd).size >= maxLogBytes) return;
    // A single small O_APPEND write avoids interleaving concurrent hook records.
    appendFileSync(fd, JSON.stringify(item) + '\n');
  } finally {closeSync(fd);}
}

function isEvent(value: unknown): value is ObservedEvent {
  const e = record(value);
  return e.version === 1 && typeof e.id === 'string' && /^[a-f0-9-]{36}$/.test(e.id) &&
    typeof e.at === 'string' && Number.isFinite(Date.parse(e.at)) &&
    typeof e.session === 'string' && /^[a-f0-9]{16}$/.test(e.session) &&
    hookEvents.includes(e.type as HookEvent) &&
    (e.tool === undefined || (typeof e.tool === 'string' && e.tool.length <= 100 && e.tool === label(e.tool))) &&
    (e.outcome === undefined || e.outcome === 'failed' || e.outcome === 'returned');
}
export interface Feed {events: ObservedEvent[]; warning: string; full: boolean}
export function readFeed(project: string): Feed {
  let fd: number | undefined;
  try {
    const folder = path.join(project, '.relay');
    if (lstatSync(folder).isSymbolicLink()) throw new Error('Refusing a linked data directory');
    fd = openSync(eventFile(project), constants.O_RDONLY | constants.O_NOFOLLOW);
    const size = fstatSync(fd).size;
    const start = Math.max(0, size - 512 * 1024);
    const buffer = Buffer.alloc(size - start);
    const read = readSync(fd, buffer, 0, buffer.length, start);
    const lines = buffer.subarray(0, read).toString('utf8').split('\n');
    if (start > 0) lines.shift();
    lines.pop(); // An incomplete final record waits for the next poll.
    let skipped = 0;
    const events: ObservedEvent[] = [];
    for (const line of lines) {
      try {
        const parsed: unknown = JSON.parse(line);
        if (isEvent(parsed)) events.push(parsed);
        else skipped++;
      } catch {skipped++;}
    }
    return {events: events.slice(-500), warning: skipped ? `${skipped} unreadable records skipped.` : '',
      full: size >= maxLogBytes};
  } catch (error) {
    const missing = (error as NodeJS.ErrnoException).code === 'ENOENT';
    return {events: [], warning: missing ? '' : 'Cannot read the local event feed. Check access to .relay/events.jsonl.', full: false};
  } finally {if (fd !== undefined) closeSync(fd);}
}

export function eventTitle(e: ObservedEvent): string {
  switch (e.type) {
    case 'SessionStart': return 'Session opened or resumed';
    case 'UserPromptSubmit': return 'New turn started';
    case 'PreToolUse': return `Tool started: ${e.tool}`;
    case 'PostToolUse': return `${e.outcome === 'failed' ? 'Tool reported failure' : 'Tool returned'}: ${e.tool}`;
    case 'PermissionRequest': return `Approval requested in Codex: ${e.tool}`;
    case 'Stop': return 'Turn stopped; review the result in Codex';
    case 'Interrupt': return 'Turn interrupted';
    case 'SessionEnd': return 'Session ended';
  }
}

export function connectionSummary(project: string): string {
  try {
    return statSync(path.join(project, '.codex', 'hooks.json')).isFile()
      ? 'Project hook file exists. Trust and event delivery are not verified.'
      : 'No project hook file found.';
  } catch {return 'No project hook file found. Run relay connect in this project.';}
}
