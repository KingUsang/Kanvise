"use client";

import { ChangeEvent, useEffect, useState } from "react";
import { Loader2, AlertCircle, Download, UserPlus, X, Upload } from "lucide-react";
import Papa from "papaparse";
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
  const [addingStudent, setAddingStudent] = useState(false);
  const [submittingStudent, setSubmittingStudent] = useState(false);
  const [addStudentError, setAddStudentError] = useState<string | null>(null);
  const [studentForm, setStudentForm] = useState({ first_name: "", last_name: "", email: "" });
  const [programmes, setProgrammes] = useState<Array<{ id: string; name: string }>>([]);
  const [programmeId, setProgrammeId] = useState("");
  const [csvRows, setCsvRows] = useState<Array<{ first_name: string; last_name: string; email: string; phone: string; programme_id: string; row: number; error?: string }>>([]);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [importingCsv, setImportingCsv] = useState(false);
  const [importSummary, setImportSummary] = useState<string | null>(null);

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

  useEffect(() => {
    async function fetchProgrammes() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/programmes`, { headers: { Authorization: `Bearer ${session?.access_token}` } });
      if (!response.ok) return;
      const body = await response.json();
      setProgrammes((body.data || []).map((programme: any) => ({ id: programme.id, name: programme.name })));
    }
    void fetchProgrammes();
  }, []);

  async function addStudent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittingStudent(true);
    setAddStudentError(null);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!programmeId) throw new Error("Choose the programme this student is enrolled in");
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/students/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ students: [{ ...studentForm, programme_id: programmeId }], send_invitations: true }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not add student");
      if (body.data?.errors?.length) throw new Error(body.data.errors[0].errors?.[0] || "Could not add student");

      setAddingStudent(false);
      setStudentForm({ first_name: "", last_name: "", email: "" });
      setProgrammeId("");
      await fetchStudents();
    } catch (err) {
      setAddStudentError(err instanceof Error ? err.message : "Could not add student");
    } finally {
      setSubmittingStudent(false);
    }
  }

  function downloadTemplate() {
    const content = "first_name,last_name,email,phone,programme\nAda,Okafor,ada@example.com,08012345678,JAMB Science";
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([content], { type: "text/csv" }));
    link.download = "kanvise-student-import-template.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function handleCsvFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setCsvError(null);
    setImportSummary(null);
    Papa.parse<Record<string, string>>(file, {
      header: true, skipEmptyLines: "greedy",
      complete: ({ data, errors }) => {
        if (errors.length) { setCsvError("We could not read that CSV file. Download the template and try again."); return; }
        const names = new Map(programmes.map((programme) => [programme.name.trim().toLowerCase(), programme.id]));
        const rows = data.map((item, index) => {
          const programmeName = String(item.programme || "").trim();
          const programme_id = names.get(programmeName.toLowerCase()) || "";
          const error = !programme_id ? `Programme “${programmeName || "(missing)"}” was not found` : undefined;
          return { row: index + 2, first_name: String(item.first_name || "").trim(), last_name: String(item.last_name || "").trim(), email: String(item.email || "").trim(), phone: String(item.phone || "").trim(), programme_id, error };
        });
        if (!rows.length) setCsvError("This CSV has no student rows.");
        setCsvRows(rows);
      },
      error: () => setCsvError("We could not read that CSV file."),
    });
    event.target.value = "";
  }

  async function importCsv() {
    if (!csvRows.length || csvRows.some((row) => row.error)) return;
    setImportingCsv(true); setCsvError(null); setImportSummary(null);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/students/import`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ students: csvRows.map(({ row, error, ...student }) => student), send_invitations: true }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not import students");
      const result = body.data;
      setImportSummary(`${result.created} added, ${result.enrolled} enrolled and ${result.invited} activation email${result.invited === 1 ? "" : "s"} sent.${result.errors?.length ? ` ${result.errors.length} row(s) need attention.` : ""}`);
      await fetchStudents();
    } catch (error) { setCsvError(error instanceof Error ? error.message : "Could not import students"); }
    finally { setImportingCsv(false); }
  }

  return (
    <div className="mx-auto max-w-[1440px] space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-[#474551]">Your learners</span>
          <h1 className="mt-2 text-[32px] leading-[40px] tracking-[-0.01em] font-bold text-kv-dark">Students</h1>
          <p className="text-base leading-6 text-gray-500 mt-1 max-w-2xl">
            Add learners to your centre, see what they can access, and review their successful payment history.
          </p>
        </div>
        
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => { setAddStudentError(null); setImportSummary(null); setAddingStudent(true); }}
            className="flex items-center gap-2 rounded bg-kv-blue px-4 py-2 text-white transition-colors hover:bg-kv-blue/90"
          >
            <UserPlus size={18} />
            <span className="text-xs font-bold uppercase tracking-widest">Add student</span>
          </button>
          <label className="flex cursor-pointer items-center gap-2 rounded border border-kv-blue px-4 py-2 text-kv-blue transition-colors hover:bg-kv-blue/5">
            <Upload size={18} />
            <span className="text-xs font-bold uppercase tracking-widest">Import CSV</span>
            <input type="file" accept=".csv,text/csv" className="sr-only" onChange={handleCsvFile} />
          </label>
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

      {addingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="add-student-title">
          <form onSubmit={addStudent} className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div><h2 id="add-student-title" className="text-xl font-bold text-kv-dark">Add a student</h2><p className="mt-1 text-sm leading-6 text-gray-500">They are enrolled in a programme immediately and receive an activation email.</p></div>
              <button type="button" onClick={() => setAddingStudent(false)} disabled={submittingStudent} aria-label="Close" className="rounded p-1 text-gray-500 hover:bg-gray-100"><X size={20} /></button>
            </div>
            {addStudentError && <div className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">{addStudentError}</div>}
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold text-kv-dark">First name<input required value={studentForm.first_name} onChange={(event) => setStudentForm((current) => ({ ...current, first_name: event.target.value }))} className="mt-1.5 w-full rounded border border-kv-dust px-3 py-2.5 font-normal outline-none focus:border-kv-blue" /></label>
              <label className="text-sm font-semibold text-kv-dark">Last name<input required value={studentForm.last_name} onChange={(event) => setStudentForm((current) => ({ ...current, last_name: event.target.value }))} className="mt-1.5 w-full rounded border border-kv-dust px-3 py-2.5 font-normal outline-none focus:border-kv-blue" /></label>
            </div>
            <label className="mt-4 block text-sm font-semibold text-kv-dark">Email address<input required type="email" value={studentForm.email} onChange={(event) => setStudentForm((current) => ({ ...current, email: event.target.value }))} className="mt-1.5 w-full rounded border border-kv-dust px-3 py-2.5 font-normal outline-none focus:border-kv-blue" /></label>
            <label className="mt-4 block text-sm font-semibold text-kv-dark">Programme<select required value={programmeId} onChange={(event) => setProgrammeId(event.target.value)} className="mt-1.5 w-full rounded border border-kv-dust bg-white px-3 py-2.5 font-normal outline-none focus:border-kv-blue"><option value="">Choose a programme</option>{programmes.map((programme) => <option key={programme.id} value={programme.id}>{programme.name}</option>)}</select></label>
            <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setAddingStudent(false)} disabled={submittingStudent} className="rounded px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100">Cancel</button><button disabled={submittingStudent} className="rounded bg-kv-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{submittingStudent ? "Sending…" : "Add & invite"}</button></div>
          </form>
        </div>
      )}

      {(csvRows.length > 0 || csvError || importSummary) && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 p-4">
          <div className="mx-auto my-8 w-full max-w-4xl rounded-xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-bold text-kv-dark">Review student import</h2><p className="mt-1 text-sm text-gray-500">Students are enrolled in the programme in their CSV and emailed an activation link when an email is available.</p></div><button type="button" onClick={() => { setCsvRows([]); setCsvError(null); setImportSummary(null); }} className="rounded p-1 text-gray-500 hover:bg-gray-100"><X size={20} /></button></div>
            <div className="mt-4 flex flex-wrap items-center gap-3"><button type="button" onClick={downloadTemplate} className="rounded border border-kv-dust px-3 py-2 text-sm font-semibold text-kv-blue">Download template</button><label className="cursor-pointer rounded border border-kv-dust px-3 py-2 text-sm font-semibold text-kv-blue">Choose another CSV<input type="file" accept=".csv,text/csv" className="sr-only" onChange={handleCsvFile} /></label></div>
            {csvError && <div className="mt-4 rounded bg-red-50 p-3 text-sm text-red-700">{csvError}</div>}
            {importSummary && <div className="mt-4 rounded bg-green-50 p-3 text-sm text-green-800">{importSummary}</div>}
            {csvRows.length > 0 && <div className="mt-5 overflow-x-auto rounded border border-kv-dust"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-[#f9f7f4]"><tr><th className="p-3">Row</th><th className="p-3">Student</th><th className="p-3">Contact</th><th className="p-3">Programme</th><th className="p-3">Status</th></tr></thead><tbody>{csvRows.slice(0, 100).map((row) => <tr key={row.row} className="border-t border-kv-dust/40"><td className="p-3">{row.row}</td><td className="p-3">{row.first_name} {row.last_name}</td><td className="p-3">{row.email || row.phone || "—"}</td><td className="p-3">{programmes.find((programme) => programme.id === row.programme_id)?.name || "—"}</td><td className={`p-3 ${row.error ? "text-red-700" : "text-green-700"}`}>{row.error || "Ready"}</td></tr>)}</tbody></table></div>}
            {csvRows.length > 100 && <p className="mt-2 text-xs text-gray-500">Showing the first 100 of {csvRows.length} students.</p>}
            <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => { setCsvRows([]); setCsvError(null); setImportSummary(null); }} className="rounded px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100">Cancel</button><button type="button" onClick={() => void importCsv()} disabled={importingCsv || !csvRows.length || csvRows.some((row) => row.error)} className="rounded bg-kv-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{importingCsv ? "Importing…" : `Import ${csvRows.length} students`}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
