// Integração com a WhatsApp Business Platform (Cloud API) da Meta.
// Credenciais ficam APENAS nos secrets das Edge Functions — nunca no frontend.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'

export const WA = {
  token: Deno.env.get('WHATSAPP_ACCESS_TOKEN') ?? '',
  phoneNumberId: Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') ?? '',
  templateName: Deno.env.get('WHATSAPP_TEMPLATE_NAME') ?? 'sunset_numero_sorte',
  templateLang: Deno.env.get('WHATSAPP_TEMPLATE_LANG') ?? 'pt_BR',
  apiVersion: Deno.env.get('WHATSAPP_API_VERSION') ?? 'v23.0',
  appSecret: Deno.env.get('WHATSAPP_APP_SECRET') ?? '',
  verifyToken: Deno.env.get('WHATSAPP_VERIFY_TOKEN') ?? '',
}

export const isWhatsAppConfigured = () => Boolean(WA.token && WA.phoneNumberId && WA.templateName)

export type SendResult =
  | { status: 'nao_configurado' }
  | { status: 'pendente'; messageId: string } // aceito pela API; confirmação chega pelo webhook
  | { status: 'falhou'; error: string }

/**
 * Envia o template aprovado com {{1}} = nome e {{2}} = número da sorte e
 * registra o resultado REAL na tabela notifications. Sem credenciais, não envia
 * e não registra nada (nunca simula envio).
 */
export async function sendLuckyNumber(
  db: SupabaseClient,
  p: { id: string; full_name: string; phone: string; number: string },
): Promise<SendResult> {
  if (!isWhatsAppConfigured()) return { status: 'nao_configurado' }

  const firstName = p.full_name.split(' ')[0]
  const body = {
    messaging_product: 'whatsapp',
    to: p.phone,
    type: 'template',
    template: {
      name: WA.templateName,
      language: { code: WA.templateLang },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: firstName },
            { type: 'text', text: p.number },
          ],
        },
      ],
    },
  }

  let result: SendResult
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 8000)
    const res = await fetch(`https://graph.facebook.com/${WA.apiVersion}/${WA.phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${WA.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    })
    clearTimeout(t)
    const data = await res.json().catch(() => ({}))
    const id = data?.messages?.[0]?.id as string | undefined
    if (res.ok && id) result = { status: 'pendente', messageId: id }
    else result = { status: 'falhou', error: data?.error?.message ?? `HTTP ${res.status}` }
  } catch (e) {
    result = { status: 'falhou', error: e instanceof Error ? e.message : String(e) }
  }

  await db.from('notifications').insert({
    participant_id: p.id,
    channel: 'whatsapp_api',
    status: result.status === 'pendente' ? 'pendente' : 'falhou',
    provider_message_id: result.status === 'pendente' ? result.messageId : null,
    error: result.status === 'falhou' ? result.error.slice(0, 500) : null,
  })

  return result
}
