import {useEffect, useState} from 'react';
import {Box, useApp, useInput, useWindowSize} from 'ink';
import path from 'node:path';
import {connectionSummary, eventTitle, readFeed} from './codex-events.js';
import type {Feed} from './codex-events.js';
import {summarizeTurn} from './live-summary.js';

import {Text, ThemeProvider, useTheme, nextTheme} from './theme.js';
import type {ThemeName} from './theme.js';

const display = (value: string) => value.replace(/[\x00-\x1f\x7f-\x9f\u202a-\u202e\u2066-\u2069]/g, '');
interface LiveDashboardProps {
  project: string; feed: Feed; session?: string; index: number; columns?: number; rows?: number; theme?: ThemeName;
}
export function LiveDashboard({theme = 'terminal', ...props}: LiveDashboardProps) {
  return <ThemeProvider name={theme}><LiveDashboardContent {...props}/></ThemeProvider>;
}
function LiveDashboardContent({project, feed, session, index, columns = 100, rows = 26}: LiveDashboardProps) {
  const theme = useTheme();
  const sessions = [...new Set(feed.events.map(e => e.session))];
  const selectedSession = session ?? sessions.at(-1);
  const events = feed.events.filter(e => e.session === selectedSession).slice().reverse();
  const latest = events[0];
  const selected = events[Math.min(index, Math.max(0, events.length - 1))];
  const summary = summarizeTurn(feed.events, selectedSession ?? '');
  const count = Math.max(2, rows - 21);
  const start = Math.max(0, Math.min(index - Math.floor(count / 2), events.length - count));
  const age = latest ? Math.max(0, Math.floor((Date.now() - Date.parse(latest.at)) / 1000)) : 0;
  if (columns < 72 || rows < 24) return <Text>RELAY / CODEX FEED — resize to 72×24. [q] Quit</Text>;
  return <Box flexDirection="column" width={Math.min(columns, 132)} backgroundColor={theme.background}>
    <Box justifyContent="space-between">
      <Text bold color={theme.accent}>RELAY / Codex activity</Text>
      <Text color={theme.warning}>READ ONLY · LOCAL FEED · {theme.name}</Text>
    </Box>
    <Text wrap="truncate-end">{display(path.basename(project))} · {sessions.length} observed sessions · {selectedSession?.slice(0, 8) ?? 'no session yet'}</Text>
    <Text color={theme.warning} wrap="truncate-end">{latest ? `Last observed: ${eventTitle(latest)}` : 'WAITING FOR FIRST CODEX EVENT'}</Text>
    <Text dimColor>{latest ? `Received ${age}s ago. A quiet feed does not prove the agent is idle.` : 'A configured hook is not a verified connection.'}</Text>
    <Box borderStyle="round" borderColor={theme.border} paddingX={1} height={rows - 6} flexDirection="column" overflow="hidden">
      {!latest ? <>
        <Text bold>Keep using your connected Codex session. Relay listens here.</Text>
        <Text> </Text>
        <Text>{connectionSummary(project)}</Text>
        <Text>Review and trust the project hooks in Codex.</Text>
        <Text>Then start or resume a local chat in this project.</Text>
        <Text>Ask Codex to inspect a file to generate activity.</Text>
        <Text> </Text>
        <Text dimColor>No transcript, prompt, code, or command content is stored.</Text>
        <Text dimColor>Past activity cannot be recovered by this connector.</Text>
      </> : <>
        <Text bold color={theme.accent}>{summary.hasTurnStart ? 'LATEST TURN' : 'RECENT ACTIVITY'} <Text dimColor>/ observed records only</Text></Text>
        <Text>Tools: {summary.toolStarts} started · {summary.toolReturns} returned</Text>
        <Text color={summary.failures ? theme.danger : undefined}>Reported failures: {summary.failures} · results unverified</Text>
        <Text color={summary.approvalRequests ? theme.warning : undefined}>{summary.approvalRequests
          ? `${summary.approvalRequests} approval request${summary.approvalRequests === 1 ? '' : 's'} observed; check status in Codex.`
          : 'No approval requests observed in this summary.'}</Text>
        <Text> </Text>
        <Text bold>OBSERVED ACTIVITY <Text dimColor>/ newest received first</Text></Text>
        <Text dimColor>{events.length} recent records · [{Math.min(index + 1, events.length)}/{events.length}]</Text>
        {events.slice(start, start + count).map(e => <Text key={e.id} wrap="truncate-end">
          <Text color={e.id === selected?.id ? theme.accent : undefined}>{e.id === selected?.id ? '> ' : '  '}</Text>
          <Text dimColor>{new Date(e.at).toLocaleTimeString([], {hour12: false})}</Text>{' '}
          <Text color={e.outcome === 'failed' ? theme.danger : e.type === 'PermissionRequest' ? theme.warning : undefined}>
            {eventTitle(e)}
          </Text>
        </Text>)}
        <Text> </Text>
        <Text color={theme.accent}>{selected?.type} · {selected ? new Date(selected.at).toLocaleString() : ''}</Text>
        <Text>{selected?.type === 'PermissionRequest'
          ? 'Resolve this in Codex. Relay cannot confirm whether it is still pending.'
          : selected?.type === 'Stop'
          ? 'A turn stopped. This does not prove the task is complete or tests passed.'
          : selected?.type === 'PostToolUse'
          ? 'Tool output was observed. Only explicit error metadata is labeled a failure.'
          : 'Metadata received from a project hook. Content stays in Codex.'}</Text>
      </>}
      {feed.warning && <Text color={theme.danger}>{feed.warning}</Text>}
      {feed.full && <Text color={theme.danger}>Feed full (8 MiB). Archive .relay/events.jsonl to resume recording.</Text>}
    </Box>
    <Text dimColor wrap="truncate-end">↑↓/jk · [ ] sessions · t theme · q quit · Approvals stay in Codex</Text>
  </Box>;
}

export function LiveApp({project, pollMs = 1000, size, theme: initialTheme = 'terminal'}: {
  project: string; pollMs?: number; size?: {columns: number; rows: number}; theme?: ThemeName;
}) {
  const [theme, setTheme] = useState(initialTheme);
  const [feed, setFeed] = useState(() => readFeed(project));
  const [session, setSession] = useState<string>();
  const [selectedId, setSelectedId] = useState<string>();
  const {exit} = useApp();
  const dimensions = useWindowSize();
  useEffect(() => {
    const timer = setInterval(() => setFeed(readFeed(project)), pollMs);
    return () => clearInterval(timer);
  }, [project, pollMs]);
  useEffect(() => {
    if (!session && feed.events.length) setSession(feed.events.at(-1)!.session);
  }, [feed, session]);
  const sessions = [...new Set(feed.events.map(e => e.session))];
  const active = session ?? sessions.at(-1);
  const events = feed.events.filter(e => e.session === active).slice().reverse();
  const index = Math.max(0, events.findIndex(e => e.id === selectedId));
  useInput((input, key) => {
    if (input === 'q' || (key.ctrl && input === 'c')) {exit(); return;}
    if (input === 't') {setTheme(nextTheme); return;}
    if (input === '[' || input === ']') {
      const next = (sessions.indexOf(active!) + (input === ']' ? 1 : -1) + sessions.length) % sessions.length;
      setSession(sessions[next]); setSelectedId(undefined);
    } else if (input === 'g') setSelectedId(undefined);
    else if (key.upArrow || input === 'k') setSelectedId(events[Math.max(0, index - 1)]?.id);
    else if (key.downArrow || input === 'j') setSelectedId(events[Math.min(events.length - 1, index + 1)]?.id);
  });
  return <LiveDashboard theme={theme} project={project} feed={feed} session={active} index={index} {...(size ?? dimensions)}/>;
}
