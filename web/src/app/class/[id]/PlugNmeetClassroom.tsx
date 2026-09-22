type Props = {
  roomId: string
  joinToken: string
  serverUrl: string
  clientFiles: { css_files: string[]; js_files: string[] }
  classId: string
  classTitle: string
  isHost: boolean
}

function assetUrl(serverUrl: string, kind: 'css' | 'js', file: string) {
  if (/^https:\/\//.test(file)) return file
  return `${serverUrl.replace(/\/$/, '')}/assets/${kind}/${file.replace(/^\//, '')}`
}

/**
 * PlugNmeet's getClientFiles documentation requires its mount element and
 * assets to be emitted in the page HTML. Keeping this a Server Component is
 * intentional: React never removes or remounts #plugnmeet-app while the
 * third-party module is starting.
 */
export default function PlugNmeetClassroom({ joinToken, serverUrl, clientFiles, classId, classTitle, isHost }: Props) {
  const secure = serverUrl.startsWith('https://')
  const cookie = `pnm_access_token=${joinToken}; Path=/; SameSite=Strict${secure ? '; Secure' : ''}`
  const bootstrap = `document.cookie = ${JSON.stringify(cookie)};`

  return (
    <main className="flex h-screen h-dvh flex-col overflow-hidden bg-[#11121a] text-white">
      <header className="flex min-h-14 items-center justify-between gap-3 border-b border-white/10 bg-[#191a24] px-4">
        <div className="min-w-0"><p className="truncate text-sm font-semibold">{classTitle}</p><p className="text-[11px] text-white/60">Connecting classroom…</p></div>
        <span className="rounded-full border border-white/15 px-3 py-1 text-[11px] text-white/70">{isHost ? 'Tutor' : 'Student'}</span>
      </header>

      {clientFiles.css_files.map((file) => <link key={file} rel="stylesheet" crossOrigin="anonymous" href={assetUrl(serverUrl, 'css', file)} />)}

      {/* This exact id is owned by the PlugNmeet React client after its module loads. */}
      <div id="plugnmeet-app" className="min-h-0 flex-1" data-kanvise-class-id={classId} />

      {/* PlugNmeet officially supports cookie-based token delivery for custom clients. */}
      {/* eslint-disable @next/next/no-sync-scripts -- PlugNmeet requires this bootstrap before its module runs. */}
      <script dangerouslySetInnerHTML={{ __html: bootstrap }} />
      {clientFiles.js_files.map((file) => file.startsWith('main-module.')
        ? <script key={file} type="module" crossOrigin="anonymous" src={assetUrl(serverUrl, 'js', file)} />
        : <script key={file} defer crossOrigin="anonymous" src={assetUrl(serverUrl, 'js', file)} />,
      )}
      {/* eslint-enable @next/next/no-sync-scripts */}
    </main>
  )
}
