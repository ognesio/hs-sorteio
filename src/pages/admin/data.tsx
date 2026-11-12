import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { backend } from '../../lib/backend'
import type { Draw, Participant, Prize, Stats } from '../../lib/types'

interface AdminData {
  stats: Stats | null
  participants: Participant[]
  prizes: Prize[]
  draws: Draw[]
  loading: boolean
  error: string | null
  updatedAt: Date | null
  refresh: () => Promise<void>
}

const Ctx = createContext<AdminData | null>(null)
export const useAdminData = () => useContext(Ctx)!

/** Carrega os dados reais do banco e atualiza a cada 15 s enquanto a aba estiver visível */
export function AdminDataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Omit<AdminData, 'refresh'>>({
    stats: null, participants: [], prizes: [], draws: [], loading: true, error: null, updatedAt: null,
  })
  const busy = useRef(false)

  const refresh = useCallback(async () => {
    if (busy.current) return
    busy.current = true
    try {
      const [stats, participants, prizes, draws] = await Promise.all([
        backend.admin.stats(), backend.admin.participants(), backend.admin.prizes(), backend.admin.draws(),
      ])
      setState({ stats, participants, prizes, draws, loading: false, error: null, updatedAt: new Date() })
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: e instanceof Error ? e.message : 'Erro ao carregar dados' }))
    } finally {
      busy.current = false
    }
  }, [])

  useEffect(() => {
    refresh()
    const id = setInterval(() => document.visibilityState === 'visible' && refresh(), 15_000)
    return () => clearInterval(id)
  }, [refresh])

  return <Ctx.Provider value={{ ...state, refresh }}>{children}</Ctx.Provider>
}
