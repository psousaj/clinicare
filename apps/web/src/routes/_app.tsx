import { createFileRoute, Link, Outlet, useRouterState } from '@tanstack/react-router';
import { Activity, CalendarDays, ChevronDown, ChevronRight, CircleHelp, ClipboardList, FileText, LayoutDashboard, Plus, Settings2, Sparkles, UsersRound, WalletCards } from 'lucide-react';
import { Button } from '@/components/ui/button';

const navigation = [
  { to: '/', label: 'Visão geral', title: 'Sua clínica, em um só lugar.', icon: LayoutDashboard },
  { to: '/pacientes', label: 'Pacientes', title: 'Pacientes', icon: UsersRound },
  { to: '/agenda', label: 'Agenda', title: 'Agenda semanal', icon: CalendarDays },
  { to: '/procedimentos', label: 'Procedimentos', title: 'Procedimentos e combos', icon: Sparkles },
  { to: '/formularios-anamnese', label: 'Formulários de anamnese', title: 'Formulários de anamnese', icon: ClipboardList },
  { to: '/contratos', label: 'Contratos', title: 'Contratos da clínica', icon: FileText },
  { to: '/financeiro', label: 'Financeiro', title: 'Contratações e pagamentos', icon: WalletCards },
] as const;

export const Route = createFileRoute('/_app')({ component: AppLayout });

function AppLayout() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const current = navigation.find(({ to }) => (to === '/' ? pathname === '/' : pathname.startsWith(to))) ?? navigation[0];
  const showNewPatient = ['/', '/pacientes'].includes(pathname.replace(/(.)\/$/, '$1'));
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" to="/">
          <span className="brand-mark"><Activity size={19} /></span>
          <span>clínicare<span className="brand-dot">.</span></span>
        </Link>
        <div className="clinic-switch">
          <span className="clinic-avatar">V</span>
          <span className="clinic-label"><strong>Clínica Vitta</strong><small>Estética & bem-estar</small></span>
          <ChevronDown size={15} />
        </div>
        <div className="nav-caption">MENU PRINCIPAL</div>
        <nav aria-label="Menu principal">
          {navigation.map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to} className="nav-link" activeProps={{ className: 'active' }} activeOptions={{ exact: to === '/' }}>
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
            {showNewPatient && <Button asChild><Link to="/pacientes/novo"><Plus size={17} /> Novo paciente</Link></Button>}
          </section>
          <Outlet />
          <footer className="page-footer">
            <span>Clínicare <span className="brand-dot">.</span> Gestão feita com cuidado.</span>
            <span>Protótipo · Dados fictícios</span>
          </footer>
        </div>
      </main>
    </div>
  );
}
