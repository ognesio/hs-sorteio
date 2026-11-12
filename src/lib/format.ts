export const VALID_DDD = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38, 41, 42, 43, 44, 45, 46, 47, 48, 49,
  51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69, 71, 73, 74, 75, 77, 79, 81, 82, 83, 84, 85, 86, 87, 88, 89, 91, 92,
  93, 94, 95, 96, 97, 98, 99,
])

/** Máscara (11) 99999-9999 enquanto digita */
export function maskPhone(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 11)
  if (d.length === 0) return ''
  if (d.length < 3) return `(${d}`
  if (d.length < 8) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

/** "5511999999999" → "(11) 99999-9999" */
export function displayPhone(e164: string): string {
  const d = e164.replace(/\D/g, '').replace(/^55(?=\d{11}$)/, '')
  return maskPhone(d)
}

export function validatePhone(value: string): string | null {
  const d = value.replace(/\D/g, '')
  if (d.length === 0) return 'Informe seu celular com DDD.'
  if (d.length !== 11) return 'O celular precisa ter DDD + 9 dígitos.'
  if (!VALID_DDD.has(Number(d.slice(0, 2)))) return 'DDD inválido.'
  if (d[2] !== '9') return 'Informe um número de celular (começa com 9).'
  if (/^(\d)\1+$/.test(d.slice(2))) return 'Celular inválido.'
  return null
}

export function validateName(value: string): string | null {
  const n = value.replace(/\s+/g, ' ').trim()
  if (!n) return 'Informe seu nome completo.'
  if (n.split(' ').length < 2) return 'Informe nome e sobrenome.'
  if (n.length > 120) return 'Nome muito longo.'
  if (!/^[\p{L}][\p{L}' .-]*$/u.test(n)) return 'Use apenas letras no nome.'
  return null
}

export function validateEmail(value: string): string | null {
  const e = value.trim()
  if (!e) return 'Informe seu e-mail.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) return 'E-mail inválido. Ex.: nome@email.com'
  return null
}

export const pad = (n: number) => String(n).padStart(4, '0')

export function firstName(full: string) {
  return full.trim().split(/\s+/)[0] ?? full
}

export function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
}

export function fmtFull(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium', timeZone: 'America/Sao_Paulo' })
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  }
}
