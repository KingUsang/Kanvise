import React, { useState } from 'react'

export function InsightModal({ insight, onClose }: { insight: any, onClose: () => void }) {
  if (!insight) return null
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 text-left font-sans">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col">
        <div className="p-6 border-b border-red-100 bg-red-50/50 flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse"></span>
              <h2 className="text-xl font-bold text-red-950">{insight.student} needs attention</h2>
            </div>
            <p className="text-sm font-semibold text-red-800 uppercase tracking-wide">{insight.topic} — {insight.topicScore}%</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto">
          <div className="mb-6">
             <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Topic Trend</h4>
             <div className="flex justify-between items-end h-24 gap-2">
                {insight.history.map((score: number, i: number) => (
                    <div key={i} className="flex-1 flex flex-col items-center justify-end gap-2 group relative">
                        <div className={`w-full rounded-t-sm transition-all ${i === 3 ? 'bg-red-400' : 'bg-slate-200'}`} style={{ height: `${Math.max(score, 10)}%` }}></div>
                        <span className="text-xs font-semibold text-slate-500">{i === 3 ? 'Today' : `Mock ${i+1}`}</span>
                        <div className="absolute -top-8 bg-slate-800 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity">{score}%</div>
                    </div>
                ))}
             </div>
          </div>
          
          <div className="mb-6">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Cross-Signal Analysis</h4>
            <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100">
              {insight.student} has consistently struggled with {insight.topic} across four assessments. He also failed today's knowledge check on Newton's Third Law.
              <br/><br/>
              <span className="font-semibold">{insight.summary}</span>
            </p>
          </div>

          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Suggested Action</h4>
            <div className="flex items-center justify-between bg-purple-50 p-4 rounded-xl border border-purple-100">
               <span className="text-sm text-purple-900 font-medium">{insight.recommendation}</span>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-200 transition-colors">
            Dismiss
          </button>
          <button onClick={onClose} className="px-5 py-2 rounded-lg text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 shadow-md hover:shadow-lg transition-all flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">send</span>
            Send Support
          </button>
        </div>
      </div>
    </div>
  )
}
