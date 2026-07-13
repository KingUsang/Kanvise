import React from 'react';

// Mockup 1: Receive Payments
export const PaymentsMockup = () => (
  <div className="w-full md:w-1/2 rounded-2xl border border-outline-variant bg-surface-container-lowest p-8 flex flex-col gap-6 shadow-sm">
    <div className="flex items-center justify-between">
      <h3 className="font-label-md text-on-surface-variant font-semibold">Recent Transactions</h3>
      <span className="text-primary font-bold">₦245,000 / mo</span>
    </div>
    
    <div className="space-y-4 relative">
      <div className="absolute w-1 h-full bg-surface-variant left-[19px] top-0 rounded-full z-0"></div>
      
      <div className="flex items-center gap-4 relative z-10">
        <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center shrink-0 border-2 border-white shadow-sm">
          <span className="material-symbols-outlined text-secondary text-[20px]">arrow_downward</span>
        </div>
        <div className="bg-white border border-outline-variant rounded-xl p-4 flex-1 shadow-sm flex justify-between items-center">
          <div>
            <p className="font-label-md font-semibold text-on-surface">Payment Received</p>
            <p className="text-[12px] text-on-surface-variant">Calculus 101 • John Doe</p>
          </div>
          <p className="font-bold text-secondary">+₦15,000</p>
        </div>
      </div>

      <div className="flex items-center gap-4 relative z-10">
        <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center shrink-0 border-2 border-white shadow-sm">
          <span className="material-symbols-outlined text-secondary text-[20px]">arrow_downward</span>
        </div>
        <div className="bg-white border border-outline-variant rounded-xl p-4 flex-1 shadow-sm flex justify-between items-center">
          <div>
            <p className="font-label-md font-semibold text-on-surface">Payment Received</p>
            <p className="text-[12px] text-on-surface-variant">Physics • Sarah Connor</p>
          </div>
          <p className="font-bold text-secondary">+₦15,000</p>
        </div>
      </div>
    </div>
    
    <div className="mt-2 w-full h-[60px] bg-surface-container rounded-lg flex items-end px-4 gap-2 pb-2">
      <div className="w-1/6 h-[40%] bg-primary/40 rounded-t-sm"></div>
      <div className="w-1/6 h-[60%] bg-primary/60 rounded-t-sm"></div>
      <div className="w-1/6 h-[80%] bg-primary/80 rounded-t-sm"></div>
      <div className="w-1/6 h-[100%] bg-primary rounded-t-sm"></div>
      <div className="w-1/6 h-[50%] bg-primary/50 rounded-t-sm"></div>
      <div className="w-1/6 h-[70%] bg-primary/70 rounded-t-sm"></div>
    </div>
  </div>
);

// Mockup 2: Schedule & Auto-Reminders
export const ScheduleMockup = () => (
  <div className="w-full md:w-1/2 rounded-2xl border border-outline-variant bg-surface-container-lowest p-8 flex flex-col items-center justify-center relative min-h-[300px]">
    <div className="w-full max-w-sm bg-white border border-outline-variant shadow-md rounded-xl overflow-hidden">
      <div className="bg-primary px-4 py-3 flex justify-between items-center text-white">
        <span className="font-label-md font-semibold">Tomorrow, 10:00 AM</span>
        <span className="material-symbols-outlined text-[20px]">calendar_today</span>
      </div>
      <div className="p-4">
        <h4 className="font-headline-sm text-[18px] mb-1">Calculus 101</h4>
        <p className="text-on-surface-variant text-[14px] flex items-center gap-1">
          <span className="material-symbols-outlined text-[16px]">group</span>
          12 Students Enrolled
        </p>
      </div>
    </div>

    {/* Floating Bubble */}
    <div className="absolute right-0 md:-right-8 bottom-12 whatsapp-bubble bg-white rounded-2xl p-4 flex gap-3 shadow-lg z-10 max-w-[240px] animate-fade-in">
      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
        <span className="material-symbols-outlined text-primary text-[18px]">mark_email_read</span>
      </div>
      <div>
        <p className="text-[12px] font-bold text-on-surface">Auto-Reminder Sent</p>
        <p className="text-[12px] text-on-surface-variant leading-tight">&quot;Reminder: Calculus 101 starts in 1 hour. Join here.&quot;</p>
      </div>
    </div>
  </div>
);

// Mockup 3: Mock Exams
export const MockExamsMockup = () => (
  <div className="w-full md:w-1/2 rounded-2xl border border-outline-variant bg-surface-container-lowest overflow-hidden flex flex-col md:flex-row shadow-sm min-h-[300px]">
    {/* Tutor Side */}
    <div className="w-full md:w-1/2 bg-surface p-4 border-r border-outline-variant flex flex-col">
      <h3 className="font-label-md text-[12px] uppercase text-on-surface-variant font-bold mb-4 tracking-wider">Tutor: Create</h3>
      <div className="bg-white rounded-lg p-3 border border-outline-variant mb-3 shadow-sm flex-1">
        <p className="text-[12px] font-semibold mb-2">Q1: What is the derivative of x²?</p>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full border border-outline"></div>
            <span className="text-[12px]">x</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
            </div>
            <span className="text-[12px] font-bold text-primary">2x</span>
          </div>
        </div>
      </div>
      <button className="w-full py-2 bg-surface-container-high border border-outline-variant rounded-md text-[12px] font-bold text-primary flex justify-center items-center gap-1 hover:bg-surface-variant transition-colors active:scale-95">
        <span className="material-symbols-outlined text-[14px]">add</span> Add Question
      </button>
    </div>

    {/* Student Side */}
    <div className="w-full md:w-1/2 bg-primary p-4 flex flex-col items-center justify-center text-white">
      <h3 className="font-label-md text-[12px] uppercase text-white/70 font-bold mb-4 tracking-wider w-full text-center">Student: Result</h3>
      <div className="relative w-24 h-24 mb-4">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
          <circle cx="18" cy="18" r="16" fill="none" className="stroke-white/20" strokeWidth="3"></circle>
          <circle cx="18" cy="18" r="16" fill="none" className="stroke-white" strokeWidth="3" strokeDasharray="100" strokeDashoffset="8"></circle>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[24px] font-bold">92%</span>
        </div>
      </div>
      <div className="bg-white/10 rounded-lg p-3 w-full backdrop-blur-sm flex items-center justify-between">
        <span className="text-[12px]">Submitted at 10:45 AM</span>
        <span className="material-symbols-outlined text-white text-[18px]">verified</span>
      </div>
    </div>
  </div>
);

// Mockup 4: Live Classes & Auto-Attendance
export const LiveClassesMockup = () => (
  <div className="w-full md:w-1/2 rounded-2xl border border-outline-variant bg-surface-container-lowest p-2 shadow-sm flex flex-col h-[320px]">
    {/* Top Bar */}
    <div className="flex justify-between items-center px-4 py-2 bg-surface rounded-t-xl border-b border-outline-variant">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-secondary animate-pulse"></div>
        <span className="font-label-md text-[12px] font-bold">LIVE: Physics 101</span>
      </div>
      <div className="flex gap-2">
        <span className="material-symbols-outlined text-[16px] text-on-surface-variant">mic</span>
        <span className="material-symbols-outlined text-[16px] text-on-surface-variant">videocam</span>
      </div>
    </div>
    
    <div className="flex flex-1 overflow-hidden relative">
      {/* Whiteboard */}
      <div className="flex-1 bg-white p-4 relative border-r border-outline-variant">
        <svg viewBox="0 0 200 100" className="w-full h-full opacity-60">
          <path d="M 20 80 Q 50 20 100 50 T 180 20" fill="none" stroke="#2E2877" strokeWidth="2" />
          <line x1="20" y1="80" x2="180" y2="80" stroke="#C26627" strokeWidth="1" />
          <text x="100" y="30" fontSize="10" fill="#2E2877" fontFamily="sans-serif">f(x) = sin(x)</text>
        </svg>
        
        {/* PIP Video */}
        <div className="absolute bottom-4 left-4 w-24 h-16 bg-surface-variant rounded-lg border-2 border-white shadow-md overflow-hidden flex items-center justify-center">
            <span className="material-symbols-outlined text-outline">person</span>
        </div>
      </div>
      
      {/* Attendance Sidebar */}
      <div className="w-1/3 bg-surface p-3 flex flex-col">
        <h4 className="text-[12px] font-bold mb-3 flex justify-between">
          <span>Attendance</span>
          <span className="text-primary">24/25</span>
        </h4>
        <div className="space-y-2 overflow-hidden flex-1">
          {[1,2,3,4].map((i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-surface-variant shrink-0"></div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold truncate">Student {i}</p>
                <p className="text-[8px] text-on-surface-variant">Joined 10:0{i} AM</p>
              </div>
              <div className="w-2 h-2 rounded-full bg-primary"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

// Mockup 5: Organise Teaching Materials
export const MaterialsMockup = () => (
  <div className="w-full md:w-1/2 rounded-2xl border border-outline-variant bg-surface-container-lowest p-6 shadow-sm flex flex-col min-h-[300px]">
    <div className="flex justify-between items-center mb-6">
      <h3 className="font-label-md text-[16px] font-semibold">Library</h3>
      <button className="bg-primary/10 text-primary px-3 py-1 rounded-md text-[12px] font-bold flex items-center gap-1">
        <span className="material-symbols-outlined text-[14px]">upload_file</span> Upload
      </button>
    </div>

    <div className="space-y-4">
      {/* Folder */}
      <div className="flex items-center gap-3 p-3 rounded-xl border border-outline-variant hover:bg-surface hover:shadow-sm hover:-translate-y-1 transition-all cursor-pointer">
        <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-secondary">folder</span>
        </div>
        <div className="flex-1">
          <p className="font-semibold text-[14px]">Week 1: Kinematics</p>
          <p className="text-[12px] text-on-surface-variant">3 files • 12MB</p>
        </div>
        <span className="material-symbols-outlined text-on-surface-variant">chevron_right</span>
      </div>

      {/* File */}
      <div className="flex items-center gap-3 p-3 rounded-xl border border-outline-variant hover:bg-surface hover:shadow-sm hover:-translate-y-1 transition-all cursor-pointer">
        <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-secondary">picture_as_pdf</span>
        </div>
        <div className="flex-1">
          <p className="font-semibold text-[14px]">Kinematics Notes.pdf</p>
          <p className="text-[12px] text-on-surface-variant">Added 2 days ago</p>
        </div>
        <span className="material-symbols-outlined text-on-surface-variant">more_vert</span>
      </div>
      
      {/* File */}
      <div className="flex items-center gap-3 p-3 rounded-xl border border-outline-variant hover:bg-surface hover:shadow-sm hover:-translate-y-1 transition-all cursor-pointer">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-primary">slideshow</span>
        </div>
        <div className="flex-1">
          <p className="font-semibold text-[14px]">Lecture Slides.pptx</p>
          <p className="text-[12px] text-on-surface-variant">Added yesterday</p>
        </div>
        <span className="material-symbols-outlined text-on-surface-variant">more_vert</span>
      </div>
    </div>
  </div>
);
