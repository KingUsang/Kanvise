'use client'

import { useState, type ReactNode } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { Copy, Download, Ellipsis, Mail, Pencil, Trash2 } from 'lucide-react'
import { Button, IconButton, LinkButton } from '@/components/ui/button'
import { Badge, CountBadge } from '@/components/ui/badge'
import { Card, Panel } from '@/components/ui/card'
import { StatusChip } from '@/components/ui/status-chip'
import { EntityIcon, entityConfig, type Entity } from '@/components/ui/entity-icon'
import { CourseSwatch, courseColors } from '@/components/ui/course-swatch'
import { Avatar } from '@/components/ui/avatar'
import { Tooltip } from '@/components/ui/tooltip'
import { Menu } from '@/components/ui/menu'
import { AlertDialog, ModalDialog } from '@/components/ui/dialog'
import { Sheet } from '@/components/ui/sheet'
import { WizardNav, WizardProgress, WizardStep } from '@/components/ui/wizard'
import { TabPanel, UnderlineTabs } from '@/components/ui/tabs'
import { PageHeader, WorkspaceHeader } from '@/components/ui/page-header'
import { Skeleton, SkeletonGroup, TopProgressLine } from '@/components/ui/skeleton'
import { Pagination } from '@/components/ui/pagination'
import { ResponsiveTable } from '@/components/ui/data-list'
import { ActiveFilterChips, FilterSheet } from '@/components/ui/filter-sheet'
import { Fab } from '@/components/ui/fab'
import { LiveRegion, SkipLink } from '@/components/ui/live-region'
import { Alert } from '@/components/ui/alert'
import { Field, fieldControlClassName } from '@/components/ui/field'
import { EmptyState, ErrorState, StaleDataNotice } from '@/components/dashboard/async-states'
import { parsePageParam } from '@/lib/use-url-state'
import { toast } from '@/lib/toast'
import { SaveStatus } from '@/components/ui/save-status'
import { ConflictBanner } from '@/components/ui/conflict-banner'
import { OfflineBanner, useOfflineBanner } from '@/components/ui/offline-banner'
import { OnlineOnlyButton } from '@/components/ui/online-only-button'
import { useUploadingCount } from '@/lib/offline/use-autosave-field'
import { AutosaveDemo, getDemoQueue, useDemoOnline } from './autosave-demo'

const sections = [
  ['tokens', 'Tokens'],
  ['buttons', 'Buttons'],
  ['status', 'Status and badges'],
  ['identity', 'Entities, swatches, avatars'],
  ['overlays', 'Tooltip, menu, dialogs, sheets'],
  ['wizard', 'Wizard'],
  ['tabs', 'Tabs'],
  ['headers', 'Page headers'],
  ['states', 'Loading, empty, error'],
  ['lists', 'Lists and pagination'],
  ['toasts', 'Toasts'],
  ['saving', 'Saving and offline'],
] as const

const tokenSwatches: { name: string; className: string }[] = [
  { name: 'page', className: 'bg-dashboard-page' },
  { name: 'surface', className: 'bg-dashboard-surface' },
  { name: 'surface-subtle', className: 'bg-dashboard-surface-subtle' },
  { name: 'surface-hover', className: 'bg-dashboard-surface-hover' },
  { name: 'outline', className: 'bg-dashboard-outline' },
  { name: 'outline-strong', className: 'bg-dashboard-outline-strong' },
  { name: 'foreground', className: 'bg-dashboard-foreground' },
  { name: 'muted', className: 'bg-dashboard-muted' },
  { name: 'primary', className: 'bg-dashboard-primary' },
  { name: 'location', className: 'bg-dashboard-location' },
  { name: 'focus', className: 'bg-dashboard-focus' },
  { name: 'info', className: 'bg-dashboard-info' },
  { name: 'success', className: 'bg-dashboard-success' },
  { name: 'warning', className: 'bg-dashboard-warning' },
  { name: 'danger', className: 'bg-dashboard-danger' },
  { name: 'status-planned', className: 'bg-dashboard-status-planned' },
  { name: 'status-soon', className: 'bg-dashboard-status-soon' },
  { name: 'status-live', className: 'bg-dashboard-status-live' },
]

const students = Array.from({ length: 3 }, (_, index) => ({
  id: String(index + 1),
  name: ['Ada Okafor', 'Ben Mensah', 'Chloe Adeyemi-Watson, a Student with a very long name'][index],
  course: ['GCSE Maths', 'A-level Physics', 'KS3 English'][index],
  next: ['Tue 4:00 PM', 'Wed 5:30 PM', 'Thu 6:00 PM'][index],
  status: (['planned', 'starting-soon', 'live'] as const)[index],
}))

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-6 space-y-4">
      <h2 id={`${id}-title`} className="text-dashboard-section-title font-semibold text-dashboard-foreground">{title}</h2>
      {children}
    </section>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-dashboard-eyebrow font-bold uppercase text-dashboard-muted">{label}</p>
      <div className="flex flex-wrap items-start gap-3">{children}</div>
    </div>
  )
}

const sampleSavedAt = new Date(2026, 10, 28, 16, 12)

function SavingSection() {
  const online = useDemoOnline()
  const banner = useOfflineBanner(online, useUploadingCount(getDemoQueue()))
  return (
    <Section id="saving" title="Saving and offline">
      <Row label="Saving states (SH-13); focus or tap Saved for the time">
        <div className="flex flex-col gap-1">
          <SaveStatus state="saving" />
          <SaveStatus state="saved" savedAt={sampleSavedAt} />
          <SaveStatus state="saved-on-device" />
          <SaveStatus state="couldnt-save" onRetry={() => toast.info('Trying again.')} />
        </div>
      </Row>
      <Row label="Offline banner (under the top bar on phones)">
        <div className="w-full overflow-hidden rounded-dashboard-panel border border-dashboard-outline">
          <OfflineBanner mode="offline" count={0} />
        </div>
        <div className="w-full overflow-hidden rounded-dashboard-panel border border-dashboard-outline">
          <OfflineBanner mode="reconnecting" count={2} />
        </div>
        <div className="w-full overflow-hidden rounded-dashboard-panel border border-dashboard-outline">
          <OfflineBanner mode="reconnecting" count={1} />
        </div>
      </Row>
      <Row label="Changed while offline">
        <ConflictBanner
          className="w-full"
          mine="Warm-up: times tables. Then fractions of amounts, with three worked examples before the practice questions."
          theirs="Start with a fractions quiz, then go over homework."
          onKeepMine={() => toast.info('Keeping your version.')}
          onUseNewer={() => toast.info('Using the newer version.')}
        />
      </Row>
      <Row label="Actions that need the server, offline">
        <OnlineOnlyButton offlineReason="You're offline. You can send this homework when you're back online.">Send</OnlineOnlyButton>
        <Button disabledReason="You're offline. You can complete this summary when you're back online.">Complete</Button>
      </Row>
      <Row label="Try it: a field that saves by itself">
        <div className="w-full space-y-3">
          <OfflineBanner
            mode={banner.mode}
            count={banner.count}
            className={banner.mode ? 'overflow-hidden rounded-dashboard-panel border border-dashboard-outline' : ''}
          />
          <AutosaveDemo />
        </div>
      </Row>
    </Section>
  )
}

export function DesignSystemCatalog() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const page = parsePageParam(searchParams.get('page'))
  const [dialog, setDialog] = useState<'none' | 'form' | 'centred' | 'wizard' | 'alert' | 'sheet' | 'side'>('none')
  const [dirty, setDirty] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [tab, setTab] = useState('overview')
  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState<'forward' | 'back'>('forward')
  const [filters, setFilters] = useState([{ key: 'status', label: 'Planned' }, { key: 'course', label: 'GCSE Maths' }])
  const [announcement, setAnnouncement] = useState('')
  const wizardSteps = ['Student', 'Course', 'Review']
  const close = () => {
    setDialog('none')
    setDirty(false)
  }

  return (
    <div className="min-h-dvh bg-dashboard-page text-dashboard-foreground">
      <SkipLink />
      <main id="main-content" className="mx-auto max-w-dashboard-content space-y-dashboard-section px-dashboard-gutter py-8 pb-32">
        <PageHeader
          title="Design system"
          description="Tokens and shared primitives for the redesign. Dev only; hidden unless NEXT_PUBLIC_ENABLE_DESIGN_PREVIEW=1."
        />
        <nav aria-label="Catalog sections" className="flex flex-wrap gap-x-4 gap-y-1 text-dashboard-small">
          {sections.map(([id, title]) => <a key={id} href={`#${id}`} className="inline-flex min-h-11 items-center font-semibold text-dashboard-primary underline-offset-2 hover:underline">{title}</a>)}
        </nav>

        <Section id="tokens" title="Tokens">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {tokenSwatches.map((token) => (
              <div key={token.name} className="space-y-1">
                <div className={`h-12 rounded-dashboard-control border border-dashboard-outline ${token.className}`} />
                <p className="text-dashboard-secondary text-dashboard-muted">{token.name}</p>
              </div>
            ))}
          </div>
          <Row label="Radius tiers: control 8px, card 12px, dialog 16px">
            <div className="size-16 rounded-dashboard-control border border-dashboard-outline bg-dashboard-surface" />
            <div className="size-16 rounded-dashboard-panel border border-dashboard-outline bg-dashboard-surface shadow-dashboard-card" />
            <div className="size-16 rounded-dashboard-dialog border border-dashboard-outline bg-dashboard-surface shadow-dashboard-overlay" />
          </Row>
          <Row label="Type: page title 24/30, section 18, body 16, small 14, secondary 13">
            <div className="space-y-1">
              <p className="text-dashboard-page-title font-bold md:text-dashboard-page-title-desktop">Page title</p>
              <p className="text-dashboard-section-title font-semibold">Section title</p>
              <p className="text-dashboard-body">Body text for phones, 16px.</p>
              <p className="text-dashboard-small text-dashboard-muted">Small text, 14px.</p>
              <p className="text-dashboard-secondary text-dashboard-muted">Secondary text never goes below 13px.</p>
            </div>
          </Row>
        </Section>

        <Section id="buttons" title="Buttons">
          <Row label="Variants (hover darkens, press scales to 98%)">
            <Button variant="primary">New course</Button>
            <Button variant="outline">Export</Button>
            <Button variant="quiet">Cancel</Button>
            <Button variant="danger"><Trash2 aria-hidden="true" className="size-4" />Delete</Button>
            <LinkButton href="#buttons" variant="outline">Link button</LinkButton>
            <IconButton label="Edit" variant="outline"><Pencil aria-hidden="true" className="size-5" /></IconButton>
          </Row>
          <Row label="Loading and disabled with reason">
            <Button pending pendingLabel="Saving…">Save</Button>
            <Button disabledReason="You're offline. You can complete this summary when you're back online.">Complete</Button>
          </Row>
        </Section>

        <Section id="status" title="Status and badges">
          <Row label="Lesson status chips">
            <StatusChip status="planned" />
            <StatusChip status="starting-soon" />
            <StatusChip status="live" />
            <StatusChip status="live" label="Live now" />
            <StatusChip status="complete" />
          </Row>
          <Row label="Count badge and badges">
            <span className="inline-flex items-center gap-2 text-dashboard-small font-semibold">Homework <CountBadge count={3} label="3 to mark" /></span>
            <Badge tone="info">New</Badge>
            <Badge>Draft</Badge>
          </Row>
        </Section>

        <Section id="identity" title="Entities, swatches, avatars">
          <Row label="Entity icons (SH-05)">
            {(Object.keys(entityConfig) as Entity[]).map((entity) => (
              <span key={entity} className="inline-flex flex-col items-center gap-1">
                <EntityIcon entity={entity} />
                <span className="text-dashboard-secondary text-dashboard-muted">{entityConfig[entity].label}</span>
              </span>
            ))}
          </Row>
          <Row label="Course swatches (rounded squares)">
            {courseColors.map((color) => <span key={color} className="inline-flex items-center gap-2 text-dashboard-small"><CourseSwatch color={color} />{color}</span>)}
          </Row>
          <Row label="Avatars">
            <Avatar name="Alex Thompson" decorative={false} />
            <Avatar name="Science Students Academy" shape="square" decorative={false} />
            <Avatar name="Ada Okafor" size="lg" decorative={false} />
          </Row>
        </Section>

        <Section id="overlays" title="Tooltip, menu, dialogs, sheets">
          <Row label="Tooltip (hover, focus or tap) and menus">
            <Tooltip content="Shown on hover, focus and tap">
              <Button variant="outline">Hover or focus me</Button>
            </Tooltip>
            <Menu
              label="More actions"
              trigger={<Ellipsis aria-hidden="true" className="size-5" />}
              items={[
                { label: 'Duplicate', icon: <Copy className="size-4" />, onSelect: () => setAnnouncement('Duplicate chosen') },
                { label: 'Download', icon: <Download className="size-4" />, onSelect: () => setAnnouncement('Download chosen') },
                { type: 'separator' },
                { label: 'Delete', icon: <Trash2 className="size-4" />, tone: 'danger', onSelect: () => setDialog('alert') },
              ]}
            />
            <Menu
              label="Account"
              iconOnly={false}
              triggerVariant="outline"
              trigger="Account menu"
              placement="bottom-start"
              header={<><p className="text-dashboard-small font-semibold">Alex Thompson</p><p className="text-dashboard-secondary text-dashboard-muted">alex@example.com</p></>}
              items={[{ label: 'My profile', href: '#overlays' }, { label: 'Sign out', onSelect: () => setAnnouncement('Sign out chosen') }]}
            />
          </Row>
          <Row label="Dialogs (phones: full-screen sheet; confirmations stay centred)">
            <Button variant="outline" onClick={() => setDialog('form')}>Form dialog</Button>
            <Button variant="outline" onClick={() => setDialog('centred')}>Centred dialog</Button>
            <Button variant="outline" onClick={() => { setStep(0); setDialog('wizard') }}>Wizard dialog</Button>
            <Button variant="outline" onClick={() => setDialog('alert')}>Confirmation</Button>
            <Button variant="outline" onClick={() => setDialog('sheet')}>Bottom sheet</Button>
            <Button variant="outline" onClick={() => setDialog('side')}>Side sheet</Button>
          </Row>
        </Section>

        <Section id="wizard" title="Wizard">
          <Card className="max-w-xl space-y-4">
            <WizardProgress steps={wizardSteps} current={step} />
            <WizardStep stepKey={step} title={wizardSteps[step]} direction={direction}>
              <p className="text-dashboard-small text-dashboard-muted">Step {step + 1} content. Focus moves to the heading when the step changes.</p>
            </WizardStep>
            <WizardNav
              current={step}
              onBack={() => { setDirection('back'); setStep((value) => Math.max(0, value - 1)) }}
              onContinue={() => { setDirection('forward'); setStep((value) => Math.min(wizardSteps.length - 1, value + 1)) }}
              continueLabel={step === wizardSteps.length - 1 ? 'Create course' : 'Continue'}
            />
          </Card>
        </Section>

        <Section id="tabs" title="Tabs">
          <UnderlineTabs
            label="Course sections"
            idPrefix="catalog-course"
            value={tab}
            onChange={setTab}
            items={[
              { id: 'overview', label: 'Overview' },
              { id: 'plan', label: 'Course plan' },
              { id: 'lessons', label: 'Lessons' },
              { id: 'homework', label: 'Homework', badge: <CountBadge count={2} label="2 to mark" /> },
              { id: 'quizzes', label: 'Quizzes' },
              { id: 'resources', label: 'Resources' },
              { id: 'recordings', label: 'Recordings' },
            ]}
          />
          {['overview', 'plan', 'lessons', 'homework', 'quizzes', 'resources', 'recordings'].map((id) => (
            <TabPanel key={id} idPrefix="catalog-course" id={id} active={tab === id}>
              <p className="py-3 text-dashboard-small text-dashboard-muted">{id} panel</p>
            </TabPanel>
          ))}
        </Section>

        <Section id="headers" title="Page headers">
          <Card>
            <PageHeader
              titleLevel={2}
              title="Courses"
              description="A course pairs a student with a tutor over time."
              primaryAction={<Button>New course</Button>}
              secondaryActions={[{ label: 'Export', onSelect: () => setAnnouncement('Export chosen') }]}
              menuItems={[{ label: 'Archived courses', onSelect: () => setAnnouncement('Archived chosen') }]}
            />
          </Card>
          <Card>
            <WorkspaceHeader
              titleLevel={2}
              leading={<CourseSwatch color="teal" size="lg" />}
              title="GCSE Maths with Ada Okafor, a long course title that truncates on phones"
              status={<StatusChip status="planned" />}
              description="Weekly lessons on Tuesday."
              facts={['Tue 12 Nov', '4:00 PM', 'GCSE Maths']}
              primaryAction={<Button><Mail aria-hidden="true" className="size-4" />Message</Button>}
              phonePrimary="fab"
            />
          </Card>
        </Section>

        <Section id="states" title="Loading, empty, error">
          <div className="relative h-8 overflow-hidden rounded-dashboard-control border border-dashboard-outline bg-dashboard-surface">
            <TopProgressLine progress={60} />
          </div>
          <SkeletonGroup label="Loading lessons" className="grid gap-3 sm:grid-cols-3">
            {[0, 1, 2].map((index) => (
              <Card key={index} className="space-y-3">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-9 w-full" />
              </Card>
            ))}
          </SkeletonGroup>
          <div className="grid gap-4 md:grid-cols-2">
            <EmptyState entity="course" title="No courses yet" body="A course pairs a student with a tutor over time." action={<Button>New course</Button>} />
            <div className="space-y-3">
              <ErrorState size="card" onRetry={() => setAnnouncement('Retrying')} />
              <Card>
                <StaleDataNotice onRetry={() => setAnnouncement('Retrying')} />
                <p className="text-dashboard-small">Data that was already on screen stays here.</p>
              </Card>
            </div>
          </div>
          <Alert tone="info">Inline information alert.</Alert>
          <Panel title="Panel" description="A card with a header." actions={<Button variant="outline">Edit</Button>}>
            <Field label="Course name" hint="Shown to the student." error={null}>
              <input className={fieldControlClassName} defaultValue="GCSE Maths" />
            </Field>
          </Panel>
        </Section>

        <Section id="lists" title="Lists and pagination">
          <div className="flex flex-wrap items-center gap-3">
            <FilterSheet activeCount={filters.length} onApply={() => setAnnouncement('Filters applied')}>
              <p className="text-dashboard-small text-dashboard-muted">The same options as the desktop filters.</p>
            </FilterSheet>
            <ActiveFilterChips filters={filters} onRemove={(key) => setFilters((list) => list.filter((item) => item.key !== key))} onClearAll={() => setFilters([])} />
          </div>
          <ResponsiveTable
            caption="Students"
            rows={students}
            getKey={(row) => row.id}
            getHref={(row) => `#student-${row.id}`}
            columns={[
              { key: 'name', header: 'Name', cell: (row) => row.name },
              { key: 'course', header: 'Course', cell: (row) => row.course },
              { key: 'next', header: 'Next lesson', cell: (row) => row.next },
              { key: 'status', header: 'Status', cell: (row) => <StatusChip status={row.status} />, align: 'end' },
            ]}
            card={{ title: (row) => row.name, details: (row) => [row.course, row.next], status: (row) => <StatusChip status={row.status} /> }}
          />
          <Pagination page={page} pageCount={5} pathname={pathname} search={searchParams.toString()} />
          <Fab label="Add student" onClick={() => setAnnouncement('Add student chosen')} />
        </Section>

        <Section id="toasts" title="Toasts">
          <Row label="One at a time; F6 moves to the toast">
            <Button variant="outline" onClick={() => toast.success('Course created')}>Success toast</Button>
            <Button variant="outline" onClick={() => toast.info('Lesson moved to Tuesday')}>Info toast</Button>
            <Button
              variant="outline"
              onClick={() => toast.undo({
                text: 'Lesson cancelled',
                onUndo: () => setAnnouncement('Undo pressed: nothing was sent'),
                onWindowClosed: () => setAnnouncement('Undo window closed: emails would send now'),
              })}
            >
              Undo toast
            </Button>
          </Row>
          <p className="text-dashboard-small text-dashboard-muted" aria-hidden="true">Last event: {announcement || 'none'}</p>
        </Section>
        <SavingSection />
        <LiveRegion message={announcement} />
      </main>

      <ModalDialog
        open={dialog === 'form'}
        onClose={close}
        title="New course"
        subtitle="A course pairs a student with a tutor over time."
        onRequestClose={() => {
          if (!dirty) return true
          setConfirmDiscard(true)
          return false
        }}
        footer={<><Button variant="outline" onClick={close}>Cancel</Button><Button onClick={close}>Create course</Button></>}
      >
        <Field label="Course name" hint="Type something, then press Escape to see the unsaved-changes check.">
          <input className={fieldControlClassName} data-autofocus="" onChange={() => setDirty(true)} />
        </Field>
      </ModalDialog>
      <AlertDialog
        open={confirmDiscard}
        title="Discard this course?"
        description="What you typed will be lost."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        onCancel={() => setConfirmDiscard(false)}
        onConfirm={() => { setConfirmDiscard(false); close() }}
      />
      <ModalDialog open={dialog === 'centred'} onClose={close} title="Share feedback" subtitle="Tell us what's working, what isn't, or what you'd like Kanvise to do next." phoneLayout="centred" size="lg" footer={<Button onClick={close}>Send</Button>}>
        <Field label="Message"><textarea className={fieldControlClassName} rows={4} data-autofocus="" /></Field>
      </ModalDialog>
      <ModalDialog
        open={dialog === 'wizard'}
        onClose={close}
        title="New course"
        subtitle="Three short steps."
        headerExtra={<WizardProgress steps={wizardSteps} current={step} />}
        footer={<WizardNav current={step} onBack={() => { setDirection('back'); setStep((value) => Math.max(0, value - 1)) }} onContinue={() => { if (step === wizardSteps.length - 1) close(); else { setDirection('forward'); setStep(step + 1) } }} continueLabel={step === wizardSteps.length - 1 ? 'Create course' : 'Continue'} />}
      >
        <WizardStep stepKey={step} title={wizardSteps[step]} direction={direction}>
          <p className="text-dashboard-small text-dashboard-muted">Step {step + 1} of {wizardSteps.length}.</p>
        </WizardStep>
      </ModalDialog>
      <AlertDialog open={dialog === 'alert'} title="Delete this lesson?" description="Students will no longer see it. This can't be undone." confirmLabel="Delete lesson" onCancel={close} onConfirm={close} />
      <Sheet open={dialog === 'sheet'} onClose={close} title="Filter" footer={<Button onClick={close}>Show results</Button>}>
        <p className="text-dashboard-small text-dashboard-muted">Bottom sheet content.</p>
      </Sheet>
      <Sheet open={dialog === 'side'} onClose={close} side="right" title="More">
        <p className="text-dashboard-small text-dashboard-muted">Side sheet content.</p>
      </Sheet>
    </div>
  )
}
