import { createMockBackend } from './backend-mock'
import { createSupabaseBackend } from './backend-supabase'
import type { Backend } from './types'

export const IS_PREVIEW = import.meta.env.VITE_PREVIEW_MODE === 'true'
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
export const TURNSTILE_SITE_KEY = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined) || ''

function unconfigured(): Backend {
  const fail = async () => {
    throw new Error('Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.')
  }
  const admin = new Proxy({}, { get: (_t, prop) => (prop === 'onAuthChange' ? () => () => {} : prop === 'getSession' ? async () => null : fail) })
  return { mode: 'unconfigured', getPublicConfig: fail, register: fail, requestWhatsApp: fail, admin } as unknown as Backend
}

export const backend: Backend = IS_PREVIEW ? createMockBackend() : url && key ? createSupabaseBackend(url, key) : unconfigured()
