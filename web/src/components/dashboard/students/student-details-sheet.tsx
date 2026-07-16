"use client";

import { useEffect, useState } from "react";
import { X, Loader2, BookOpen, Clock, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function StudentDetailsSheet({ student, onClose }: { student: any, onClose: () => void }) {
  const [enrolments, setEnrolments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchEnrolments() {
      try {
        const supabase = createClient();
        const { data: session } = await supabase.auth.getSession();
        
        const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
        const res = await fetch(`${API_URL}/enrolments?student_id=${student.id}`, {
          headers: {
            Authorization: `Bearer ${session?.session?.access_token}`,
          },
        });
        
        if (!res.ok) throw new Error("Failed to fetch enrolments");
        
        const json = await res.json();
        setEnrolments(json.data || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchEnrolments();
  }, [student.id]);

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity animate-fade-in"
        onClick={onClose}
      />
      
      <div className="fixed top-0 right-0 h-full w-[400px] max-w-[90vw] bg-white shadow-2xl z-50 flex flex-col animate-slide-right border-l border-kv-dust/30">
        <div className="flex items-center justify-between p-6 border-b border-kv-dust/30 bg-kv-soft/50">
          <h2 className="text-xl font-bold text-kv-dark">Student Details</h2>
          <button 
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-kv-dark hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-16 h-16 rounded-full bg-kv-blue text-white flex items-center justify-center font-bold text-2xl shadow-sm">
              {student.first_name?.[0] || ""}{student.last_name?.[0] || ""}
            </div>
            <div>
              <h3 className="text-xl font-bold text-kv-dark leading-tight">
                {student.first_name} {student.last_name}
              </h3>
              <p className="text-gray-500 text-sm mt-0.5">{student.email}</p>
              <span className="inline-block mt-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-600">
                ID: {student.kanvise_user_id || "—"}
              </span>
            </div>
          </div>

          <div className="mb-6">
            <h4 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-2">
              <BookOpen size={16} />
              Active Enrolments
            </h4>
            
            {loading ? (
              <div className="flex justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin text-kv-blue" />
              </div>
            ) : error ? (
              <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm flex items-start gap-2">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <p>{error}</p>
              </div>
            ) : enrolments.length === 0 ? (
              <div className="text-center p-6 border border-dashed border-kv-dust rounded-lg text-gray-500 text-sm">
                This student is not currently enrolled in any programmes or courses.
              </div>
            ) : (
              <div className="space-y-3">
                {enrolments.map((enrolment) => (
                  <div key={enrolment.id} className="p-4 border border-kv-dust/40 rounded-lg hover:border-kv-blue/30 transition-colors bg-white shadow-sm">
                    <div className="flex justify-between items-start mb-1">
                      <div className="font-semibold text-kv-dark">
                        {enrolment.programmes?.name || enrolment.courses?.name || "Unknown"}
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-green-100 text-green-700">
                        {enrolment.status || "Active"}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 flex items-center gap-1.5 mt-2">
                      <Clock size={12} />
                      Enrolled: {enrolment.enrolled_at ? new Date(enrolment.enrolled_at).toLocaleDateString() : "Unknown"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
        <div className="p-6 border-t border-kv-dust/30 bg-gray-50 flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-white border border-kv-dust/50 text-kv-dark font-semibold rounded-lg hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
          <button 
            className="flex-1 px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors"
          >
            Remove Student
          </button>
        </div>
      </div>
    </>
  );
}
