#!/usr/bin/env node
import {render, renderToString} from 'ink';
import {App, Dashboard} from './App.js';
import {initialState, reducer} from './model.js';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {LiveApp, LiveDashboard} from './LiveApp.js';
import {readFeed} from './codex-events.js';
import {configureProject} from './connect.js';
import {isThemeName} from './theme.js';

const args = process.argv.slice(2);
const projectArg = args.find(a => a.startsWith('--project='));
const project = path.resolve(projectArg?.slice('--project='.length) || process.cwd());
const themeArg = args.find(a => a.startsWith('--theme='))?.slice('--theme='.length) ?? 'terminal';
const theme = isThemeName(themeArg) ? themeArg : 'terminal';
const allowed = ['--snapshot', '--demo', '--live', '--help', '--version', '--view=overview', '--view=timeline', '--view=approval'];
if (['connect', 'disconnect'].includes(args[0] ?? '') &&
  args.slice(1).every(a => a.startsWith('--project=') || a === '--preview') &&
  args.filter(a => a.startsWith('--project=')).length <= 1) {
  try {
    const disconnected = args[0] === 'disconnect';
    const result = configureProject(project, disconnected, args.includes('--preview'));
    if (result.configuration) console.log(result.configuration);
    else {
      console.log(`${disconnected ? 'Removed Relay hooks' : 'Configured Relay hooks'} for ${result.project}`);
      if (result.backup) console.log(`Previous configuration saved to ${result.backup}`);
      if (!disconnected) console.log('Next: review and trust these hooks in Codex, then start/resume a local chat in this project.\nRun relay --live in this folder to watch. Connection is unverified until an event arrives.');
    }
  } catch (error) {
    console.error((error as Error).message); process.exitCode = 1;
  }
} else if (!isThemeName(themeArg) || args.filter(a => a.startsWith('--theme=')).length > 1) {
  console.error('Choose one theme: --theme=terminal, --theme=ocean, or --theme=orchid.');
  process.exitCode = 1;
} else if (args.some(arg => !allowed.includes(arg) && !arg.startsWith('--project=') && !arg.startsWith('--theme=')) ||
  (args.includes('--live') && (args.includes('--demo') || args.some(a => a.startsWith('--view=')))) ||
  args.filter(a => a.startsWith('--project=')).length > 1) {
  console.error('Unknown option. Use --help.');
  process.exitCode = 1;
} else if (args.includes('--version')) {
  const {version} = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {version: string};
  console.log(`relay ${version}`);
} else if (args.includes('--help')) {
  console.log(`RELAY — coding agent activity monitor

relay                               Interactive demo (72×24 minimum)
relay --demo                        Explicitly launch the simulated scenario
relay connect                       Add project-local Codex observation hooks
relay connect --preview             Print proposed hook config without changing it
relay disconnect                    Remove only Relay hooks; retain local history
relay --live                        Watch real hook events (read only)
relay --live --project=/path         Watch a different project folder
relay --live --theme=ocean           Ocean colors (also: terminal, orchid)
relay --snapshot                    Static 100×26 overview, no input needed
relay --snapshot --view=approval    Static approval preview
relay --help                        Show this guide
relay --version                     Show the installed version

From source: npm start -- [options]

Use 1/2/3 or Tab to navigate; ? for all keys. t switches theme; q quits.
Themes last for this launch. Use --theme to select one on startup.
Demo activity is fictional. Live mode reads project-local metadata only.
Live decisions stay in Codex. Hooks require review and trust in Codex.
Node.js 22 or later required.`);
} else if (args.includes('--live')) {
  if (args.includes('--snapshot') || !process.stdin.isTTY || !process.stdout.isTTY) {
    console.log(renderToString(<LiveDashboard theme={theme} project={project} feed={readFeed(project)} index={0}/>, {columns: 100}));
  } else {
    await render(<LiveApp theme={theme} project={project}/>).waitUntilExit();
  }
} else {
  const view = args.find(a => a.startsWith('--view='))?.split('=')[1] as 'overview' | 'timeline' | 'approval' | undefined;
  const seed = view ? reducer(initialState(), {type: 'view', view}) : initialState();
  if (args.includes('--snapshot') || !process.stdin.isTTY || !process.stdout.isTTY) {
    console.log(renderToString(<Dashboard theme={theme} state={seed} columns={100} rows={26}/>, {columns: 100}));
    if (!args.includes('--snapshot')) console.log('Static preview: run relay (or npm start from source) in a terminal for keyboard controls.');
  } else {
    const instance = render(<App seed={seed} theme={theme}/>);
    await instance.waitUntilExit();
  }
}
