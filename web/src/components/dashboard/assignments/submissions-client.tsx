"use client";

import React, { useState, useEffect } from "react";
import { Download, Edit, Search, FileText, CheckCircle, AlertTriangle, Clock } from "lucide-react";
import { toast } from "sonner";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function SubmissionsClient({ assignmentId, session }: { assignmentId: string; session: any }) {
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [assignment, setAssignment] = useState<any>(null);
  const [summary, setSummary] = useState({ total_submitted: 0, total_reviewed: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  
  // Grading state
  const [selectedSubmission, setSelectedSubmission] = useState<any>(null);
  const [score, setScore] = useState<string>("");
  const [feedback, setFeedback] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const token = session?.access_token;

  const fetchSubmissions = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/assignments/${assignmentId}/submissions`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to load submissions");
      }
      const json = await res.json();
      setSubmissions(json.data || []);
      setSummary(json.summary || { total_submitted: 0, total_reviewed: 0 });
      
      // Select first submission automatically if none selected
      if (json.data && json.data.length > 0 && !selectedSubmission) {
        setSelectedSubmission(json.data[0]);
        setScore(json.data[0].score !== null ? String(json.data[0].score) : "");
        setFeedback(json.data[0].feedback || "");
      }
    } catch (error: any) {
      console.error(error);
      toast.error(errorMessage(error, "Failed to load submissions"));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchSubmissions();
    }
  }, [assignmentId, token]);

  const handleSelectSubmission = (sub: any) => {
    setSelectedSubmission(sub);
    setScore(sub.score !== null ? String(sub.score) : "");
    setFeedback(sub.feedback || "");
  };

  const handleSubmitGrade = async () => {
    if (!selectedSubmission) return;
    if (!score || isNaN(Number(score))) {
      toast.error("Please enter a valid numeric score");
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/submissions/${selectedSubmission.id}/review`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          score: Number(score),
          feedback
        })
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to submit grade");
      }

      toast.success("Grade submitted successfully");
      await fetchSubmissions(); // Refresh list to update UI
    } catch (error: any) {
      console.error(error);
      toast.error(errorMessage(error, "Failed to submit grade"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownload = (url: string, fileName: string) => {
    if (!url) {
      toast.error("Download link is missing or expired.");
      return;
    }
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const filteredSubmissions = submissions.filter(sub => {
    const studentName = `${sub.student?.first_name || ""} ${sub.student?.last_name || ""}`.toLowerCase();
    return studentName.includes(search.toLowerCase());
  });

  return (
    <div className="flex flex-col animate-in fade-in duration-500">
      {/* Context Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-gray-200 pb-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-[#180d62] mb-2 font-poppins">Submission Review</h2>
          <p className="text-gray-600 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Assignment Submissions ({summary.total_reviewed} / {summary.total_submitted} Reviewed)
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Student List */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm flex-1 h-[calc(100vh-250px)] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-[#180d62]">Submissions</h3>
              <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-semibold">{submissions.length} Total</span>
            </div>
            
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input 
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-md text-sm focus:border-[#2e2877] focus:outline-none" 
                placeholder="Search students..." 
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="overflow-y-auto flex-1 -mx-6 px-6">
              {isLoading ? (
                <div className="text-center py-10 text-gray-400">Loading submissions...</div>
              ) : filteredSubmissions.length === 0 ? (
                <div className="text-center py-10 text-gray-400">No submissions found.</div>
              ) : (
                filteredSubmissions.map((sub) => {
                  const isSelected = selectedSubmission?.id === sub.id;
                  const initials = `${sub.student?.first_name?.[0] || ""}${sub.student?.last_name?.[0] || ""}`;
                  const isGraded = sub.reviewed_at != null;
                  
                  return (
                    <div 
                      key={sub.id}
                      onClick={() => handleSelectSubmission(sub)}
                      className={`group flex items-center justify-between p-3 mb-2 rounded border-l-4 cursor-pointer transition-colors
                        ${isSelected ? 'bg-blue-50/50 border-[#180d62]' : 'hover:bg-gray-50 border-transparent hover:border-gray-200'}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm
                          ${isSelected ? 'bg-blue-100 text-[#180d62]' : 'bg-gray-100 text-gray-700'}`}>
                          {initials}
                        </div>
                        <div>
                          <div className={`text-sm font-bold ${isSelected ? 'text-[#180d62]' : 'text-gray-900'}`}>
                            {sub.student?.first_name} {sub.student?.last_name}
                          </div>
                          <div className={`text-xs flex items-center gap-1 ${isGraded ? 'text-gray-500' : (sub.is_late ? 'text-red-500' : 'text-gray-500')}`}>
                            {isGraded ? (
                              <><CheckCircle className="w-3 h-3" /> Graded ({sub.score}/100)</>
                            ) : sub.is_late ? (
                              <><AlertTriangle className="w-3 h-3" /> Late Submission</>
                            ) : (
                              <><Clock className="w-3 h-3" /> Needs Review</>
                            )}
                          </div>
                        </div>
                      </div>
                      {!isGraded && <span className="w-2 h-2 rounded-full bg-[#994704]"></span>}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Grading Workspace */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {selectedSubmission ? (
            <>
              {/* Top Area: Document Viewer Placeholder & Info */}
              <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm flex flex-col h-[500px]">
                <div className="flex justify-between items-start mb-4 border-b border-gray-200 pb-4">
                  <div>
                    <h3 className="text-2xl font-semibold text-[#180d62]">
                      {selectedSubmission.student?.first_name} {selectedSubmission.student?.last_name}
                    </h3>
                    <p className="text-sm text-gray-500">Submitted: {new Date(selectedSubmission.submitted_at).toLocaleString()}</p>
                  </div>
                  <button 
                    onClick={() => handleDownload(selectedSubmission.download_url, `${selectedSubmission.student?.first_name}_submission.pdf`)}
                    className="flex items-center gap-2 text-[#180d62] hover:text-[#2e2877] font-semibold text-sm py-1 px-3 border border-[#180d62] rounded transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Download Submission
                  </button>
                </div>

                {/* Pseudo Document Viewer */}
                <div className="flex-1 bg-gray-50 border border-gray-200 rounded overflow-hidden flex flex-col items-center justify-center relative group">
                  <div className="absolute inset-0 bg-opacity-5" style={{ backgroundImage: 'url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTEgMWgxOHYxOEgxem0xIDF2MTZoMTZWNHoiIGZpbGw9IiNlNGEyZTEiIGZpbGwtcnVsZT0iZXZlbm9kZCIvPjwvc3ZnPg==")'}}></div>
                  <FileText className="w-16 h-16 text-gray-400 mb-4" />
                  <p className="text-gray-600 font-medium">Submission Document</p>
                  <p className="text-gray-400 text-sm mt-1">{selectedSubmission.file_key.split('/').pop()}</p>
                  <button 
                    onClick={() => handleDownload(selectedSubmission.download_url, `${selectedSubmission.student?.first_name}_submission.pdf`)}
                    className="mt-6 px-4 py-2 bg-white text-[#180d62] border border-[#180d62] rounded font-semibold text-sm shadow-sm hover:bg-gray-50 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    Click to Download
                  </button>
                </div>
              </div>

              {/* Bottom Area: Grading Panel */}
              <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <h4 className="text-xl font-semibold text-[#180d62] mb-6 flex items-center gap-2">
                  <Edit className="w-5 h-5" />
                  Grading & Feedback
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                  {/* Score Input */}
                  <div className="md:col-span-4 flex flex-col">
                    <label className="block text-sm font-semibold text-[#180d62] mb-2">Final Score</label>
                    <div className="flex items-center gap-2">
                      <input 
                        className="w-24 text-2xl font-bold text-center border border-gray-200 rounded-md py-3 focus:border-[#2e2877] focus:ring-1 focus:ring-[#2e2877] focus:outline-none" 
                        max="100" 
                        min="0" 
                        placeholder="-" 
                        type="number"
                        value={score}
                        onChange={(e) => setScore(e.target.value)}
                      />
                      <span className="text-2xl text-gray-400">/ 100</span>
                    </div>
                  </div>

                  {/* Written Feedback */}
                  <div className="md:col-span-8 flex flex-col">
                    <label className="block text-sm font-semibold text-[#180d62] mb-2">Written Feedback</label>
                    <textarea 
                      className="w-full flex-1 min-h-[120px] p-4 border border-gray-200 rounded-md resize-none text-sm focus:border-[#2e2877] focus:ring-1 focus:ring-[#2e2877] focus:outline-none" 
                      placeholder="Provide constructive feedback for the student..."
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                    />
                    <div className="flex justify-end mt-4 gap-3">
                      <button 
                        onClick={handleSubmitGrade}
                        disabled={isSubmitting}
                        className="px-6 py-2 bg-[#994704] text-white font-semibold text-sm rounded-md hover:bg-[#994704]/90 transition-colors shadow-sm disabled:opacity-50"
                      >
                        {isSubmitting ? "Submitting..." : "Submit Grade"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm flex items-center justify-center h-full text-gray-500">
              Select a student submission from the list to begin reviewing.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
