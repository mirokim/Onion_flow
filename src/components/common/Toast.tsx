import { create } from 'zustand'
import { cn } from '@/lib/utils'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

interface ToastItem {
  id: string
  message: string
  type: ToastType
  duration?: number
}

interface ToastState {
  toasts: ToastItem[]
  addToast: (message: string, type?: ToastType, duration?: number) => void
  removeToast: (id: string) => void
}

let toastCounter = 0

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (message, type = 'info', duration = 4000) => {
    const id = `toast-${++toastCounter}`
    set((s) => ({ toasts: [...s.toasts, { id, message, type, duration }] }))
    if (duration > 0) {
      setTimeout(() => {
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
      }, duration)
    }
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

export const toast = {
  success: (msg: string) => useToastStore.getState().addToast(msg, 'success'),
  error: (msg: string) => useToastStore.getState().addToast(msg, 'error', 6000),
  warning: (msg: string) => useToastStore.getState().addToast(msg, 'warning'),
  info: (msg: string) => useToastStore.getState().addToast(msg, 'info'),
}

const TYPE_STYLES: Record<ToastType, string> = {
  success: 'border-l-green-500 bg-green-500/10',
  error: 'border-l-red-500 bg-red-500/10',
  warning: 'border-l-yellow-500 bg-yellow-500/10',
  info: 'border-l-blue-500 bg-blue-500/10',
}

const TYPE_ICONS: Record<ToastType, string> = {
  success: '\u2713',
  error: '\u2717',
  warning: '\u26A0',
  info: '\u2139',
}

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore()

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            'border-l-4 rounded shadow-lg px-4 py-3 text-sm text-text-primary',
            'animate-in slide-in-from-right-5 fade-in duration-200',
            'backdrop-blur-sm',
            TYPE_STYLES[t.type],
          )}
          role="alert"
        >
          <div className="flex items-start gap-2">
            <span className="text-base leading-none mt-0.5">{TYPE_ICONS[t.type]}</span>
            <span className="flex-1">{t.message}</span>
            <button
              onClick={() => removeToast(t.id)}
              className="text-text-muted hover:text-text-primary text-xs ml-2"
              aria-label="닫기"
            >
              &#x2715;
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
