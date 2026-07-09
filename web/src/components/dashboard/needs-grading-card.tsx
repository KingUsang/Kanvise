import React from 'react'

export interface GradingItem {
  id: string;
  title: string;
  context: string;
  progress: number;
}

export function NeedsGradingCard({ items }: { items: GradingItem[] }) {
  return (
    <div className="bg-white rounded-lg border border-[#c8c5d2] shadow-[0_4px_20px_rgba(61,61,61,0.08)] overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-[#f0eded]">
        <h3 className="text-[#1b1c1c] font-semibold text-[20px]">Needs Grading</h3>
        <span className="bg-[#2e2877] text-white text-[12px] font-semibold px-3 py-1 rounded-full">
          {items.length} New
        </span>
      </div>

      {/* List */}
      <div className="flex-1 flex flex-col">
        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 py-16">
            <div className="w-16 h-16 bg-[#eae8e7] rounded-full flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-[32px] text-[#787582]">assignment_turned_in</span>
            </div>
            <h4 className="text-[#1b1c1c] font-semibold text-[16px] mb-1">All caught up!</h4>
            <p className="text-[#474551] text-[14px]">You have no pending assignments to grade right now.</p>
          </div>
        ) : (
          items.map((item, index) => (
            <div key={item.id} className={`p-6 ${index !== items.length - 1 ? 'border-b border-[#f0eded]' : ''}`}>
              <div className="flex justify-between items-center mb-1">
                <h4 className="text-[#1b1c1c] font-medium text-[16px]">{item.title}</h4>
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
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-[#f0eded] text-center mt-auto">
        <button className="text-[#c26627] font-semibold text-[14px] hover:text-[#994704] transition-colors">
          View All Submissions
        </button>
      </div>
    </div>
  )
}
