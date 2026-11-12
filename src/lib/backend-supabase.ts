import { createClient, FunctionsHttpError, type SupabaseClient } from '@supabase/supabase-js'
import type { Backend, Draw, DrawResult, Participant, RegisterResult, Settings, WaState } from './types'

const DRAW_ERRORS: Record<string, string> = {
  draw_in_progress: 'Já existe um sorteio em andamento. Aguarde alguns segundos.',
  already_drawn: 'Este prêmio já foi sorteado. Para refazer, confirme e informe o motivo.',
  prize_not_found: 'Prêmio não encontrado.',
}

async function fnCall<T>(sb: SupabaseClient, name: string, body: object): Promise<T> {
  const { data, error } = await sb.functions.invoke(name, { body })
  if (error) {
    if (error instanceof FunctionsHttpError) {
      try {
        return (await error.context.json()) as T
      } catch {
        /* resposta sem JSON */
      }
    }
    return { ok: false, message: 'Sem conexão com o servidor. Verifique sua internet e tente novamente.' } as T
  }
  return data as T
}

function friendly(e: { message?: string } | null): Error {
  const m = e?.message ?? 'Erro inesperado'
  if (/not_authorized|permission denied|JWT/i.test(m)) return new Error('Sua sessão não tem permissão de administrador.')
  return new Error(m)
}

export function createSupabaseBackend(url: string, key: string): Backend {
  const sb = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } })

  return {
    mode: 'supabase',

    async getPublicConfig() {
      const { data, error } = await sb.rpc('get_public_config')
      if (error) throw friendly(error)
      return data
    },

    register: (input) => fnCall<RegisterResult>(sb, 'register', input),

    requestWhatsApp: (participantId, receiptToken) =>
      fnCall<{ ok: boolean; whatsapp?: WaState; message?: string }>(sb, 'whatsapp-send', { participantId, receiptToken }),

    admin: {
      async getSession() {
        const { data } = await sb.auth.getSession()
        return data.session?.user?.email ? { email: data.session.user.email } : null
      },
      onAuthChange(cb) {
        const { data } = sb.auth.onAuthStateChange((_e, s) => cb(s?.user?.email ? { email: s.user.email } : null))
        return () => data.subscription.unsubscribe()
      },
      async signIn(email, password) {
        const { error } = await sb.auth.signInWithPassword({ email, password })
        if (error) throw new Error(/invalid/i.test(error.message) ? 'E-mail ou senha incorretos.' : error.message)
      },
      async signOut() {
        await sb.auth.signOut()
      },
      async isAdmin() {
        const { data: u, error: uErr } = await sb.auth.getUser()
        if (uErr || !u.user) {
          // sessão antiga (ex.: conta apagada/recriada): limpa e volta para o login
          await sb.auth.signOut().catch(() => {})
          return false
        }
        const { data } = await sb.from('admins').select('user_id').eq('user_id', u.user.id).maybeSingle()
        return Boolean(data)
      },
      async stats() {
        const { data, error } = await sb.rpc('admin_stats')
        if (error) throw friendly(error)
        return data
      },
      async participants() {
        const all: Participant[] = []
        for (let from = 0; ; from += 1000) {
          const { data, error } = await sb.from('participants_admin').select('*').order('lucky_number').range(from, from + 999)
          if (error) throw friendly(error)
          all.push(...(data as Participant[]))
          if (!data || data.length < 1000) break
        }
        return all
      },
      async setStatus(id, status, reason) {
        const { error } = await sb.rpc('admin_set_participant_status', { p_id: id, p_status: status, p_reason: reason })
        if (error) throw friendly(error)
      },
      async markManualWhatsApp(id) {
        const { error } = await sb.rpc('admin_mark_manual_whatsapp', { p_id: id })
        if (error) throw friendly(error)
      },
      resendWhatsApp: (id) => fnCall(sb, 'whatsapp-send', { participantId: id }),
      async waStatus() {
        const r = await fnCall<{ ok: boolean } & Record<string, unknown>>(sb, 'whatsapp-send', { action: 'status' })
        return r.ok ? (r as never) : null
      },
      async prizes() {
        const { data, error } = await sb.from('prizes').select('id, round, title, description').order('round')
        if (error) throw friendly(error)
        return data
      },
      async draws() {
        const { data, error } = await sb.from('draws').select('*').order('created_at', { ascending: false })
        if (error) throw friendly(error)
        return data as Draw[]
      },
      async performDraw(prizeId, redo = false, reason) {
        const { data, error } = await sb.rpc('perform_draw', { p_prize_id: prizeId, p_redo: redo, p_redo_reason: reason ?? null })
        if (error) throw friendly(error)
        if (!data.ok) throw new Error(DRAW_ERRORS[data.code] ?? 'Não foi possível realizar o sorteio.')
        return data as DrawResult
      },
      async settings() {
        const { data, error } = await sb.from('settings').select('*').eq('id', 1).single()
        if (error) throw friendly(error)
        return data as Settings
      },
      async updateSettings(patch) {
        const { error } = await sb.from('settings').update(patch).eq('id', 1)
        if (error) throw friendly(error)
      },
      async savePrize(p) {
        const row = { round: p.round, title: p.title, description: p.description ?? null }
        const { error } = p.id ? await sb.from('prizes').update(row).eq('id', p.id) : await sb.from('prizes').insert(row)
        if (error) throw new Error(/duplicate/i.test(error.message) ? 'Já existe um prêmio com essa ordem.' : error.message)
      },
      async deletePrize(id) {
        const { error } = await sb.from('prizes').delete().eq('id', id)
        if (error) throw new Error(/foreign key/i.test(error.message) ? 'Este prêmio já tem sorteio registrado e não pode ser removido.' : error.message)
      },
      async audit() {
        const { data, error } = await sb.from('audit_log').select('*').order('created_at', { ascending: false }).limit(80)
        if (error) throw friendly(error)
        return data
      },
    },
  }
}
