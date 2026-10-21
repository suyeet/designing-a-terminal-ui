import {existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, renameSync, statSync, writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {hookEvents} from './codex-events.js';

const marker = 'Relay: record local activity';
const quote = (text: string) => "'" + text.replace(/'/g, "'\\''") + "'";
type Handler = Record<string, unknown>;
type Group = {hooks: Handler[]; [key: string]: unknown};
type Config = {hooks?: Record<string, Group[]>; [key: string]: unknown};

export function configureProject(projectPath: string, disconnect = false, preview = false): {project: string; changed: boolean; backup?: string; configuration?: string} {
  const project = realpathSync(projectPath);
  if (!statSync(project).isDirectory()) throw new Error('Choose a project directory.');
  const entry = fileURLToPath(new URL('./hook.js', import.meta.url));
  if (!disconnect && !existsSync(entry)) throw new Error('Run npm run build, then use node dist/cli.js connect.');
  const folder = path.join(project, '.codex');
  const file = path.join(folder, 'hooks.json');
  if (existsSync(folder) && lstatSync(folder).isSymbolicLink()) throw new Error('Refusing to modify a linked .codex directory.');
  if (existsSync(file) && lstatSync(file).isSymbolicLink()) throw new Error('Refusing to modify a linked hook file.');
  const previous = existsSync(file) ? readFileSync(file, 'utf8') : null;
  const config: Config = previous === null ? {} : JSON.parse(previous);
  if (!config || typeof config !== 'object' || Array.isArray(config) ||
    (config.hooks !== undefined && (typeof config.hooks !== 'object' || config.hooks === null || Array.isArray(config.hooks)))) {
    throw new Error('Existing hook configuration is invalid; it was left unchanged.');
  }
  const hooks = {...config.hooks};
  for (const event of hookEvents) {
    const groups = hooks[event] ?? [];
    if (!Array.isArray(groups) || groups.some(g => !g || !Array.isArray(g.hooks))) {
      throw new Error(`Existing ${event} configuration is invalid; it was left unchanged.`);
    }
    const kept = groups.flatMap(g => {
      const filtered = g.hooks.filter(h => h?.statusMessage !== marker);
      return g.hooks.length > 0 && filtered.length === 0 ? [] : [{...g, hooks: filtered}];
    });
    if (!disconnect) kept.push({hooks: [{
      type: 'command', command: `${quote(process.execPath)} ${quote(entry)} ${quote(project)}`,
      timeout: 3, statusMessage: marker,
    }]});
    if (kept.length) hooks[event] = kept;
    else delete hooks[event];
  }
  const next = {...config, hooks};
  if (preview) return {project, changed: false, configuration: JSON.stringify(next, null, 2) + '\n'};
  if (JSON.stringify(next) === JSON.stringify(config) || (disconnect && previous === null)) {
    return {project, changed: false};
  }
  mkdirSync(folder, {recursive: true});
  const backup = previous === null ? undefined : `${file}.relay-backup-${randomUUID()}`;
  if (backup) writeFileSync(backup, previous!, {flag: 'wx', mode: 0o600});
  const temporary = `${file}.relay-${randomUUID()}.tmp`;
  writeFileSync(temporary, JSON.stringify(next, null, 2) + '\n', {flag: 'wx', mode: 0o600});
  renameSync(temporary, file);
  return {project, changed: true, backup};
}
