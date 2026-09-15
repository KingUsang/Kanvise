import { supabase } from '../lib/supabase'
import { buildPrivateFileKey, deletePrivateObject, readPrivateObject, uploadPrivateObject } from '../storage/r2'
import { MAX_SLIDE_PAGES } from './conversion-policy'
import { readPdfPageCount } from './pdf-metadata'
import { convertPdfToImages } from '../workers/pdf-converter'

const db = supabase as any

export async function processPresentation(id: string) {
  const { data: material, error } = await db.from('live_class_presentations')
    .select('id, school_id, live_class_id, file_key, processing_status').eq('id', id).maybeSingle()
  if (error || !material || material.processing_status !== 'processing') return
  const pageImageKeys: string[] = []
  try {
    const bytes = await readPrivateObject(material.file_key, material.school_id)
    const pageCount = await readPdfPageCount(bytes)
    if (pageCount < 1 || pageCount > MAX_SLIDE_PAGES) throw new Error(`PDF must contain between 1 and ${MAX_SLIDE_PAGES} pages`)
    const pageImageKeyMap: Record<string, string> = {}
    const pageImageDimensions: Record<string, { width: number; height: number }> = {}
    await convertPdfToImages(bytes, async (message) => {
      if (message.type !== 'page') return
      const pageKey = buildPrivateFileKey(
        material.school_id,
        'live_class_presentation',
        material.live_class_id,
        'jpg',
        `${material.id}-page-${message.pageNumber}`,
      )
      await uploadPrivateObject({ fileKey: pageKey, schoolId: material.school_id, body: message.buffer, contentType: 'image/jpeg' })
      pageImageKeyMap[String(message.pageNumber)] = pageKey
      if (message.width && message.height) pageImageDimensions[String(message.pageNumber)] = { width: message.width, height: message.height }
      pageImageKeys.push(pageKey)
    })
    if (Object.keys(pageImageKeyMap).length !== pageCount) throw new Error('PDF page conversion did not produce every page')
    const { error: updateError } = await db.from('live_class_presentations').update({
      processing_status: 'ready', processing_error: null, processing_started_at: null, page_count: pageCount,
      page_image_keys: pageImageKeyMap, page_image_dimensions: pageImageDimensions,
    }).eq('id', id).eq('processing_status', 'processing')
    if (updateError) throw updateError
  } catch (error) {
    await Promise.all(pageImageKeys.map((key) => deletePrivateObject(key, material.school_id).catch(() => undefined)))
    const message = error instanceof Error ? error.message : 'The PDF could not be read'
    await db.from('live_class_presentations').update({
      processing_status: 'failed', processing_error: message.slice(0, 500), processing_started_at: null,
    }).eq('id', id)
  }
}

export function enqueuePresentationProcessing(id: string) {
  setTimeout(() => void processPresentation(id), 0)
}
