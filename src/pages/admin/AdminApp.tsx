import { Dices, Hash, LayoutDashboard, LogOut, RefreshCw, Settings as Cog, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { Logo, Vinyl } from '../../components/brand'
import { Spinner } from '../../components/ui'
import { backend } from '../../lib/backend'
import Dashboard from './Dashboard'
import { AdminDataProvider, useAdminData } from './data'
import DrawPage from './Draw'
import Login from './Login'
import Numbers from './Numbers'
import Participants from './Participants'
import SettingsPage from './Settings'

type Gate = 'loading' | 'out' | 'denied' | 'ok'

export default function AdminApp() {
  const [gate, setGate] = useState<Gate>('loading')
  const [email, setEmail] = useState('')

  useEffect(() => {
    document.title = 'Admin — Sunset House'
    const check = async (s: { email: string } | null) => {
      if (!s) return setGate('out')
      setEmail(s.email)
      setGate((await backend.admin.isAdmin().catch(() => false)) ? 'ok' : 'denied')
    }
    backend.admin.getSession().then(check)
    return backend.admin.onAuthChange((s) => { check(s) })
  }, [])

  if (gate === 'loading') return <div className="grid min-h-dvh place-items-center bg-paper"><Spinner className="h-8 w-8" /></div>
  if (gate === 'out') return <Login />
  if (gate === 'denied')
    return (
      <div className="grid min-h-dvh place-items-center bg-paper p-6 text-center">
        <div className="sticker max-w-sm p-7">
          <h1 className="display text-3xl">Acesso negado</h1>
          <p className="mt-3 text-sm">A conta <b>{email}</b> não está autorizada como administradora.</p>
          <button className="btn btn-md btn-ink mt-5 w-full" onClick={() => backend.admin.signOut()}>Sair</button>
        </div>
      </div>
    )

  return (
    <AdminDataProvider>
      <Shell email={email}>
        <Routes>
          <Route index element={<Dashboard />} />
          <Route path="participantes" element={<Participants />} />
          <Route path="numeros" element={<Numbers />} />
          <Route path="sorteio" element={<DrawPage />} />
          <Route path="configuracoes" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </Shell>
    </AdminDataProvider>
  )
}

const NAV = [
  { to: '/admin', label: 'Dashboard', short: 'Início', icon: LayoutDashboard, end: true },
  { to: '/admin/participantes', label: 'Participantes', short: 'Pessoas', icon: Users },
  { to: '/admin/numeros', label: 'Números da sorte', short: 'Números', icon: Hash },
  { to: '/admin/sorteio', label: 'Realizar sorteio', short: 'Sorteio', icon: Dices },
  { to: '/admin/configuracoes', label: 'Configurações', short: 'Ajustes', icon: Cog },
]

function Shell({ email, children }: { email: string; children: React.ReactNode }) {
  const { refresh, updatedAt, error } = useAdminData()
  const [spinning, setSpinning] = useState(false)
  const doRefresh = async () => { setSpinning(true); await refresh(); setSpinning(false) }

  return (
    <div className="min-h-dvh bg-paper text-ink lg:pl-[264px]">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 hidden w-[264px] flex-col bg-ink px-4 py-6 text-paper lg:flex">
        <div className="flex items-center gap-3 px-2">
          <Vinyl className="w-10" />
          <div>
            <Logo tone="neon" className="w-[120px]" />
            <p className="mt-1 font-display text-[10px] font-extrabold uppercase tracking-[0.2em] text-paper/50">Painel do sorteio</p>
          </div>
        </div>
        <nav className="mt-10 space-y-1">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}
              className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 font-display text-[14px] font-bold transition-colors ${isActive ? 'bg-neon text-ink' : 'text-paper/75 hover:bg-white/10 hover:text-paper'}`}>
              <n.icon className="h-[18px] w-[18px]" strokeWidth={2.4} /> {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto space-y-3 px-2 text-[12px] text-paper/60">
          <p className="truncate">{email}</p>
          <button onClick={() => backend.admin.signOut()} className="flex items-center gap-2 font-semibold text-paper hover:text-neon"><LogOut className="h-4 w-4" /> Sair</button>
        </div>
      </aside>

      {/* Topo mobile */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b-2 border-ink bg-ink px-4 py-3 text-paper lg:hidden">
        <Logo tone="neon" className="w-[96px]" />
        <div className="flex items-center gap-2">
          <button onClick={doRefresh} className="grid h-9 w-9 place-items-center rounded-xl bg-white/10" aria-label="Atualizar"><RefreshCw className={`h-4 w-4 ${spinning ? 'animate-spin' : ''}`} /></button>
          <button onClick={() => backend.admin.signOut()} className="grid h-9 w-9 place-items-center rounded-xl bg-white/10" aria-label="Sair"><LogOut className="h-4 w-4" /></button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-28 pt-5 sm:px-6 lg:px-10 lg:pb-12 lg:pt-8">
        <div className="mb-4 hidden items-center justify-end gap-3 text-[12px] text-graphite-500 lg:flex">
          {updatedAt && <span>Atualizado às {updatedAt.toLocaleTimeString('pt-BR')}</span>}
          <button onClick={doRefresh} className="btn btn-sm btn-paper !shadow-hard-sm"><RefreshCw className={`h-3.5 w-3.5 ${spinning ? 'animate-spin' : ''}`} /> Atualizar</button>
        </div>
        {error && <div className="mb-4 rounded-2xl border-2 border-ink bg-[#ff5a3c] px-4 py-3 text-sm font-semibold">{error}</div>}
        {children}
      </main>

      {/* Abas mobile */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t-2 border-ink bg-ink pb-[env(safe-area-inset-bottom)] lg:hidden">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end}
            className={({ isActive }) => `flex flex-col items-center gap-1 py-2.5 font-display text-[10px] font-bold uppercase tracking-wide ${isActive ? 'text-neon' : 'text-paper/60'}`}>
            <n.icon className="h-5 w-5" strokeWidth={2.4} /> {n.short}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
