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
    // Browsers intentionally hide the underlying reason for a failed cross-origin
    // PUT. It may be DNS, an R2/CDN outage, a rejected CORS preflight, or the
    // user's connection — never claim it was definitely their network.
    request.addEventListener('error', () => reject(new Error('The storage upload URL could not be reached. This may be a storage, DNS, or browser-permission issue; please try again shortly.')))
    request.addEventListener('abort', () => reject(new Error('The upload was cancelled before it completed.')))
    request.send(file)
  })
}

export function titleFromFileName(fileName: string) {
  const title = fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
  return title || fileName
}
