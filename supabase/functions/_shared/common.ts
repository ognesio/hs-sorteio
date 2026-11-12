// Utilitários compartilhados pelas Edge Functions (Deno)
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '*')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? ''
  const allow = ALLOWED_ORIGINS.includes('*') ? '*' : ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0] ?? ''
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    Vary: 'Origin',
  }
}

export function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json; charset=utf-8' },
  })
}

export function serviceClient(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function randomToken(bytes = 24): string {
  const a = crypto.getRandomValues(new Uint8Array(bytes))
  return btoa(String.fromCharCode(...a)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function clientIp(req: Request): string {
  return (
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-real-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  )
}

/** Retorna o usuário admin autenticado (via JWT do Supabase Auth) ou null. */
export async function getAdmin(req: Request, db: SupabaseClient) {
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.replace(/^Bearer\s+/i, '')
  if (!token) return null
  const { data, error } = await db.auth.getUser(token)
  if (error || !data.user) return null
  const { data: adm } = await db.from('admins').select('user_id,email').eq('user_id', data.user.id).maybeSingle()
  return adm ? { id: data.user.id, email: adm.email as string } : null
}

// ---------------------------------------------------------------------
// Validação (espelha as regras do frontend — o servidor é a fonte da verdade)
// ---------------------------------------------------------------------
const VALID_DDD = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38, 41, 42, 43, 44, 45, 46, 47, 48, 49,
  51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69, 71, 73, 74, 75, 77, 79, 81, 82, 83, 84, 85, 86, 87, 88, 89, 91, 92,
  93, 94, 95, 96, 97, 98, 99,
])

/** Normaliza para 55 + DDD + 9 dígitos. Retorna null se não for celular brasileiro válido. */
export function normalizePhone(raw: string): string | null {
  let d = String(raw ?? '').replace(/\D/g, '')
  if (d.length === 13 && d.startsWith('55')) d = d.slice(2)
  if (d.length !== 11) return null
  if (!VALID_DDD.has(Number(d.slice(0, 2)))) return null
  if (d[2] !== '9') return null
  if (/^(\d)\1+$/.test(d.slice(2))) return null
  return '55' + d
}

export function normalizeName(raw: string): string | null {
  const n = String(raw ?? '').replace(/\s+/g, ' ').trim()
  if (n.length < 3 || n.length > 120) return null
  if (!/^[\p{L}][\p{L}' .-]*$/u.test(n)) return null
  if (n.split(' ').filter(Boolean).length < 2) return null
  return n
}

export function normalizeEmail(raw: string): string | null {
  const e = String(raw ?? '').trim().toLowerCase()
  if (e.length > 160) return null
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) return null
  return e
}
