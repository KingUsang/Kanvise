import { describe, expect, it } from 'vitest'
import { convertPdfToImages, type PdfConversionMessage } from './pdf-converter'

function createOnePagePdf() {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Length 44 >>\nstream\nBT /F1 24 Tf 72 720 Td (Test slide) Tj ET\nendstream',
  ]
  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf))
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`
  })
  const xrefOffset = Buffer.byteLength(pdf)
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  pdf += offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
  return new Uint8Array(Buffer.from(pdf))
}

describe('PDF converter worker', () => {
  it('renders every PDF page to a JPEG and completes', async () => {
    const messages: PdfConversionMessage[] = []
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
    await convertPdfToImages(createOnePagePdf(), message => messages.push(message), async () => pdfjs)

    expect(messages[0]).toEqual({ type: 'start', numPages: 1 })
    expect(messages.at(-1)).toEqual({ type: 'complete' })
    const page = messages.find(message => message.type === 'page')
    expect(page).toMatchObject({ type: 'page', pageNumber: 1 })
    if (page?.type !== 'page') throw new Error('Expected a rendered page')
    expect([...page.buffer.subarray(0, 2)]).toEqual([0xff, 0xd8])
    expect(page.buffer.byteLength).toBeGreaterThan(1_000)
  })

  it('rejects malformed PDF bytes', async () => {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
    await expect(convertPdfToImages(new Uint8Array([1, 2, 3]), () => {}, async () => pdfjs)).rejects.toThrow()
  })
})
