import { Check, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

export function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

export function Checkbox({
  checked, onChange, children, error, id,
}: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode; error?: string; id: string }) {
  return (
    <div>
      <label htmlFor={id} className="flex cursor-pointer items-start gap-3 text-[14px] leading-snug">
        <span className="relative mt-0.5 shrink-0">
          <input id={id} type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)}
            aria-invalid={Boolean(error)} aria-describedby={error ? id + '-err' : undefined} />
          <span className={`grid h-6 w-6 place-items-center rounded-lg border-[2.5px] border-ink transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-ink peer-focus-visible:ring-offset-2 ${checked ? 'bg-ink text-sun' : error ? 'bg-[#fff4f1]' : 'bg-white'}`}>
            {checked && <Check className="h-4 w-4" strokeWidth={3.5} />}
          </span>
        </span>
        <span>{children}</span>
      </label>
      {error && <p id={id + '-err'} className="mt-1.5 pl-9 text-[13px] font-semibold text-[#c22a14]">{error}</p>}
    </div>
  )
}

export function Modal({
  open, onClose, title, children, wide = false,
}: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    ref.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/60 p-0 backdrop-blur-[2px] sm:items-center sm:p-6" onClick={onClose}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}
        className={`max-h-[92dvh] w-full overflow-y-auto rounded-t-[28px] border-[2.5px] border-ink bg-paper p-5 shadow-hard-lg outline-none animate-rise sm:rounded-[28px] sm:p-7 ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'}`}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="display text-2xl">{title}</h2>
          <button onClick={onClose} className="btn btn-sm btn-paper !shadow-none" aria-label="Fechar"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

type Toast = { id: number; text: string; tone: 'ok' | 'error' | 'info' }
const ToastCtx = createContext<(text: string, tone?: Toast['tone']) => void>(() => {})
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([])
  const push = useCallback((text: string, tone: Toast['tone'] = 'ok') => {
    const id = Date.now() + Math.random()
    setItems((x) => [...x, { id, text, tone }])
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 3200)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`pointer-events-auto flex max-w-sm items-center gap-2 rounded-2xl border-[2.5px] border-ink px-4 py-3 text-sm font-semibold shadow-hard animate-pop ${t.tone === 'error' ? 'bg-[#ff5a3c] text-ink' : t.tone === 'info' ? 'bg-paper text-ink' : 'bg-ink text-sun'}`}>
            {t.tone === 'ok' && <Check className="h-4 w-4 shrink-0" strokeWidth={3} />}
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

export function PreviewBanner() {
  return (
    <div className="sticky top-0 z-[70] border-b-2 border-ink bg-ink px-4 py-1.5 text-center text-[11px] font-bold uppercase tracking-wider text-sun">
      Pré-visualização · dados fictícios ·{' '}
      <Link to="/" className="underline underline-offset-2">site</Link> ·{' '}
      <Link to="/admin" className="underline underline-offset-2">painel admin</Link>
    </div>
  )
}
