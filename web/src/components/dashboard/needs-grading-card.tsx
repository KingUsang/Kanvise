import React from 'react'
import Link from 'next/link'

export interface GradingItem {
  id: string;
  kind?: 'mock' | 'assignment';
  href?: string;
  title: string;
  context: string;
  pending_count?: number;
  progress: number;
}

export function NeedsGradingCard({ items }: { items: GradingItem[] }) {
  return (
    <div className="bg-white rounded-lg border border-[#c8c5d2] shadow-[0_4px_20px_rgba(61,61,61,0.08)] overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-[#f0eded] p-4 sm:p-6">
        <h3 className="text-base font-semibold text-[#1b1c1c] sm:text-[20px]">Waiting for you to grade</h3>
        <span className="bg-[#2e2877] text-white text-[12px] font-semibold px-3 py-1 rounded-full">
          {items.reduce((sum, item) => sum + (item.pending_count || 0), 0)} waiting
        </span>
      </div>

      {/* List */}
      <div className="flex-1 flex flex-col">
        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center p-5 py-7 text-center sm:p-8 sm:py-12">
            <div className="mb-3 hidden h-14 w-14 items-center justify-center rounded-full bg-[#eae8e7] sm:flex">
              <span className="material-symbols-outlined text-[32px] text-[#787582]">assignment_turned_in</span>
            </div>
            <h4 className="mb-1 font-semibold text-[#1b1c1c]">All caught up</h4>
            <p className="text-sm text-[#474551]">Nothing needs grading right now.</p>
          </div>
        ) : (
          items.map((item, index) => (
            <Link href={item.href || `/dashboard/assignments/${item.id}/submissions`} key={`${item.kind || 'assignment'}-${item.id}`} className={`block p-6 transition-colors hover:bg-[#fbf9f8] ${index !== items.length - 1 ? 'border-b border-[#f0eded]' : ''}`}>
              <div className="flex justify-between items-center mb-1">
                <div className="flex min-w-0 items-center gap-2">
                  <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${item.kind === 'mock' ? 'bg-[#fff3e8] text-[#994704]' : 'bg-[#eeedff] text-[#2e2877]'}`}>{item.kind === 'mock' ? 'Mock' : 'Assignment'}</span>
                  <h4 className="truncate text-[#1b1c1c] font-medium text-[16px]">{item.title}</h4>
                </div>
                <span className="material-symbols-outlined text-[#c8c5d2] text-[20px]">chevron_right</span>
              </div>
              <p className="text-[#474551] text-[14px] mb-3">{item.context}</p>
              
              <div className="flex items-center gap-3">
                <div className="flex-1 h-1.5 bg-[#eae8e7] rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-[#c26627] rounded-full" 
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
                <span className="text-[#474551] text-[12px] font-semibold w-8 text-right">{item.progress}%</span>
              </div>
            </Link>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-[#f0eded] mt-auto flex items-center justify-center gap-5">
        <Link href="/dashboard/mocks" className="text-[#c26627] font-semibold text-[14px] hover:text-[#994704] transition-colors">
          Mocks
        </Link>
        <Link href="/dashboard/assignments" className="text-[#c26627] font-semibold text-[14px] hover:text-[#994704] transition-colors">
          Assignments
        </Link>
      </div>
    </div>
  )
}
