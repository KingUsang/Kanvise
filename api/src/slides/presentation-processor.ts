import { supabase } from '../lib/supabase'
import { readPrivateObject } from '../storage/r2'
import { MAX_SLIDE_PAGES } from './conversion-policy'
import { readPdfPageCount } from './pdf-metadata'

const db = supabase as any

export async function processPresentation(id: string) {
  const { data: material, error } = await db.from('live_class_presentations')
    .select('id, school_id, file_key, processing_status').eq('id', id).maybeSingle()
  if (error || !material || material.processing_status !== 'processing') return
  try {
    const bytes = await readPrivateObject(material.file_key, material.school_id)
    const pageCount = await readPdfPageCount(bytes)
    if (pageCount < 1 || pageCount > MAX_SLIDE_PAGES) throw new Error(`PDF must contain between 1 and ${MAX_SLIDE_PAGES} pages`)
    const { error: updateError } = await db.from('live_class_presentations').update({
      processing_status: 'ready', processing_error: null, processing_started_at: null, page_count: pageCount,
    }).eq('id', id).eq('processing_status', 'processing')
    if (updateError) throw updateError
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The PDF could not be read'
    await db.from('live_class_presentations').update({
      processing_status: 'failed', processing_error: message.slice(0, 500), processing_started_at: null,
    }).eq('id', id)
  }
}

export function enqueuePresentationProcessing(id: string) {
  setTimeout(() => void processPresentation(id), 0)
}
