import { createFileRoute, Link, Outlet, redirect, useRouterState } from '@tanstack/react-router';
import { Activity, CalendarDays, ChevronDown, ChevronRight, ClipboardList, FileSignature, FileText, Layers, LayoutDashboard, PartyPopper, Plus, Settings2, Sparkles, UsersRound, WalletCards, X } from 'lucide-react';
import { useState } from 'react';
import { QuickActions } from '@/components/QuickActions';
import { Button } from '@/components/ui/button';
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useQuery } from '@tanstack/react-query';
import { accountQuery, professionalProfileQuery } from '@/lib/queries';

const navigation = [
  { to: '/', label: 'Visão geral', title: 'Sua clínica, em um só lugar.', icon: LayoutDashboard },
  { to: '/pacientes', label: 'Pacientes', title: 'Pacientes', icon: UsersRound },
  { to: '/agenda', label: 'Agenda', title: 'Agenda semanal', icon: CalendarDays },
  { to: '/procedimentos', label: 'Procedimentos', title: 'Procedimentos e combos', icon: Sparkles },
  { to: '/planos', label: 'Planos', title: 'Planos', icon: Layers },
  { to: '/eventos', label: 'Eventos', title: 'Eventos da clínica', icon: PartyPopper },
  { to: '/formularios-anamnese', label: 'Formulários de anamnese', title: 'Formulários de anamnese', icon: ClipboardList },
  { to: '/contratos', label: 'Contratos', title: 'Contratos da clínica', icon: FileText },
  { to: '/documentos', label: 'Documentos', title: 'Assinaturas do representante', icon: FileSignature },
  { to: '/financeiro', label: 'Financeiro', title: 'Acompanhamentos e pagamentos', icon: WalletCards },
] as const;
const mobileNavigation = [navigation[0], navigation[1], navigation[2], navigation[8]] as const;
const settingsEntry = { to: '/configuracoes', label: 'Configurações', title: 'Registro profissional e preferências da conta.' } as const;

export const Route = createFileRoute('/_app')({
  beforeLoad: async () => {
    const response = await fetch('/api/auth/get-session', { credentials: 'include' });
    const session = response.ok ? await response.json() : null;
    if (!session?.user) throw redirect({ to: '/login' });
  },
  component: AppLayout,
});

function NavigationPanelContent({ onNavigate, mobile = false }: { onNavigate: () => void; mobile?: boolean }) {
  const account = useQuery(accountQuery);
  const profile = useQuery(professionalProfileQuery);
  const userName = account.data?.user.name ?? '…';
  const tenantName = account.data?.tenant.name ?? '…';
  const council = profile.data?.registrationType && profile.data?.registrationNumber
    ? `${profile.data.registrationType} ${profile.data.registrationNumber}${profile.data.registrationState ? `/${profile.data.registrationState}` : ''}`
    : null;
  return (
    <>
      <div className="mobile-drawer-header">
        <Link className="brand" to="/" onClick={onNavigate}>
          <span className="brand-mark"><Activity size={19} /></span>
          <span>clínicare<span className="brand-dot">.</span></span>
        </Link>
        {mobile && <SheetClose asChild><button type="button" className="mobile-drawer-close" aria-label="Fechar menu"><X size={18} /></button></SheetClose>}
      </div>
      <div className="clinic-switch">
        <span className="clinic-avatar">{initials(tenantName)}</span>
        <span className="clinic-label"><strong>{tenantName}</strong><small>{council ?? account.data?.user.email ?? '…'}</small></span>
        <ChevronDown size={15} />
      </div>
      <div className="nav-caption">MENU PRINCIPAL</div>
      <nav aria-label="Menu principal">
        {navigation.map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to} className="nav-link" activeProps={{ className: 'active' }} activeOptions={{ exact: to === '/' }} onClick={onNavigate}>
            <Icon size={18} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <Link to="/configuracoes" className="nav-link" activeProps={{ className: 'active' }} onClick={onNavigate}><Settings2 size={18} /><span>Configurações</span></Link>
        <div className="profile-row">
          <div className="profile-avatar">{initials(userName)}</div>
          <div className="profile-copy"><strong>{userName}</strong><small>{tenantName}</small></div>
        </div>
      </div>
    </>
  );
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length || parts[0] === '…') return '•';
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : '')).toUpperCase() || '•';
}

function AppLayout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const account = useQuery(accountQuery);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const current = pathname.startsWith('/configuracoes')
    ? settingsEntry
    : (navigation.find(({ to }) => (to === '/' ? pathname === '/' : pathname.startsWith(to))) ?? navigation[0]);
  const path = pathname.replace(/(.)\/$/, '$1');
  const showNewPatient = path === '/pacientes';

  return (
    <div className="app-shell">
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <aside className="sidebar desktop-sidebar" aria-label="Navegação principal">
          <NavigationPanelContent onNavigate={() => {}} />
        </aside>
        <main className="main-area">
          <header className="topbar">
            <div className="breadcrumb">{account.data?.tenant.name ?? '…'} <ChevronRight size={14} /> <strong>{current.label}</strong></div>
            <div className="topbar-right">
              <span className="date-chip"><CalendarDays size={15} /> {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full' }).format(new Date())}</span>
            </div>
          </header>
          <div className="content-wrap">
            <section className="welcome-row">
              <div>
                <h1>{current.title}</h1>
                <p className="welcome-subtitle">Gestão de pacientes, procedimentos e cuidados.</p>
              </div>
              {path === '/' && <QuickActions />}
              {showNewPatient && <Button asChild><Link to="/pacientes/novo"><Plus size={17} /> Novo paciente</Link></Button>}
            </section>
            <Outlet />
            <footer className="page-footer">
              <span>Clínicare <span className="brand-dot">.</span> Gestão feita com cuidado.</span>
            </footer>
          </div>
        </main>
        <nav className="mobile-dock" aria-label="Atalhos principais">
          <div className="mobile-dock-links">
            {mobileNavigation.map(({ to, label, icon: Icon }) => (
              <Link key={to} to={to} className="mobile-dock-link" aria-label={label} title={label} activeProps={{ className: 'active' }} activeOptions={{ exact: to === '/' }} onClick={() => setMobileNavOpen(false)}>
                <Icon size={20} aria-hidden="true" />
              </Link>
            ))}
          </div>
          <SheetTrigger asChild>
            <button type="button" className="mobile-menu-trigger" aria-label="Abrir menu">
              <Plus size={21} />
            </button>
          </SheetTrigger>
        </nav>
        <SheetContent
          id="mobile-navigation"
          side="left"
          showCloseButton={false}
          className="sidebar mobile-navigation-sheet gap-0"
          style={{ inset: 'max(12px, env(safe-area-inset-top)) auto max(12px, env(safe-area-inset-bottom)) 16px', width: 'min(320px, calc(100vw - 32px))', height: 'auto', maxWidth: 'none', padding: '18px 14px 14px', border: '1px solid rgb(233 237 232 / 90%)', borderRadius: 24, boxShadow: '0 24px 70px rgb(24 35 31 / 24%)' }}
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Menu principal</SheetTitle>
            <SheetDescription>Navegue pelas áreas da clínica.</SheetDescription>
          </SheetHeader>
          <NavigationPanelContent mobile onNavigate={() => setMobileNavOpen(false)} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
