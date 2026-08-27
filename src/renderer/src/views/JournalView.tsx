import React, { useState, useEffect, useMemo, useRef } from 'react'
import type { JournalEntry } from '../../preload/types'
import { useAppContext } from '../state/AppContext'

interface DangerConfig {
  type: 'time' | 'words'
  timeSeconds: number
  targetWords: number
}

export const JournalView: React.FC = () => {
  const { showToast } = useAppContext()
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDateFilter, setSelectedDateFilter] = useState<string | null>(null)

  // Main Composer state
  const [mainContent, setMainContent] = useState('')
  const [mainAttachments, setMainAttachments] = useState<string[]>([])
  const [activeReplyParentId, setActiveReplyParentId] = useState<string | null>(null)
  const [replyContent, setReplyContent] = useState('')
  const [replyAttachments, setReplyAttachments] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)

  // Danger Mode State
  const [showDangerModal, setShowDangerModal] = useState(false)
  const [dangerTargetParentId, setDangerTargetParentId] = useState<string | null>(null) // null = root entry, or parentId for thread
  const [dangerConfig, setDangerConfig] = useState<DangerConfig>({
    type: 'time',
    timeSeconds: 180, // 3 minutes default
    targetWords: 100
  })
  const [isDangerActive, setIsDangerActive] = useState(false)
  const [dangerSecondsLeft, setDangerSecondsLeft] = useState(180)
  const [inactivitySeconds, setInactivitySeconds] = useState(0) // 0 to 5 seconds
  const [dangerWordCount, setDangerWordCount] = useState(0)

  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null)
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null)
  const lastKeyStrokeRef = useRef<number>(Date.now())
  const composerTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const replyTextareaRef = useRef<HTMLTextAreaElement | null>(null)

  const loadEntries = async () => {
    try {
      setIsLoading(true)
      const data = await window.api.journal.list()
      setEntries(data || [])
    } catch (err: any) {
      showToast('Failed to load journal entries', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadEntries()
  }, [])

  // ─── Danger Mode Logic (Squibler Inactivity & Countdown) ───
  const startDangerSession = (parentId: string | null = null) => {
    setDangerTargetParentId(parentId)
    setIsDangerActive(true)
    setShowDangerModal(false)
    setInactivitySeconds(0)
    lastKeyStrokeRef.current = Date.now()

    if (dangerConfig.type === 'time') {
      setDangerSecondsLeft(dangerConfig.timeSeconds)
    } else {
      setDangerWordCount(0)
    }

    if (parentId) {
      setActiveReplyParentId(parentId)
      setReplyContent('')
      setTimeout(() => replyTextareaRef.current?.focus(), 50)
    } else {
      setMainContent('')
      setTimeout(() => composerTextareaRef.current?.focus(), 50)
    }

    showToast(`⚡ Danger Mode Activated! Keep typing or lose progress.`, 'warning')
  }

  const cancelDangerSession = () => {
    setIsDangerActive(false)
    setInactivitySeconds(0)
    if (inactivityTimerRef.current) clearInterval(inactivityTimerRef.current)
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current)
  }

  const handleDangerTyping = (text: string, isReply: boolean = false) => {
    lastKeyStrokeRef.current = Date.now()
    setInactivitySeconds(0)

    const words = text.trim() ? text.trim().split(/\s+/).length : 0
    setDangerWordCount(words)

    if (isReply) {
      setReplyContent(text)
    } else {
      setMainContent(text)
    }

    // Word target goal check
    if (dangerConfig.type === 'words' && words >= dangerConfig.targetWords) {
      completeDangerSuccess(text, isReply ? activeReplyParentId : null)
    }
  }

  const completeDangerSuccess = async (contentToSave: string, parentId: string | null) => {
    cancelDangerSession()
    if (!contentToSave.trim()) return

    try {
      const attachments = parentId ? replyAttachments : mainAttachments
      await window.api.journal.save(contentToSave.trim(), attachments, parentId || undefined)
      if (parentId) {
        setReplyContent('')
        setReplyAttachments([])
      } else {
        setMainContent('')
        setMainAttachments([])
      }
      showToast('🎉 Danger Session Completed & Saved! Continue threading below.', 'success')
      await loadEntries()
    } catch (err) {
      showToast('Error saving danger entry', 'error')
    }
  }

  const triggerDangerFailure = () => {
    cancelDangerSession()
    if (dangerTargetParentId) {
      setReplyContent('')
    } else {
      setMainContent('')
    }
    showToast('💥 Danger Mode Failed! You paused for too long.', 'error')
  }

  // Active Danger Mode Inactivity & Timer interval
  useEffect(() => {
    if (!isDangerActive) return

    // Inactivity ticker (checks every 200ms)
    inactivityTimerRef.current = setInterval(() => {
      const elapsedSinceKey = (Date.now() - lastKeyStrokeRef.current) / 1000
      setInactivitySeconds(elapsedSinceKey)

      if (elapsedSinceKey >= 5.0) {
        triggerDangerFailure()
      }
    }, 200)

    // Time countdown ticker (if mode is time)
    if (dangerConfig.type === 'time') {
      countdownTimerRef.current = setInterval(() => {
        setDangerSecondsLeft(prev => {
          if (prev <= 1) {
            const textToSave = dangerTargetParentId ? replyContent : mainContent
            completeDangerSuccess(textToSave, dangerTargetParentId)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }

    return () => {
      if (inactivityTimerRef.current) clearInterval(inactivityTimerRef.current)
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current)
    }
  }, [isDangerActive, dangerConfig, dangerTargetParentId, mainContent, replyContent])

  // ─── Attachments Handling ───
  const handlePickAttachments = async (isReply: boolean = false) => {
    try {
      const paths = await window.api.journal.selectAttachment()
      if (paths && paths.length > 0) {
        if (isReply) {
          setReplyAttachments(prev => [...prev, ...paths])
        } else {
          setMainAttachments(prev => [...prev, ...paths])
        }
      }
    } catch {
      showToast('Error selecting attachments', 'error')
    }
  }

  const handleSaveEntry = async (contentToSave: string, attachments: string[], parentId?: string) => {
    if (!contentToSave.trim() && attachments.length === 0) return

    setIsSaving(true)
    try {
      await window.api.journal.save(contentToSave.trim(), attachments, parentId)
      if (parentId) {
        setReplyContent('')
        setReplyAttachments([])
        setActiveReplyParentId(null)
      } else {
        setMainContent('')
        setMainAttachments([])
      }
      showToast('Journal entry saved', 'success')
      await loadEntries()
    } catch {
      showToast('Failed to save journal entry', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteEntry = async (id: string) => {
    if (!window.confirm('Delete this journal entry and any threaded replies?')) return
    try {
      await window.api.journal.delete(id)
      showToast('Journal entry deleted', 'info')
      setEntries(prev => prev.filter(e => e.id !== id && e.parent_id !== id))
    } catch {
      showToast('Failed to delete entry', 'error')
    }
  }

  const getMediaUrl = (filePath: string) => {
    // Robust URL construction for media://
    const normalized = filePath.replace(/\\/g, '/')
    return `media://app/${encodeURIComponent(normalized)}`
  }

  const formatRelativeTime = (isoString: string) => {
    const date = new Date(isoString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffMins = Math.floor(diffMs / (1000 * 60))

    if (diffDays === 0) {
      if (diffHours === 0) {
        return diffMins <= 1 ? 'Just now' : `${diffMins}m ago`
      }
      return `${diffHours}h ago`
    }
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 30) return `${diffDays} days ago`
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  }

  // ─── Hierarchy / Thread Construction ───
  const { rootEntries, threadMap, entriesByDateMap, dateGutterDays } = useMemo(() => {
    const roots: JournalEntry[] = []
    const childrenMap: Record<string, JournalEntry[]> = {}
    const dateMap: Record<string, JournalEntry[]> = {}

    entries.forEach(e => {
      const dateStr = e.created_at.slice(0, 10)
      if (!dateMap[dateStr]) dateMap[dateStr] = []
      dateMap[dateStr].push(e)

      if (!e.parent_id) {
        roots.push(e)
      } else {
        if (!childrenMap[e.parent_id]) childrenMap[e.parent_id] = []
        childrenMap[e.parent_id].push(e)
      }
    })

    // Generate 45-day gutter list
    const daysList: { dateStr: string; dayLetter: string; dayNum: number; monthLabel: string | null; hasEntries: boolean; count: number }[] = []
    const now = new Date()
    let lastMonth = ''

    for (let i = 0; i < 45; i++) {
      const d = new Date(now)
      d.setDate(now.getDate() - i)
      const dateStr = d.toISOString().slice(0, 10)
      const dayLetter = ['S', 'M', 'T', 'W', 'T', 'F', 'S'][d.getDay()]
      const dayNum = d.getDate()
      const currentMonth = d.toLocaleString('default', { month: 'short', year: 'numeric' })
      const monthLabel = currentMonth !== lastMonth ? currentMonth : null
      lastMonth = currentMonth

      const dayEntries = dateMap[dateStr] || []
      daysList.push({
        dateStr,
        dayLetter,
        dayNum,
        monthLabel,
        hasEntries: dayEntries.length > 0,
        count: dayEntries.length
      })
    }

    return {
      rootEntries: roots,
      threadMap: childrenMap,
      entriesByDateMap: dateMap,
      dateGutterDays: daysList
    }
  }, [entries])

  // Filter root entries by search query or selected date
  const filteredRootEntries = rootEntries.filter(root => {
    if (selectedDateFilter) {
      const threadAll = [root, ...(threadMap[root.id] || [])]
      const matchesDate = threadAll.some(e => e.created_at.slice(0, 10) === selectedDateFilter)
      if (!matchesDate) return false
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const threadAll = [root, ...(threadMap[root.id] || [])]
      return threadAll.some(e => e.content.toLowerCase().includes(q))
    }
    return true
  })

  const todayHeaderStr = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })

  return (
    <div className="flex-1 flex overflow-hidden bg-surface-base text-text-primary">
      {/* ═══════════════════════════════════════════════════════════════════════
          LEFT DATE GUTTER (Reference Image 2)
         ═══════════════════════════════════════════════════════════════════════ */}
      <aside className="w-44 border-r border-border-subtle bg-surface-raised flex flex-col shrink-0 select-none overflow-y-auto">
        <div className="p-3.5 border-b border-border-subtle flex items-center justify-between">
          <span className="text-[11px] font-mono font-bold text-accent bg-accent-subtle px-2 py-0.5 rounded-md border border-accent/20">
            {entries.length} entries
          </span>
          {selectedDateFilter && (
            <button
              type="button"
              onClick={() => setSelectedDateFilter(null)}
              className="text-[10px] font-mono text-text-muted hover:text-text-primary underline cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>

        <div className="py-3 px-3 space-y-1">
          {dateGutterDays.map((d, idx) => {
            const isSelected = selectedDateFilter === d.dateStr
            const isToday = idx === 0

            return (
              <div key={d.dateStr} className="space-y-1">
                {d.monthLabel && (
                  <div className="text-[10px] font-mono font-bold uppercase text-text-muted pt-3 pb-1 border-t border-border-subtle/40">
                    {d.monthLabel}
                  </div>
                )}

                <div
                  onClick={() => d.hasEntries && setSelectedDateFilter(isSelected ? null : d.dateStr)}
                  className={`flex items-center justify-between px-2 py-1 rounded-md text-xs font-mono transition-all ${
                    isSelected
                      ? 'bg-accent text-white font-bold shadow-soft'
                      : d.hasEntries
                      ? 'text-text-primary hover:bg-surface-subtle font-semibold cursor-pointer'
                      : 'text-text-muted/50 cursor-default'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className={isToday ? 'text-accent font-bold' : isSelected ? 'text-white' : 'text-text-muted'}>
                      {d.dayLetter}
                    </span>
                    <span className={isToday ? 'font-bold underline' : ''}>{d.dayNum}</span>
                  </div>

                  {/* Indicator Dots for Entries */}
                  {d.hasEntries && (
                    <span className="text-accent text-[11px] tracking-tighter" title={`${d.count} entries`}>
                      {Array.from({ length: Math.min(3, d.count) }).map((_, i) => '•').join('')}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </aside>

      {/* ═══════════════════════════════════════════════════════════════════════
          MAIN CENTER FEED & COMPOSER
         ═══════════════════════════════════════════════════════════════════════ */}
      <main className="flex-1 flex flex-col overflow-hidden bg-surface-base">
        {/* Header Strip */}
        <header className="px-8 py-3.5 border-b border-border-subtle flex items-center justify-between shrink-0 bg-surface-card">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-text-muted">
              {todayHeaderStr}
            </span>
            {selectedDateFilter && (
              <span className="text-[11px] font-mono text-accent bg-accent-subtle px-2 py-0.5 rounded border border-accent/30">
                Filtered: {selectedDateFilter}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search thoughts & threads..."
              className="w-56 bg-surface-input border border-border-subtle rounded-lg px-3 py-1 text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-accent font-sans"
            />
          </div>
        </header>

        {/* Timeline Content */}
        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-8">
          <div className="max-w-3xl mx-auto space-y-8 pb-20">

            {/* ─── Main Root Composer ─── */}
            <div className={`bg-surface-card border rounded-2xl p-5 shadow-soft space-y-3.5 transition-all ${
              isDangerActive && !activeReplyParentId
                ? inactivitySeconds > 3.0
                  ? 'border-blocked shadow-lg animate-pulse ring-2 ring-blocked'
                  : 'border-accent shadow-md'
                : 'border-border-subtle'
            }`}>
              {/* Composer Header & Danger Button */}
              <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
                <span className="text-xs font-mono font-medium text-text-secondary">
                  What are you thinking?
                </span>

                <div className="flex items-center gap-2 relative">
                  {/* Danger Mode Configuration Trigger */}
                  {!isDangerActive && (
                    <button
                      type="button"
                      onClick={() => {
                        setDangerTargetParentId(null)
                        setShowDangerModal(prev => !prev)
                      }}
                      className="flex items-center gap-1 text-xs font-mono px-2.5 py-1 rounded-lg border border-accent/40 bg-accent-subtle text-accent hover:bg-accent hover:text-white transition-all cursor-pointer shadow-soft"
                      title="Configure Squibler Danger Mode"
                    >
                      <span>⚡</span> Danger Mode
                    </button>
                  )}

                  {/* Danger Mode Active HUD */}
                  {isDangerActive && !activeReplyParentId && (
                    <div className="flex items-center gap-2 text-xs font-mono bg-surface-subtle px-3 py-1 rounded-lg border border-accent">
                      {dangerConfig.type === 'time' ? (
                        <span className="font-bold text-accent">⏱️ {dangerSecondsLeft}s left</span>
                      ) : (
                        <span className="font-bold text-accent">✍️ {dangerWordCount}/{dangerConfig.targetWords} words</span>
                      )}
                      <span className={`text-[10px] ${inactivitySeconds > 3 ? 'text-blocked font-bold' : 'text-text-muted'}`}>
                        (Pause: {inactivitySeconds.toFixed(1)}s / 5s)
                      </span>
                      <button
                        type="button"
                        onClick={cancelDangerSession}
                        className="text-text-muted hover:text-blocked text-xs ml-1 cursor-pointer"
                        title="Cancel Danger Mode"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  {/* Media Attachment Button */}
                  {!isDangerActive && (
                    <button
                      type="button"
                      onClick={() => handlePickAttachments(false)}
                      className="flex items-center gap-1 text-xs font-mono text-text-secondary hover:text-accent border border-border-subtle bg-surface-subtle px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                    >
                      📎 Attach
                    </button>
                  )}
                </div>
              </div>

              {/* Danger Mode Options Dropdown / Popover */}
              {showDangerModal && !isDangerActive && (
                <div className="p-3.5 bg-surface-subtle border border-border-subtle rounded-xl space-y-3 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold font-sans text-text-primary flex items-center gap-1.5">
                      <span>⚡</span> Honest Writing Session (Squibler Mode)
                    </span>
                    <span className="text-[10px] font-mono text-text-muted">Pause &gt; 5s = Lost</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block font-mono text-[10px] text-text-muted mb-1">Target Mode</label>
                      <div className="flex bg-surface-card p-0.5 rounded border border-border-subtle">
                        <button
                          type="button"
                          onClick={() => setDangerConfig(c => ({ ...c, type: 'time' }))}
                          className={`flex-1 py-1 text-center font-mono rounded text-[11px] transition-all cursor-pointer ${
                            dangerConfig.type === 'time' ? 'bg-accent text-white font-bold' : 'text-text-muted'
                          }`}
                        >
                          Time Limit
                        </button>
                        <button
                          type="button"
                          onClick={() => setDangerConfig(c => ({ ...c, type: 'words' }))}
                          className={`flex-1 py-1 text-center font-mono rounded text-[11px] transition-all cursor-pointer ${
                            dangerConfig.type === 'words' ? 'bg-accent text-white font-bold' : 'text-text-muted'
                          }`}
                        >
                          Word Goal
                        </button>
                      </div>
                    </div>

                    <div>
                      {dangerConfig.type === 'time' ? (
                        <>
                          <label className="block font-mono text-[10px] text-text-muted mb-1">Duration</label>
                          <select
                            value={dangerConfig.timeSeconds}
                            onChange={e => setDangerConfig(c => ({ ...c, timeSeconds: Number(e.target.value) }))}
                            className="w-full bg-surface-card border border-border-subtle rounded p-1 text-xs text-text-primary outline-none"
                          >
                            <option value={60}>1 Minute (Sprint)</option>
                            <option value={180}>3 Minutes (Standard)</option>
                            <option value={300}>5 Minutes (Deep Dive)</option>
                            <option value={600}>10 Minutes (Flow State)</option>
                          </select>
                        </>
                      ) : (
                        <>
                          <label className="block font-mono text-[10px] text-text-muted mb-1">Word Target</label>
                          <select
                            value={dangerConfig.targetWords}
                            onChange={e => setDangerConfig(c => ({ ...c, targetWords: Number(e.target.value) }))}
                            className="w-full bg-surface-card border border-border-subtle rounded p-1 text-xs text-text-primary outline-none"
                          >
                            <option value={50}>50 Words</option>
                            <option value={100}>100 Words</option>
                            <option value={250}>250 Words</option>
                            <option value={500}>500 Words</option>
                          </select>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowDangerModal(false)}
                      className="px-3 py-1 text-xs font-mono text-text-muted hover:text-text-primary cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => startDangerSession(dangerTargetParentId)}
                      className="px-4 py-1.5 bg-accent hover:bg-accent-hover text-white text-xs font-bold rounded-lg shadow-soft cursor-pointer"
                    >
                      Start Session
                    </button>
                  </div>
                </div>
              )}

              {/* Textarea */}
              <textarea
                ref={composerTextareaRef}
                value={mainContent}
                onChange={e => {
                  if (isDangerActive && !activeReplyParentId) {
                    handleDangerTyping(e.target.value, false)
                  } else {
                    setMainContent(e.target.value)
                  }
                }}
                placeholder={
                  isDangerActive && !activeReplyParentId
                    ? "Keep typing without pausing for 5 seconds..."
                    : "Capture thoughts, observations, or raw reflections..."
                }
                rows={3}
                className={`w-full bg-surface-input border rounded-xl p-3.5 text-sm text-text-primary placeholder:text-text-muted outline-none resize-none font-sans leading-relaxed transition-all ${
                  isDangerActive && !activeReplyParentId
                    ? 'border-accent focus:ring-1 focus:ring-accent'
                    : 'border-border-subtle focus:border-accent'
                }`}
              />

              {/* Attached Media Chips */}
              {mainAttachments.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {mainAttachments.map((p, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 bg-surface-subtle border border-border-subtle px-2.5 py-1 rounded-lg text-xs font-mono text-text-primary">
                      <span className="truncate max-w-[180px]">{p.split(/[\\/]/).pop()}</span>
                      <button
                        type="button"
                        onClick={() => setMainAttachments(prev => prev.filter((_, i) => i !== idx))}
                        className="text-text-muted hover:text-blocked ml-1 cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {!isDangerActive && (
                <div className="flex items-center justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => handleSaveEntry(mainContent, mainAttachments)}
                    disabled={isSaving || (!mainContent.trim() && mainAttachments.length === 0)}
                    className="px-4 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white font-bold text-xs transition-all shadow-soft active:scale-95 disabled:opacity-40 cursor-pointer"
                  >
                    {isSaving ? 'Saving...' : 'Post Entry'}
                  </button>
                </div>
              )}
            </div>

            {/* ─── Threaded Journal Entries (Reference Image 2) ─── */}
            <div className="space-y-6">
              {isLoading ? (
                <div className="text-center py-12 text-xs font-mono text-text-muted">
                  Loading journal feed...
                </div>
              ) : filteredRootEntries.length === 0 ? (
                <div className="text-center py-16 bg-surface-card border border-dashed border-border-subtle rounded-2xl p-8 space-y-2">
                  <span className="text-3xl block">📖</span>
                  <p className="text-sm font-serif text-text-primary">No journal entries found</p>
                  <p className="text-xs text-text-muted max-w-sm mx-auto">
                    {selectedDateFilter ? `No reflections on ${selectedDateFilter}.` : 'Write your raw thoughts or start a Danger Mode honest session above.'}
                  </p>
                </div>
              ) : (
                filteredRootEntries.map(root => {
                  const replies = threadMap[root.id] || []
                  const isReplyingThisThread = activeReplyParentId === root.id

                  return (
                    <article
                      key={root.id}
                      className="bg-surface-card border border-border-subtle rounded-2xl p-5 shadow-soft space-y-4 hover:border-border-strong transition-all relative"
                    >
                      {/* Root Entry Header */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1">
                          {/* Circular Avatar Dot */}
                          <span className="w-3.5 h-3.5 rounded-full bg-accent mt-1 shrink-0 shadow-sm" />
                          
                          <div className="space-y-2 flex-1">
                            <p className="text-sm text-text-primary font-sans leading-relaxed whitespace-pre-wrap">
                              {root.content}
                            </p>

                            {/* Attachments rendering */}
                            {root.attachments && root.attachments.length > 0 && (
                              <div className="pt-2 space-y-2">
                                {/* Images */}
                                {root.attachments.some(a => a.media_type === 'image') && (
                                  <div className="flex flex-wrap gap-2.5">
                                    {root.attachments.filter(a => a.media_type === 'image').map(att => (
                                      <a
                                        key={att.id}
                                        href={getMediaUrl(att.file_path)}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="block rounded-xl overflow-hidden border border-border-subtle max-w-[200px] max-h-[140px] bg-black/20 hover:opacity-90 transition-opacity"
                                      >
                                        <img
                                          src={getMediaUrl(att.file_path)}
                                          alt="Attachment"
                                          className="w-full h-full object-cover"
                                        />
                                      </a>
                                    ))}
                                  </div>
                                )}

                                {/* Audio */}
                                {root.attachments.filter(a => a.media_type === 'audio').map(att => (
                                  <div key={att.id} className="p-2.5 bg-surface-subtle border border-border-subtle rounded-xl space-y-1">
                                    <div className="flex items-center gap-2 text-xs font-mono text-text-secondary truncate">
                                      <span>🎵</span>
                                      <span className="truncate">{att.file_path.split(/[\\/]/).pop()}</span>
                                    </div>
                                    <audio controls src={getMediaUrl(att.file_path)} className="w-full h-7" />
                                  </div>
                                ))}

                                {/* Video */}
                                {root.attachments.filter(a => a.media_type === 'video').map(att => (
                                  <div key={att.id} className="rounded-xl overflow-hidden border border-border-subtle bg-black max-w-md">
                                    <video controls src={getMediaUrl(att.file_path)} className="w-full max-h-[240px]" />
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Relative Timestamp & Delete */}
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[11px] font-mono text-text-muted">
                            {formatRelativeTime(root.created_at)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDeleteEntry(root.id)}
                            className="text-text-muted hover:text-blocked text-xs p-1 transition-colors cursor-pointer"
                            title="Delete entry"
                          >
                            ✕
                          </button>
                        </div>
                      </div>

                      {/* ─── Threaded Replies with Vertical Connector Line ─── */}
                      {replies.length > 0 && (
                        <div className="pl-5 ml-1.5 border-l-2 border-accent/40 space-y-4 pt-1">
                          {replies.map(reply => (
                            <div key={reply.id} className="flex items-start justify-between gap-3 relative">
                              {/* Horizontal connector pip */}
                              <div className="flex items-start gap-2.5 flex-1">
                                <span className="w-2.5 h-2.5 rounded-full bg-accent/60 mt-1 shrink-0" />
                                <div className="space-y-1.5 flex-1">
                                  <p className="text-sm text-text-primary font-sans leading-relaxed whitespace-pre-wrap">
                                    {reply.content}
                                  </p>

                                  {reply.attachments && reply.attachments.length > 0 && (
                                    <div className="pt-1 flex flex-wrap gap-2">
                                      {reply.attachments.filter(a => a.media_type === 'image').map(att => (
                                        <img
                                          key={att.id}
                                          src={getMediaUrl(att.file_path)}
                                          alt="Reply Attachment"
                                          className="w-32 h-24 object-cover rounded-lg border border-border-subtle"
                                        />
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-[10px] font-mono text-text-muted">
                                  {formatRelativeTime(reply.created_at)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteEntry(reply.id)}
                                  className="text-text-muted hover:text-blocked text-xs p-0.5 cursor-pointer"
                                  title="Delete reply"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* ─── Thread Reply / Add Another Entry Strip ─── */}
                      <div className="pt-2 border-t border-border-subtle/50 flex items-center justify-between">
                        {!isReplyingThisThread ? (
                          <button
                            type="button"
                            onClick={() => {
                              setActiveReplyParentId(root.id)
                              setReplyContent('')
                              setReplyAttachments([])
                            }}
                            className="text-xs font-mono text-accent hover:text-accent-hover flex items-center gap-1.5 cursor-pointer"
                          >
                            <span>💬</span> Add another entry / reply
                          </button>
                        ) : (
                          <div className="w-full space-y-3 pl-3 border-l-2 border-accent pt-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-mono font-bold text-accent">
                                Threaded Continuation
                              </span>
                              <div className="flex items-center gap-2">
                                {!isDangerActive && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setDangerTargetParentId(root.id)
                                      setShowDangerModal(true)
                                    }}
                                    className="text-[10px] font-mono text-accent hover:underline cursor-pointer"
                                  >
                                    ⚡ Danger Session
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveReplyParentId(null)
                                    cancelDangerSession()
                                  }}
                                  className="text-xs font-mono text-text-muted hover:text-text-primary cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>

                            <textarea
                              ref={replyTextareaRef}
                              value={replyContent}
                              onChange={e => {
                                if (isDangerActive && activeReplyParentId === root.id) {
                                  handleDangerTyping(e.target.value, true)
                                } else {
                                  setReplyContent(e.target.value)
                                }
                              }}
                              placeholder={
                                isDangerActive
                                  ? "Keep typing without pausing for 5 seconds..."
                                  : "Add a follow-up thought or reflection..."
                              }
                              rows={2}
                              className="w-full bg-surface-input border border-border-subtle rounded-xl p-2.5 text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-accent resize-none font-sans"
                            />

                            {!isDangerActive && (
                              <div className="flex items-center justify-between">
                                <button
                                  type="button"
                                  onClick={() => handlePickAttachments(true)}
                                  className="text-[10px] font-mono text-text-muted hover:text-accent cursor-pointer"
                                >
                                  📎 Attach Media
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSaveEntry(replyContent, replyAttachments, root.id)}
                                  disabled={isSaving || (!replyContent.trim() && replyAttachments.length === 0)}
                                  className="px-3 py-1.5 bg-accent hover:bg-accent-hover text-white text-xs font-bold rounded-lg shadow-soft cursor-pointer disabled:opacity-40"
                                >
                                  Reply
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                    </article>
                  )
                })
              )}
            </div>

          </div>
        </div>
      </main>
    </div>
  )
}
