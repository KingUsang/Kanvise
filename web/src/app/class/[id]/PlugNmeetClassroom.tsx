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
      // PlugNmeet's shipped client checks `access_token` first when it boots.
      // Keep the cookie as a fallback, but provide the documented query value
      // so the embedded client behaves exactly like its standalone page.
      const currentUrl = new URL(window.location.href)
      currentUrl.searchParams.set('access_token', joinToken)
      // The deployed PlugNmeet client ships the English catalog under `en`.
      // Pin the detector to that catalog instead of requesting a browser
      // regional variant (for example `en-GB`) that this server does not have.
      currentUrl.searchParams.set('lng', 'en')
      window.history.replaceState(window.history.state, '', currentUrl)
      // The official client reads this short-lived token from its cookie when
      // it starts. This avoids putting credentials into the visible URL while
      // following PlugNmeet's documented custom-client flow.
      document.cookie = `pnm_access_token=${encodeURIComponent(joinToken)}; Path=/; SameSite=Strict${window.location.protocol === 'https:' ? '; Secure' : ''}`
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
      // Leave the token available while the client performs verifyToken and
      // opens its realtime connection; it is short-lived and the page is
      // already authenticated. The client may renew it through its socket.
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
      {issue ? <section className="m-auto max-w-md rounded-xl bg-white p-6 text-center text-[#180d62]"><h1 className="text-lg font-bold">Couldn&apos;t load the classroom</h1><p className="mt-2 text-sm text-slate-600">{issue}</p><Link href={isHost ? '/dashboard' : '/dashboard/student/classes'} className="mt-5 inline-flex rounded-lg bg-[#2e2877] px-4 py-2 text-sm font-semibold text-white">Back to classes</Link></section> : <div id="plugnmeet-app" className="min-h-0 flex-1" data-kanvise-class-id={classId} />}
    </main>
  )
}
