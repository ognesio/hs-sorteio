export type ParticipantStatus = 'valido' | 'desclassificado' | 'excluido'
export type NotificationStatus = 'pendente' | 'enviado' | 'entregue' | 'lido' | 'falhou'

/** Resultado do WhatsApp devolvido ao participante */
export type WaState =
  | 'pendente' // aceito pela API, aguardando confirmação do webhook
  | 'falhou'
  | 'nao_configurado'
  | 'sem_consentimento'
  | 'disponivel'
  | 'ja_enviado'

export interface Prize {
  id: string
  round: number
  title: string
  description: string | null
}

export interface PublicConfig {
  event_name: string
  raffle_name: string
  raffle_description: string
  event_date: string
  rules_text: string
  registrations_open: boolean
  closed_reason: 'closed' | 'full' | null
  prizes: Omit<Prize, 'id'>[]
}

export interface RegisterInput {
  name: string
  phone: string
  email: string
  privacyConsent: boolean
  whatsappConsent: boolean
  website: string // honeypot
  startedAt: number
  turnstileToken?: string
}

export interface Ticket {
  id: string
  name: string
  number: string
  phoneMasked: string
  receiptToken: string
  whatsapp: WaState
  createdAt: string
}

export type RegisterResult =
  | { ok: true; existing: boolean; participant: { id: string; name: string; number: string; phoneMasked: string }; receiptToken: string; whatsapp: WaState }
  | { ok: false; message: string; code?: string; fieldErrors?: Record<string, string> }

export interface Participant {
  id: string
  full_name: string
  phone: string
  email: string
  lucky_number: number
  number: string
  status: ParticipantStatus
  status_reason: string | null
  status_changed_at: string | null
  privacy_consent: boolean
  privacy_consent_at: string
  whatsapp_consent: boolean
  whatsapp_consent_at: string | null
  created_at: string
  whatsapp_status: NotificationStatus | null
  whatsapp_channel: 'whatsapp_api' | 'whatsapp_manual' | null
  whatsapp_updated_at: string | null
  whatsapp_error: string | null
  is_winner: boolean
}

export interface Stats {
  participants_total: number
  participants_valid: number
  numbers_generated: number
  numbers_available: number
  whatsapp_sent: number
  whatsapp_pending: number
  registrations_open: boolean
  max_participants: number | null
  prizes_total: number
  prizes_drawn: number
  last_registration_at: string | null
}

export interface Draw {
  id: string
  prize_id: string
  round: number
  prize_title: string
  participant_id: string
  lucky_number: number
  winner_name: string
  pool_size: number
  pool_hash: string
  status: 'valido' | 'anulado'
  void_reason: string | null
  voided_at: string | null
  performed_by_email: string | null
  created_at: string
}

export interface DrawResult {
  draw_id: string
  round: number
  prize: string
  number: string
  participant_id: string
  name: string
  phone: string
  email: string
  pool_size: number
  pool_hash: string
  created_at: string
}

export interface Settings {
  event_name: string
  raffle_name: string
  raffle_description: string
  event_date: string
  registrations_open: boolean
  max_participants: number | null
  allow_same_winner: boolean
  rules_text: string
  last_number: number
  updated_at: string
}

export type SettingsPatch = Partial<Omit<Settings, 'last_number' | 'updated_at'>>

export interface AuditEntry {
  id: number
  actor_email: string | null
  action: string
  entity: string | null
  entity_id: string | null
  details: Record<string, unknown> | null
  created_at: string
}

export interface WaIntegrationStatus {
  configured: boolean
  templateName: string
  templateLang: string
  apiVersion: string
  webhookConfigured: boolean
}

export interface Backend {
  mode: 'supabase' | 'preview' | 'unconfigured'
  getPublicConfig(): Promise<PublicConfig>
  register(input: RegisterInput): Promise<RegisterResult>
  requestWhatsApp(participantId: string, receiptToken: string): Promise<{ ok: boolean; whatsapp?: WaState; message?: string }>
  admin: {
    getSession(): Promise<{ email: string } | null>
    onAuthChange(cb: (s: { email: string } | null) => void): () => void
    signIn(email: string, password: string): Promise<void>
    signOut(): Promise<void>
    isAdmin(): Promise<boolean>
    stats(): Promise<Stats>
    participants(): Promise<Participant[]>
    setStatus(id: string, status: ParticipantStatus, reason: string): Promise<void>
    markManualWhatsApp(id: string): Promise<void>
    resendWhatsApp(id: string): Promise<{ ok: boolean; whatsapp?: WaState; message?: string }>
    waStatus(): Promise<WaIntegrationStatus | null>
    prizes(): Promise<Prize[]>
    draws(): Promise<Draw[]>
    performDraw(prizeId: string, redo?: boolean, reason?: string): Promise<DrawResult>
    settings(): Promise<Settings>
    updateSettings(patch: SettingsPatch): Promise<void>
    savePrize(p: Partial<Prize> & { round: number; title: string }): Promise<void>
    deletePrize(id: string): Promise<void>
    audit(): Promise<AuditEntry[]>
  }
}
