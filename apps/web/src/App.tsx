import { useEffect, useMemo, useState } from 'react';
import { Activity, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, ClipboardList, Clock3, FileText, LayoutDashboard, Plus, Search, Settings2, Sparkles, UserRound, UsersRound, WalletCards } from 'lucide-react';

type Patient = { id: string; fullName: string; phone: string | null; email: string | null; notes: string | null; createdAt: string };
type Procedure = { id: string; name: string; description: string | null; baseSessions: number; durationMinutes: number | null; priceCents: number; active: number };
type ApiResult<T> = { data?: T; error?: string };

const currency = (cents: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);

function useApi<T>(path: string) {
  const [result, setResult] = useState<ApiResult<T>>({});
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    fetch(path).then(async (res) => {
      if (!res.ok) throw new Error('Não foi possível carregar os dados.');
      return res.json() as Promise<T>;
    }).then((data) => active && setResult({ data })).catch((error: Error) => active && setResult({ error: error.message }));
    return () => { active = false; };
  }, [path, reload]);
  return { ...result, refresh: () => setReload((value) => value + 1) };
}

function App() {
  const patientsApi = useApi<Patient[]>('/api/patients');
  const proceduresApi = useApi<Procedure[]>('/api/procedures');
  const patients = patientsApi.data ?? [];
  const procedures = proceduresApi.data ?? [];
  const [query, setQuery] = useState('');
  const [activeView, setActiveView] = useState('Visão geral');
  const [showPatientForm, setShowPatientForm] = useState(false);
  const [showProcedureForm, setShowProcedureForm] = useState(false);
  const [notice, setNotice] = useState('');

  const filteredPatients = useMemo(() => patients.filter((patient) => patient.fullName.toLowerCase().includes(query.toLowerCase()) || patient.phone?.includes(query)), [patients, query]);
  const navigation = [
    { label: 'Visão geral', icon: LayoutDashboard },
    { label: 'Pacientes', icon: UsersRound },
    { label: 'Agenda', icon: CalendarDays },
    { label: 'Procedimentos', icon: Sparkles },
    { label: 'Anamneses', icon: ClipboardList },
    { label: 'Contratos', icon: FileText },
    { label: 'Financeiro', icon: WalletCards },
  ];

  async function createPatient(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch('/api/patients', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ fullName: form.get('fullName'), phone: form.get('phone'), email: form.get('email') }) });
    if (!response.ok) { setNotice('Não foi possível salvar o paciente. Confira os campos.'); return; }
    setShowPatientForm(false); setNotice('Paciente cadastrado.'); patientsApi.refresh();
  }

  async function createProcedure(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch('/api/procedures', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: form.get('name'), description: form.get('description'), baseSessions: Number(form.get('baseSessions')), durationMinutes: Number(form.get('durationMinutes')), priceCents: Math.round(Number(form.get('price')) * 100) }) });
    if (!response.ok) { setNotice('Não foi possível salvar o procedimento. Confira os campos.'); return; }
    setShowProcedureForm(false); setNotice('Procedimento cadastrado.'); proceduresApi.refresh();
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="#inicio" aria-label="Clínicare, início"><span className="brand-mark"><Activity size={19} strokeWidth={2.6} /></span><span>clínicare<span className="brand-dot">.</span></span></a>
      <div className="clinic-switch"><span className="clinic-avatar">V</span><span className="clinic-label"><strong>Clínica Vitta</strong><small>Estética & bem-estar</small></span><ChevronDown size={15} /></div>
      <div className="nav-caption">MENU PRINCIPAL</div>
      <nav aria-label="Menu principal">{navigation.map(({ label, icon: Icon }) => <button key={label} className={`nav-link ${activeView === label ? 'active' : ''}`} onClick={() => setActiveView(label)}><Icon size={18} strokeWidth={1.8} /><span>{label}</span>{label === 'Pacientes' && patients.length > 0 && <small className="nav-count">{patients.length}</small>}</button>)}</nav>
      <div className="sidebar-bottom"><button className="nav-link"><Settings2 size={18} /><span>Configurações</span></button><div className="help-card"><span className="help-icon"><CircleHelp size={17} /></span><div><strong>Precisa de ajuda?</strong><small>Acesse nossa central</small></div><ChevronRight size={15} /></div><div className="profile-row"><div className="profile-avatar">MA</div><div className="profile-copy"><strong>Marina Alves</strong><small>Administradora</small></div><button className="icon-button" aria-label="Opções de perfil"><ChevronDown size={16} /></button></div></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div className="breadcrumb">Clínica Vitta <ChevronRight size={14} /> <strong>{activeView}</strong></div><div className="topbar-right"><span className="prototype-tag">AMBIENTE DE TESTE</span><button className="date-chip"><CalendarDays size={15} /> Segunda-feira, 28 de setembro</button><div className="top-avatar">MA</div></div></header>
      <div className="content-wrap">
        {notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Fechar aviso">×</button></div>}
        <section className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-line" /> SEGUNDA-FEIRA, 28 DE SETEMBRO DE 2026</div><h1>Bom dia, Marina <span className="wave">✳</span></h1><p className="welcome-subtitle">Um resumo tranquilo para começar o dia.</p></div><button className="primary-button" onClick={() => setShowPatientForm(true)}><Plus size={17} /> Novo paciente</button></section>
        <section className="stats-grid" aria-label="Resumo da clínica"><article className="stat-card"><div className="stat-heading"><span>Pacientes cadastrados</span><span className="stat-icon violet"><UsersRound size={17} /></span></div><div className="stat-value">{patients.length}<span className="stat-suffix"> no total</span></div><div className="stat-foot"><span className="tiny-dot green-dot" /> Base da clínica</div></article><article className="stat-card"><div className="stat-heading"><span>Procedimentos ativos</span><span className="stat-icon peach"><Sparkles size={17} /></span></div><div className="stat-value">{procedures.length}<span className="stat-suffix"> cadastrados</span></div><div className="stat-foot">Configure seu catálogo</div></article><article className="stat-card"><div className="stat-heading"><span>Agenda de hoje</span><span className="stat-icon blue"><CalendarDays size={17} /></span></div><div className="stat-value">—<span className="stat-suffix"> horários</span></div><div className="stat-foot">Agenda em breve</div></article><article className="stat-card"><div className="stat-heading"><span>Em acompanhamento</span><span className="stat-icon mint"><Activity size={17} /></span></div><div className="stat-value">—<span className="stat-suffix"> tratamentos</span></div><div className="stat-foot">Acompanhamento em breve</div></article></section>
        <div className="section-heading"><div><div className="section-kicker">SUA CLÍNICA</div><h2>Comece por aqui</h2></div><span className="section-note">O básico, bem organizado.</span></div>
        <section className="setup-grid" aria-label="Ações iniciais"><button className="setup-card" onClick={() => setShowPatientForm(true)}><span className="setup-icon lavender"><UserRound size={19} /></span><span className="setup-copy"><strong>Cadastre um paciente</strong><small>Guarde contatos e informações básicas.</small></span><span className="setup-arrow"><ChevronRight size={17} /></span></button><button className="setup-card" onClick={() => setShowProcedureForm(true)}><span className="setup-icon apricot"><Sparkles size={19} /></span><span className="setup-copy"><strong>Configure procedimentos</strong><small>Monte o catálogo de serviços da clínica.</small></span><span className="setup-arrow"><ChevronRight size={17} /></span></button><button className="setup-card" onClick={() => setActiveView('Agenda')}><span className="setup-icon sky"><CalendarDays size={19} /></span><span className="setup-copy"><strong>Organize sua agenda</strong><small>Veja seus horários em um só lugar.</small></span><span className="setup-arrow"><ChevronRight size={17} /></span></button></section>
        <section className="data-grid"><article className="panel patients-panel"><div className="panel-header"><div><div className="section-kicker">RELACIONAMENTO</div><h2>Pacientes recentes</h2></div><button className="text-button" onClick={() => setActiveView('Pacientes')}>Ver todos <ChevronRight size={15} /></button></div><label className="search-box"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar paciente por nome ou telefone" aria-label="Buscar paciente por nome ou telefone" /></label>{patientsApi.error ? <div className="inline-error">{patientsApi.error}</div> : filteredPatients.length ? <div className="patient-list">{filteredPatients.slice(0, 5).map((patient) => <button className="patient-row" key={patient.id} onClick={() => setNotice(`Perfil de ${patient.fullName} estará disponível na próxima etapa.`)}><span className="patient-initials">{patient.fullName.split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</span><span className="patient-info"><strong>{patient.fullName}</strong><small>{patient.phone || patient.email || 'Sem contato informado'}</small></span><span className="patient-meta">Cadastro recente</span><ChevronRight size={16} className="patient-chevron" /></button>)}</div> : <div className="empty-state"><span className="empty-illustration"><UsersRound size={24} /></span><strong>{query ? 'Nenhum paciente encontrado' : 'Sua lista começa aqui'}</strong><span>{query ? 'Tente buscar por outro nome ou telefone.' : 'Cadastre seu primeiro paciente para acompanhar tudo por aqui.'}</span>{!query && <button className="secondary-button" onClick={() => setShowPatientForm(true)}><Plus size={15} /> Cadastrar paciente</button>}</div>}</article>
          <article className="panel procedures-panel"><div className="panel-header"><div><div className="section-kicker">CATÁLOGO</div><h2>Procedimentos</h2></div><button className="round-add" aria-label="Adicionar procedimento" onClick={() => setShowProcedureForm(true)}><Plus size={17} /></button></div>{proceduresApi.error ? <div className="inline-error">{proceduresApi.error}</div> : procedures.length ? <div className="procedure-list">{procedures.slice(0, 4).map((procedure) => <div className="procedure-row" key={procedure.id}><span className="procedure-bullet"><Sparkles size={15} /></span><span className="procedure-info"><strong>{procedure.name}</strong><small>{procedure.baseSessions} {procedure.baseSessions === 1 ? 'sessão' : 'sessões'}{procedure.durationMinutes ? ` · ${procedure.durationMinutes} min` : ''}</small></span><strong className="procedure-price">{currency(procedure.priceCents)}</strong></div>)}</div> : <div className="empty-state compact"><span className="empty-illustration"><Sparkles size={22} /></span><strong>Nenhum procedimento cadastrado</strong><span>Adicione os procedimentos oferecidos pela clínica.</span><button className="secondary-button" onClick={() => setShowProcedureForm(true)}><Plus size={15} /> Novo procedimento</button></div>}<button className="catalog-link" onClick={() => setActiveView('Procedimentos')}>Abrir catálogo completo <ChevronRight size={15} /></button></article></section>
        <footer className="page-footer"><span>Clínicare <span className="brand-dot">.</span> Gestão feita com cuidado.</span><span>Versão de demonstração · Dados de teste</span></footer>
      </div>
    </main>
    {showPatientForm && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setShowPatientForm(false)}><form className="modal" onSubmit={createPatient}><div className="modal-kicker">NOVO CADASTRO</div><h2>Cadastrar paciente</h2><p>Adicione as informações básicas para começar o acompanhamento.</p><label>Nome completo<input name="fullName" required autoFocus placeholder="Ex.: Ana Souza" /></label><label>Telefone<input name="phone" placeholder="(11) 99999-9999" /></label><label>E-mail<input name="email" type="email" placeholder="ana@email.com" /></label><div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setShowPatientForm(false)}>Cancelar</button><button className="primary-button" type="submit"><Plus size={16} /> Salvar paciente</button></div></form></div>}
    {showProcedureForm && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setShowProcedureForm(false)}><form className="modal" onSubmit={createProcedure}><div className="modal-kicker">CATÁLOGO DA CLÍNICA</div><h2>Novo procedimento</h2><p>Defina as informações principais. Os campos clínicos poderão ser configurados depois.</p><label>Nome do procedimento<input name="name" required autoFocus placeholder="Ex.: Limpeza de pele" /></label><label>Descrição<input name="description" placeholder="Uma breve descrição (opcional)" /></label><div className="form-columns"><label>Sessões base<input name="baseSessions" type="number" min="1" defaultValue="1" required /></label><label>Duração (minutos)<input name="durationMinutes" type="number" min="1" defaultValue="60" required /></label></div><label>Preço padrão (R$)<input name="price" type="number" min="0" step="0.01" defaultValue="0" required /></label><div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setShowProcedureForm(false)}>Cancelar</button><button className="primary-button" type="submit"><Plus size={16} /> Salvar procedimento</button></div></form></div>}
  </div>;
}

export default App;
