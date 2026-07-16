"use client";

import { useEffect, useState } from "react";
import { Users, Loader2, AlertCircle, Download, UserPlus } from "lucide-react";
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

  useEffect(() => {
    async function fetchStudents() {
      try {
        const supabase = createClient();
        const { data: session } = await supabase.auth.getSession();
        
        const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
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
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchStudents();
  }, []);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-[32px] leading-[40px] tracking-[-0.01em] font-bold text-kv-dark">Manage Students</h1>
          <p className="text-base leading-6 text-gray-500 mt-1">
            View, filter, and manage student enrollments and payment statuses.
          </p>
        </div>
        
        <div className="flex gap-4">
          <button 
            onClick={() => exportToCSV(students)}
            className="flex items-center gap-2 px-4 py-2 border border-kv-blue text-kv-blue rounded hover:bg-kv-blue/5 transition-colors"
          >
            <Download size={18} />
            <span className="text-xs font-bold tracking-widest uppercase">Export List</span>
          </button>
          <button 
            onClick={() => alert("Students enrol themselves via the public landing page. Invites are for Tutors only.")}
            className="flex items-center gap-2 px-4 py-2 bg-kv-brown text-white rounded hover:bg-kv-brown/90 transition-colors"
          >
            <UserPlus size={18} />
            <span className="text-xs font-bold tracking-widest uppercase">Add Student</span>
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
          <div>
            <h3 className="font-bold mb-1">Error loading roster</h3>
            <p className="text-sm text-red-600/80">{error}</p>
          </div>
        </div>
      ) : (
        <StudentsTable students={students} />
      )}
    </div>
  );
}
