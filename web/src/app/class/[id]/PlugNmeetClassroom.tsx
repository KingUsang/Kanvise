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
      // Let the supplied PlugNmeet UI fill the page, but brand its native
      // welcome/logo surface as Kanvise. This is PlugNmeet's supported
      // designCustomization API — not a CSS hack over its controls.
      designCustomization: {
        primary_color: '#2e2877',
        primary_btn_bg_color: '#2e2877',
        primary_btn_text_color: '#ffffff',
        custom_logo: `${window.location.origin}/kanvise_logo_small_blue.png`,
      },
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

    // PlugNmeet's module reads #plugNmeet-app synchronously at evaluation.
    // Waiting one animation frame proves this React-owned node is in the live
    // document before module evaluation starts.
    frame = requestAnimationFrame(() => {
      if (disposed || !root.isConnected || document.getElementById('plugNmeet-app') !== root) {
        if (!disposed) setIssue('The classroom mount point changed before startup. Please refresh and try again.')
        return
      }
      for (const file of clientFiles.js_files) {
        const script = document.createElement('script')
        script.src = assetUrl(serverUrl, 'js', file)
        script.crossOrigin = 'anonymous'
        if (file.startsWith('main-module.')) script.type = 'module'
        else script.defer = true
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
    <>
      {/* PlugNmeet's own CSS establishes the document and mount height, including
          its mobile safe-area behaviour. Do not wrap this in a Kanvise viewport. */}
      <div ref={rootRef} id="plugNmeet-app" data-kanvise-class-id={classId} aria-label={`${classTitle} classroom`} />
      {issue ? <section className="fixed inset-x-4 top-24 z-20 mx-auto max-w-md rounded-xl bg-white p-6 text-center text-[#180d62] shadow-xl"><h1 className="text-lg font-bold">Couldn&apos;t load the classroom</h1><p className="mt-2 text-sm text-slate-600">{issue}</p><Link href={isHost ? '/dashboard' : '/dashboard/student/classes'} className="mt-5 inline-flex rounded-lg bg-[#2e2877] px-4 py-2 text-sm font-semibold text-white">Back to classes</Link></section> : null}
    </>
  )
}
