import React from 'react'
import { useAppContext } from '../state/AppContext'

export const Toast: React.FC = () => {
  const { toasts, dismissToast } = useAppContext()

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map(toast => {
        let borderCol = 'border-border'
        if (toast.type === 'success') borderCol = 'border-done'
        if (toast.type === 'warning') borderCol = 'border-blocked'
        
        return (
          <div 
            key={toast.id}
            className={`bg-bg-raised border ${borderCol} shadow-lg rounded px-4 py-3 flex items-center justify-between min-w-[250px] animate-[slideUp_0.3s_ease-out] pointer-events-auto`}
          >
            <span className="text-sm text-ink">{toast.text}</span>
            <button 
              onClick={() => dismissToast(toast.id)}
              className="text-ink-dim hover:text-ink ml-4"
            >
              ✕
            </button>
          </div>
        )
      })}
    </div>
  )
}
