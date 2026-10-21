import {useEffect, useReducer, useState} from 'react';
import {Box, useApp, useInput, useWindowSize} from 'ink';
import {initialState, phrase, reducer, request, visibleEvents} from './model.js';
import type {State, TaskStatus, View} from './model.js';

import {Text, ThemeProvider, useTheme, nextTheme} from './theme.js';
import type {ThemeName} from './theme.js';
const statusLabels: Record<TaskStatus, string> = {
  done: '[done]', waiting: '[wait]', queued: '[next]', running: '[work]', stopped: '[stop]',
};

const runLabels = {
  waiting: 'WAITING FOR YOU', running: 'SIMULATION RUNNING',
  ready: 'READY FOR CODE REVIEW', stopped: 'STOPPED BY YOU',
};

function Overview({state, wide}: {state: State; wide: boolean}) {
  const theme = useTheme();
  const selected = state.tasks[state.taskIndex]!;
  const completed = state.tasks.filter(t => t.status === 'done').length;
  return <Box flexDirection="column">
    <Text bold>Welcome back. Here is what changed in 30 minutes.</Text>
    <Text><Text color={theme.success}>{completed}/5 tasks done</Text>   2 failed attempts / 2 retries / recovered</Text>
    <Text color={theme.warning}>{state.run === 'waiting'
      ? 'Now: integration paused. Next: review request A-17 [3].'
      : state.run === 'stopped' ? 'Now: stopped. Baseline preserved. No further work scheduled.'
      : state.run === 'ready' ? 'Now: your code review. Nothing committed or deployed.'
      : 'Now: simulating the approved action. Next: review handoff.'}</Text>
    <Box marginTop={1} flexDirection={wide ? 'row' : 'column'}>
      <Box flexDirection="column" width={wide ? '50%' : '100%'}>
        <Text dimColor>{'TASK'.padEnd(37)}TIME</Text>
        {state.tasks.map((task, i) => <Text key={task.id} wrap="truncate-end">
          <Text color={i === state.taskIndex ? theme.accent : undefined}>{i === state.taskIndex ? '> ' : '  '}</Text>
          <Text color={task.status === 'done' ? theme.success : task.status === 'stopped' ? theme.danger : task.status === 'queued' ? theme.muted : theme.warning}>{statusLabels[task.status]}</Text>
          {' '}{task.title.padEnd(27)} <Text dimColor>{task.duration}</Text>
        </Text>)}
      </Box>
      <Box flexDirection="column" width={wide ? '50%' : '100%'} paddingLeft={wide ? 2 : 0} marginTop={wide ? 0 : 1}>
        <Text color={theme.accent} bold>{wide ? 'SELECTED TASK' : selected.title}</Text>
        <Text>{selected.detail}</Text>
        {wide && <><Text> </Text><Text dimColor>EVIDENCE / SCOPE</Text><Text>{selected.evidence}</Text></>}
      </Box>
    </Box>
  </Box>;
}

function Timeline({state, rows}: {state: State; rows: number}) {
  const theme = useTheme();
  const events = visibleEvents(state);
  const count = Math.min(events.length, Math.max(4, rows - 17));
  const start = Math.max(0, Math.min(state.eventIndex - Math.floor(count / 2), events.length - count));
  const selected = events[state.eventIndex]!;
  return <Box flexDirection="column">
    <Text bold>Activity timeline <Text dimColor>/ newest first / scenario time</Text></Text>
    <Text color={theme.accent}>{state.failuresOnly ? 'FILTER: failures + recovery' : 'FILTER: all activity'} <Text dimColor> [f] change · {state.eventIndex + 1}/{events.length}</Text></Text>
    <Box flexDirection="column" marginTop={1}>
      {events.slice(start, start + count).map(e => <Text key={e.id} wrap="truncate-end">
        <Text color={e.id === selected.id ? theme.accent : undefined}>{e.id === selected.id ? '> ' : '  '}</Text>
        <Text dimColor>{e.time}</Text>{' '}
        <Text color={e.kind === 'failure' ? theme.danger : e.kind === 'success' ? theme.success : e.kind === 'approval' ? theme.warning : undefined}>
          {e.kind.toUpperCase().padEnd(8)}
        </Text>{' '}{e.title}
      </Text>)}
    </Box>
    <Box marginTop={1} flexDirection="column">
      <Text color={theme.accent} bold wrap="truncate-end">{selected.title}</Text>
      <Text>{selected.detail}</Text>
    </Box>
  </Box>;
}

function Approval({state}: {state: State}) {
  const theme = useTheme();
  return <Box flexDirection="column">
    <Text bold color={state.approval === 'pending' ? theme.warning : theme.accent}>A-17 / {state.approval.toUpperCase()} / {request.title}</Text>
    <Text>Why: expiry handling now clears the stale session cookie.</Text>
    <Text color={theme.warning}>Risk: updating a baseline can hide a regression.</Text>
    <Text> </Text>
    <Text>Run:   {request.run}   |   Scope: once, one file</Text>
    <Text>Cmd:   {request.command}</Text>
    <Text>File:  {request.file}</Text>
    <Text dimColor>Proposed diff (fixture):</Text>
    <Text>   status: 401</Text>
    <Text color={theme.danger}>-  headers: {'{}'}</Text>
    <Text color={theme.success}>+  headers: {'{ "set-cookie": "session=; Max-Age=0" }'}</Text>
    <Text> </Text>
    <Text>{state.approval === 'pending'
      ? <><Text color={theme.accent}>[a] Review approval</Text>   [d] Review denial   [Esc] Back</>
      : state.approval === 'approved' ? 'Approved once. Follow simulated progress in [1] or [2].'
      : 'Denied. Baseline preserved; run stopped. [r] Restart demo'}</Text>
    <Text dimColor>Simulation only. No command execution or file changes.</Text>
  </Box>;
}

function Confirmation({state}: {state: State}) {
  const theme = useTheme();
  const dialog = state.dialog!;
  const resetting = dialog.kind === 'reset';
  return <Box flexDirection="column">
    <Text bold color={theme.warning}>{resetting ? 'RESTART THE DEMO' : `CONFIRM ${dialog.kind.toUpperCase()} / ${request.id}`}</Text>
    <Text> </Text>
    <Text>{resetting ? 'This clears this session’s decisions and returns to 09:30.'
      : dialog.kind === 'approve' ? 'Authorize this one simulated snapshot update.'
      : 'Reject the update. Keep the baseline and stop the run.'}</Text>
    {!resetting && <><Text>Run: {request.run} / one invocation / one file</Text>
      <Text>{request.command}</Text><Text>{request.file}</Text></>}
    <Text> </Text>
    <Text>Type <Text bold color={theme.accent}>{phrase(state)}</Text>, then press Enter.</Text>
    <Text color={theme.accent}>&gt; {dialog.text}<Text inverse> </Text></Text>
    <Text color={theme.danger}>{dialog.error || ' '}</Text>
    <Text>[Esc] Cancel without changing the decision</Text>
    <Text dimColor>Nothing executes. This records an in-memory demo decision.</Text>
  </Box>;
}

function Help() {
  const theme = useTheme();
  return <Box flexDirection="column">
    <Text bold color={theme.accent}>KEYBOARD GUIDE</Text>
    <Text> </Text>
    <Text>1 / 2 / 3       Overview / timeline / approval</Text>
    <Text>Tab / Shift+Tab Next / previous view</Text>
    <Text>Up / Down, j/k  Select task or event</Text>
    <Text>Enter           Open A-17 from its task or timeline event</Text>
    <Text>f               Toggle timeline failures + recovery</Text>
    <Text>a / d           Review approve / deny, in approval view</Text>
    <Text>Escape          Cancel dialog / close help / overview</Text>
    <Text>r               Restart demo, with confirmation</Text>
    <Text>t               Switch theme (Terminal / Ocean / Orchid)</Text>
    <Text>?               Toggle this guide</Text>
    <Text>q / Ctrl+C      Quit (decisions are not saved)</Text>
    <Text> </Text>
    <Text dimColor>All timestamps and agent results are fictional. [Esc] Close</Text>
  </Box>;
}

interface DashboardProps {state: State; columns: number; rows: number; theme?: ThemeName}
export function Dashboard({theme = 'terminal', ...props}: DashboardProps) {
  return <ThemeProvider name={theme}><DashboardContent {...props}/></ThemeProvider>;
}
function DashboardContent({state, columns, rows}: DashboardProps) {
  const theme = useTheme();
  if (columns < 72 || rows < 24) return <Box flexDirection="column">
    <Text bold color={theme.warning}>RELAY / SIMULATION</Text>
    <Text>Resize to at least 72 columns x 24 rows.</Text>
    <Text>Current: {columns} x {rows}. Decisions are disabled.</Text>
    <Text>[q] Quit</Text>
  </Box>;
  return <Box flexDirection="column" width={Math.min(columns, 132)} backgroundColor={theme.background}>
    <Box justifyContent="space-between">
      <Text><Text bold color={theme.accent}>RELAY</Text> / agent activity · {theme.name}</Text>
      <Text color={theme.warning}>SIMULATION · RUN-042</Text>
    </Box>
    <Text wrap="truncate-end">account-api / session expiry <Text dimColor>· away 09:00–09:30 · 30m</Text></Text>
    <Box marginTop={1} justifyContent="space-between">
      <Text>{(['overview', 'timeline', 'approval'] as View[]).map((view, i) =>
        <Text key={view} color={state.view === view ? theme.accent : undefined} bold={state.view === view}>
          {state.view === view ? '[' : ' '}{i + 1} {view}{state.view === view ? ']' : ' '}{'  '}
        </Text>)}</Text>
      <Text color={state.run === 'ready' ? theme.success : theme.warning}>{runLabels[state.run]}</Text>
    </Box>
    <Box borderStyle="round" borderColor={state.dialog ? theme.warning : theme.border}
      paddingX={1} flexDirection="column" height={rows - 7} overflow="hidden">
      {state.dialog ? <Confirmation state={state}/> : state.help ? <Help/>
        : state.view === 'overview' ? <Overview state={state} wide={columns >= 108}/>
        : state.view === 'timeline' ? <Timeline state={state} rows={rows}/>
        : <Approval state={state}/>}
    </Box>
    <Text dimColor wrap="truncate-end">{state.dialog ? 'Exact phrase + Enter to confirm · Esc cancels'
      : state.help ? 'Esc close · q quit'
      : 'Tab views · ↑↓/jk · Enter inspect · t theme · ? help · q quit'}</Text>
  </Box>;
}

export function App({seed, tickMs = 1600, size, theme: initialTheme = 'terminal'}: {seed?: State; tickMs?: number; size?: {columns: number; rows: number}; theme?: ThemeName}) {
  const [theme, setTheme] = useState(initialTheme);
  const [state, dispatch] = useReducer(reducer, seed ?? initialState());
  const {exit} = useApp();
  const terminal = useWindowSize();
  useEffect(() => {
    if (state.run !== 'running') return;
    const timer = setInterval(() => dispatch({type: 'tick'}), tickMs);
    return () => clearInterval(timer);
  }, [state.run, tickMs]);
  const dimensions = size ?? terminal;
  useInput((input, key) => {
    if (key.ctrl && input === 'c') {exit(); return;}
    if (dimensions.columns < 72 || dimensions.rows < 24) {
      if (input === 'q') exit();
      return;
    }
    if (state.dialog) {
      if (key.escape) dispatch({type: 'cancel'});
      else if (key.return) dispatch({type: 'confirm'});
      else if (key.backspace || key.delete) dispatch({type: 'backspace'});
      else if (!key.ctrl && !key.meta) dispatch({type: 'text', text: input});
      return;
    }
    if (input === 'q') {exit(); return;}
    if (input === 't') {setTheme(nextTheme); return;}
    if (key.escape) {
      dispatch(state.help ? {type: 'cancel'} : {type: 'view', view: 'overview'});
      return;
    }
    if (input === '?') {dispatch({type: 'help'}); return;}
    if (state.help) return;
    if (key.tab) {
      const views: View[] = ['overview', 'timeline', 'approval'];
      dispatch({type: 'view', view: views[(views.indexOf(state.view) + (key.shift ? 2 : 1)) % 3]!});
    } else if (['1', '2', '3'].includes(input)) {
      dispatch({type: 'view', view: (['overview', 'timeline', 'approval'] as View[])[Number(input) - 1]!});
    } else if (key.upArrow || input === 'k') dispatch({type: 'move', delta: -1});
    else if (key.downArrow || input === 'j') dispatch({type: 'move', delta: 1});
    else if (input === 'f') dispatch({type: 'filter'});
    else if (input === 'r') dispatch({type: 'open', kind: 'reset'});
    else if (input === 'a' || input === 'd') dispatch({type: 'open', kind: input === 'a' ? 'approve' : 'deny'});
    else if (key.return && (
      (state.view === 'overview' && state.tasks[state.taskIndex]?.id === 'integration') ||
      (state.view === 'timeline' && visibleEvents(state)[state.eventIndex]?.kind === 'approval')
    )) dispatch({type: 'view', view: 'approval'});
  });
  return <Dashboard state={state} {...dimensions} theme={theme}/>;
}
