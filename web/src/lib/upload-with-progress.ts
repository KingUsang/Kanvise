export function uploadFileWithProgress(url: string, file: File, onProgress: (progress: number | null) => void) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('PUT', url)
    request.setRequestHeader('Content-Type', file.type)
    request.upload.addEventListener('progress', (event) => {
      onProgress(event.lengthComputable && event.total > 0 ? Math.round((event.loaded / event.total) * 100) : null)
    })
    request.addEventListener('load', () => {
      if (request.status >= 200 && request.status < 300) resolve()
      else reject(new Error('Could not upload file to storage'))
    })
    request.addEventListener('error', () => reject(new Error('The upload was interrupted by a network error')))
    request.addEventListener('abort', () => reject(new Error('The upload was cancelled')))
    request.send(file)
  })
}

export function titleFromFileName(fileName: string) {
  const title = fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
  return title || fileName
}
