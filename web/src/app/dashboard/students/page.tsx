"use client";

import { useEffect, useState } from "react";
import { Loader2, AlertCircle, Download } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import StudentsTable from "@/components/dashboard/students/students-table";

function exportToCSV(students: any[]) {
  if (students.length === 0) return;
  const headers = ["Kanvise ID", "First Name", "Last Name", "Email", "Enrolments Count"];
  const rows = students.map(s => [
    s.kanvise_user_id || "",
    s.first_name || "",
    s.last_name || "",
    s.email || "",
    s.enrolments?.length || 0
  ]);
  const csvContent = "data:text/csv;charset=utf-8," 
    + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", "student_roster.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export default function StudentsPage() {
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchStudents() {
      setLoading(true);
      setError(null);
      try {
        const supabase = createClient();
        const { data: session } = await supabase.auth.getSession();
        
        const API_URL = process.env.NEXT_PUBLIC_API_URL;
        const res = await fetch(`${API_URL}/users/students`, {
          headers: {
            Authorization: `Bearer ${session?.session?.access_token}`,
          },
        });
        
        if (!res.ok) {
          const errText = await res.text();
          console.error("API Error:", res.status, errText);
          throw new Error(`Server returned ${res.status}: ${errText}`);
        }
        
        const json = await res.json();
        setStudents(json.data || []);
      } catch (err: any) {
        console.error('Failed to load student roster', err);
        setError('We could not load the student roster. Please try again.');
      } finally {
        setLoading(false);
      }
  }

  useEffect(() => {
    void fetchStudents();
  }, []);

  return (
    <div className="mx-auto max-w-[1440px] space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-[#474551]">Your learners</span>
          <h1 className="mt-2 text-[32px] leading-[40px] tracking-[-0.01em] font-bold text-kv-dark">Students</h1>
          <p className="text-base leading-6 text-gray-500 mt-1 max-w-2xl">
            See who has enrolled, what they can access, and their checkout history. Students appear here after their first successful enrolment.
          </p>
        </div>
        
        <div className="flex gap-4">
          <button 
            onClick={() => exportToCSV(students)}
            className="flex items-center gap-2 px-4 py-2 border border-kv-blue text-kv-blue rounded hover:bg-kv-blue/5 transition-colors"
          >
            <Download size={18} />
            <span className="text-xs font-bold tracking-widest uppercase">Export students</span>
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-kv-blue" />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-100 text-red-600 p-6 rounded-xl flex items-start gap-3 shadow-sm">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-bold mb-1">Error loading roster</h3>
            <p className="text-sm text-red-600/80">{error}</p>
            <button type="button" onClick={() => void fetchStudents()} className="mt-4 rounded bg-[#ba1a1a] px-4 py-2 text-sm font-semibold text-white">Try again</button>
          </div>
        </div>
      ) : (
        <StudentsTable students={students} onStudentRemoved={(studentId) => setStudents((current) => current.filter((student) => student.id !== studentId))} />
      )}
    </div>
  );
}
