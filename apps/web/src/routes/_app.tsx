import { createFileRoute, Link, Outlet, useRouterState } from '@tanstack/react-router';
import { Activity, CalendarDays, ChevronDown, ChevronRight, CircleHelp, ClipboardList, FileText, Layers, LayoutDashboard, Plus, Settings2, Sparkles, UsersRound, WalletCards, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { QuickActions } from '@/components/QuickActions';
import { Button } from '@/components/ui/button';

const navigation = [
  { to: '/', label: 'Visão geral', title: 'Sua clínica, em um só lugar.', icon: LayoutDashboard },
  { to: '/pacientes', label: 'Pacientes', title: 'Pacientes', icon: UsersRound },
  { to: '/agenda', label: 'Agenda', title: 'Agenda semanal', icon: CalendarDays },
  { to: '/procedimentos', label: 'Procedimentos', title: 'Procedimentos e combos', icon: Sparkles },
  { to: '/planos', label: 'Planos', title: 'Planos', icon: Layers },
  { to: '/formularios-anamnese', label: 'Formulários de anamnese', title: 'Formulários de anamnese', icon: ClipboardList },
  { to: '/contratos', label: 'Contratos', title: 'Contratos da clínica', icon: FileText },
  { to: '/financeiro', label: 'Financeiro', title: 'Acompanhamentos e pagamentos', icon: WalletCards },
] as const;
const mobileNavigation = [navigation[0], navigation[1], navigation[2], navigation[7]] as const;

export const Route = createFileRoute('/_app')({ component: AppLayout });

function AppLayout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const mobileMenuTrigger = useRef<HTMLButtonElement>(null);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const current = navigation.find(({ to }) => (to === '/' ? pathname === '/' : pathname.startsWith(to))) ?? navigation[0];
  const path = pathname.replace(/(.)\/$/, '$1');
  const showNewPatient = path === '/pacientes';

  useEffect(() => {
    if (!mobileNavOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.querySelector<HTMLAnchorElement>('#mobile-navigation nav a')?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileNavOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', closeOnEscape);
      mobileMenuTrigger.current?.focus();
    };
  }, [mobileNavOpen]);
  return (
    <div className="app-shell">
      {mobileNavOpen && <button type="button" className="mobile-nav-backdrop" aria-label="Fechar menu" onClick={() => setMobileNavOpen(false)} />}
      <aside id="mobile-navigation" className={`sidebar${mobileNavOpen ? ' mobile-nav-open' : ''}`} aria-label="Navegação principal">
        <div className="mobile-drawer-header">
          <Link className="brand" to="/" onClick={() => setMobileNavOpen(false)}>
            <span className="brand-mark"><Activity size={19} /></span>
            <span>clínicare<span className="brand-dot">.</span></span>
          </Link>
          <button type="button" className="mobile-drawer-close" aria-label="Fechar menu" onClick={() => setMobileNavOpen(false)}><X size={18} /></button>
        </div>
        <div className="clinic-switch">
          <span className="clinic-avatar">V</span>
          <span className="clinic-label"><strong>Clínica Vitta</strong><small>Estética & bem-estar</small></span>
          <ChevronDown size={15} />
        </div>
        <div className="nav-caption">MENU PRINCIPAL</div>
        <nav aria-label="Menu principal">
          {navigation.map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to} className="nav-link" activeProps={{ className: 'active' }} activeOptions={{ exact: to === '/' }} onClick={() => setMobileNavOpen(false)}>
              <Icon size={18} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className="nav-link"><Settings2 size={18} /><span>Configurações</span></button>
          <div className="help-card">
            <span className="help-icon"><CircleHelp size={17} /></span>
            <div><strong>Ambiente de teste</strong><small>Use apenas dados fictícios</small></div>
          </div>
          <div className="profile-row">
            <div className="profile-avatar">AD</div>
            <div className="profile-copy"><strong>Administradora</strong><small>Clínica Vitta</small></div>
          </div>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb">Clínica Vitta <ChevronRight size={14} /> <strong>{current.label}</strong></div>
          <div className="topbar-right">
            <span className="prototype-tag">PROTÓTIPO · DADOS FICTÍCIOS</span>
            <span className="date-chip"><CalendarDays size={15} /> {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full' }).format(new Date())}</span>
          </div>
        </header>
        <div className="content-wrap">
          <section className="welcome-row">
            <div>
              <div className="eyebrow"><span className="eyebrow-line" /> AMBIENTE DE DEMONSTRAÇÃO</div>
              <h1>{current.title}</h1>
              <p className="welcome-subtitle">Gestão de pacientes, procedimentos e cuidados.</p>
            </div>
            {path === '/' && <QuickActions />}
            {showNewPatient && <Button asChild><Link to="/pacientes/novo"><Plus size={17} /> Novo paciente</Link></Button>}
          </section>
          <Outlet />
          <footer className="page-footer">
            <span>Clínicare <span className="brand-dot">.</span> Gestão feita com cuidado.</span>
            <span>Protótipo · Dados fictícios</span>
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
        <button
          ref={mobileMenuTrigger}
          type="button"
          className="mobile-menu-trigger"
          aria-label={mobileNavOpen ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={mobileNavOpen}
          aria-controls="mobile-navigation"
          onClick={() => setMobileNavOpen((open) => !open)}
        >
          {mobileNavOpen ? <X size={21} /> : <Plus size={21} />}
        </button>
      </nav>
    </div>
  );
}
