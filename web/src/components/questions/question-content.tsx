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
  return html ? <div className="my-3 max-w-full overflow-x-auto overscroll-x-contain" dangerouslySetInnerHTML={{ __html: html }} />
    : <code className="my-3 block max-w-full overflow-x-auto rounded-lg bg-[#f3f0ed] p-3">{latex}</code>
}

function comparableMath(value: string) {
  const scriptDigits: Record<string, string> = {
    '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9',
    '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
  }
  return value
    .replace(/[₀₁₂₃₄₅₆₇₈₉⁰¹²³⁴⁵⁶⁷⁸⁹]/g, digit => scriptDigits[digit])
    .replace(/\\(?:mathrm|mathbf|text|operatorname)\s*\{([^{}]*)\}/g, '$1')
    .replace(/\\(?:left|right|,|;|!)/g, '')
    .replace(/\\times|×/g, '*')
    .replace(/\\div|÷/g, '/')
    .replace(/[{}_^\s]/g, '')
    .replace(/[−–—]/g, '-')
    .toLowerCase()
}

export function stripDuplicatedTrailingFormula(plainText: string, blocks: ContentBlock[]) {
  let result = plainText.trim()
  for (const block of blocks) {
    if (block.type !== 'equation' && block.type !== 'chemistry') continue
    const formula = comparableMath(block.latex)
    if (!formula) continue
    for (let index = 0; index < result.length; index += 1) {
      if (comparableMath(result.slice(index)) === formula) {
        result = result.slice(0, index).trim().replace(/[:;,]$/, '').trim()
        break
      }
    }
  }
  return result
}

export function shouldRenderPlainText(plainText: string | null | undefined, blocks: ContentBlock[]) {
  const normalizedPlainText = plainText?.trim().replace(/\s+/g, ' ')
  if (!normalizedPlainText) return false
  return !blocks.some(block => block.type === 'text' && block.text.trim().replace(/\s+/g, ' ') === normalizedPlainText)
}

export function QuestionContent({ plainText, blocks = [] }: { plainText?: string | null; blocks?: ContentBlock[] }) {
  const displayText = plainText ? stripDuplicatedTrailingFormula(plainText, blocks) : plainText
  return <div className="min-w-0 max-w-full space-y-3 text-[15px] leading-7 text-[#302d36]">
    {shouldRenderPlainText(displayText, blocks) && <p className="whitespace-pre-wrap break-words">{displayText}</p>}
    {blocks.map((block, index) => {
      if (block.type === 'text') return <p key={index} className="whitespace-pre-wrap break-words">{block.text}</p>
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
