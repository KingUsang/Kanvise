"use client";

import { Dialog } from "@/components/ui/dialog";
import { Alert } from "@/components/ui/alert";
import { ChangeEvent, useEffect, useState } from "react";
import { Loader2, AlertCircle, Download, UserPlus, X, Upload } from "lucide-react";
import Papa from "papaparse";
import { authenticatedApiFetch } from "@/lib/authenticated-fetch";
import { apiRequest } from "@/lib/api-request";
import { fetchAllPages } from "@/lib/fetch-all-pages";
import { downloadStudentRosterCsv } from "@/lib/student-roster";
import StudentsTable from "@/components/dashboard/students/students-table";
import { DashboardPageHeader } from "@/components/dashboard/page-header";

export default function StudentsPage() {
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addingStudent, setAddingStudent] = useState(false);
  const [submittingStudent, setSubmittingStudent] = useState(false);
  const [addStudentError, setAddStudentError] = useState<string | null>(null);
  const [studentEmail, setStudentEmail] = useState("");
  const [programmes, setProgrammes] = useState<Array<{ id: string; name: string }>>([]);
  const [csvRows, setCsvRows] = useState<Array<{ first_name: string; last_name: string; email: string; phone: string; programme_id: string; row: number; error?: string }>>([]);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [importingCsv, setImportingCsv] = useState(false);
  const [importSummary, setImportSummary] = useState<string | null>(null);

  async function fetchStudents() {
      setLoading(true);
      setError(null);
      try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL;
        setStudents(await fetchAllPages<any>(
          (page) => authenticatedApiFetch(`${API_URL}/users/students?limit=200&offset=${(page - 1) * 200}`),
          "Could not load the learner roster",
        ));
      } catch {
        setError('We could not load the learner roster. Please try again.');
      } finally {
        setLoading(false);
      }
  }

  useEffect(() => {
    void fetchStudents();
  }, []);

  useEffect(() => {
    async function fetchProgrammes() {
      try {
        const body = await apiRequest<{ data?: Array<{ id: string; name: string }> }>(`${process.env.NEXT_PUBLIC_API_URL}/programmes`, "Could not load Classes");
        setProgrammes((body.data || []).map((programme) => ({ id: programme.id, name: programme.name })));
      } catch {
        // The import form simply offers no Class list when this read fails.
      }
    }
    void fetchProgrammes();
  }, []);

  async function addStudent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittingStudent(true);
    setAddStudentError(null);
    try {
      const response = await authenticatedApiFetch(`${process.env.NEXT_PUBLIC_API_URL}/users/students/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ students: [{ email: studentEmail }], send_invitations: true }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Could not add learner");
      if (body.data?.errors?.length) throw new Error(body.data.errors[0].errors?.[0] || "Could not add learner");

      setAddingStudent(false);
      setStudentEmail("");
      await fetchStudents();
    } catch (err) {
      setAddStudentError(err instanceof Error ? err.message : "Could not add learner");
    } finally {
      setSubmittingStudent(false);
    }
  }

  function downloadTemplate() {
    const content = "first_name,last_name,email,phone,class\nAda,Okafor,ada@example.com,08012345678,JAMB Science";
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
        const normalizedEmails = data.map((item) => String(item.email || "").trim().toLowerCase());
        const emailCounts = new Map<string, number>();
        normalizedEmails.forEach((email) => { if (email) emailCounts.set(email, (emailCounts.get(email) || 0) + 1); });
        const rows = data.map((item, index) => {
          const programmeName = String(item.class || item.programme || "").trim();
          const programme_id = names.get(programmeName.toLowerCase()) || "";
          const email = String(item.email || "").trim().toLowerCase();
          const error = !email
            ? "Email address is required"
            : (emailCounts.get(email) || 0) > 1
              ? "Email address appears more than once in this import"
            : !programme_id
              ? `Class “${programmeName || "(missing)"}” was not found`
              : undefined;
          return { row: index + 2, first_name: String(item.first_name || "").trim(), last_name: String(item.last_name || "").trim(), email, phone: String(item.phone || "").trim(), programme_id, error };
        });
        if (!rows.length) setCsvError("This CSV has no learner rows.");
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
      const response = await authenticatedApiFetch(`${process.env.NEXT_PUBLIC_API_URL}/users/students/import`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ students: csvRows.map(({ first_name, last_name, email, phone, programme_id }) => ({ first_name, last_name, email, phone, programme_id })), send_invitations: true }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not import learners");
      const result = body.data;
      setImportSummary(`${result.created} added, ${result.enrolled} enrolled and ${result.invited} activation email${result.invited === 1 ? "" : "s"} sent.${result.errors?.length ? ` ${result.errors.length} row(s) need attention.` : ""}`);
      await fetchStudents();
    } catch (error) { setCsvError(error instanceof Error ? error.message : "Could not import learners"); }
    finally { setImportingCsv(false); }
  }

  return (
    <div className="mx-auto max-w-[1440px] space-y-8 animate-fade-in">
      {/* Header */}
      <DashboardPageHeader
        title="Learners"
        description="Add learners to your tutoring account, see what they can access, and review their successful payment history."
        actions={<>
          <button
            type="button"
            onClick={() => { setAddStudentError(null); setImportSummary(null); setAddingStudent(true); }}
            className="flex items-center gap-2 rounded-dashboard-control bg-dashboard-accent px-4 py-2 text-white transition-colors hover:bg-dashboard-accent/90"
          >
            <UserPlus size={18} />
            <span className="text-xs font-bold uppercase tracking-widest">Add learner</span>
          </button>
          <label className="flex cursor-pointer items-center gap-2 rounded-dashboard-control border border-dashboard-primary px-4 py-2 text-dashboard-primary transition-colors hover:bg-dashboard-primary/5">
            <Upload size={18} />
            <span className="text-xs font-bold uppercase tracking-widest">Import CSV</span>
            <input type="file" accept=".csv,text/csv" className="sr-only" onChange={handleCsvFile} />
          </label>
          <button 
            onClick={() => downloadStudentRosterCsv(students)}
            className="flex items-center gap-2 rounded-dashboard-control border border-dashboard-primary px-4 py-2 text-dashboard-primary transition-colors hover:bg-dashboard-primary/5"
          >
            <Download size={18} />
            <span className="text-xs font-bold tracking-widest uppercase">Export learners</span>
          </button>
        </>}
      />

      {/* Content */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-dashboard-primary" />
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
        <StudentsTable students={students} onStudentRemoved={(studentId) => setStudents((current) => current.filter((student) => student.id !== studentId))} onStudentsChanged={() => void fetchStudents()} />
      )}

      {addingStudent && (
        <Dialog className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" dismissOnBackdrop={false} panelClassName="w-full max-w-md outline-none" labelledBy="add-student-title" onClose={submittingStudent ? undefined : () => setAddingStudent(false)}>
          <form onSubmit={addStudent} className="rounded-xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div><h2 id="add-student-title" className="text-xl font-bold text-dashboard-foreground">Invite a learner</h2><p className="mt-1 text-sm leading-6 text-dashboard-muted">They enter their own name and password from the email. Add them to a class now or later.</p></div>
              <button type="button" onClick={() => setAddingStudent(false)} disabled={submittingStudent} aria-label="Close" className="rounded p-1 text-gray-500 hover:bg-gray-100"><X size={20} /></button>
            </div>
            {addStudentError && <Alert className="mt-5">{addStudentError}</Alert>}
            <label className="mt-5 block text-sm font-semibold text-dashboard-foreground">Email address<input required type="email" value={studentEmail} onChange={(event) => setStudentEmail(event.target.value)} className="mt-1.5 w-full rounded-dashboard-control border border-dashboard-outline px-3 py-2.5 font-normal outline-none focus:border-dashboard-primary" /></label>
            <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setAddingStudent(false)} disabled={submittingStudent} className="rounded-dashboard-control px-4 py-2 text-sm font-semibold text-dashboard-muted hover:bg-dashboard-surface-subtle">Cancel</button><button disabled={submittingStudent} className="rounded-dashboard-control bg-dashboard-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{submittingStudent ? "Sending…" : "Add & invite"}</button></div>
          </form>
        </Dialog>
      )}

      {(csvRows.length > 0 || csvError || importSummary) && (
        <Dialog className="fixed inset-0 z-50 overflow-y-auto bg-black/40 p-4" dismissOnBackdrop={false} panelClassName="mx-auto my-8 w-full max-w-4xl outline-none" label="Review learner import" onClose={importingCsv ? undefined : () => { setCsvRows([]); setCsvError(null); setImportSummary(null); }}>
          <div className="rounded-xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-bold text-dashboard-foreground">Review learner import</h2><p className="mt-1 text-sm text-dashboard-muted">Every learner needs an email for their activation link. Names and phone numbers are optional; learners can enter their own names during activation.</p></div><button type="button" onClick={() => { setCsvRows([]); setCsvError(null); setImportSummary(null); }} className="rounded p-1 text-dashboard-muted hover:bg-dashboard-surface-subtle"><X size={20} /></button></div>
            <div className="mt-4 flex flex-wrap items-center gap-3"><button type="button" onClick={downloadTemplate} className="rounded-dashboard-control border border-dashboard-outline px-3 py-2 text-sm font-semibold text-dashboard-primary">Download template</button><label className="cursor-pointer rounded-dashboard-control border border-dashboard-outline px-3 py-2 text-sm font-semibold text-dashboard-primary">Choose another CSV<input type="file" accept=".csv,text/csv" className="sr-only" onChange={handleCsvFile} /></label></div>
            {csvError && <Alert className="mt-4">{csvError}</Alert>}
            {importSummary && <Alert tone="success" className="mt-4">{importSummary}</Alert>}
            {csvRows.length > 0 && <div className="mt-5 overflow-x-auto rounded-dashboard-control border border-dashboard-outline"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-dashboard-surface-subtle"><tr><th className="p-3">Row</th><th className="p-3">Learner</th><th className="p-3">Contact</th><th className="p-3">Class</th><th className="p-3">Status</th></tr></thead><tbody>{csvRows.slice(0, 100).map((row) => <tr key={row.row} className="border-t border-dashboard-outline/50"><td className="p-3">{row.row}</td><td className="p-3">{row.first_name} {row.last_name}</td><td className="p-3">{row.email || row.phone || "—"}</td><td className="p-3">{programmes.find((programme) => programme.id === row.programme_id)?.name || "—"}</td><td className={`p-3 ${row.error ? "text-red-700" : "text-green-700"}`}>{row.error || "Ready"}</td></tr>)}</tbody></table></div>}
            {csvRows.length > 100 && <p className="mt-2 text-xs text-gray-500">Showing the first 100 of {csvRows.length} students.</p>}
            <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => { setCsvRows([]); setCsvError(null); setImportSummary(null); }} className="rounded-dashboard-control px-4 py-2 text-sm font-semibold text-dashboard-muted hover:bg-dashboard-surface-subtle">Cancel</button><button type="button" onClick={() => void importCsv()} disabled={importingCsv || !csvRows.length || csvRows.some((row) => row.error)} className="rounded-dashboard-control bg-dashboard-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{importingCsv ? "Importing…" : `Import ${csvRows.length} learners`}</button></div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
