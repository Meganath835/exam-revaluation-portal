import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Check, Monitor, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

// Light / dark / system theme. The choice is a per-browser convenience; index.html applies it before
// the first paint so there is no flash of the wrong theme.
const KEY = 'revaluation.theme';
const ThemeContext = createContext({ theme: 'system', resolved: 'light', setTheme: () => {} });

function readStored() {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

const systemDark = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(readStored);
  const [osDark, setOsDark] = useState(systemDark);
  const resolved = theme === 'system' ? (osDark ? 'dark' : 'light') : theme;

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return undefined;
    const onChange = (e) => setOsDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', resolved === 'dark');
    root.style.colorScheme = resolved;
  }, [resolved]);

  const setTheme = useCallback((t) => {
    setThemeState(t);
    try {
      if (t === 'system') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, t);
    } catch {
      /* private mode: the choice lasts for this visit only */
    }
  }, []);

  return <ThemeContext.Provider value={{ theme, resolved, setTheme }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);

const OPTIONS = [
  ['light', 'Light', Sun],
  ['dark', 'Dark', Moon],
  ['system', 'System', Monitor],
];

/** Sun/moon button with a Light / Dark / System menu. `showLabel` adds the current choice as text. */
export function ThemeToggle({ className, variant = 'outline', showLabel = false }) {
  const { theme, resolved, setTheme } = useTheme();
  const Icon = resolved === 'dark' ? Moon : Sun;
  const current = OPTIONS.find(([value]) => value === theme)?.[1];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={showLabel ? 'default' : 'icon'} className={cn('shrink-0', className)} aria-label={`Theme: ${theme}. Change theme`}>
          <Icon />
          {showLabel && <span className="flex-1 text-left">Theme<span className="ml-1.5 opacity-60">{current}</span></span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {OPTIONS.map(([value, label, ItemIcon]) => (
          <DropdownMenuItem key={value} onSelect={() => setTheme(value)}>
            <ItemIcon className="h-4 w-4" /> {label}
            {theme === value && <Check className="ml-auto h-4 w-4" aria-label="selected" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
