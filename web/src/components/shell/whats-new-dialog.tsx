'use client'

import { useId, useState } from 'react'
import { ChevronDown, ExternalLink, Gauge, Sparkles, Wrench } from 'lucide-react'
import { ModalDialog } from '@/components/ui/dialog'
import { changelogSectionLabels, type ChangelogEntry, type ChangelogSection } from '@/content/changelog'

const sectionOrder: ChangelogSection[] = ['features', 'fixes', 'speed']
const sectionIcons = { features: Sparkles, fixes: Wrench, speed: Gauge } as const
const sectionCountWords: Record<ChangelogSection, [string, string]> = {
  features: ['feature', 'features'],
  fixes: ['fix', 'fixes'],
  speed: ['speed improvement', 'speed improvements'],
}

function parseDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, (month || 1) - 1, day || 1)
}

/** "26 November · Yesterday"; older days show the date only. */
export function changelogDayLabel(date: string, today: Date) {
  const day = parseDate(date)
  const label = day.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const diff = Math.round((start.getTime() - day.getTime()) / 86_400_000)
  if (diff === 0) return `${label} · Today`
  if (diff === 1) return `${label} · Yesterday`
  return label
}

/** "1 feature, 1 fix" for a collapsed older day. */
export function changelogCountLabel(entry: ChangelogEntry) {
  return sectionOrder
    .map((section) => {
      const count = entry.sections[section]?.length ?? 0
      if (!count) return null
      const [one, many] = sectionCountWords[section]
      return `${count} ${count === 1 ? one : many}`
    })
    .filter(Boolean)
    .join(', ')
}

function EntryBody({ entry }: { entry: ChangelogEntry }) {
  return (
    <div className="space-y-4">
      {sectionOrder.map((section) => {
        const items = entry.sections[section]
        if (!items?.length) return null
        const Icon = sectionIcons[section]
        return (
          <section key={section}>
            <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-dashboard-muted">
              <Icon aria-hidden="true" className="size-4" />
              {changelogSectionLabels[section]}
            </h4>
            <ul className="mt-2 list-disc space-y-2 pl-5 text-dashboard-small leading-6 text-dashboard-muted marker:text-dashboard-outline-strong">
              {items.map((item) => (
                <li key={item.name}><strong className="font-semibold text-dashboard-foreground">{item.name}</strong> {item.text}</li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

function EarlierDay({ entry, today }: { entry: ChangelogEntry; today: Date }) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  return (
    <li className="border-b border-dashboard-outline last:border-b-0">
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
          className="flex min-h-11 w-full items-center gap-2 py-2 text-left text-dashboard-small outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dashboard-focus"
        >
          <span className="font-medium text-dashboard-foreground">{changelogDayLabel(entry.date, today)}</span>
          <span className="flex-1 text-dashboard-muted">· {changelogCountLabel(entry)}</span>
          <ChevronDown aria-hidden="true" className={`size-4 text-dashboard-muted transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </h3>
      <div id={panelId} hidden={!open} className="pb-4">
        <EntryBody entry={entry} />
      </div>
    </li>
  )
}

/** What's new (SH-04a): newest day open, older days collapsed under "Read earlier". */
export function WhatsNewDialog({ open, onClose, entries, changelogUrl, today = new Date() }: {
  open: boolean
  onClose: () => void
  entries: ChangelogEntry[]
  changelogUrl?: string
  today?: Date
}) {
  const [newest, ...earlier] = entries
  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      size="lg"
      title="What's new"
      subtitle="Recent updates to Kanvise"
      footer={changelogUrl ? (
        <a href={changelogUrl} target="_blank" rel="noopener noreferrer" className="mr-auto inline-flex min-h-11 items-center gap-1.5 text-dashboard-small font-medium text-dashboard-primary underline-offset-2 hover:underline max-md:mr-0 max-md:justify-center">
          See the full changelog
          <ExternalLink aria-hidden="true" className="size-4" />
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      ) : undefined}
    >
      {newest ? (
        <>
          <h3 className="mb-3 text-dashboard-small text-dashboard-muted">{changelogDayLabel(newest.date, today)}</h3>
          <EntryBody entry={newest} />
        </>
      ) : (
        <p className="text-dashboard-small text-dashboard-muted">Nothing new yet. Updates will appear here as we ship them.</p>
      )}
      {earlier.length ? (
        <>
          <div className="my-5 flex items-center gap-3 text-dashboard-secondary text-dashboard-muted" role="separator" aria-label="Read earlier">
            <span aria-hidden="true" className="h-px flex-1 bg-dashboard-outline" />
            <span aria-hidden="true">Read earlier</span>
            <span aria-hidden="true" className="h-px flex-1 bg-dashboard-outline" />
          </div>
          <ul>
            {earlier.map((entry) => <EarlierDay key={entry.id} entry={entry} today={today} />)}
          </ul>
        </>
      ) : null}
    </ModalDialog>
  )
}
