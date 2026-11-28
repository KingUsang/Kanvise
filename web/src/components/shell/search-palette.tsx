'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react'
import { useRouter } from 'next/navigation'
import { ArrowDown, ArrowUp, CornerDownLeft, Search, WifiOff, X } from 'lucide-react'
import type { DashboardCapabilities } from '@/config/dashboard-navigation'
import { Button, IconButton } from '@/components/dashboard/action-controls'
import { Dialog } from '@/components/ui/dialog'
import { EntityIcon } from '@/components/ui/entity-icon'
import { LiveRegion } from '@/components/ui/live-region'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusChip } from '@/components/ui/status-chip'
import { Tooltip } from '@/components/ui/tooltip'
import {
  SEARCH_DEBOUNCE_MS,
  SEARCH_MIN_LENGTH,
  getBrowseTypes,
  highlightParts,
  resultCountMessage,
  searchEntity,
  shortcutHint,
  type SearchFunction,
  type SearchGroup,
} from '@/lib/search'

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

const focusRing = 'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dashboard-focus'

/** Design preview: start the palette in one state without a network. */
export type SearchPreviewState = 'empty' | 'results' | 'no-results' | 'error' | 'offline' | 'loading'

type SearchContextValue = {
  openPalette: () => void
  registerTrigger: (element: HTMLElement | null) => () => void
}

const SearchContext = createContext<SearchContextValue | null>(null)

function useSearchContext() {
  const value = useContext(SearchContext)
  if (!value) throw new Error('SearchTrigger must be inside SearchProvider')
  return value
}

const noSubscribe = () => () => undefined

function useShortcutHint() {
  return useSyncExternalStore(
    noSubscribe,
    () => shortcutHint(navigator.platform || navigator.userAgent),
    () => 'Ctrl K',
  )
}

function subscribeOnline(listener: () => void) {
  window.addEventListener('online', listener)
  window.addEventListener('offline', listener)
  return () => {
    window.removeEventListener('online', listener)
    window.removeEventListener('offline', listener)
  }
}

function useOnline(forcedOffline: boolean) {
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true)
  return forcedOffline ? false : online
}

function isVisible(element: HTMLElement) {
  return element.getClientRects().length > 0
}

/**
 * Owns the search palette (SH-05): its open state, the Cmd/Ctrl+K shortcut
 * and the triggers focus returns to. The shell renders it around ShellFrame.
 */
export function SearchProvider({
  capabilities,
  search,
  children,
  onOpenResult,
  enabled = true,
  initialOpen = false,
  initialQuery = '',
  previewState,
}: {
  capabilities: DashboardCapabilities
  search: SearchFunction
  children: ReactNode
  /** False while there is no account to search (agency setup, failed load). */
  enabled?: boolean
  /** Where a chosen result or type goes. Defaults to client navigation. */
  onOpenResult?: (href: string) => void
  initialOpen?: boolean
  initialQuery?: string
  previewState?: SearchPreviewState
}) {
  const [open, setOpen] = useState(initialOpen)
  const triggers = useRef(new Set<HTMLElement>())

  const registerTrigger = useCallback((element: HTMLElement | null) => {
    if (!element) return () => undefined
    triggers.current.add(element)
    return () => { triggers.current.delete(element) }
  }, [])

  // The palette returns focus to whatever had it when it opened. From the
  // shortcut, move focus to the visible Search field first, so Escape lands
  // there (SH-12).
  const openPalette = useCallback(() => {
    const all = [...triggers.current]
    const target = all.find(isVisible) ?? all[0]
    if (target && !target.contains(document.activeElement)) target.focus()
    setOpen(true)
  }, [])

  useEffect(() => {
    if (!enabled) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'k' || !(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return
      event.preventDefault()
      if (open) {
        document.querySelector<HTMLInputElement>('[data-search-input]')?.focus()
        return
      }
      openPalette()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [enabled, open, openPalette])

  const value = useMemo(() => ({ openPalette, registerTrigger }), [openPalette, registerTrigger])

  return (
    <SearchContext.Provider value={value}>
      {children}
      {open && enabled ? (
        <SearchPalette
          capabilities={capabilities}
          search={search}
          initialQuery={initialQuery}
          previewState={previewState}
          onOpenResult={onOpenResult}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </SearchContext.Provider>
  )
}

export type SearchSlotRail = {
  srInRail: string
  hideInRail: string
  centreInRail: string
  tooltips: boolean
}

/**
 * The Search field in the sidebar (SH-02 item 2) or the magnifier in the
 * phone top bar (SH-16). Both open the palette.
 */
export function SearchTrigger({ variant, rail }: { variant: 'sidebar' | 'phone'; rail?: SearchSlotRail }) {
  const { openPalette, registerTrigger } = useSearchContext()
  const hint = useShortcutHint()
  const ref = useRef<HTMLButtonElement>(null)
  useEffect(() => registerTrigger(ref.current), [registerTrigger])
  const keyShortcuts = 'Meta+K Control+K'

  if (variant === 'phone') {
    return (
      <button
        ref={ref}
        type="button"
        aria-label="Search"
        aria-haspopup="dialog"
        aria-keyshortcuts={keyShortcuts}
        onClick={openPalette}
        className={cx('inline-flex size-11 shrink-0 items-center justify-center rounded-full text-dashboard-muted hover:bg-dashboard-surface-hover hover:text-dashboard-foreground', focusRing)}
      >
        <Search aria-hidden="true" className="size-5" strokeWidth={1.75} />
      </button>
    )
  }

  const button = (
    <button
      ref={ref}
      type="button"
      aria-haspopup="dialog"
      aria-keyshortcuts={keyShortcuts}
      onClick={openPalette}
      data-search-trigger=""
      className={cx(
        'flex min-h-11 w-full items-center gap-2 rounded-dashboard-control border border-dashboard-outline bg-dashboard-surface px-3 text-left text-dashboard-small text-dashboard-muted hover:bg-dashboard-surface-hover lg:min-h-10',
        focusRing,
        rail?.centreInRail,
      )}
    >
      <Search aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.75} />
      <span className={cx('min-w-0 flex-1 truncate', rail?.srInRail)}>Search…</span>
      <kbd aria-hidden="true" className={cx('rounded border border-dashboard-outline bg-dashboard-surface-subtle px-1.5 py-0.5 font-sans text-[11px] font-medium text-dashboard-muted', rail?.hideInRail)}>{hint}</kbd>
    </button>
  )
  if (!rail?.tooltips) return button
  return <Tooltip content="Search" side="right" describes={false} className="flex w-full">{button}</Tooltip>
}

type Option = { id: string; href: string }

type Status = 'idle' | 'loading' | 'ready' | 'error'

function Highlighted({ text, query }: { text: string; query: string }) {
  return (
    <>
      {highlightParts(text, query).map((part, index) => part.match
        ? <mark key={index} className="rounded-sm bg-dashboard-highlight px-px text-inherit">{part.text}</mark>
        : <span key={index}>{part.text}</span>)}
    </>
  )
}

function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="inline-flex min-w-6 items-center justify-center rounded border border-dashboard-outline bg-dashboard-surface px-1.5 py-0.5 font-sans text-[11px] font-medium text-dashboard-muted">{children}</kbd>
}

const previewOffline = (state?: SearchPreviewState) => state === 'offline'

/**
 * The palette (SH-05, SH-12): a combobox field over a grouped listbox,
 * centred near the top from 768px and a full-screen sheet on phones (R-07).
 */
export function SearchPalette({
  capabilities,
  search,
  onClose,
  onOpenResult,
  initialQuery = '',
  previewState,
}: {
  capabilities: DashboardCapabilities
  search: SearchFunction
  onClose: () => void
  onOpenResult?: (href: string) => void
  initialQuery?: string
  previewState?: SearchPreviewState
}) {
  const router = useRouter()
  const id = useId()
  const listboxId = `${id}-listbox`
  const optionId = (index: number) => `${id}-option-${index}`
  const [query, setQuery] = useState(initialQuery)
  const [status, setStatus] = useState<Status>(previewState === 'loading' ? 'loading' : previewState === 'error' ? 'error' : 'idle')
  const [groups, setGroups] = useState<SearchGroup[]>([])
  const [searchedFor, setSearchedFor] = useState('')
  const [active, setActive] = useState(0)
  const [attempt, setAttempt] = useState(0)
  const online = useOnline(previewOffline(previewState))
  const requestRef = useRef(0)
  const searchRef = useRef(search)
  useEffect(() => { searchRef.current = search }, [search])
  const inputRef = useRef<HTMLInputElement>(null)
  const term = query.trim().replace(/\s+/g, ' ')
  const searching = term.length >= SEARCH_MIN_LENGTH
  const browseTypes = useMemo(() => getBrowseTypes(capabilities), [capabilities])

  useEffect(() => {
    if (!searching || !online || previewState === 'loading' || previewState === 'error') return
    const request = ++requestRef.current
    const timer = window.setTimeout(() => {
      setStatus('loading')
      searchRef.current(term).then(
        (response) => {
          if (request !== requestRef.current) return
          setGroups(response.groups.filter((group) => group.results.length > 0))
          setSearchedFor(term)
          setActive(0)
          setStatus('ready')
        },
        () => {
          if (request === requestRef.current) setStatus('error')
        },
      )
    }, SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [term, searching, online, attempt, previewState])

  const browsing = !searching
  const showResults = searching && online && status !== 'error' && searchedFor !== '' && groups.length > 0
  const options: Option[] = browsing
    ? browseTypes.map((type) => ({ id: `browse-${type.href}`, href: type.href }))
    : showResults ? groups.flatMap((group) => group.results.map((result) => ({ id: `${result.type}-${result.id}`, href: result.href }))) : []
  const activeIndex = options.length ? Math.min(active, options.length - 1) : -1
  const firstLoad = searching && online && status === 'loading' && searchedFor === ''
  const noResults = searching && online && status === 'ready' && groups.length === 0

  let announcement = ''
  if (!online && searching) announcement = "You're offline. Search works when you're back online."
  else if (status === 'error' && searching) announcement = "We couldn't search right now."
  else if (noResults) announcement = `No matches for "${searchedFor}".`
  else if (showResults && status === 'ready') announcement = resultCountMessage(options.length)

  useEffect(() => {
    if (activeIndex < 0) return
    document.getElementById(optionId(activeIndex))?.scrollIntoView?.({ block: 'nearest' })
    // optionId is derived from a stable id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex])

  const openHref = (href: string) => {
    onClose()
    if (onOpenResult) onOpenResult(href)
    else router.push(href)
  }

  const onKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (!options.length) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActive((activeIndex + step + options.length) % options.length)
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault()
      openHref(options[activeIndex].href)
    }
  }

  const optionClass = (index: number) => cx(
    'flex min-h-12 cursor-pointer items-center gap-3 px-4 py-2 text-dashboard-small text-dashboard-foreground',
    index === activeIndex ? 'bg-dashboard-surface-hover' : '',
  )
  const groupHeading = 'px-4 pb-1 pt-3 text-dashboard-secondary font-medium text-dashboard-muted'

  let body: ReactNode
  if (browsing) {
    const headingId = `${id}-browse`
    body = (
      <div role="listbox" id={listboxId} aria-labelledby={headingId} className="pb-2">
        <div role="group" aria-labelledby={headingId}>
          <p id={headingId} role="presentation" className={groupHeading}>Browse by type</p>
          {browseTypes.map((type, index) => (
            <div
              key={type.href}
              id={optionId(index)}
              role="option"
              aria-selected={index === activeIndex}
              className={optionClass(index)}
              onMouseMove={() => setActive(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => openHref(type.href)}
            >
              <EntityIcon entity={type.entity} size="sm" />
              <span className="font-medium">{type.label}</span>
            </div>
          ))}
        </div>
      </div>
    )
  } else if (!online) {
    body = (
      <div className="flex flex-col items-center px-6 py-10 text-center">
        <WifiOff aria-hidden="true" className="size-6 text-dashboard-muted" strokeWidth={1.75} />
        <p className="mt-3 text-dashboard-small font-semibold text-dashboard-foreground">You&apos;re offline. Search works when you&apos;re back online.</p>
      </div>
    )
  } else if (status === 'error') {
    body = (
      <div className="flex flex-col items-center px-6 py-10 text-center">
        <p className="text-dashboard-small font-semibold text-dashboard-foreground">We couldn&apos;t search right now.</p>
        <Button variant="outline" className="mt-4" onClick={() => { setStatus('idle'); setAttempt((value) => value + 1); inputRef.current?.focus() }}>Try again</Button>
      </div>
    )
  } else if (firstLoad || (searching && searchedFor === '' && status !== 'ready')) {
    body = (
      <div aria-hidden="true" className="space-y-1 px-4 py-3" data-search-loading="">
        {[0, 1, 2, 3].map((row) => (
          <div key={row} className="flex min-h-12 items-center gap-3">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    )
  } else if (noResults) {
    body = (
      <div className="px-6 py-10 text-center">
        <p className="break-words text-dashboard-small font-semibold text-dashboard-foreground">No matches for &quot;{searchedFor}&quot;.</p>
        <p className="mt-1 text-dashboard-small text-dashboard-muted">Try a student&apos;s name, a course or a lesson topic.</p>
      </div>
    )
  } else {
    const offsets = groups.map((_, groupIndex) => groups.slice(0, groupIndex).reduce((sum, group) => sum + group.results.length, 0))
    body = (
      <div role="listbox" id={listboxId} aria-label="Search results" aria-busy={status === 'loading'} className="pb-2">
        {groups.map((group, groupIndex) => {
          const headingId = `${id}-group-${group.type}`
          return (
            <div key={group.type} role="group" aria-labelledby={headingId}>
              <p id={headingId} role="presentation" className={groupHeading}>{group.label}</p>
              {group.results.map((result, resultIndex) => {
                const current = offsets[groupIndex] + resultIndex
                return (
                  <div
                    key={`${result.type}-${result.id}`}
                    id={optionId(current)}
                    role="option"
                    aria-selected={current === activeIndex}
                    className={optionClass(current)}
                    onMouseMove={() => setActive(current)}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => openHref(result.href)}
                  >
                    <EntityIcon entity={searchEntity[result.type]} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 break-words font-medium md:line-clamp-1"><Highlighted text={result.name} query={searchedFor} /></span>
                      {result.detail ? <span className="block truncate text-dashboard-secondary text-dashboard-muted"><Highlighted text={result.detail} query={searchedFor} /></span> : null}
                    </span>
                    {result.type === 'lesson' && result.status ? <StatusChip status={result.status} /> : null}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    )
  }

  const expanded = options.length > 0

  return (
    <Dialog
      label="Search"
      onClose={onClose}
      layout="search"
      className="animate-dashboard-scrim-in fixed inset-0 z-[99999] flex items-start justify-center bg-dashboard-scrim backdrop-blur-sm md:px-4 md:pt-[12vh]"
      panelClassName={cx(
        'flex w-full flex-col overflow-hidden bg-dashboard-surface shadow-dashboard-overlay outline-none',
        'h-dvh max-md:animate-dashboard-sheet-up',
        'md:h-auto md:max-h-[min(36rem,76vh)] md:max-w-[560px] md:rounded-dashboard-dialog md:animate-dashboard-dialog-in',
      )}
    >
      {/* The field shows focus as a 2px line under the header, not a box inside it. */}
      <div className="flex items-center gap-2 border-b border-dashboard-outline px-4 focus-within:shadow-[inset_0_-2px_0_var(--dashboard-focus)] max-md:pt-[env(safe-area-inset-top)]">
        <Search aria-hidden="true" className="size-4 shrink-0 text-dashboard-muted max-md:hidden" strokeWidth={1.75} />
        <input
          ref={inputRef}
          data-search-input=""
          data-autofocus=""
          role="combobox"
          aria-label="Search"
          aria-expanded={expanded}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
          type="text"
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          maxLength={100}
          placeholder="Search…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onKeyDown}
          // The global focus ring is unlayered CSS, so only an inline style replaces it here.
          style={{ outline: 'none' }}
          className="h-14 min-w-0 flex-1 bg-transparent text-dashboard-body text-dashboard-foreground outline-none placeholder:text-dashboard-muted max-md:order-2"
        />
        <IconButton variant="quiet" label="Close search" onClick={onClose} className="-mr-2 shrink-0 max-md:order-1 max-md:-ml-2 max-md:mr-0">
          <X aria-hidden="true" className="size-5" />
        </IconButton>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{body}</div>
      <div aria-hidden="true" className="flex items-center gap-2 border-t border-dashboard-outline px-4 py-2.5 text-dashboard-secondary text-dashboard-muted max-md:hidden">
        <Kbd><ArrowUp className="size-3" /></Kbd><Kbd><ArrowDown className="size-3" /></Kbd><span>Navigate</span>
        <span>·</span>
        <Kbd><CornerDownLeft className="size-3" /></Kbd><span>Open</span>
        <span>·</span>
        <Kbd>esc</Kbd><span>Close</span>
      </div>
      <LiveRegion message={announcement} />
    </Dialog>
  )
}
