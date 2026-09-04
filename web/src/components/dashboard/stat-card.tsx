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
      <div className="bg-[#2e2877] rounded-lg p-6 text-white shadow-[0_4px_20px_rgba(61,61,61,0.08)] relative overflow-hidden flex flex-col h-full">
        {/* Subtle background decoration */}
        <div className="absolute right-0 top-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl"></div>
        <div className="absolute -top-6 -right-6 w-24 h-24 bg-white/5 rounded-full"></div>
        
        <div className="flex justify-between items-start relative z-10">
          <p className="text-white/80 text-[12px] font-semibold tracking-[0.05em] uppercase mb-4">{title}</p>
          <span className="material-symbols-outlined text-[24px] text-white/80">{icon}</span>
        </div>
        
        <div className="relative z-10 mt-auto pt-2">
          <h3 className="text-[32px] font-bold leading-none">{value}</h3>
          {subtitle && <p className="text-white/80 text-sm mt-3">{subtitle}</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg p-6 border border-[#c8c5d2] shadow-[0_4px_20px_rgba(61,61,61,0.08)] relative overflow-hidden flex flex-col h-full">
      {/* Decorative top-right circle */}
      <div className="absolute -top-6 -right-6 w-24 h-24 bg-[#eae8e7] rounded-full"></div>
      
      <div className="flex justify-between items-start relative z-10">
        <p className="text-[#474551] text-[12px] font-semibold tracking-[0.05em] uppercase mb-4">{title}</p>
        <span className="material-symbols-outlined text-[24px] text-[#2e2877]">{icon}</span>
      </div>
      
      <div className="relative z-10 mt-auto pt-2">
        <h3 className="text-[32px] font-bold text-[#1b1c1c] leading-none">{value}</h3>
        {subtitle && <p className="text-[#474551] text-sm mt-3 font-medium">{subtitle}</p>}
      </div>
    </div>
  )
}
