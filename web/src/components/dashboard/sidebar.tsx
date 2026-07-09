'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface SidebarProps {
  capabilities: {
    isAdmin: boolean;
    isTutor: boolean;
  }
}

export function Sidebar({ capabilities }: SidebarProps) {
  const pathname = usePathname()
  
  const navItems = [
    { label: 'Dashboard', href: '/dashboard', show: true, icon: 'space_dashboard' },
    
    // Admin only
    { label: 'School Setup', href: '/dashboard/school-setup', show: capabilities.isAdmin, icon: 'settings_applications' },
    { label: 'Programmes', href: '/dashboard/programmes', show: capabilities.isAdmin, icon: 'library_books' },
    { label: 'Tutors', href: '/dashboard/tutors', show: capabilities.isAdmin, icon: 'groups_3' },
    { label: 'Students', href: '/dashboard/students', show: capabilities.isAdmin, icon: 'face' },
    { label: 'Payments', href: '/dashboard/payments', show: capabilities.isAdmin, icon: 'payments' },
    
    // Shared Admin/Tutor
    { label: 'Schedule', href: '/dashboard/schedule', show: true, icon: 'calendar_month' },
    { label: 'Attendance', href: '/dashboard/attendance', show: true, icon: 'fact_check' },
    { label: 'Mocks', href: '/dashboard/mocks', show: true, icon: 'quiz' },
    
    // Tutor only
    { label: 'Notes', href: '/dashboard/notes', show: capabilities.isTutor, icon: 'description' },
    { label: 'Assignments', href: '/dashboard/assignments', show: capabilities.isTutor, icon: 'assignment' },
    { label: 'Submissions', href: '/dashboard/submissions', show: capabilities.isTutor, icon: 'check_circle' },
    
    // Always show
    { label: 'Settings', href: '/dashboard/settings', show: true, icon: 'settings' }
  ].filter(item => item.show)

  return (
    <aside className="w-64 bg-[#2e2877] h-screen fixed left-0 top-0 flex flex-col text-white z-50">
      <div className="h-16 flex items-center px-6 border-b border-white/10">
        <img src="/kanvise_logo.jpeg" alt="Kanvise" className="w-8 h-8 rounded border border-white/20 mr-3 object-cover" />
        <h1 className="font-bold text-lg tracking-tight">Kanvise</h1>
      </div>
      
      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <li key={item.href}>
                <Link 
                  href={item.href}
                  className={`
                    flex items-center px-6 py-3 text-sm font-medium transition-colors relative
                    ${isActive 
                      ? 'text-white bg-white/5' 
                      : 'text-[#9893e8] hover:text-white hover:bg-white/5'
                    }
                  `}
                >
                  {isActive && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#c26627] rounded-r-sm" />
                  )}
                  <span className="material-symbols-outlined mr-3 text-[24px]">
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
      
      <div className="p-4 border-t border-white/10">
        <div className="text-xs text-[#9893e8] text-center">
          Kanvise OS v1.0
        </div>
      </div>
    </aside>
  )
}
