// Webhook da Meta: atualiza o status REAL das mensagens (sent / delivered / read / failed).
// GET  → verificação do webhook (hub.challenge)
// POST → eventos, com assinatura X-Hub-Signature-256 validada pelo App Secret
import { serviceClient } from '../_shared/common.ts'
import { WA } from '../_shared/whatsapp.ts'

const MAP: Record<string, string> = { sent: 'enviado', delivered: 'entregue', read: 'lido', failed: 'falhou' }
const RANK: Record<string, number> = { pendente: 0, falhou: 1, enviado: 2, entregue: 3, lido: 4 }

async function validSignature(raw: string, header: string | null) {
  if (!WA.appSecret || !header?.startsWith('sha256=')) return false
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(WA.appSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw))
  const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('')
  const expected = header.slice(7)
  if (hex.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ expected.charCodeAt(i)
  return diff === 0
}

Deno.serve(async (req) => {
  const url = new URL(req.url)
  if (req.method === 'GET') {
    const ok = url.searchParams.get('hub.mode') === 'subscribe' && WA.verifyToken && url.searchParams.get('hub.verify_token') === WA.verifyToken
    return ok ? new Response(url.searchParams.get('hub.challenge') ?? '', { status: 200 }) : new Response('forbidden', { status: 403 })
  }
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 })

  const raw = await req.text()
  if (!(await validSignature(raw, req.headers.get('x-hub-signature-256')))) return new Response('invalid signature', { status: 401 })

  const payload = JSON.parse(raw)
  const db = serviceClient()
  for (const entry of payload?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      for (const st of change?.value?.statuses ?? []) {
        const status = MAP[st.status]
        if (!status || !st.id) continue
        const { data: current } = await db.from('notifications').select('id, status').eq('provider_message_id', st.id).maybeSingle()
        if (!current) continue
        // não regride status (ex.: "delivered" chegando depois de "read")
        if (status !== 'falhou' && RANK[status] <= RANK[current.status]) continue
        await db.from('notifications').update({
          status,
          error: status === 'falhou' ? (st.errors?.[0]?.title ?? st.errors?.[0]?.message ?? 'falhou') : null,
          updated_at: new Date().toISOString(),
        }).eq('id', current.id)
      }
    }
  }
  return new Response('ok', { status: 200 })
})
