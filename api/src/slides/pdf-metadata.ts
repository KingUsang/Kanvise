import path from 'node:path'
import { DOMMatrix, Path2D } from '@napi-rs/canvas'

type PdfJs = typeof import('pdfjs-dist/legacy/build/pdf.mjs')
const loadPdfJs = new Function('return import("pdfjs-dist/legacy/build/pdf.mjs")') as () => Promise<PdfJs>

export async function readPdfPageCount(buffer: Uint8Array, loader: () => Promise<PdfJs> = loadPdfJs) {
  ;(globalThis as any).DOMMatrix ??= DOMMatrix
  ;(globalThis as any).Path2D ??= Path2D
  const pdfjs = await loader()
  const pdfjsRoot = path.dirname(require.resolve('pdfjs-dist/package.json'))
  const task = pdfjs.getDocument({
    data: buffer,
    disableFontFace: true,
    standardFontDataUrl: path.join(pdfjsRoot, 'standard_fonts/'),
  })
  try {
    const document = await task.promise
    return document.numPages
  } finally {
    await task.destroy()
  }
}
