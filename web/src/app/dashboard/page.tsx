import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { StatCard } from '@/components/dashboard/stat-card'
import { NeedsGradingCard, GradingItem } from '@/components/dashboard/needs-grading-card'
import Link from 'next/link'

export default async function DashboardHomePage() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
      },
    }
  )

  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token

  if (!token) return null

  // Fetch stats
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/dashboard/stats`, {
    headers: {
      'Authorization': `Bearer ${token}`
    },
    cache: 'no-store'
  })

  if (!res.ok) {
    return (
      <div className="p-8 text-center text-red-500">
        Failed to load dashboard data. Please try again.
      </div>
    )
  }

  const { data: statsData } = await res.json()
  
  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0
    }).format(amount)
  }

  // Fallback to empty array if no grading items
  const gradingItems: GradingItem[] = statsData.admin_stats?.needs_grading || []

  return (
    <div className="animate-in fade-in duration-500 space-y-8">
      
      {/* Welcome Section */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold text-[#1b1c1c]">Welcome back</h2>
          <p className="text-[#474551] mt-1">Here's what's happening in your centre today.</p>
        </div>
        {statsData.admin_stats && (
          <button className="bg-[#c26627] text-white px-4 py-2 rounded-lg font-medium text-sm hover:bg-[#994704] transition-colors flex items-center">
            <span className="material-symbols-outlined mr-2 text-[20px]">add</span>
            New Programme
          </button>
        )}
      </div>

      {/* Admin Stats Region (Full Width Top Row) */}
      {statsData.admin_stats && (
        <section>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard 
              title="Total Students" 
              value={statsData.admin_stats.total_students} 
              icon="groups" 
              subtitle="Enrolled across all courses"
            />
            <StatCard 
              title="Active Tutors" 
              value={statsData.admin_stats.active_tutors} 
              icon="school" 
              subtitle="Across all programmes"
            />
            <StatCard 
              title="Upcoming Classes" 
              value={statsData.admin_stats.upcoming_classes} 
              icon="event" 
              subtitle="Scheduled for today"
            />
            <StatCard 
              title="Revenue (MTD)" 
              value={formatCurrency(statsData.admin_stats.mtd_revenue)} 
              icon="payments"
              subtitle="Pending Clearance: ₦450k"
              isRevenue={true} 
            />
          </div>
        </section>
      )}

      {/* Tutor Stats Region (Full Width Top Row) - Only shown to pure tutors */}
      {!statsData.admin_stats && statsData.tutor_stats && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-[#1b1c1c]">My Teaching Hub</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard 
              title="My Classes Today" 
              value={statsData.tutor_stats.classes_today} 
              icon="laptop_chromebook" 
              subtitle="Across your assigned courses"
            />
            <StatCard 
              title="Pending Submissions" 
              value={statsData.tutor_stats.pending_submissions} 
              icon="assignment_late" 
              subtitle="Awaiting your review"
            />
            <StatCard 
              title="My Courses" 
              value={statsData.tutor_stats.my_courses} 
              icon="library_books" 
              subtitle="Active teaching assignments"
            />
          </div>
        </section>
      )}

      {/* Bottom Grid: Schedule (Left) + Needs Grading (Right) */}
      <div className="flex flex-col lg:flex-row gap-6">
        
        {/* Left Column: Schedule Stub */}
        <div className="flex-1">
          <div className="bg-white rounded-lg border border-[#c8c5d2] p-6 shadow-[0_4px_20px_rgba(61,61,61,0.08)] flex flex-col h-full">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-[#1b1c1c]">Today's Schedule</h3>
                <p className="text-sm text-[#474551] mt-1">{statsData.admin_stats?.upcoming_classes || 0} sessions remaining</p>
              </div>
              <button className="text-[#c26627] font-semibold text-sm hover:text-[#994704] transition-colors flex items-center">
                View Full Calendar
                <span className="material-symbols-outlined text-[16px] ml-1">arrow_forward</span>
              </button>
            </div>

            {/* Stub Content */}
            <div className="flex-1 flex flex-col items-center justify-center text-center py-12 border-2 border-dashed border-[#eae8e7] rounded-lg">
              <span className="material-symbols-outlined text-4xl text-[#c8c5d2] mb-3">calendar_month</span>
              <h4 className="text-lg font-medium text-[#1b1c1c]">Schedule Table Coming Soon</h4>
              <p className="text-[#474551] mt-1 max-w-sm mx-auto text-sm">
                The detailed daily schedule table will be built in Step 5.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Needs Grading Widget */}
        <div className="w-full lg:w-[400px] shrink-0">
          <NeedsGradingCard items={gradingItems} />
        </div>

      </div>

    </div>
  )
}
