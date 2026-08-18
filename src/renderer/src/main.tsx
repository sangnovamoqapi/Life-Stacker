import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Global Focus & Keyboard Input Watchdog for Electron / Chromium
// Permanently prevents orphaned focus state when focused inputs/buttons are unmounted, edited, or disabled
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  // 1. Force immediate native focus whenever any typable element is clicked
  document.addEventListener('pointerdown', (e) => {
    const target = e.target as HTMLElement | null
    if (!target) return
    const isTypable = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable
    if (isTypable) {
      if (document.activeElement !== target) {
        target.focus()
      }
    }
  }, { capture: true, passive: true })

  // 2. Watch for unmounting of currently focused DOM nodes
  const originalRemoveChild = Node.prototype.removeChild
  Node.prototype.removeChild = function <T extends Node>(child: T): T {
    const activeEl = document.activeElement
    if (activeEl && (child === (activeEl as unknown as Node) || (child instanceof Element && child.contains(activeEl)))) {
      if (activeEl instanceof HTMLElement) {
        activeEl.blur()
      }
      window.focus()
    }
    return originalRemoveChild.call(this, child) as T
  }

  // 3. Focus recovery watchdog when focus is lost or reset to body
  document.addEventListener('focusout', () => {
    requestAnimationFrame(() => {
      if (!document.activeElement || document.activeElement === document.body || !document.contains(document.activeElement)) {
        window.focus()
      }
    })
  }, { passive: true })
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
