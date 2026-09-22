'use client'

import { useEffect, useState } from 'react'
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
  interface Window {
    plugNmeetConfig?: Record<string, unknown>
    plugNmeet?: Record<string, any>
  }
}

function assetUrl(serverUrl: string, kind: 'css' | 'js', file: string) {
  if (/^https:\/\//.test(file)) return file
  return `${serverUrl.replace(/\/$/, '')}/assets/${kind}/${file.replace(/^\//, '')}`
}

export default function PlugNmeetClassroom({ roomId, joinToken, serverUrl, clientFiles, classId, classTitle, isHost }: Props) {
  const [issue, setIssue] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let disposed = false
    const cssNodes: HTMLLinkElement[] = []
    const scriptNodes: HTMLScriptElement[] = []
    const load = async () => {
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
      // PlugNmeet officially supports reading the short-lived join token from
      // this cookie. Do not add it to the URL here: Next.js instruments the
      // History API and can remount this route, removing #plugnmeet-app while
      // PlugNmeet's module is still starting.
      document.cookie = `pnm_access_token=${joinToken}; Path=/; SameSite=Strict${window.location.protocol === 'https:' ? '; Secure' : ''}`
      for (const file of clientFiles.css_files || []) {
        const link = document.createElement('link')
        link.rel = 'stylesheet'
        link.href = assetUrl(serverUrl, 'css', file)
        document.head.appendChild(link)
        cssNodes.push(link)
      }
      for (const file of clientFiles.js_files || []) {
        const script = document.createElement('script')
        script.src = assetUrl(serverUrl, 'js', file)
        if (file.startsWith('main-module.')) script.type = 'module'
        else script.defer = true
        await new Promise<void>((resolve, reject) => { script.onload = () => resolve(); script.onerror = () => reject(new Error('Could not load PlugNmeet classroom assets')); document.body.appendChild(script) })
        scriptNodes.push(script)
      }
      if (disposed) return
      if (!disposed) setLoaded(true)
    }
    void load().catch((error) => { if (!disposed) setIssue(error instanceof Error ? error.message : 'Could not load the classroom') })
    return () => {
      disposed = true
      try { window.plugNmeet?.leave?.() } catch { /* provider cleanup is best effort */ }
      for (const node of cssNodes) node.remove()
      for (const node of scriptNodes) node.remove()
      document.cookie = `pnm_access_token=; Path=/; Max-Age=0; SameSite=Strict${window.location.protocol === 'https:' ? '; Secure' : ''}`
      delete window.plugNmeetConfig
    }
  }, [clientFiles.css_files, clientFiles.js_files, isHost, joinToken, roomId, serverUrl])

  return (
    <main className="flex h-screen h-dvh flex-col overflow-hidden bg-[#11121a] text-white">
      <header className="flex min-h-14 items-center justify-between gap-3 border-b border-white/10 bg-[#191a24] px-4">
        <div className="min-w-0"><p className="truncate text-sm font-semibold">{classTitle}</p><p className="text-[11px] text-white/60">{loaded ? 'Connected · adaptive video' : 'Connecting'}</p></div>
        <span className="rounded-full border border-white/15 px-3 py-1 text-[11px] text-white/70">{isHost ? 'Tutor' : 'Student'}</span>
      </header>
      <div id="plugnmeet-app" className="relative min-h-0 flex-1" data-kanvise-class-id={classId} />
      {issue ? <section className="absolute inset-x-4 top-24 z-20 mx-auto max-w-md rounded-xl bg-white p-6 text-center text-[#180d62] shadow-xl"><h1 className="text-lg font-bold">Couldn&apos;t load the classroom</h1><p className="mt-2 text-sm text-slate-600">{issue}</p><Link href={isHost ? '/dashboard' : '/dashboard/student/classes'} className="mt-5 inline-flex rounded-lg bg-[#2e2877] px-4 py-2 text-sm font-semibold text-white">Back to classes</Link></section> : null}
    </main>
  )
}
