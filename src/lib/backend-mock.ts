// PRÉ-VISUALIZAÇÃO DE DESIGN — usado somente em `npm run build:preview`.
// Dados fictícios em memória, sem banco e sem envio de WhatsApp. Nunca é usado em produção.
import { pad } from './format'
import type { AuditEntry, Backend, Draw, Participant, Prize, Settings } from './types'

export function createMockBackend(): Backend {
const NAMES = [
  'Ana Clara Ribeiro', 'Bruno Tavares', 'Camila Duarte', 'Diego Moreira', 'Eduarda Lins', 'Felipe Arantes', 'Gabriela Nogueira',
  'Heitor Campos', 'Isabela Freitas', 'João Pedro Lima', 'Karina Matos', 'Lucas Pereira', 'Marina Couto', 'Nicolas Barros',
  'Olívia Prado', 'Paulo Henrique Dias', 'Rafaela Teixeira', 'Samuel Costa', 'Tainá Rocha', 'Victor Hugo Sales', 'Yasmin Torres',
  'Arthur Mendes', 'Beatriz Fontes', 'Caio Azevedo', 'Débora Gomes', 'Enzo Martins', 'Fernanda Sá', 'Gustavo Ramos',
  'Helena Viana', 'Igor Cardoso', 'Júlia Monteiro', 'Kauã Ferreira', 'Laura Pacheco', 'Matheus Brito',
]

const now = Date.now()
const prizes: Prize[] = [
  { id: 'p1', round: 1, title: '2 chaveiros', description: '1º sorteio' },
  { id: 'p2', round: 2, title: 'Copo de whisky + 1 chaveiro', description: '2º sorteio' },
  { id: 'p3', round: 3, title: 'Kit Napiteira', description: '3º sorteio' },
  { id: 'p4', round: 4, title: 'Case Napiteira', description: '4º sorteio' },
]
const people: Participant[] = NAMES.map((n, i) => {
  const created = new Date(now - (NAMES.length - i) * 7 * 60_000).toISOString()
  const wa = i % 3 !== 0
  return {
    id: 'u' + (i + 1), full_name: n, phone: '55119' + String(81230000 + i * 137).slice(0, 8),
    email: n.toLowerCase().normalize('NFD').replace(/[^a-z ]/g, '').split(' ').join('.') + '@email.com',
    lucky_number: i + 1, number: pad(i + 1), status: i === 6 ? 'desclassificado' : 'valido',
    status_reason: i === 6 ? 'Cadastro duplicado com outro telefone' : null, status_changed_at: null,
    privacy_consent: true, privacy_consent_at: created, whatsapp_consent: wa, whatsapp_consent_at: wa ? created : null,
    created_at: created, whatsapp_status: i % 5 === 1 ? 'enviado' : null, whatsapp_channel: i % 5 === 1 ? 'whatsapp_manual' : null,
    whatsapp_updated_at: null, whatsapp_error: null, is_winner: false,
  }
})
const draws: Draw[] = []
const audit: AuditEntry[] = []
const settings: Settings = {
  event_name: 'SUNSET HOUSE', raffle_name: 'Sorteio oficial Sunset House',
  raffle_description: 'Participe do sorteio oficial do Sunset House, garanta seu número da sorte e aproveite a festa!',
  event_date: '2026-11-15', registrations_open: true, max_participants: null, allow_same_winner: false,
  rules_text: 'Cada pessoa pode se cadastrar uma única vez, com telefone e e-mail próprios. Cada cadastro recebe um único número da sorte. O vencedor precisa estar presente no evento para retirar o prêmio.',
  last_number: people.length, updated_at: new Date().toISOString(),
}
let session: { email: string } | null = null
const listeners = new Set<(s: { email: string } | null) => void>()
const wait = (ms = 350) => new Promise((r) => setTimeout(r, ms))
const log = (action: string, details: Record<string, unknown>) =>
  audit.unshift({ id: audit.length + 1, actor_email: session?.email ?? null, action, entity: null, entity_id: null, details, created_at: new Date().toISOString() })
function rand(n: number) {
  const lim = Math.floor(2 ** 32 / n) * n
  const a = new Uint32Array(1)
  do crypto.getRandomValues(a)
  while (a[0] >= lim)
  return a[0] % n
}

  return {
    mode: 'preview',
    async getPublicConfig() {
      await wait(150)
      return { ...settings, closed_reason: settings.registrations_open ? null : 'closed', prizes: prizes.map(({ id: _id, ...p }) => p) }
    },
    async register(input) {
      await wait(700)
      const phone = '55' + input.phone.replace(/\D/g, '')
      const email = input.email.trim().toLowerCase()
      const byPhone = people.find((p) => p.phone === phone)
      const byEmail = people.find((p) => p.email === email)
      if (byPhone && byEmail && byPhone.id === byEmail.id)
        return { ok: true, existing: true, participant: { id: byPhone.id, name: byPhone.full_name, number: byPhone.number, phoneMasked: '(••) •••••-' + phone.slice(-4) }, receiptToken: 'preview', whatsapp: 'nao_configurado' }
      if (byPhone) return { ok: false, code: 'duplicate_phone', message: 'Este celular já está cadastrado. Se o cadastro é seu, use o mesmo e-mail para recuperar seu número.' }
      if (byEmail) return { ok: false, code: 'duplicate_email', message: 'Este e-mail já está cadastrado. Se o cadastro é seu, use o mesmo celular para recuperar seu número.' }
      if (!settings.registrations_open) return { ok: false, code: 'closed', message: 'As inscrições estão encerradas.' }
      settings.last_number += 1
      const p: Participant = {
        ...people[0], id: 'u' + settings.last_number, full_name: input.name.trim(), phone, email, lucky_number: settings.last_number,
        number: pad(settings.last_number), status: 'valido', status_reason: null, whatsapp_consent: input.whatsappConsent,
        whatsapp_consent_at: input.whatsappConsent ? new Date().toISOString() : null, created_at: new Date().toISOString(),
        whatsapp_status: null, whatsapp_channel: null, is_winner: false,
      }
      people.push(p)
      return {
        ok: true, existing: false, participant: { id: p.id, name: p.full_name, number: p.number, phoneMasked: `(${phone.slice(2, 4)}) •••••-${phone.slice(-4)}` },
        receiptToken: 'preview', whatsapp: input.whatsappConsent ? 'nao_configurado' : 'sem_consentimento',
      }
    },
    async requestWhatsApp() {
      await wait(600)
      return { ok: true, whatsapp: 'nao_configurado' }
    },
    admin: {
      async getSession() { return session },
      onAuthChange(cb) { listeners.add(cb); return () => listeners.delete(cb) },
      async signIn(email) { await wait(500); session = { email: email || 'admin@sunsethouse.com' }; listeners.forEach((l) => l(session)) },
      async signOut() { session = null; listeners.forEach((l) => l(null)) },
      async isAdmin() { return Boolean(session) },
      async stats() {
        await wait(200)
        const valid = people.filter((p) => p.status === 'valido')
        return {
          participants_total: people.length, participants_valid: valid.length, numbers_generated: settings.last_number,
          numbers_available: valid.filter((p) => settings.allow_same_winner || !p.is_winner).length,
          whatsapp_sent: people.filter((p) => p.whatsapp_status === 'enviado').length,
          whatsapp_pending: people.filter((p) => p.whatsapp_consent && p.status !== 'excluido' && !p.whatsapp_status).length,
          registrations_open: settings.registrations_open, max_participants: settings.max_participants,
          prizes_total: prizes.length, prizes_drawn: draws.filter((d) => d.status === 'valido').length,
          last_registration_at: people[people.length - 1]?.created_at ?? null,
        }
      },
      async participants() { await wait(200); return people.map((p) => ({ ...p })) },
      async setStatus(id, status, reason) {
        const p = people.find((x) => x.id === id)!
        log('participant_status', { from: p.status, to: status, reason, number: p.number })
        Object.assign(p, { status, status_reason: reason, status_changed_at: new Date().toISOString() })
      },
      async markManualWhatsApp(id) {
        const p = people.find((x) => x.id === id)!
        Object.assign(p, { whatsapp_status: 'enviado', whatsapp_channel: 'whatsapp_manual', whatsapp_updated_at: new Date().toISOString() })
        log('whatsapp_manual', { number: p.number })
      },
      async resendWhatsApp() { return { ok: true, whatsapp: 'nao_configurado' } },
      async waStatus() { return { configured: false, templateName: 'sunset_numero_sorte', templateLang: 'pt_BR', apiVersion: 'v23.0', webhookConfigured: false } },
      async prizes() { return prizes.map((p) => ({ ...p })) },
      async draws() { return draws.map((d) => ({ ...d })) },
      async performDraw(prizeId, redo, reason) {
        await wait(400)
        const prize = prizes.find((p) => p.id === prizeId)!
        const prev = draws.find((d) => d.prize_id === prizeId && d.status === 'valido')
        if (prev && (!redo || !reason)) throw new Error('Este prêmio já foi sorteado. Para refazer, confirme e informe o motivo.')
        if (prev) {
          Object.assign(prev, { status: 'anulado', void_reason: reason, voided_at: new Date().toISOString() })
          people.find((p) => p.id === prev.participant_id)!.is_winner = false
        }
        const voided = new Set(draws.filter((d) => d.prize_id === prizeId && d.status === 'anulado').map((d) => d.participant_id))
        const pool = people.filter((p) => p.status === 'valido' && (settings.allow_same_winner || !p.is_winner) && !voided.has(p.id))
        if (!pool.length) throw new Error('Nenhum número válido disponível para este sorteio')
        const w = pool[rand(pool.length)]
        w.is_winner = true
        const d: Draw = {
          id: 'd' + (draws.length + 1), prize_id: prize.id, round: prize.round, prize_title: prize.title, participant_id: w.id,
          lucky_number: w.lucky_number, winner_name: w.full_name, pool_size: pool.length, pool_hash: 'preview', status: 'valido',
          void_reason: null, voided_at: null, performed_by_email: session?.email ?? null, created_at: new Date().toISOString(),
        }
        draws.unshift(d)
        log('draw_performed', { round: prize.round, number: w.number, winner: w.full_name, pool_size: pool.length })
        return { draw_id: d.id, round: d.round, prize: d.prize_title, number: w.number, participant_id: w.id, name: w.full_name, phone: w.phone, email: w.email, pool_size: pool.length, pool_hash: 'preview', created_at: d.created_at }
      },
      async settings() { return { ...settings } },
      async updateSettings(patch) { Object.assign(settings, patch); log('update_settings', patch as Record<string, unknown>) },
      async savePrize(p) {
        if (p.id) Object.assign(prizes.find((x) => x.id === p.id)!, p)
        else prizes.push({ id: 'p' + Date.now(), round: p.round, title: p.title, description: p.description ?? null })
        prizes.sort((a, b) => a.round - b.round)
      },
      async deletePrize(id) {
        if (draws.some((d) => d.prize_id === id)) throw new Error('Este prêmio já tem sorteio registrado e não pode ser removido.')
        prizes.splice(prizes.findIndex((p) => p.id === id), 1)
      },
      async audit() { return audit.slice(0, 80) },
    },
  }
}
