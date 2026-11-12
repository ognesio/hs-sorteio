import type { Ticket } from './types'

const KEY = 'sunset-house:ticket:v1'

export function loadTicket(): Ticket | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Ticket) : null
  } catch {
    return null
  }
}

export function saveTicket(t: Ticket) {
  try {
    localStorage.setItem(KEY, JSON.stringify(t))
  } catch {
    /* modo privado: o ticket continua na tela */
  }
}

export function clearTicket() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}
