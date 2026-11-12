// POST /functions/v1/whatsapp-send
//  • Participante: { participantId, receiptToken }  → autoriza e envia o número
//  • Admin (Bearer JWT): { participantId }           → reenvia pela API
//  • Admin (Bearer JWT): { action: 'status' }        → status da integração
import { corsHeaders, getAdmin, json, serviceClient, sha256 } from '../_shared/common.ts'
import { isWhatsAppConfigured, sendLuckyNumber, WA } from '../_shared/whatsapp.ts'

const MAX_API_ATTEMPTS = 3

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
  if (req.method !== 'POST') return json(req, { ok: false, message: 'Método não permitido' }, 405)

  const db = serviceClient()
  const body = await req.json().catch(() => ({}))
  const admin = await getAdmin(req, db)

  if (body.action === 'status') {
    if (!admin) return json(req, { ok: false, message: 'Não autorizado' }, 401)
    return json(req, {
      ok: true,
      configured: isWhatsAppConfigured(),
      templateName: WA.templateName,
      templateLang: WA.templateLang,
      apiVersion: WA.apiVersion,
      webhookConfigured: Boolean(WA.appSecret && WA.verifyToken),
    })
  }

  const participantId = String(body.participantId ?? '')
  if (!/^[0-9a-f-]{36}$/i.test(participantId)) return json(req, { ok: false, message: 'Participante inválido.' }, 400)

  const { data: p } = await db
    .from('participants')
    .select('id, full_name, phone, lucky_number, status, whatsapp_consent, receipt_token_hash')
    .eq('id', participantId)
    .maybeSingle()
  if (!p) return json(req, { ok: false, message: 'Participante não encontrado.' }, 404)

  if (!admin) {
    const token = String(body.receiptToken ?? '')
    if (!token || (await sha256(token)) !== p.receipt_token_hash) {
      return json(req, { ok: false, message: 'Não autorizado.' }, 401)
    }
    // O clique em "RECEBER PELO WHATSAPP" é a autorização explícita do participante
    if (!p.whatsapp_consent) {
      await db.from('participants').update({ whatsapp_consent: true, whatsapp_consent_at: new Date().toISOString() }).eq('id', p.id)
    }
  } else if (!p.whatsapp_consent) {
    return json(req, { ok: false, message: 'Este participante não autorizou o envio por WhatsApp.' }, 409)
  }

  if (p.status !== 'valido') return json(req, { ok: false, message: 'Cadastro não está ativo.' }, 409)
  if (!isWhatsAppConfigured()) return json(req, { ok: true, whatsapp: 'nao_configurado' })

  const { data: history } = await db
    .from('notifications')
    .select('status, channel, provider_message_id')
    .eq('participant_id', p.id)
  const delivered = (history ?? []).some((n) => ['enviado', 'entregue', 'lido'].includes(n.status) || (n.status === 'pendente' && n.provider_message_id))
  if (delivered && !admin) return json(req, { ok: true, whatsapp: 'ja_enviado' })
  const attempts = (history ?? []).filter((n) => n.channel === 'whatsapp_api').length
  if (attempts >= MAX_API_ATTEMPTS && !admin) return json(req, { ok: false, message: 'Limite de tentativas atingido. Procure a organização.' }, 429)

  const number = String(p.lucky_number).padStart(4, '0')
  const r = await sendLuckyNumber(db, { id: p.id, full_name: p.full_name, phone: p.phone, number })
  if (admin) {
    await db.from('audit_log').insert({ actor: admin.id, actor_email: admin.email, action: 'whatsapp_api_resend', entity: 'participant', entity_id: p.id, details: { result: r.status } })
  }
  return json(req, { ok: r.status !== 'falhou', whatsapp: r.status, message: r.status === 'falhou' ? 'O WhatsApp recusou o envio agora.' : undefined })
})
