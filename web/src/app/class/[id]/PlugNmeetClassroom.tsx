'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

type Props = {
  roomId: string
  joinToken: string
  serverUrl: string
  clientFiles: { css_files: string[]; js_files: string[] }
  classId: string
  classTitle: string
  isHost: boolean
}

declare global {
  interface Window { plugNmeetConfig?: Record<string, unknown>; plugNmeet?: { leave?: () => void } }
}

function assetUrl(serverUrl: string, kind: 'css' | 'js', file: string) {
  if (/^https:\/\//.test(file)) return file
  return `${serverUrl.replace(/\/$/, '')}/assets/${kind}/${file.replace(/^\//, '')}`
}

export default function PlugNmeetClassroom({ roomId, joinToken, serverUrl, clientFiles, classId, classTitle, isHost }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [issue, setIssue] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const root = rootRef.current
    if (!root) {
      setIssue('The classroom mount point was unavailable. Please refresh and try again.')
      return
    }

    let disposed = false
    let frame = 0
    const cssNodes: HTMLLinkElement[] = []
    const scriptNodes: HTMLScriptElement[] = []
    window.plugNmeetConfig = {
      serverUrl,
      staticAssetsPath: `${serverUrl.replace(/\/$/, '')}/assets`,
      enableAdaptiveStream: true,
      enableDynacast: true,
      enableSimulcast: true,
      videoCodec: 'vp8',
      defaultWebcamResolution: 'h360',
      defaultAudioPreset: 'speech',
      stopMicTrackOnMute: true,
      focusActiveSpeakerWebcam: true,
      maxNumDisplayWebcams: { desktop: 6, tablet: 4, mobile: 2 },
    }
    document.cookie = `pnm_access_token=${joinToken}; Path=/; SameSite=Strict${window.location.protocol === 'https:' ? '; Secure' : ''}`

    for (const file of clientFiles.css_files) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.crossOrigin = 'anonymous'
      link.href = assetUrl(serverUrl, 'css', file)
      document.head.appendChild(link)
      cssNodes.push(link)
    }

    // PlugNmeet's module reads #plugnmeet-app synchronously at evaluation.
    // Waiting one animation frame proves this React-owned node is in the live
    // document before module evaluation starts.
    frame = requestAnimationFrame(() => {
      if (disposed || !root.isConnected || document.getElementById('plugnmeet-app') !== root) {
        if (!disposed) setIssue('The classroom mount point changed before startup. Please refresh and try again.')
        return
      }
      for (const file of clientFiles.js_files) {
        const script = document.createElement('script')
        script.src = assetUrl(serverUrl, 'js', file)
        script.crossOrigin = 'anonymous'
        if (file.startsWith('main-module.')) script.type = 'module'
        else script.defer = true
        script.onload = () => { if (!disposed) setConnected(true) }
        script.onerror = () => { if (!disposed) setIssue('Could not load the classroom assets. Please try again.') }
        document.body.appendChild(script)
        scriptNodes.push(script)
      }
    })

    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      try { window.plugNmeet?.leave?.() } catch { /* best effort */ }
      for (const node of cssNodes) node.remove()
      for (const node of scriptNodes) node.remove()
      document.cookie = `pnm_access_token=; Path=/; Max-Age=0; SameSite=Strict${window.location.protocol === 'https:' ? '; Secure' : ''}`
      delete window.plugNmeetConfig
    }
  }, [clientFiles.css_files, clientFiles.js_files, joinToken, roomId, serverUrl])

  return (
    <main className="flex h-screen h-dvh flex-col overflow-hidden bg-[#11121a] text-white">
      <header className="flex min-h-14 items-center justify-between gap-3 border-b border-white/10 bg-[#191a24] px-4">
        <div className="min-w-0"><p className="truncate text-sm font-semibold">{classTitle}</p><p className="text-[11px] text-white/60">{connected ? 'Connecting classroom…' : 'Loading classroom…'}</p></div>
        <span className="rounded-full border border-white/15 px-3 py-1 text-[11px] text-white/70">{isHost ? 'Tutor' : 'Student'}</span>
      </header>
      <div ref={rootRef} id="plugnmeet-app" className="min-h-0 flex-1" data-kanvise-class-id={classId} />
      {issue ? <section className="absolute inset-x-4 top-24 z-20 mx-auto max-w-md rounded-xl bg-white p-6 text-center text-[#180d62] shadow-xl"><h1 className="text-lg font-bold">Couldn&apos;t load the classroom</h1><p className="mt-2 text-sm text-slate-600">{issue}</p><Link href={isHost ? '/dashboard' : '/dashboard/student/classes'} className="mt-5 inline-flex rounded-lg bg-[#2e2877] px-4 py-2 text-sm font-semibold text-white">Back to classes</Link></section> : null}
    </main>
  )
}
