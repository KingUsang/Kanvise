"use client";

import { useState, useMemo } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Search } from "lucide-react";
import StudentDetailsSheet from "./student-details-sheet";

export default function StudentsTable({ students, onStudentRemoved }: { students: any[], onStudentRemoved: (studentId: string) => void }) {
  const [programmeFilter, setProgrammeFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);

  // Extract unique programmes for the filter dropdown
  const enrolmentOptions = useMemo(() => {
    const progs = new Map<string, string>();
    students.forEach(student => {
      (student.enrolments || []).forEach((enr: any) => {
        if (enr.programmes?.id) progs.set(`programme:${enr.programmes.id}`, `Programme — ${enr.programmes.name}`);
        if (enr.sub_programmes?.id) progs.set(`sub_programme:${enr.sub_programmes.id}`, `Sub-programme — ${enr.sub_programmes.name}`);
        if (enr.courses?.id) progs.set(`course:${enr.courses.id}`, `Subject — ${enr.courses.name}`);
      });
    });
    return Array.from(progs.entries()).map(([id, name]) => ({ id, name }));
  }, [students]);

  const filteredStudents = students.filter(student => {
    const query = searchQuery.trim().toLowerCase();
    if (query) {
      const searchable = `${student.first_name || ''} ${student.last_name || ''} ${student.email || ''} ${student.kanvise_user_id || ''}`.toLowerCase();
      if (!searchable.includes(query)) return false;
    }

    if (programmeFilter) {
      const [type, id] = programmeFilter.split(':');
      const hasEnrolment = (student.enrolments || []).some((e: any) => type === 'programme' ? e.programmes?.id === id : type === 'sub_programme' ? e.sub_programmes?.id === id : e.courses?.id === id);
      if (!hasEnrolment) return false;
    }
    
    return true;
  });

  const totalPages = Math.ceil(filteredStudents.length / itemsPerPage);
  const paginatedStudents = filteredStudents.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div>
      {/* Filters & Tools Bar */}
      <div className="mb-4 flex flex-col gap-4 rounded-dashboard-panel border border-dashboard-outline bg-dashboard-surface p-4 shadow-dashboard-card xl:flex-row xl:items-center">
        <div className="flex flex-1 flex-col gap-3 md:flex-row">
          <div className="relative min-w-[240px] flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
            <input value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }} placeholder="Search name, email or student ID" className="w-full rounded-dashboard-control border border-dashboard-outline bg-transparent py-2 pl-10 pr-3 text-sm outline-none focus:border-dashboard-primary" />
          </div>
          <div className="relative min-w-[200px]">
            <select 
              value={programmeFilter}
              onChange={(e) => { setProgrammeFilter(e.target.value); setCurrentPage(1); }}
              className="w-full cursor-pointer appearance-none rounded-dashboard-control border border-dashboard-outline bg-transparent py-2 pl-4 pr-10 text-sm focus:border-dashboard-primary focus:outline-none"
            >
              <option value="">All enrolments</option>
              {enrolmentOptions.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={16} />
          </div>
        </div>
        
        <div className="flex items-center gap-2 text-gray-600 text-xs font-bold uppercase tracking-widest">
          <span>Showing {filteredStudents.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, filteredStudents.length)} of {filteredStudents.length}</span>
          <div className="ml-2 flex overflow-hidden rounded-dashboard-control border border-dashboard-outline">
            <button 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-2 py-1 hover:bg-gray-50 border-r border-kv-dust disabled:opacity-50 flex items-center justify-center"
            >
              <ChevronLeft size={18} />
            </button>
            <button 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="px-2 py-1 hover:bg-gray-50 disabled:opacity-50 flex items-center justify-center"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="overflow-x-auto rounded-dashboard-panel border border-dashboard-outline bg-dashboard-surface shadow-dashboard-card">
        <table className="w-full min-w-[900px] text-left border-collapse">
          <thead>
            <tr className="border-b border-dashboard-outline bg-dashboard-surface-subtle">
              <th className="py-3 px-6 text-xs font-bold text-gray-600 uppercase tracking-widest">Student Info</th>
              <th className="py-3 px-6 text-xs font-bold text-gray-600 uppercase tracking-widest">Student ID</th>
              <th className="py-3 px-6 text-xs font-bold text-gray-600 uppercase tracking-widest">Enrolments</th>
              <th className="py-3 px-6 text-xs font-bold text-gray-600 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {paginatedStudents.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-8 px-6 text-center text-gray-500">
                  No students found matching filters.
                </td>
              </tr>
            ) : (
              paginatedStudents.map((student, i) => {
                const avatarColor = "bg-dashboard-primary text-white";
                return (
                  <tr 
                    key={student.id} 
                    onClick={() => setSelectedStudent(student)}
                    className="group cursor-pointer border-b border-dashboard-outline/50 transition-colors hover:bg-dashboard-primary/5"
                  >
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        {student.profile_photo_url ? (
                          <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
                            <img 
                              src={student.profile_photo_url}
                              alt={`${student.first_name} avatar`}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className={`w-8 h-8 rounded-full ${avatarColor} flex items-center justify-center font-bold text-xs flex-shrink-0`}>
                            {student.first_name?.[0] || ""}{student.last_name?.[0] || ""}
                          </div>
                        )}
                        <div>
                          <div className="font-bold text-dashboard-foreground">{student.first_name} {student.last_name}</div>
                          <div className="text-gray-500 text-xs">{student.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-gray-600 font-mono text-xs">
                      {student.kanvise_user_id || "—"}
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex flex-wrap gap-1">
                        {student.enrolments && student.enrolments.length > 0 ? (
                          student.enrolments.map((enr: any) => (
                            <span key={enr.id} className="px-2 py-1 bg-gray-100 border border-gray-200 rounded text-[10px] font-bold text-gray-600 uppercase tracking-wider">
                              {enr.programmes?.name || enr.sub_programmes?.name || enr.courses?.name || "Unknown"}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-gray-400">None</span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button 
                        onClick={(e) => { e.stopPropagation(); setSelectedStudent(student); }}
                        className="rounded border border-[#c8c5d2] px-3 py-1.5 text-xs font-semibold text-[#2e2877] hover:bg-[#2e2877]/5"
                      >
                        View details
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {selectedStudent && (
        <StudentDetailsSheet 
          student={selectedStudent} 
          onClose={() => setSelectedStudent(null)} 
          onRemoved={() => {
            onStudentRemoved(selectedStudent.id);
            setSelectedStudent(null);
          }}
        />
      )}
    </div>
  );
}
