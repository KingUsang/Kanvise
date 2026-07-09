'use client'

import React from 'react'

interface TopBarProps {
  user: {
    first_name: string;
    last_name: string;
    role: string;
  };
  onMenuClick?: () => void;
}

export function TopBar({ user, onMenuClick }: TopBarProps) {
  return (
    <header className="h-16 fixed top-0 right-0 left-0 md:left-64 bg-white/95 backdrop-blur-sm border-b border-[#c8c5d2] flex items-center justify-between px-4 md:px-8 z-40">
      
      {/* Search & Mobile Menu */}
      <div className="flex-1 flex items-center gap-4 max-w-md">
        <button 
          className="md:hidden text-[#474551] flex items-center"
          onClick={onMenuClick}
        >
          <span className="material-symbols-outlined text-[24px]">menu</span>
        </button>
        <div className="relative flex-1 hidden sm:block">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#474551] text-[20px]">
            search
          </span>
          <input 
            type="text" 
            placeholder="Search students, classes, or notes..." 
            className="w-full bg-[#f5f3f2] border border-[#c8c5d2] rounded-lg py-2 pl-10 pr-4 text-sm text-[#1b1c1c] focus:outline-none focus:ring-2 focus:ring-[#2e2877]"
          />
        </div>
      </div>
      
      {/* Right side icons & Profile */}
      <div className="flex items-center space-x-6">
        
        {/* Notifications */}
        <button className="relative text-[#474551] hover:text-[#180d62] transition-colors">
          <span className="material-symbols-outlined text-[24px]">notifications</span>
          <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
        </button>
        
        {/* Divider */}
        <div className="h-6 w-px bg-[#c8c5d2]"></div>
        
        {/* Profile */}
        <div className="flex items-center space-x-3 cursor-pointer group">
          <div className="text-right">
            <div className="text-sm font-semibold text-[#1b1c1c] group-hover:text-[#180d62] transition-colors">
              {user.first_name}
            </div>
            <div className="text-xs text-[#474551] capitalize">{user.role}</div>
          </div>
          
          <div className="w-10 h-10 rounded-full bg-[#180d62] text-white flex items-center justify-center font-bold">
            {user.first_name?.[0]}
          </div>
        </div>
        
      </div>
    </header>
  )
}
