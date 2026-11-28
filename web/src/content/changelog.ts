/**
 * What's new (01-app-shell SH-04a). Writing an entry here is part of shipping
 * a feature. Newest first. Each item is a short bold name and one sentence on
 * what it does for the reader, in plain words.
 */
export type ChangelogSection = 'features' | 'fixes' | 'speed'

export type ChangelogItem = { name: string; text: string }

export type ChangelogEntry = {
  /** Stable id; the newest id is what "read" means on this device. */
  id: string
  /** Calendar date, YYYY-MM-DD. */
  date: string
  sections: Partial<Record<ChangelogSection, ChangelogItem[]>>
}

export const changelogSectionLabels: Record<ChangelogSection, string> = {
  features: 'New features & improvements',
  fixes: 'Fixes',
  speed: 'Speed improvements',
}

export const changelog: ChangelogEntry[] = [
  {
    id: '2026-11-28-new-shell',
    date: '2026-11-28',
    sections: {
      features: [
        { name: 'A calmer sidebar', text: 'Your pages are now grouped into People, Work, Library and Account, and the page you are on is marked with an orange bar.' },
        { name: 'Bottom bar on phones', text: 'Today, Calendar and More sit at the bottom of the screen, and More opens everything else in one sheet.' },
        { name: 'Switch accounts from the sidebar', text: 'If you work with more than one tutoring agency, tap the account name at the top to move between them.' },
        { name: 'Share feedback', text: 'Send us a note from the ? menu whenever something works well, gets in your way, or is missing.' },
      ],
      fixes: [
        { name: 'Full-height sidebar', text: 'The sidebar now reaches the bottom of the window on long pages.' },
      ],
    },
  },
]
