"use client";

import { useEffect, useState } from "react";
import { X, Loader2, BookOpen, Clock, AlertCircle, ReceiptText } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function StudentDetailsSheet({ student, onClose, onRemoved }: { student: any, onClose: () => void, onRemoved: () => void }) {
  const [enrolments, setEnrolments] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [confirmRemoval, setConfirmRemoval] = useState(false);

  const removeStudent = async () => {
    setRemoving(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      if (!session || !apiUrl) throw new Error('Your session is unavailable');
      const response = await fetch(`${apiUrl}/users/${encodeURIComponent(student.id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Could not remove student');
      onRemoved();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not remove student');
      setRemoving(false);
    }
  };

  useEffect(() => {
    async function fetchEnrolments() {
      try {
        const supabase = createClient();
        const { data: session } = await supabase.auth.getSession();
        
        const API_URL = process.env.NEXT_PUBLIC_API_URL;
        const headers = { Authorization: `Bearer ${session?.session?.access_token}` };
        const [res, paymentsRes] = await Promise.all([
          fetch(`${API_URL}/enrolments?student_id=${encodeURIComponent(student.id)}`, { headers }),
          fetch(`${API_URL}/payments?student_id=${encodeURIComponent(student.id)}`, { headers }),
        ]);
        
        if (!res.ok || !paymentsRes.ok) throw new Error("Failed to fetch student details");
        
        const json = await res.json();
        const paymentsJson = await paymentsRes.json();
        setEnrolments(json.data || []);
        setPayments((paymentsJson.data || []).filter((payment: any) => payment.status === 'successful'));
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
      
      <div className="fixed top-0 right-0 z-50 flex h-full w-[400px] max-w-[90vw] flex-col animate-slide-right border-l border-dashboard-outline bg-dashboard-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-dashboard-outline bg-dashboard-surface-subtle p-6">
          <h2 className="text-xl font-bold text-dashboard-foreground">Student Details</h2>
          <button 
            onClick={onClose}
            className="rounded-full p-2 text-dashboard-muted transition-colors hover:bg-dashboard-surface hover:text-dashboard-foreground"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex items-center gap-4 mb-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-dashboard-primary text-2xl font-bold text-white shadow-sm">
              {student.first_name?.[0] || ""}{student.last_name?.[0] || ""}
            </div>
            <div>
              <h3 className="text-xl font-bold leading-tight text-dashboard-foreground">
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
                <Loader2 className="w-6 h-6 animate-spin text-dashboard-primary" />
              </div>
            ) : error ? (
              <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm flex items-start gap-2">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <p>{error}</p>
              </div>
            ) : enrolments.length === 0 ? (
              <div className="rounded-dashboard-panel border border-dashed border-dashboard-outline p-6 text-center text-sm text-dashboard-muted">
                This student is not currently enrolled in any programmes or subjects.
              </div>
            ) : (
              <div className="space-y-3">
                {enrolments.map((enrolment) => (
                  <div key={enrolment.id} className="rounded-dashboard-panel border border-dashboard-outline bg-dashboard-surface p-4 shadow-sm transition-colors hover:border-dashboard-primary/30">
                    <div className="flex justify-between items-start mb-1">
                      <div className="font-semibold text-dashboard-foreground">
                        {enrolment.programmes?.name || enrolment.sub_programmes?.name || enrolment.courses?.name || "Unknown"}
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-green-100 text-green-700">
                        Access granted
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

          <div className="mb-6">
            <h4 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gray-400">
              <ReceiptText size={16} />
              Payment history
            </h4>
            {payments.length === 0 ? (
              <div className="rounded-dashboard-panel border border-dashed border-dashboard-outline p-6 text-center text-sm text-dashboard-muted">No completed payment records found.</div>
            ) : (
              <div className="space-y-3">
                {payments.map((payment) => {
                  const itemName = payment.programmes?.name || payment.sub_programmes?.name || payment.courses?.name || 'Enrolment'
                  return (
                    <div key={payment.id} className="rounded-dashboard-panel border border-dashboard-outline bg-dashboard-surface p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div><p className="font-semibold text-dashboard-foreground">{itemName}</p><p className="mt-1 text-xs text-dashboard-muted">{payment.paystack_reference}</p></div>
                        <span className="rounded bg-green-100 px-2 py-0.5 text-[10px] font-bold uppercase text-green-700">Paid</span>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-xs text-dashboard-muted"><span className="font-semibold text-dashboard-foreground">₦{Number(payment.amount).toLocaleString()}</span><span>{new Date(payment.paid_at || payment.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span></div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
        
        <div className="flex gap-3 border-t border-dashboard-outline bg-dashboard-surface-subtle p-6">
          <button 
            onClick={onClose}
            className="flex-1 rounded-dashboard-control border border-dashboard-outline bg-dashboard-surface px-4 py-2 font-semibold text-dashboard-foreground transition-colors hover:bg-dashboard-surface-subtle"
          >
            Close
          </button>
          <button 
            type="button"
            onClick={() => setConfirmRemoval(true)}
            disabled={removing}
            className="flex-1 px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors"
          >
            {removing ? 'Removing…' : 'Remove Student'}
          </button>
        </div>
      </div>
      {confirmRemoval && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-dashboard-panel border border-dashboard-outline bg-dashboard-surface p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-dashboard-foreground">Remove this student?</h3>
            <p className="mt-2 text-sm leading-6 text-gray-600">{student.first_name} {student.last_name} will lose access to this centre. Their enrolment and payment history will be retained.</p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setConfirmRemoval(false)} className="rounded px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100">Keep student</button>
              <button type="button" onClick={() => { setConfirmRemoval(false); void removeStudent(); }} className="rounded bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">Remove student</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
