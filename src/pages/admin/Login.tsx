import { LogIn } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Cloud, Logo, Sparkle, Vinyl } from '../../components/brand'
import { Spinner } from '../../components/ui'
import { backend, IS_PREVIEW } from '../../lib/backend'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await backend.admin.signIn(email.trim(), password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível entrar.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden bg-ink px-5 py-10">
      <Vinyl className="absolute -right-24 -top-24 w-80 opacity-80" />
      <Cloud v={1} className="absolute -left-8 bottom-16 w-52 animate-drift-slow opacity-90" />
      <Sparkle className="absolute left-[12%] top-[14%] w-10" />
      <form onSubmit={submit} className="sticker relative w-full max-w-sm p-6 sm:p-8">
        <Logo className="mx-auto w-40" />
        <h1 className="display mt-6 text-center text-[28px]">Painel do sorteio</h1>
        <p className="mt-1 text-center text-sm text-graphite-700">Acesso restrito à organização</p>
        {IS_PREVIEW && <p className="mt-3 rounded-xl bg-sun px-3 py-2 text-center text-xs font-semibold">Pré-visualização: toque em Entrar sem preencher.</p>}
        <div className="mt-6 space-y-3">
          <input className="field" type="email" placeholder="E-mail" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required={!IS_PREVIEW} />
          <input className="field" type="password" placeholder="Senha" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required={!IS_PREVIEW} />
        </div>
        {error && <p role="alert" className="mt-3 text-sm font-semibold text-[#c22a14]">{error}</p>}
        <button className="btn btn-lg btn-ink mt-5 w-full" disabled={busy}>{busy ? <Spinner /> : <LogIn className="h-5 w-5" />} Entrar</button>
      </form>
    </div>
  )
}
