import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronsUpDown, FilePlus2, FolderOpen, GraduationCap, Inbox, LogOut, Workflow } from 'lucide-react';
import { api } from '../api/client';
import { ROLE_LABEL, canViewProcess, isStudent, useAuth } from '../auth/AuthContext';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { ThemeToggle } from './theme';

function NavItem({ to, icon: Icon, children, badge }) {
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) => cn(
        'group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium no-underline transition-colors',
        isActive ? 'bg-white/10 text-white shadow-[inset_3px_0_0_#fdc80a]' : 'text-white/70 hover:bg-white/5 hover:text-white',
      )}
    >
      <Icon className="h-4 w-4 shrink-0 group-[.active]:text-gold" aria-hidden="true" />
      <span className="flex-1">{children}</span>
      {badge > 0 && <Badge className="h-5 min-w-5 justify-center rounded-full bg-pen px-1.5 text-[11px] text-pen-foreground hover:bg-pen">{badge}</Badge>}
    </NavLink>
  );
}

const initials = (name = '') => name.split(/[\s,]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

export default function Layout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const tasks = useQuery({ queryKey: ['tasks', 'mine'], queryFn: () => api('/tasks?view=mine'), refetchInterval: 5000 });
  const group = useQuery({
    queryKey: ['tasks', 'group'],
    queryFn: () => api('/tasks?view=group'),
    refetchInterval: 5000,
    enabled: (user?.groups || []).length > 0,
  });
  const open = (tasks.data?.length || 0) + (group.data?.filter((t) => !t.assignee).length || 0);

  return (
    <div className="flex flex-wrap min-h-screen bg-background">
      <aside className="flex-[1_1_240px] bg-brand-dark dark:bg-[#111111] dark:border-r dark:border-border text-white px-3 py-4 flex flex-col gap-6 md:min-h-screen md:max-w-[260px]">
        <div className="flex items-center gap-2.5 px-2">
          <div aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold text-gold-foreground shadow-sm">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-display font-semibold">Revaluation Portal</span>
            <span className="text-xs text-white/60">Office of the CoE</span>
          </div>
        </div>
        <nav aria-label="Main" className="flex flex-col gap-1">
          <span className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-white/45">Menu</span>
          {isStudent(user) ? (
            <>
              <NavItem to="/requests/new" icon={FilePlus2}>New request</NavItem>
              <NavItem to="/requests" icon={FolderOpen}>My requests</NavItem>
              <NavItem to="/tasks" icon={Inbox} badge={open}>My tasks</NavItem>
            </>
          ) : (
            <>
              <NavItem to="/tasks" icon={Inbox} badge={open}>Task inbox</NavItem>
              <NavItem to="/requests" icon={FolderOpen}>All requests</NavItem>
              {canViewProcess(user) && <NavItem to="/process" icon={Workflow}>Process view</NavItem>}
            </>
          )}
        </nav>
        <div className="mt-auto flex flex-col gap-2">
          <ThemeToggle showLabel variant="ghost" className="w-full justify-start gap-3 px-3 text-white/70 hover:bg-white/5 hover:text-white" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="flex w-full items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-2 text-left text-white transition-colors hover:bg-white/10">
                <Avatar className="h-9 w-9 rounded-md">
                  <AvatarFallback className="rounded-md bg-gold text-gold-foreground text-xs font-semibold">{initials(user.displayName)}</AvatarFallback>
                </Avatar>
                <span className="flex min-w-0 flex-1 flex-col leading-tight">
                  <span className="line-clamp-2 text-sm font-semibold leading-tight">{user.displayName}</span>
                  <span className="truncate text-xs text-white/60">{ROLE_LABEL[user.role]}</span>
                </span>
                <ChevronsUpDown className="h-4 w-4 text-white/60" aria-hidden="true" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-[--radix-dropdown-menu-trigger-width] min-w-56">
              <DropdownMenuLabel className="flex flex-col">
                <span>{user.displayName}</span>
                <span className="font-mono text-xs font-normal text-muted-foreground">{user.username}</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => { signOut(); navigate('/login'); }}>
                <LogOut className="h-4 w-4" /> Switch user
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>
      <main className="flex-[999_1_560px] min-w-0 px-4 sm:px-8 py-7 flex flex-col gap-6">
        <Outlet />
      </main>
    </div>
  );
}
