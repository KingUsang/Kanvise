"use client";

import { useState, useMemo } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, CheckCircle2, Clock, AlertTriangle, MoreVertical, HelpCircle } from "lucide-react";
import StudentDetailsSheet from "./student-details-sheet";

export default function StudentsTable({ students }: { students: any[] }) {
  const [programmeFilter, setProgrammeFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);

  // Extract unique programmes for the filter dropdown
  const uniqueProgrammes = useMemo(() => {
    const progs = new Map<string, string>();
    students.forEach(student => {
      (student.enrolments || []).forEach((enr: any) => {
        if (enr.programmes?.id) progs.set(enr.programmes.id, enr.programmes.name);
      });
    });
    return Array.from(progs.entries()).map(([id, name]) => ({ id, name }));
  }, [students]);

  // Compute payment status for a student (mock logic based on enrolment status since payment instalments aren't in DB yet)
  const getPaymentStatus = (student: any) => {
    if (!student.enrolments || student.enrolments.length === 0) return { label: "No Enrolment", code: "none", color: "bg-gray-100 text-gray-800", icon: HelpCircle };
    // Since there's no payment schedule/instalment tracking yet, any enrolment implies they have successfully paid.
    return { label: "Fully Paid", code: "paid", color: "bg-green-100 text-green-800", icon: CheckCircle2 };
  };

  const filteredStudents = students.filter(student => {
    // Programme Filter
    if (programmeFilter) {
      const hasProgramme = (student.enrolments || []).some((e: any) => e.programmes?.id === programmeFilter);
      if (!hasProgramme) return false;
    }
    
    // Payment Filter
    if (paymentFilter) {
      const pStatus = getPaymentStatus(student);
      if (pStatus.code !== paymentFilter) return false;
    }
    
    return true;
  });

  const totalPages = Math.ceil(filteredStudents.length / itemsPerPage);
  const paginatedStudents = filteredStudents.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div>
      {/* Filters & Tools Bar */}
      <div className="bg-white p-4 rounded-lg shadow-[0px_4px_20px_rgba(61,61,61,0.08)] border border-kv-dust/20 mb-4 flex gap-4 items-center">
        <div className="flex-1 flex gap-4">
          <div className="relative min-w-[200px]">
            <select 
              value={programmeFilter}
              onChange={(e) => { setProgrammeFilter(e.target.value); setCurrentPage(1); }}
              className="w-full appearance-none pl-4 pr-10 py-2 border border-kv-dust rounded text-sm focus:outline-none focus:border-kv-blue bg-transparent cursor-pointer"
            >
              <option value="">All Programmes</option>
              {uniqueProgrammes.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={16} />
          </div>
          <div className="relative min-w-[200px]">
            <select 
              value={paymentFilter}
              onChange={(e) => { setPaymentFilter(e.target.value); setCurrentPage(1); }}
              className="w-full appearance-none pl-4 pr-10 py-2 border border-kv-dust rounded text-sm focus:outline-none focus:border-kv-blue bg-transparent cursor-pointer"
            >
              <option value="">Payment Status</option>
              <option value="paid">Fully Paid</option>
              <option value="partial">Partially Paid</option>
              <option value="overdue">Overdue</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={16} />
          </div>
        </div>
        
        <div className="flex items-center gap-2 text-gray-600 text-xs font-bold uppercase tracking-widest">
          <span>Showing {filteredStudents.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, filteredStudents.length)} of {filteredStudents.length}</span>
          <div className="flex border border-kv-dust rounded overflow-hidden ml-2">
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
      <div className="bg-white rounded-lg shadow-[0px_4px_20px_rgba(61,61,61,0.08)] border border-kv-dust/20 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#F9F7F4] border-b border-kv-dust">
              <th className="py-3 px-6 text-xs font-bold text-gray-600 uppercase tracking-widest">Student Info</th>
              <th className="py-3 px-6 text-xs font-bold text-gray-600 uppercase tracking-widest">Student ID</th>
              <th className="py-3 px-6 text-xs font-bold text-gray-600 uppercase tracking-widest">Enrolments</th>
              <th className="py-3 px-6 text-xs font-bold text-gray-600 uppercase tracking-widest">Payment Status</th>
              <th className="py-3 px-6 text-xs font-bold text-gray-600 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {paginatedStudents.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 px-6 text-center text-gray-500">
                  No students found matching filters.
                </td>
              </tr>
            ) : (
              paginatedStudents.map((student, i) => {
                const avatarColors = ["bg-kv-blue text-white", "bg-kv-brown text-white", "bg-kv-dark text-white"];
                const avatarColor = avatarColors[i % avatarColors.length];
                const paymentStatus = getPaymentStatus(student);

                return (
                  <tr 
                    key={student.id} 
                    onClick={() => setSelectedStudent(student)}
                    className="border-b border-kv-dust/30 hover:bg-kv-blue/5 transition-colors group cursor-pointer"
                  >
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        {/* TODO: In the future, parse `student.profile_photo_key` to a signed S3/Supabase Storage URL. Using initials as fallback. */}
                        {student.profile_photo_key ? (
                          <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
                            <img 
                              src={`https://kanvise-storage.com/${student.profile_photo_key}`} // Mocked URL structure
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
                          <div className="font-bold text-kv-dark">{student.first_name} {student.last_name}</div>
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
                              {enr.programmes?.name || enr.courses?.name || "Unknown"}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-gray-400">None</span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 ${paymentStatus.color} rounded text-xs font-bold uppercase tracking-wider`}>
                        <paymentStatus.icon size={14} />
                        {paymentStatus.label}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      {/* TODO: Implement actions dropdown menu (e.g. Suspend, Send Payment Reminder, Reset Password) */}
                      <button 
                        onClick={(e) => { e.stopPropagation(); setSelectedStudent(student); }}
                        className="text-gray-400 hover:text-kv-blue transition-colors p-1"
                      >
                        <MoreVertical size={20} />
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
        />
      )}
    </div>
  );
}
