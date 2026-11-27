export const PRESENTATION_PROCESSING_FAILED_MESSAGE = 'This material could not be prepared. Upload it again or replace the file.'

/**
 * Client projection of a presentation row. Raw processor error text is never
 * returned (DEV-LVC-025); failures are reported as a stable code and message.
 * Annotations are included only when requested, so list responses can omit them
 * for inactive materials (DEV-LVC-034).
 */
export function publicPresentation(row: any, options: { includeAnnotations?: boolean } = {}) {
  const includeAnnotations = options.includeAnnotations ?? true
  const pageImageKeys = row.page_image_keys && typeof row.page_image_keys === 'object' ? row.page_image_keys : {}
  const failed = row.processing_status === 'failed'
  return {
    id: row.id,
    filename: row.filename,
    file_size_bytes: row.file_size_bytes,
    page_count: row.page_count,
    processing_status: row.processing_status || 'ready',
    processing_error: failed ? PRESENTATION_PROCESSING_FAILED_MESSAGE : null,
    processing_error_code: failed ? 'PROCESSING_FAILED' : null,
    sort_order: row.sort_order,
    current_page: row.current_page,
    is_active: row.is_active,
    annotations: includeAnnotations ? row.annotations || {} : {},
    annotations_revision: row.annotations_revision ?? 0,
    page_images_ready: Object.keys(pageImageKeys).length,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export const PRESENTATION_LIST_COLUMNS = 'id, filename, file_size_bytes, page_count, processing_status, sort_order, current_page, is_active, annotations_revision, page_image_keys, created_at, updated_at'
