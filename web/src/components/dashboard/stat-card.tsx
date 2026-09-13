import React from 'react'

interface StatCardProps {
  title: string;
  value: string | number;
  icon: string;
  subtitle?: string;
  isRevenue?: boolean;
}

export function StatCard({ title, value, icon, subtitle, isRevenue }: StatCardProps) {
  if (isRevenue) {
    return (
      <div className="relative flex min-w-0 flex-col overflow-hidden rounded-lg bg-[#2e2877] p-4 text-white shadow-[0_4px_20px_rgba(61,61,61,0.08)] sm:p-6">
        {/* Subtle background decoration */}
        <div className="absolute right-0 top-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl"></div>
        <div className="absolute -top-6 -right-6 w-24 h-24 bg-white/5 rounded-full"></div>
        
        <div className="flex justify-between items-start relative z-10">
          <p className="mb-3 text-[10px] font-semibold uppercase leading-4 tracking-[0.05em] text-white/80 sm:mb-4 sm:text-[12px]">{title}</p>
          <span className="material-symbols-outlined text-[20px] text-white/80 sm:text-[24px]">{icon}</span>
        </div>
        
        <div className="relative z-10 mt-auto pt-2">
          <h3 className="break-words text-[22px] font-bold leading-tight sm:text-[32px] sm:leading-none">{value}</h3>
          {subtitle && <p className="mt-3 hidden text-sm text-white/80 sm:block">{subtitle}</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex min-w-0 flex-col overflow-hidden rounded-lg border border-[#c8c5d2] bg-white p-4 shadow-[0_4px_20px_rgba(61,61,61,0.08)] sm:p-6">
      {/* Decorative top-right circle */}
      <div className="absolute -top-6 -right-6 w-24 h-24 bg-[#eae8e7] rounded-full"></div>
      
      <div className="flex justify-between items-start relative z-10">
        <p className="mb-3 text-[10px] font-semibold uppercase leading-4 tracking-[0.05em] text-[#474551] sm:mb-4 sm:text-[12px]">{title}</p>
        <span className="material-symbols-outlined text-[20px] text-[#2e2877] sm:text-[24px]">{icon}</span>
      </div>
      
      <div className="relative z-10 mt-auto pt-2">
        <h3 className="break-words text-[24px] font-bold leading-none text-[#1b1c1c] sm:text-[32px]">{value}</h3>
        {subtitle && <p className="mt-3 hidden text-sm font-medium text-[#474551] sm:block">{subtitle}</p>}
      </div>
    </div>
  )
}
