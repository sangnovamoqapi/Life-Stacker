import React, { useState, useEffect, useRef } from 'react'
import { useAppContext } from '../state/AppContext'
import { ActionDiffCard } from '../components/ActionDiffCard'
import { renderSimpleMarkdown } from '../utils/markdown'
import type { ChatMessage, PendingAction } from '../types'

function extractJsonBlock(text: string): { jsonStr: string; startIndex: number; endIndex: number } | null {
  const startIdx = text.indexOf('{')
  if (startIdx === -1) return null

  let depth = 0
  let inString = false
  let escape = false
  let endIdx = -1

  for (let i = startIdx; i < text.length; i++) {
    const char = text[i]

    if (escape) {
      escape = false
      continue
    }

    if (char === '\\') {
      escape = true
      continue
    }

    if (char === '"') {
      inString = !inString
      continue
    }

    if (!inString) {
      if (char === '{') {
        depth++
      } else if (char === '}') {
        depth--
        if (depth === 0) {
          endIdx = i + 1
          break
        }
      }
    }
  }

  if (endIdx !== -1) {
    return {
      jsonStr: text.slice(startIdx, endIdx),
      startIndex: startIdx,
      endIndex: endIdx
    }
  }

  return {
    jsonStr: text.slice(startIdx),
    startIndex: startIdx,
    endIndex: text.length
  }
}

function stripToolJson(content: string): string {
  if (!content) return ''
  let cleaned = content.replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, '').trim()

  while (true) {
    const block = extractJsonBlock(cleaned)
    if (!block) break
    const { jsonStr, startIndex, endIndex } = block
    if (
      jsonStr.includes('"name"') ||
      jsonStr.includes('"function"') ||
      jsonStr.includes('"tool_name"') ||
      jsonStr.includes('"parameters"') ||
      jsonStr.includes('"action_steps"') ||
      jsonStr.includes('"items_create"') ||
      jsonStr.includes('"items_update"') ||
      jsonStr.includes('"action_steps_create"')
    ) {
      cleaned = (cleaned.slice(0, startIndex) + cleaned.slice(endIndex)).trim()
    } else {
      break
    }
  }

  return cleaned.replace(/```(?:json)?\s*```/g, '').trim()
}

export const ChatView: React.FC = () => {
  const { showToast } = useAppContext()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([])
  const [inputText, setInputText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [aiReady, setAiReady] = useState<boolean | null>(null)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const loadChatData = async () => {
    try {
      const [msgs, actions, ready] = await Promise.all([
        window.api.chat.listMessages(),
        window.api.chat.listPendingActions(),
        window.api.ai.checkStatus().catch(() => false)
      ])
      setMessages(msgs)
      setPendingActions(actions)
      setAiReady(ready)
    } catch (err) {
      console.error('Failed to load chat history:', err)
    }
  }

  useEffect(() => {
    loadChatData()
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const text = inputText.trim()
    if (!text || isLoading) return

    setInputText('')
    setIsLoading(true)

    // Optimistic user message
    const tempUserMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: text,
      created_at: new Date().toISOString()
    }
    setMessages(prev => [...prev, tempUserMsg])

    try {
      const res = await window.api.chat.send(text)
      if (res.assistantMessage) {
        setMessages(prev => [...prev.filter(m => m.id !== tempUserMsg.id), tempUserMsg, res.assistantMessage])
      }
      if (res.pendingActions && res.pendingActions.length > 0) {
        setPendingActions(prev => [...prev, ...res.pendingActions])
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to send message', 'warning')
      setMessages(prev => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: `⚠️ Failed to send message: ${err?.message || err}`,
          created_at: new Date().toISOString()
        }
      ])
    } finally {
      setIsLoading(false)
      loadChatData()
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleClearHistory = async () => {
    setShowClearConfirm(false)
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
    await window.api.chat.clearHistory()
    setMessages([])
    setPendingActions([])
    showToast('Conversation cleared', 'info')
    window.focus()
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden max-w-5xl w-full mx-auto px-6 py-4">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between pb-3 mb-2 border-b border-white/[0.08] shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-400/20 border border-amber-400/30 flex items-center justify-center text-amber-300 font-bold text-base shadow-inner">
            ✦
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-100 leading-tight">LifeStack Assistant</h1>
            <p className="text-[11px] font-mono text-slate-400">
              Conversational task & item management · Track 1
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {aiReady === false && (
            <span className="text-[10px] font-mono text-amber-400 bg-amber-400/10 border border-amber-400/30 px-2 py-1 rounded">
              ⚠️ Ollama Offline
            </span>
          )}

          {/* Clear History with inline confirmation */}
          {messages.length > 0 && (
            showClearConfirm ? (
              <div className="flex items-center gap-1.5 bg-red-500/15 border border-red-500/30 px-2.5 py-1 rounded-lg">
                <span className="text-[11px] text-red-300 font-mono">Clear all?</span>
                <button
                  type="button"
                  onClick={handleClearHistory}
                  className="px-2 py-0.5 rounded bg-red-600 hover:bg-red-500 text-white font-bold text-[10px] transition-colors"
                >
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(false)}
                  className="px-1.5 py-0.5 text-slate-400 hover:text-slate-200 text-[10px] transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowClearConfirm(true)}
                className="text-xs font-mono text-slate-400 hover:text-red-400 border border-white/[0.08] hover:border-red-400/30 px-2.5 py-1 rounded transition-colors"
              >
                Clear Chat
              </button>
            )
          )}
        </div>
      </div>

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-2 pb-4 scroll-smooth">
        {messages.length === 0 && !isLoading && (
          <div className="text-center py-16 space-y-3">
            <div className="text-4xl opacity-25">💬</div>
            <h3 className="font-serif text-lg text-slate-300 italic">How can I help with your stack today?</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Ask me to create tasks, update your progress, or search for context across all your sectors.
            </p>
            <div className="flex flex-wrap gap-2 justify-center pt-2 max-w-lg mx-auto">
              <button
                onClick={() => { setInputText('Create an item called Prepare quarterly presentation in Career'); inputRef.current?.focus() }}
                className="text-xs font-sans bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-300 px-3 py-1.5 rounded-lg transition-colors text-left"
              >
                + "Create an item in Career..."
              </button>
              <button
                onClick={() => { setInputText('What items do I have regarding Berlin or transfers?'); inputRef.current?.focus() }}
                className="text-xs font-sans bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-300 px-3 py-1.5 rounded-lg transition-colors text-left"
              >
                🔍 "Search related to Berlin..."
              </button>
              <button
                onClick={() => { setInputText('What is currently active in my stack?'); inputRef.current?.focus() }}
                className="text-xs font-sans bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-300 px-3 py-1.5 rounded-lg transition-colors text-left"
              >
                ⚡ "What is currently active?"
              </button>
            </div>
          </div>
        )}

        {messages.map(msg => {
          const isUser = msg.role === 'user'
          const attachedActions = pendingActions.filter(a => a.message_id === msg.id)

          return (
            <div 
              key={msg.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
            >
              <div className="flex items-baseline gap-2 mb-1 px-1">
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                  {isUser ? 'You' : 'Assistant'}
                </span>
                <span className="text-[9px] font-mono text-slate-600">
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              <div 
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-md ${
                  isUser 
                    ? 'bg-amber-500/15 border border-amber-500/30 text-slate-100 rounded-tr-sm' 
                    : 'bg-slate-900/65 border border-white/[0.10] backdrop-blur-md text-slate-200 rounded-tl-sm'
                }`}
              >
                {/* Message Body */}
                {(() => {
                  const cleaned = stripToolJson(msg.content)
                  if (!cleaned && attachedActions.length > 0) return null
                  return (
                    <div className="prose prose-invert prose-sm max-w-none break-words leading-relaxed">
                      {renderSimpleMarkdown(cleaned || msg.content)}
                    </div>
                  )
                })()}

                {/* Attached Pending Actions (Diff Cards) */}
                {attachedActions.length > 0 && (
                  <div className="space-y-2 mt-1">
                    {attachedActions.map(action => (
                      <ActionDiffCard 
                        key={action.id} 
                        action={action} 
                        onResolved={() => {
                          loadChatData()
                          setTimeout(() => inputRef.current?.focus(), 50)
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {isLoading && (
          <div className="flex items-start gap-2 pt-1">
            <div className="bg-slate-900/65 border border-white/[0.10] backdrop-blur-md px-4 py-3 rounded-2xl rounded-tl-sm flex items-center gap-2 text-slate-400 text-xs font-mono">
              <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span>Thinking & formulating actions...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Bottom Message Input Bar */}
      <form onSubmit={handleSend} className="shrink-0 pt-2 border-t border-white/[0.08]">
        <div className="relative flex items-center bg-slate-900/70 border border-white/[0.12] rounded-xl p-1.5 focus-within:border-amber-400/50 backdrop-blur-md shadow-lg transition-all">
          <textarea
            ref={inputRef}
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything or propose task actions... (Press Enter to send, Shift+Enter for newline)"
            rows={1}
            disabled={isLoading}
            className="flex-1 bg-transparent px-3 py-1.5 text-sm text-slate-100 placeholder-slate-500 outline-none resize-none max-h-32 min-h-[38px]"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isLoading}
            className="shrink-0 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:hover:bg-amber-500 text-slate-950 font-bold text-xs transition-all shadow active:scale-95"
          >
            Send ↵
          </button>
        </div>
      </form>
    </div>
  )
}
