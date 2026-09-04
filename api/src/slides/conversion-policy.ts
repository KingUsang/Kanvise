export const MAX_SLIDE_PDF_SIZE = 25 * 1024 * 1024
export const MAX_SLIDE_PAGES = 50
export const SLIDE_CONVERSION_TIMEOUT_MS = 120_000

export class SlideConversionValidationError extends Error {
  constructor(
    message: string,
    readonly code: 'NO_FILE' | 'INVALID_FILE_TYPE' | 'FILE_TOO_LARGE',
  ) {
    super(message)
    this.name = 'SlideConversionValidationError'
  }
}

export function validateSlidePdf(file: File | null | undefined) {
  if (!file) throw new SlideConversionValidationError('No file provided', 'NO_FILE')
  if (file.type !== 'application/pdf') {
    throw new SlideConversionValidationError('Only PDF files are allowed', 'INVALID_FILE_TYPE')
  }
  if (file.size > MAX_SLIDE_PDF_SIZE) {
    throw new SlideConversionValidationError(
      'File exceeds 25MB limit. Please compress your PDF.',
      'FILE_TOO_LARGE',
    )
  }
  return file
}

export function validateSlidePdfMetadata(input: { fileName: unknown; contentType: unknown; fileSizeBytes: unknown }) {
  const fileName = typeof input.fileName === 'string' ? input.fileName : ''
  const contentType = typeof input.contentType === 'string' ? input.contentType : ''
  const fileSizeBytes = Number(input.fileSizeBytes)
  if (!fileName || !Number.isInteger(fileSizeBytes) || fileSizeBytes <= 0) {
    throw new SlideConversionValidationError('A PDF file is required', 'NO_FILE')
  }
  if (contentType !== 'application/pdf' || !fileName.toLowerCase().endsWith('.pdf')) {
    throw new SlideConversionValidationError('Only PDF files are allowed', 'INVALID_FILE_TYPE')
  }
  if (fileSizeBytes > MAX_SLIDE_PDF_SIZE) {
    throw new SlideConversionValidationError('File exceeds 25MB limit. Please compress your PDF.', 'FILE_TOO_LARGE')
  }
  return { fileName, contentType, fileSizeBytes }
}

export function createConversionDeadline(
  onTimeout: () => void | Promise<void>,
  timeoutMs = SLIDE_CONVERSION_TIMEOUT_MS,
) {
  const timer = setTimeout(() => void onTimeout(), timeoutMs)
  timer.unref?.()
  return () => clearTimeout(timer)
}
