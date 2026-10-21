import {createContext, useContext} from 'react';
import type {ComponentProps, ReactNode} from 'react';
import {Text as InkText} from 'ink';

export const themeNames = ['terminal', 'ocean', 'orchid'] as const;
export type ThemeName = typeof themeNames[number];
interface Palette {
  name: string;
  background?: string;
  foreground?: string;
  muted: string;
  accent: string;
  success: string;
  warning: string;
  danger: string;
  border: string;
}
export const palettes: Record<ThemeName, Palette> = {
  terminal: {name: 'Terminal', muted: 'gray', accent: 'cyan', success: 'green',
    warning: 'yellow', danger: 'red', border: 'gray'},
  ocean: {name: 'Ocean', background: '#101c2c', foreground: '#e2ecf6',
    muted: '#a3b5cb', accent: '#72ddf7', success: '#8bdfb2', warning: '#f6cd7a',
    danger: '#ff9696', border: '#637e9d'},
  orchid: {name: 'Orchid', background: '#241b30', foreground: '#f2e7f8',
    muted: '#bfb0cc', accent: '#d8adff', success: '#a9dfba', warning: '#f5d38b',
    danger: '#ff9eb3', border: '#947aa8'},
};
export const isThemeName = (value: string): value is ThemeName =>
  themeNames.includes(value as ThemeName);
export const nextTheme = (name: ThemeName): ThemeName =>
  themeNames[(themeNames.indexOf(name) + 1) % themeNames.length]!;

const ThemeContext = createContext(palettes.terminal);
export const useTheme = () => useContext(ThemeContext);
export function ThemeProvider({name, children}: {name: ThemeName; children: ReactNode}) {
  return <ThemeContext.Provider value={palettes[name]}>{children}</ThemeContext.Provider>;
}

// Give every leaf text a readable foreground on an explicit dark surface.
// Terminal theme leaves base text and background to the terminal preferences.
export function Text({color, dimColor, ...props}: ComponentProps<typeof InkText>) {
  const theme = useTheme();
  return <InkText {...props}
    color={color ?? (dimColor && theme.background ? theme.muted : theme.foreground)}
    dimColor={theme.background ? false : dimColor}/>;
}
