import React from 'react'

export function renderSimpleMarkdown(text: string): React.ReactNode {
  if (!text || !text.trim()) {
    return <span className="text-slate-500 italic">No notes provided.</span>
  }

  const lines = text.split('\n')
  return (
    <div className="space-y-1 text-sm leading-relaxed text-slate-200">
      {lines.map((line, idx) => {
        const trimmed = line.trim()
        if (!trimmed) {
          return <div key={idx} className="h-2" />
        }

        // Heading: ### or ## or #
        if (trimmed.startsWith('### ')) {
          return (
            <h4 key={idx} className="text-sm font-bold text-blue-300 mt-2 mb-1">
              {formatInline(trimmed.substring(4))}
            </h4>
          )
        }
        if (trimmed.startsWith('## ')) {
          return (
            <h3 key={idx} className="text-base font-bold text-slate-100 mt-2 mb-1">
              {formatInline(trimmed.substring(3))}
            </h3>
          )
        }
        if (trimmed.startsWith('# ')) {
          return (
            <h2 key={idx} className="text-lg font-bold text-slate-100 mt-2 mb-1">
              {formatInline(trimmed.substring(2))}
            </h2>
          )
        }

        // Checklist task: - [ ] or - [x]
        if (trimmed.startsWith('- [ ] ') || trimmed.startsWith('- [x] ') || trimmed.startsWith('- [X] ')) {
          const checked = trimmed.startsWith('- [x] ') || trimmed.startsWith('- [X] ')
          const content = trimmed.substring(6)
          return (
            <div key={idx} className="flex items-center gap-2 pl-1 py-0.5">
              <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center text-[10px] ${
                checked ? 'bg-blue-600 border-blue-500 text-white' : 'border-white/20 bg-[#121622]'
              }`}>
                {checked ? '✓' : ''}
              </span>
              <span className={checked ? 'line-through text-slate-500' : 'text-slate-200'}>
                {formatInline(content)}
              </span>
            </div>
          )
        }

        // Bullet list item: - or *
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-2 py-0.5">
              <span className="text-blue-400 font-bold leading-none mt-1">•</span>
              <span className="text-slate-200">{formatInline(trimmed.substring(2))}</span>
            </div>
          )
        }

        // Numbered list: 1. 2. etc.
        const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/)
        if (numMatch) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-2 py-0.5">
              <span className="text-slate-400 font-mono text-xs mt-0.5">{numMatch[1]}.</span>
              <span className="text-slate-200">{formatInline(numMatch[2])}</span>
            </div>
          )
        }

        // Code block: ```
        if (trimmed.startsWith('```')) {
          return null
        }

        return <p key={idx} className="text-slate-200">{formatInline(line)}</p>
      })}
    </div>
  )
}

function formatInline(text: string): React.ReactNode {
  // Simple regex for **bold**, *italic*, `code`
  const parts: React.ReactNode[] = []
  let remaining = text
  let key = 0

  while (remaining.length > 0) {
    // Bold: **text**
    const boldMatch = remaining.match(/^(.*?)\*\*(.+?)\*\*(.*)$/)
    if (boldMatch) {
      if (boldMatch[1]) parts.push(<span key={key++}>{boldMatch[1]}</span>)
      parts.push(<strong key={key++} className="font-bold text-slate-100">{boldMatch[2]}</strong>)
      remaining = boldMatch[3]
      continue
    }

    // Italic: *text*
    const italicMatch = remaining.match(/^(.*?)\*(.+?)\*(.*)$/)
    if (italicMatch) {
      if (italicMatch[1]) parts.push(<span key={key++}>{italicMatch[1]}</span>)
      parts.push(<em key={key++} className="italic text-blue-200 font-serif">{italicMatch[2]}</em>)
      remaining = italicMatch[3]
      continue
    }

    // Inline code: `code`
    const codeMatch = remaining.match(/^(.*?)`(.+?)`(.*)$/)
    if (codeMatch) {
      if (codeMatch[1]) parts.push(<span key={key++}>{codeMatch[1]}</span>)
      parts.push(
        <code key={key++} className="px-1.5 py-0.5 rounded bg-black/40 text-blue-300 font-mono text-xs border border-white/[0.08]">
          {codeMatch[2]}
        </code>
      )
      remaining = codeMatch[3]
      continue
    }

    parts.push(<span key={key++}>{remaining}</span>)
    break
  }

  return <>{parts}</>
}
