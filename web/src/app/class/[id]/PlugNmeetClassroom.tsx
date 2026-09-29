'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

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
  interface Window { plugNmeetConfig?: Record<string, unknown>; plugNmeet?: { leave?: () => void }; __kanvisePlugNmeetReady?: boolean }
}

function assetUrl(serverUrl: string, kind: 'css' | 'js', file: string) {
  if (/^https:\/\//.test(file)) return file
  return `${serverUrl.replace(/\/$/, '')}/assets/${kind}/${file.replace(/^\//, '')}`
}

export default function PlugNmeetClassroom({ roomId, joinToken, serverUrl, clientFiles, classId, classTitle, isHost }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [issue, setIssue] = useState<string | null>(null)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const marker = { kanviseClass: classId }
    window.history.pushState(marker, '', window.location.href)
    const onPopState = () => {
      window.history.pushState(marker, '', window.location.href)
      setConfirmLeave(true)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [classId])

  const leaveClass = () => {
    try { window.plugNmeet?.leave?.() } catch { /* best effort */ }
    router.replace(isHost ? '/dashboard' : '/dashboard/student/classes')
  }

  useEffect(() => {
    const root = rootRef.current
    if (!root) {
      setIssue('The classroom mount point was unavailable. Please refresh and try again.')
      return
    }

    let disposed = false
    let frame = 0
    let readyTimer = 0
    const cssNodes: HTMLLinkElement[] = []
    const scriptNodes: HTMLScriptElement[] = []
    window.plugNmeetConfig = {
      serverUrl,
      staticAssetsPath: `${serverUrl.replace(/\/$/, '')}/assets`,
      enableAdaptiveStream: true,
      enableDynacast: true,
      enableSimulcast: true,
      videoCodec: 'vp8',
      defaultWebcamResolution: 'h720',
      defaultAudioPreset: 'speech',
      stopMicTrackOnMute: true,
      focusActiveSpeakerWebcam: true,
      maxNumDisplayWebcams: { desktop: 4, tablet: 2, mobile: 1 },
      // Let the supplied PlugNmeet UI fill the page, but brand its native
      // welcome/logo surface as Kanvise. This is PlugNmeet's supported
      // designCustomization API — not a CSS hack over its controls.
      // PlugNmeet's colour customisation applies to its native light theme.
      designCustomization: { custom_logo: `${window.location.origin}/kanvise_logo_small_blue.png` },
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
    frame = requestAnimationFrame(() => { void (async () => {
      if (disposed || !root.isConnected || document.getElementById('plugNmeet-app') !== root) {
        if (!disposed) setIssue('The classroom mount point changed before startup. Please refresh and try again.')
        return
      }
      try {
        for (const file of clientFiles.js_files) {
          // PlugNmeet is an ES module. A dynamically injected module tag can
          // finish downloading without evaluating in a Next client boundary;
          // importing it explicitly guarantees execution and gives us an
          // actionable failure instead of a silent blank classroom.
          await import(/* webpackIgnore: true */ assetUrl(serverUrl, 'js', file))
        }
        const announceReady = () => {
          if (disposed) return
          if (root.childElementCount > 0) {
            window.__kanvisePlugNmeetReady = true
            window.dispatchEvent(new Event('kanvise:plugnmeet-ready'))
            return
          }
          readyTimer = window.setTimeout(announceReady, 100)
        }
        announceReady()
      } catch {
        if (!disposed) setIssue('Could not start the classroom interface. Please refresh and try again.')
      }
    })() })

    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      window.clearTimeout(readyTimer)
      try { window.plugNmeet?.leave?.() } catch { /* best effort */ }
      for (const node of cssNodes) node.remove()
      for (const node of scriptNodes) node.remove()
      document.cookie = `pnm_access_token=; Path=/; Max-Age=0; SameSite=Strict${window.location.protocol === 'https:' ? '; Secure' : ''}`
      delete window.plugNmeetConfig
      delete window.__kanvisePlugNmeetReady
    }
  }, [clientFiles.css_files, clientFiles.js_files, joinToken, roomId, serverUrl])

  return (
    <>
      {/* PlugNmeet's own CSS establishes the document and mount height, including
          its mobile safe-area behaviour. Do not wrap this in a Kanvise viewport. */}
      <div ref={rootRef} id="plugNmeet-app" data-kanvise-class-id={classId} aria-label={`${classTitle} classroom`} />
      {issue ? <section className="fixed inset-x-4 top-24 z-20 mx-auto max-w-md rounded-xl bg-white p-6 text-center text-[#180d62] shadow-xl"><h1 className="text-lg font-bold">Couldn&apos;t load the classroom</h1><p className="mt-2 text-sm text-slate-600">{issue}</p><Link href={isHost ? '/dashboard' : '/dashboard/student/classes'} className="mt-5 inline-flex rounded-lg bg-[#2e2877] px-4 py-2 text-sm font-semibold text-white">Back to classes</Link></section> : null}
      {confirmLeave ? <section role="dialog" aria-modal="true" aria-labelledby="leave-class-title" className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-5"><div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"><h1 id="leave-class-title" className="text-lg font-bold text-[#180d62]">Leave class?</h1><p className="mt-2 text-sm text-slate-600">You will leave the live classroom.</p><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setConfirmLeave(false)} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-700">Stay</button><button type="button" onClick={leaveClass} className="rounded-lg bg-[#2e2877] px-4 py-2 text-sm font-semibold text-white">Leave class</button></div></div></section> : null}
    </>
  )
}
