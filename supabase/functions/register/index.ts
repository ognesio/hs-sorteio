// POST /functions/v1/register — cadastro público + número da sorte
// Validação no servidor, anti-spam (honeypot, tempo mínimo, rate limit por IP,
// Cloudflare Turnstile opcional) e gravação atômica via RPC.
import {
  clientIp, corsHeaders, json, normalizeEmail, normalizeName, normalizePhone, randomToken, serviceClient, sha256,
} from '../_shared/common.ts'
import { isWhatsAppConfigured, sendLuckyNumber } from '../_shared/whatsapp.ts'

const RATE_LIMIT_PER_IP = Number(Deno.env.get('RATE_LIMIT_PER_IP') ?? 40) // por janela de 10 min (Wi-Fi da festa é compartilhado)
const MIN_FILL_MS = 2500
const TURNSTILE_SECRET = Deno.env.get('TURNSTILE_SECRET_KEY') ?? ''
const IP_SALT = Deno.env.get('IP_HASH_SALT') ?? 'sunset-house'

const ERRORS: Record<string, [number, string]> = {
  closed: [409, 'As inscrições estão encerradas.'],
  full: [409, 'O limite de participantes foi atingido.'],
  duplicate_phone: [409, 'Este celular já está cadastrado. Se o cadastro é seu, use o mesmo e-mail para recuperar seu número.'],
  duplicate_email: [409, 'Este e-mail já está cadastrado. Se o cadastro é seu, use o mesmo celular para recuperar seu número.'],
  duplicate: [409, 'Cadastro já existente. Tente novamente.'],
  not_eligible: [409, 'Este cadastro não está apto a participar. Procure a organização.'],
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
  if (req.method !== 'POST') return json(req, { ok: false, message: 'Método não permitido' }, 405)

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json(req, { ok: false, message: 'Requisição inválida.' }, 400)
  }

  // Honeypot e tempo mínimo de preenchimento (bots)
  if (body.website) return json(req, { ok: false, message: 'Não foi possível concluir o cadastro.' }, 400)
  const startedAt = Number(body.startedAt ?? 0)
  if (!startedAt || Date.now() - startedAt < MIN_FILL_MS) {
    return json(req, { ok: false, message: 'Confira seus dados e tente novamente.' }, 400)
  }

  const db = serviceClient()
  const ipHash = await sha256(IP_SALT + clientIp(req))
  const { data: allowed } = await db.rpc('hit_rate_limit', { p_key: 'reg:' + ipHash, p_limit: RATE_LIMIT_PER_IP, p_window_seconds: 600 })
  if (allowed === false) {
    return json(req, { ok: false, message: 'Muitas tentativas a partir desta rede. Aguarde alguns minutos.' }, 429)
  }

  if (TURNSTILE_SECRET) {
    const form = new FormData()
    form.append('secret', TURNSTILE_SECRET)
    form.append('response', String(body.turnstileToken ?? ''))
    form.append('remoteip', clientIp(req))
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form })
    const v = await r.json().catch(() => ({ success: false }))
    if (!v.success) return json(req, { ok: false, message: 'Verificação anti-robô falhou. Tente novamente.' }, 400)
  }

  const name = normalizeName(String(body.name ?? ''))
  const phone = normalizePhone(String(body.phone ?? ''))
  const email = normalizeEmail(String(body.email ?? ''))
  const fieldErrors: Record<string, string> = {}
  if (!name) fieldErrors.name = 'Informe nome e sobrenome.'
  if (!phone) fieldErrors.phone = 'Informe um celular válido com DDD.'
  if (!email) fieldErrors.email = 'Informe um e-mail válido.'
  if (body.privacyConsent !== true) fieldErrors.privacyConsent = 'É preciso aceitar o regulamento e a política de privacidade.'
  if (Object.keys(fieldErrors).length) {
    return json(req, { ok: false, message: 'Confira os campos destacados.', fieldErrors }, 422)
  }
  const whatsappConsent = body.whatsappConsent === true

  const receiptToken = randomToken()
  const { data, error } = await db.rpc('register_participant', {
    p_name: name,
    p_phone: phone,
    p_email: email,
    p_whatsapp_consent: whatsappConsent,
    p_token_hash: await sha256(receiptToken),
    p_ip_hash: ipHash,
    p_user_agent: req.headers.get('user-agent') ?? '',
  })
  if (error || !data) {
    console.error('register_participant', error)
    return json(req, { ok: false, message: 'Não foi possível salvar seu cadastro agora. Tente novamente.' }, 500)
  }
  if (!data.ok) {
    const [status, message] = ERRORS[data.code] ?? [400, 'Não foi possível concluir o cadastro.']
    return json(req, { ok: false, code: data.code, message }, status)
  }

  // WhatsApp: envia somente com consentimento explícito e API configurada
  let whatsapp: string = data.whatsapp_consent ? 'nao_configurado' : 'sem_consentimento'
  if (whatsappConsent && !data.existing) {
    if (isWhatsAppConfigured()) {
      const r = await sendLuckyNumber(db, { id: data.id, full_name: data.name, phone: data.phone, number: data.number })
      whatsapp = r.status
    }
  } else if (data.existing && data.whatsapp_consent) {
    whatsapp = isWhatsAppConfigured() ? 'disponivel' : 'nao_configurado'
  }

  return json(req, {
    ok: true,
    existing: data.existing,
    participant: { id: data.id, name: data.name, number: data.number, phoneMasked: maskPhone(data.phone) },
    receiptToken,
    whatsapp,
  })
})

function maskPhone(p: string) {
  const d = p.slice(2)
  return `(${d.slice(0, 2)}) •••••-${d.slice(7)}`
}
