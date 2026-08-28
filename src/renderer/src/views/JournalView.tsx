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
  const [dangerTargetParentId, setDangerTargetParentId] = useState<string | null>(null)
  const [dangerConfig, setDangerConfig] = useState<DangerConfig>({
    type: 'time',
    timeSeconds: 180,
    targetWords: 100
  })
  const [isDangerActive, setIsDangerActive] = useState(false)
  const [dangerSecondsLeft, setDangerSecondsLeft] = useState(180)
  const [inactivitySeconds, setInactivitySeconds] = useState(0)
  const [dangerWordCount, setDangerWordCount] = useState(0)

  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null)
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null)
  const lastKeyStrokeRef = useRef<number>(Date.now())
  const composerTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const replyTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const entryRefs = useRef<Record<string, HTMLElement | null>>({})

  const loadEntries = async () => {
    try {
      setIsLoading(true)
      const data = await window.api.journal.list()
      setEntries(data || [])
    } catch {
      showToast('Failed to load journal entries', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadEntries()
  }, [])

  // ─── Native Media Selection (Small Image Icon) ───
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
    } catch {
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

  useEffect(() => {
    if (!isDangerActive) return

    inactivityTimerRef.current = setInterval(() => {
      const elapsedSinceKey = (Date.now() - lastKeyStrokeRef.current) / 1000
      setInactivitySeconds(elapsedSinceKey)

      if (elapsedSinceKey >= 5.0) {
        triggerDangerFailure()
      }
    }, 200)

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

  // ─── Hierarchy & Date Gutter Construction ───
  const { rootEntries, threadMap, dateGutterDays } = useMemo(() => {
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

    const daysList: { dateStr: string; dayLetter: string; dayNum: number; isWeekend: boolean; monthLabel: string | null; hasEntries: boolean; count: number }[] = []
    const now = new Date()
    let lastMonth = ''

    for (let i = 0; i < 45; i++) {
      const d = new Date(now)
      d.setDate(now.getDate() - i)
      const dateStr = d.toISOString().slice(0, 10)
      const dayOfWeek = d.getDay() // 0 = Sun, 6 = Sat
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
      const dayLetter = ['S', 'M', 'T', 'W', 'T', 'F', 'S'][dayOfWeek]
      const dayNum = d.getDate()
      const currentMonth = d.toLocaleString('default', { month: 'short', year: 'numeric' })
      const monthLabel = currentMonth !== lastMonth ? currentMonth : null
      lastMonth = currentMonth

      const dayEntries = dateMap[dateStr] || []
      daysList.push({
        dateStr,
        dayLetter,
        dayNum,
        isWeekend,
        monthLabel,
        hasEntries: dayEntries.length > 0,
        count: dayEntries.length
      })
    }

    return {
      rootEntries: roots,
      threadMap: childrenMap,
      dateGutterDays: daysList
    }
  }, [entries])

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

  const scrollToDate = (dateStr: string) => {
    setSelectedDateFilter(prev => prev === dateStr ? null : dateStr)
    const target = entryRefs.current[dateStr]
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const todayHeaderStr = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })

  return (
    <div className="flex-1 flex overflow-hidden bg-[#151a15] text-[#d4ded4] font-sans select-text">
      {/* ═══════════════════════════════════════════════════════════════════════
          LEFT DATE GUTTER (Exact match to Reference Image 2)
         ═══════════════════════════════════════════════════════════════════════ */}
      <aside className="w-52 bg-[#151a15] flex flex-col shrink-0 select-none overflow-y-auto font-mono text-xs pl-6 pr-3 py-6">
        {/* Top Entry Counter */}
        <div className="pb-4 flex items-center justify-between">
          <span className="text-[#22c55e] font-bold text-sm tracking-wide">
            {entries.length} entries
          </span>
          {selectedDateFilter && (
            <button
              type="button"
              onClick={() => setSelectedDateFilter(null)}
              className="text-[11px] text-zinc-500 hover:text-[#22c55e] underline cursor-pointer"
            >
              All
            </button>
          )}
        </div>

        {/* Vertical Date Rows */}
        <div className="space-y-1.5 pt-2">
          {dateGutterDays.map((d, idx) => {
            const isSelected = selectedDateFilter === d.dateStr
            const isToday = idx === 0

            return (
              <div key={d.dateStr} className="space-y-1">
                {/* Month label on left */}
                {d.monthLabel && (
                  <div className="text-[11px] text-[#6b7c6b] font-mono pt-4 pb-1">
                    {d.monthLabel}
                  </div>
                )}

                {/* Date Row */}
                <div
                  onClick={() => scrollToDate(d.dateStr)}
                  className={`flex items-center justify-between py-0.5 px-1 rounded transition-colors cursor-pointer group ${
                    isSelected ? 'text-[#22c55e] font-bold' : ''
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {/* Day letter: red for today, golden for weekend, gray for weekday */}
                    <span className={`w-3.5 text-center font-bold ${
                      isToday
                        ? 'text-[#f87171]'
                        : d.isWeekend
                        ? 'text-[#eab308]'
                        : 'text-[#6b7c6b] group-hover:text-zinc-300'
                    }`}>
                      {d.dayLetter}
                    </span>

                    {/* Day number: red for today, golden for weekend, gray for weekday */}
                    <span className={`w-5 font-mono ${
                      isToday
                        ? 'text-[#f87171] font-bold'
                        : d.isWeekend
                        ? 'text-[#eab308]'
                        : 'text-[#8a9e8a] group-hover:text-zinc-200'
                    }`}>
                      {d.dayNum}
                    </span>
                  </div>

                  {/* Indicator dots for entries */}
                  {d.hasEntries && (
                    <div className="flex items-center gap-0.5" title={`${d.count} entries on ${d.dateStr}`}>
                      <span className="text-[#eab308] text-sm tracking-tighter leading-none">
                        {Array.from({ length: Math.min(3, d.count) }).map((_, i) => '•').join('')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </aside>

      {/* ═══════════════════════════════════════════════════════════════════════
          MAIN CENTER FEED (Exact match to Reference Image 2)
         ═══════════════════════════════════════════════════════════════════════ */}
      <main className="flex-1 flex flex-col overflow-hidden bg-[#151a15]">
        {/* Top Header Bar */}
        <header className="px-12 pt-6 pb-2 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-[#6b7c6b]">
              Pile Test · {todayHeaderStr}
            </span>
            {selectedDateFilter && (
              <span className="text-[11px] font-mono text-[#22c55e] bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40">
                Filtered: {selectedDateFilter}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="w-44 bg-transparent border-b border-[#2d3a2d] focus:border-[#22c55e] px-2 py-1 text-xs text-zinc-200 placeholder:text-[#556655] outline-none font-sans"
            />
          </div>
        </header>

        {/* Scrollable Timeline */}
        <div className="flex-1 overflow-y-auto px-12 py-6">
          <div className="max-w-3xl space-y-10 pb-28">

            {/* ─── Minimalist Composer (Exact match to Image 2) ─── */}
            <div className="space-y-3 pt-2">
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
                    : "What are you thinking?"
                }
                rows={3}
                className={`w-full bg-transparent p-0 text-lg font-sans text-zinc-100 placeholder:text-zinc-500 outline-none resize-none leading-relaxed transition-all ${
                  isDangerActive && !activeReplyParentId
                    ? inactivitySeconds > 3.0
                      ? 'text-red-300 animate-pulse'
                      : 'text-emerald-200'
                    : ''
                }`}
              />

              {/* Media Thumbnail Previews */}
              {mainAttachments.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {mainAttachments.map((p, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 bg-[#1b221b] border border-[#273227] px-3 py-1 rounded-lg text-xs font-mono text-zinc-200">
                      <span className="truncate max-w-[200px]">{p.split(/[\\/]/).pop()}</span>
                      <button
                        type="button"
                        onClick={() => setMainAttachments(prev => prev.filter((_, i) => i !== idx))}
                        className="text-zinc-500 hover:text-red-400 ml-1 cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Action Strip: Small Image Icon (Left) & Post Button (Right) */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-3">
                  {/* Small Image Icon */}
                  {!isDangerActive && (
                    <button
                      type="button"
                      onClick={() => handlePickAttachments(false)}
                      className="text-[#6b7c6b] hover:text-[#22c55e] transition-colors cursor-pointer p-0.5"
                      title="Attach image or media"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </button>
                  )}

                  {/* Danger Mode Toggle */}
                  {!isDangerActive && (
                    <button
                      type="button"
                      onClick={() => {
                        setDangerTargetParentId(null)
                        setShowDangerModal(prev => !prev)
                      }}
                      className="text-xs font-mono text-amber-400/80 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
                      title="Start Squibler Danger Session"
                    >
                      <span>⚡</span> Danger Mode
                    </button>
                  )}

                  {/* Danger Active HUD */}
                  {isDangerActive && !activeReplyParentId && (
                    <div className="flex items-center gap-2 text-xs font-mono bg-emerald-950/80 text-emerald-300 px-3 py-1 rounded-full border border-emerald-500">
                      {dangerConfig.type === 'time' ? (
                        <span className="font-bold">⏱️ {dangerSecondsLeft}s left</span>
                      ) : (
                        <span className="font-bold">✍️ {dangerWordCount}/{dangerConfig.targetWords} words</span>
                      )}
                      <span className={`text-[10px] ${inactivitySeconds > 3 ? 'text-red-400 font-bold' : 'text-zinc-400'}`}>
                        (Pause: {inactivitySeconds.toFixed(1)}s / 5s)
                      </span>
                      <button
                        type="button"
                        onClick={cancelDangerSession}
                        className="text-zinc-400 hover:text-red-400 ml-1 cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>

                {/* Right: Vibrant Green Post Pill Button */}
                {!isDangerActive && (
                  <button
                    type="button"
                    onClick={() => handleSaveEntry(mainContent, mainAttachments)}
                    disabled={isSaving || (!mainContent.trim() && mainAttachments.length === 0)}
                    className="px-6 py-1.5 rounded-full bg-[#22c55e] hover:bg-[#16a34a] active:scale-95 text-white font-bold text-sm transition-all shadow-sm disabled:opacity-30 cursor-pointer"
                  >
                    {isSaving ? 'Posting...' : 'Post'}
                  </button>
                )}
              </div>

              {/* Danger Mode Configuration Popover */}
              {showDangerModal && !isDangerActive && (
                <div className="mt-2 p-3 bg-[#1b221b] border border-[#273227] rounded-xl space-y-2 text-xs">
                  <div className="flex items-center justify-between text-zinc-200 font-semibold">
                    <span>⚡ Squibler Danger Session</span>
                    <span className="text-[10px] text-zinc-400 font-mono">5s Pause = Text Lost</span>
                  </div>
                  <div className="flex gap-3">
                    <select
                      value={dangerConfig.timeSeconds}
                      onChange={e => setDangerConfig(c => ({ ...c, type: 'time', timeSeconds: Number(e.target.value) }))}
                      className="bg-[#121612] border border-[#273227] rounded px-2 py-1 text-zinc-200 text-xs outline-none"
                    >
                      <option value={60}>1 Minute Sprint</option>
                      <option value={180}>3 Minutes Standard</option>
                      <option value={300}>5 Minutes Deep Dive</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => startDangerSession(dangerTargetParentId)}
                      className="px-4 py-1 bg-[#22c55e] hover:bg-[#16a34a] text-white font-bold rounded-full text-xs cursor-pointer"
                    >
                      Start
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ─── Open Feed Entries (Exact match to Reference Image 2) ─── */}
            <div className="space-y-10">
              {isLoading ? (
                <div className="text-center py-12 text-xs font-mono text-zinc-500">
                  Loading thoughts...
                </div>
              ) : filteredRootEntries.length === 0 ? (
                <div className="text-center py-16 text-xs text-zinc-500 font-mono">
                  {selectedDateFilter ? `No reflections on ${selectedDateFilter}.` : 'No thoughts yet. Post something above.'}
                </div>
              ) : (
                filteredRootEntries.map(root => {
                  const replies = threadMap[root.id] || []
                  const isReplying = activeReplyParentId === root.id
                  const dateKey = root.created_at.slice(0, 10)

                  return (
                    <div
                      key={root.id}
                      ref={el => { entryRefs.current[dateKey] = el }}
                      className="space-y-3 pt-2"
                    >
                      {/* Root Entry Row */}
                      <div className="flex items-start justify-between gap-5 group">
                        <div className="flex items-start gap-4 flex-1 min-w-0">
                          {/* Circular Green Bullet Dot */}
                          <span className="w-3.5 h-3.5 rounded-full bg-[#4ade80] mt-1.5 shrink-0 shadow-sm" />

                          <div className="space-y-3 flex-1 min-w-0">
                            {/* Text Content */}
                            <p className="text-base font-normal text-zinc-100 leading-relaxed whitespace-pre-wrap">
                              {root.content}
                            </p>

                            {/* Media Attachment: Rounded 3XL Image Card */}
                            {root.attachments && root.attachments.length > 0 && (
                              <div className="pt-1 space-y-2">
                                {root.attachments.filter(a => a.media_type === 'image').map(att => (
                                  <div key={att.id} className="rounded-3xl overflow-hidden max-w-2xl shadow-xl border border-emerald-950/40 bg-black/40">
                                    <img
                                      src={getMediaUrl(att.file_path)}
                                      alt="Journal attachment"
                                      className="w-full object-cover max-h-[480px]"
                                    />
                                  </div>
                                ))}

                                {root.attachments.filter(a => a.media_type === 'audio').map(att => (
                                  <div key={att.id} className="p-3 bg-[#1b221b] border border-[#273227] rounded-2xl max-w-md">
                                    <span className="text-xs font-mono text-zinc-400 block mb-1">🎵 {att.file_path.split(/[\\/]/).pop()}</span>
                                    <audio controls src={getMediaUrl(att.file_path)} className="w-full h-8" />
                                  </div>
                                ))}

                                {root.attachments.filter(a => a.media_type === 'video').map(att => (
                                  <div key={att.id} className="rounded-3xl overflow-hidden max-w-2xl bg-black border border-[#273227] shadow-xl">
                                    <video controls src={getMediaUrl(att.file_path)} className="w-full max-h-[420px]" />
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Action Buttons: Add another entry / Reflect */}
                            <div className="flex items-center gap-4 pt-1 text-xs font-mono">
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveReplyParentId(root.id)
                                  setReplyContent('')
                                  setReplyAttachments([])
                                }}
                                className="text-[#22c55e] hover:text-emerald-300 flex items-center gap-1.5 cursor-pointer font-semibold"
                              >
                                <span>💬</span> Add another entry
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteEntry(root.id)}
                                className="text-zinc-600 hover:text-red-400 text-[11px] opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Far Right: Relative Time */}
                        <span className="text-xs font-mono text-[#6b7c6b] shrink-0 pt-1">
                          {formatRelativeTime(root.created_at)}
                        </span>
                      </div>

                      {/* ─── Threaded Replies with Vertical Connector Line ─── */}
                      {replies.length > 0 && (
                        <div className="pl-6 ml-1.5 border-l-2 border-[#22c55e]/40 space-y-4 pt-2">
                          {replies.map(reply => (
                            <div key={reply.id} className="flex items-start justify-between gap-4 group">
                              <div className="flex items-start gap-3.5 flex-1 min-w-0">
                                <span className="w-2.5 h-2.5 rounded-full bg-[#4ade80]/80 mt-1.5 shrink-0" />
                                <div className="space-y-2 flex-1 min-w-0">
                                  <p className="text-base font-normal text-zinc-100 leading-relaxed whitespace-pre-wrap">
                                    {reply.content}
                                  </p>

                                  {reply.attachments && reply.attachments.length > 0 && (
                                    <div className="pt-1 flex flex-wrap gap-2">
                                      {reply.attachments.filter(a => a.media_type === 'image').map(att => (
                                        <img
                                          key={att.id}
                                          src={getMediaUrl(att.file_path)}
                                          alt="Reply Attachment"
                                          className="w-56 h-40 object-cover rounded-2xl border border-[#273227]"
                                        />
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0 pt-1">
                                <span className="text-[11px] font-mono text-[#6b7c6b]">
                                  {formatRelativeTime(reply.created_at)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteEntry(reply.id)}
                                  className="text-zinc-600 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100 cursor-pointer"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* ─── Inline Thread Reply Composer ─── */}
                      {isReplying && (
                        <div className="pl-6 ml-1.5 border-l-2 border-[#22c55e] pt-2 space-y-2">
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
                                : "Add continuation thought..."
                            }
                            rows={2}
                            className="w-full bg-[#1b221b] border border-[#273227] rounded-xl p-3 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-[#22c55e] resize-none font-sans"
                          />

                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => handlePickAttachments(true)}
                                className="text-[#6b7c6b] hover:text-[#22c55e] cursor-pointer"
                                title="Attach media"
                              >
                                🖼️
                              </button>
                              {!isDangerActive && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDangerTargetParentId(root.id)
                                    setShowDangerModal(true)
                                  }}
                                  className="text-[11px] font-mono text-amber-400 hover:underline cursor-pointer"
                                >
                                  ⚡ Danger
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveReplyParentId(null)
                                  cancelDangerSession()
                                }}
                                className="text-[11px] font-mono text-zinc-400 hover:text-zinc-200 cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>

                            {!isDangerActive && (
                              <button
                                type="button"
                                onClick={() => handleSaveEntry(replyContent, replyAttachments, root.id)}
                                disabled={isSaving || (!replyContent.trim() && replyAttachments.length === 0)}
                                className="px-5 py-1 bg-[#22c55e] hover:bg-[#16a34a] text-white font-bold rounded-full text-xs shadow-sm cursor-pointer disabled:opacity-30"
                              >
                                Reply
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                    </div>
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
