'use client'

import katex from 'katex'
import 'katex/contrib/mhchem'
import { useMemo } from 'react'

export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'equation' | 'chemistry'; latex: string }
  | { type: 'image'; media_id: string; url?: string; alt_text: string; width?: number; height?: number }
  | { type: 'table'; rows: Array<Array<string | number>> }

function Formula({ latex }: { latex: string }) {
  const html = useMemo(() => {
    try { return katex.renderToString(latex, { throwOnError: false, displayMode: true, strict: false, trust: false }) }
    catch { return '' }
  }, [latex])
  return html ? <div className="my-3 overflow-x-auto" dangerouslySetInnerHTML={{ __html: html }} />
    : <code className="my-3 block overflow-x-auto rounded-lg bg-[#f3f0ed] p-3">{latex}</code>
}

export function QuestionContent({ plainText, blocks = [] }: { plainText?: string | null; blocks?: ContentBlock[] }) {
  return <div className="space-y-3 text-[15px] leading-7 text-[#302d36]">
    {plainText && <p className="whitespace-pre-wrap">{plainText}</p>}
    {blocks.map((block, index) => {
      if (block.type === 'text') return <p key={index} className="whitespace-pre-wrap">{block.text}</p>
      if (block.type === 'equation' || block.type === 'chemistry') return <Formula key={index} latex={block.latex} />
      if (block.type === 'image') return block.url
        ? <figure key={index} className="my-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- signed private R2 URLs are short-lived. */}
          <img src={block.url} alt={block.alt_text} className="max-h-[420px] max-w-full rounded-xl border border-[#e3ded9] object-contain" />
          <figcaption className="mt-1 text-xs text-[#77727e]">{block.alt_text}</figcaption>
        </figure>
        : <p key={index} className="rounded-lg bg-[#f5f2ef] p-3 text-sm text-[#716c76]">Image unavailable: {block.alt_text}</p>
      if (block.type === 'table') return <div key={index} className="overflow-x-auto"><table className="min-w-full border-collapse text-sm"><tbody>{block.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex} className="border border-[#d9d3cf] px-3 py-2">{cell}</td>)}</tr>)}</tbody></table></div>
      return null
    })}
  </div>
}
