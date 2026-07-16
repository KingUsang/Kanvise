"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Papa from "papaparse";

type Course = {
  id: string;
  name: string;
};

type OptionState = {
  id: string; // local id
  option_text: string;
  is_correct: boolean;
};

type QuestionState = {
  id: string; // local id for mapping
  question_type: "mcq" | "theory";
  question_text: string;
  marks: number;
  options: OptionState[]; // only for MCQ
  grading_rubric?: string; // only for theory
};

export function MockBuilderClient({ token }: { token: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editMockId = searchParams.get("id");
  const isEditMode = !!editMockId;
  
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isReadOnly, setIsReadOnly] = useState(false);

  // Assessment Parameters State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [courseId, setCourseId] = useState("");
  
  const [publishMode, setPublishMode] = useState<"immediate" | "scheduled">("immediate");
  const [publishDate, setPublishDate] = useState("");
  const [publishTime, setPublishTime] = useState("");
  
  const [isUntimed, setIsUntimed] = useState(false);
  const [timeLimit, setTimeLimit] = useState(60);

  // Questions State
  const [questions, setQuestions] = useState<QuestionState[]>([]);

  // CSV Upload & Modal State
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [questionToDelete, setQuestionToDelete] = useState<string | null>(null);

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/courses`, {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });
        if (res.ok) {
          const { data } = await res.json();
          setCourses(data || []);
          if (data && data.length > 0 && !isEditMode) {
            setCourseId(data[0].id);
          }
        }
      } catch (err) {
        console.error("Failed to fetch courses", err);
      } finally {
        if (!isEditMode) setIsLoading(false);
      }
    };

    const fetchMockData = async () => {
      if (!editMockId) return;
      try {
        const [mockRes, qRes] = await Promise.all([
          fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/mocks/${editMockId}`, {
            headers: { "Authorization": `Bearer ${token}` }
          }),
          fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/mocks/${editMockId}/questions`, {
            headers: { "Authorization": `Bearer ${token}` }
          })
        ]);

        if (mockRes.ok && qRes.ok) {
          const mockData = (await mockRes.json()).data;
          const qData = (await qRes.json()).data;

          if (mockData.status !== "draft") {
            setIsReadOnly(true);
          }

          setTitle(mockData.title || "");
          setDescription(mockData.description || "");
          setCourseId(mockData.course_id || "");
          
          if (mockData.time_limit_minutes === 0) {
            setIsUntimed(true);
          } else {
            setIsUntimed(false);
            setTimeLimit(mockData.time_limit_minutes);
          }

          if (mockData.publish_at) {
            setPublishMode("scheduled");
            const d = new Date(mockData.publish_at);
            setPublishDate(d.toISOString().split('T')[0]);
            setPublishTime(d.toTimeString().substring(0,5));
          }

          // Map questions to state
          if (qData && qData.length > 0) {
            setQuestions(qData.map((q: any) => ({
              id: `q_${q.id}`, // mapped local id
              question_type: q.question_type,
              question_text: q.question_text,
              marks: q.marks,
              options: (q.options || []).map((o: any) => ({
                id: `o_${o.id}`,
                option_text: o.option_text,
                is_correct: o.is_correct
              })),
              grading_rubric: q.grading_rubric || ""
            })));
          }
        } else {
          alert("Failed to load mock data or you do not have permission.");
          router.push("/dashboard/mocks");
        }
      } catch (err) {
        console.error("Failed to fetch mock data", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCourses().then(() => {
      if (isEditMode) fetchMockData();
    });
  }, [token, editMockId, isEditMode, router]);

  const handleAddMCQ = () => {
    setQuestions([
      ...questions,
      {
        id: `q${Date.now()}`,
        question_type: "mcq",
        question_text: "",
        marks: 2,
        options: [
          { id: `o${Date.now()}_1`, option_text: "", is_correct: true },
          { id: `o${Date.now()}_2`, option_text: "", is_correct: false }
        ]
      }
    ]);
  };

  const handleAddTheory = () => {
    setQuestions([
      ...questions,
      {
        id: `q${Date.now()}`,
        question_type: "theory",
        question_text: "",
        marks: 10,
        options: [],
        grading_rubric: ""
      }
    ]);
  };

  const updateQuestion = (id: string, updates: Partial<QuestionState>) => {
    setQuestions(questions.map(q => q.id === id ? { ...q, ...updates } : q));
  };

  const confirmRemoveQuestion = (id: string) => {
    setQuestionToDelete(id);
  };

  const executeRemoveQuestion = () => {
    if (questionToDelete) {
      setQuestions(questions.filter(q => q.id !== questionToDelete));
      setQuestionToDelete(null);
    }
  };

  const downloadTemplate = () => {
    const csvContent = "Type,Question,Marks,Option 1,Option 2,Option 3,Option 4,Correct Option (1-4),Grading Rubric\n"
                     + "mcq,What is the powerhouse of the cell?,2,Nucleus,Mitochondria,Ribosome,Membrane,2,\n"
                     + "theory,Explain cellular respiration,5,,,,,,Key points: ATP oxygen glucose";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "kanvise_mock_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const processCSV = (file: File) => {
    setIsUploading(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsedQuestions: QuestionState[] = [];
        results.data.forEach((row: any) => {
          const qType = (row.Type || "").toLowerCase().trim();
          if (qType !== 'mcq' && qType !== 'theory') return;
          
          const qId = `q${Date.now()}${Math.random()}`;
          const newQ: QuestionState = {
            id: qId,
            question_type: qType,
            question_text: row.Question || "",
            marks: Number(row.Marks) || 1,
            options: [],
            grading_rubric: row['Grading Rubric'] || ""
          };

          if (qType === 'mcq') {
            const correctOptIndex = Number(row['Correct Option (1-4)']) || 1;
            for (let i = 1; i <= 4; i++) {
              const optText = row[`Option ${i}`];
              if (optText) {
                newQ.options.push({
                  id: `o${Date.now()}${Math.random()}`,
                  option_text: optText,
                  is_correct: correctOptIndex === i
                });
              }
            }
          }
          parsedQuestions.push(newQ);
        });
        
        setQuestions(prev => [...prev, ...parsedQuestions]);
        setIsUploading(false);
        alert(`Successfully imported ${parsedQuestions.length} questions!`);
      },
      error: (error) => {
        console.error(error);
        alert("Error parsing CSV file");
        setIsUploading(false);
      }
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.type === "text/csv" || file.name.endsWith(".csv"))) {
      processCSV(file);
    } else {
      alert("Please upload a valid .csv file.");
    }
  };
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processCSV(file);
  };

  const handleSave = async (shouldPublish: boolean) => {
    if (!title || !courseId) {
      alert("Please provide a Mock Title and select a Course.");
      return;
    }

    try {
      let mockId = editMockId;
      const finalPublishAt = publishMode === "scheduled" && publishDate && publishTime 
        ? `${publishDate}T${publishTime}:00Z` 
        : null;

      const payload = {
        title,
        description,
        course_id: courseId,
        publish_at: finalPublishAt,
        time_limit_minutes: isUntimed ? 0 : timeLimit
      };

      if (isEditMode) {
        // 1. Update existing Mock
        const mockRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/mocks/${mockId}`, {
          method: "PUT",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });
        if (!mockRes.ok) throw new Error("Failed to update mock");
      } else {
        // 1. Create Parent Mock
        const mockRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/mocks`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });
        if (!mockRes.ok) throw new Error("Failed to create mock");
        const mockData = await mockRes.json();
        mockId = mockData.data.id;
      }

      // 2. Insert/Update Questions
      if (questions.length > 0) {
        if (isEditMode) {
          // Bulk overwrite for edits
          const qRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/mocks/${mockId}/questions`, {
            method: "PUT",
            headers: { 
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ questions })
          });
          if (!qRes.ok) throw new Error("Failed to update questions");
        } else {
          // Sequential insert for new mock (as it was)
          await Promise.all(questions.map((q, index) => {
            return fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/mocks/${mockId}/questions`, {
              method: "POST",
              headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
              },
              body: JSON.stringify({
                question_type: q.question_type,
                question_text: q.question_text,
                marks: q.marks,
                order_index: index + 1,
                options: q.options,
                grading_rubric: q.grading_rubric
              })
            });
          }));
        }
      }



      // 3. Publish if immediate
      if (shouldPublish && publishMode === "immediate") {
        await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/mocks/${mockId}/publish`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          }
        });
      }

      // 4. Navigate away
      router.push("/dashboard/mocks"); 
    } catch (err) {
      console.error(err);
      alert("Failed to save mock");
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-[#474551]">Loading builder...</div>;
  }

  return (
    <div className="w-full max-w-[1200px] mx-auto pb-20 font-sans">
      {isReadOnly && (
        <div className="bg-[#fff4f2] border-l-4 border-[#ba1a1a] text-[#ba1a1a] p-4 mb-6 rounded shadow-sm">
          <p className="font-semibold text-[15px] flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px]">lock</span>
            Read-Only Mode
          </p>
          <p className="text-[13px] mt-1">This mock has already been published. Its questions and parameters can no longer be edited to preserve grading integrity.</p>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {questionToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="bg-white rounded-lg p-6 w-[400px] shadow-xl border border-[#e4e2e1]">
            <h3 className="text-[18px] font-semibold text-[#1b1c1c] mb-2 flex items-center gap-2">
              <span className="material-symbols-outlined text-[#ba1a1a]">warning</span>
              Delete Question?
            </h3>
            <p className="text-[14px] text-[#474551] mb-6">Are you sure you want to delete this question? This action cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setQuestionToDelete(null)} 
                className="px-4 py-2 text-[14px] font-medium text-[#474551] hover:bg-gray-100 rounded transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={executeRemoveQuestion} 
                className="px-4 py-2 text-[14px] font-medium text-white bg-[#ba1a1a] hover:bg-[#931515] rounded transition-colors cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="flex justify-between items-end mb-8 pb-4 border-b border-[#e4e2e1]">
        <div>
          <h2 className="text-[32px] font-bold text-[#1b1c1c] leading-tight">{isEditMode ? "Edit Mock Assessment" : "Build Mock Assessment"}</h2>
          <p className="text-[16px] text-[#474551] mt-1">Configure parameters and construct questions for the upcoming evaluation.</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => handleSave(false)}
            disabled={isReadOnly}
            className="px-6 py-2.5 border border-[#c8c5d2] text-[#1b1c1c] font-semibold text-sm rounded hover:bg-gray-50 hover:shadow-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save as Draft
          </button>
          <button 
            onClick={() => handleSave(true)}
            disabled={isReadOnly}
            className="px-6 py-2.5 bg-[#C26627] text-white font-semibold text-sm rounded hover:bg-[#a55621] hover:shadow-md transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-[18px]">publish</span>
            {publishMode === "immediate" ? "Publish Mock" : "Schedule Mock"}
          </button>
        </div>
      </div>

      {/* Asymmetric Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Question Builder (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          <div className="space-y-6">
            {questions.map((q, idx) => (
              <div key={q.id} className="bg-white border border-[#e4e2e1] rounded-lg p-6 shadow-sm group relative">
                
                <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center gap-3">
                    <span className={`px-2.5 py-0.5 rounded text-[12px] font-bold ${q.question_type === 'mcq' ? 'bg-[#e3dfff] text-[#180d62]' : 'bg-[#ffdbc9] text-[#994704]'}`}>
                      Q{idx + 1}
                    </span>
                    <span className="text-[12px] font-semibold text-[#787582] uppercase tracking-wider">
                      {q.question_type === 'mcq' ? 'Multiple Choice' : 'Theory / Essay'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="text-[14px] text-[#474551]">Marks:</label>
                    <input 
                      type="number" 
                      disabled={isReadOnly}
                      value={q.marks}
                      onChange={(e) => updateQuestion(q.id, { marks: Number(e.target.value) })}
                      className="w-16 bg-white border border-[#c8c5d2] focus:border-[#2e2877] focus:ring-1 focus:ring-[#2e2877] rounded px-2 py-1.5 text-center text-[14px] text-[#1b1c1c] outline-none transition-all disabled:bg-[#f5f3f2]" 
                    />
                    {!isReadOnly && (
                      <button onClick={() => confirmRemoveQuestion(q.id)} className="text-[#c8c5d2] hover:text-[#ba1a1a] transition-colors cursor-pointer hover:scale-110">
                        <span className="material-symbols-outlined text-[20px]">delete</span>
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <textarea 
                    value={q.question_text}
                    disabled={isReadOnly}
                    onChange={(e) => updateQuestion(q.id, { question_text: e.target.value })}
                    className="w-full bg-white border border-[#c8c5d2] focus:border-[#2e2877] focus:ring-1 focus:ring-[#2e2877] rounded px-4 py-3 text-[15px] text-[#1b1c1c] outline-none transition-all mb-5 min-h-[100px] resize-y disabled:bg-[#f5f3f2]" 
                    placeholder="Enter question text here..."
                  />

                  {q.question_type === 'mcq' && (
                    <div className="space-y-3">
                      {q.options.map((opt) => (
                        <div key={opt.id} className="flex items-center gap-4">
                          <button 
                            type="button"
                            onClick={() => {
                              const newOpts = q.options.map(o => ({ ...o, is_correct: o.id === opt.id }));
                              updateQuestion(q.id, { options: newOpts });
                            }}
                            className="flex shrink-0 items-center justify-center w-5 h-5 rounded-full border-2 transition-all focus:outline-none cursor-pointer hover:border-[#2e2877]"
                            style={{ 
                              borderColor: opt.is_correct ? '#2e2877' : '#c8c5d2',
                            }}
                          >
                            {opt.is_correct && <div className="w-2.5 h-2.5 rounded-full bg-[#2e2877]" />}
                          </button>
                          
                          <input 
                            type="text" 
                            disabled={isReadOnly}
                            value={opt.option_text}
                            onChange={(e) => {
                              const newOpts = q.options.map(o => o.id === opt.id ? { ...o, option_text: e.target.value } : o);
                              updateQuestion(q.id, { options: newOpts });
                            }}
                            className={`flex-1 border rounded px-4 py-2.5 text-[15px] text-[#1b1c1c] outline-none transition-all disabled:bg-[#f5f3f2] ${opt.is_correct ? 'border-[#2e2877] bg-[#e3dfff]/20' : 'border-[#c8c5d2] bg-white'}`} 
                          />
                          <button 
                            onClick={() => {
                              const newOpts = q.options.filter(o => o.id !== opt.id);
                              updateQuestion(q.id, { options: newOpts });
                            }}
                            className="text-[#c8c5d2] hover:text-[#474551] transition-colors cursor-pointer hover:scale-110"
                          >
                            <span className="material-symbols-outlined text-[20px]">close</span>
                          </button>
                        </div>
                      ))}
                      {!isReadOnly && (
                        <button 
                          onClick={() => {
                            const newOpts = [...q.options, { id: `o${Date.now()}`, option_text: "", is_correct: false }];
                            updateQuestion(q.id, { options: newOpts });
                          }}
                          className="flex items-center gap-1.5 text-[#2e2877] text-[14px] font-semibold mt-4 hover:underline ml-9 cursor-pointer opacity-80 hover:opacity-100 transition-opacity"
                        >
                          <span className="material-symbols-outlined text-[18px]">add</span> Add Option
                        </button>
                      )}
                    </div>
                  )}

                  {q.question_type === 'theory' && (
                    <div className="flex items-start gap-4 mt-2">
                      <label className="text-[13px] text-[#474551] font-medium pt-2 w-32 shrink-0">
                        Grading Rubric / Keywords (Internal)
                      </label>
                      <textarea 
                        value={q.grading_rubric || ""}
                        disabled={isReadOnly}
                        onChange={(e) => updateQuestion(q.id, { grading_rubric: e.target.value })}
                        className="flex-1 bg-[#fbf9f8] border border-[#c8c5d2] focus:border-[#2e2877] focus:ring-1 focus:ring-[#2e2877] rounded px-4 py-3 text-[14px] text-[#474551] outline-none transition-all min-h-[80px] resize-y disabled:bg-[#f5f3f2]" 
                        placeholder="Keywords expected for full marks..."
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Bulk Import Section */}
          {!isReadOnly && (
            <>
              <div className="mt-8">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[16px] font-semibold text-[#1b1c1c]">Bulk Import Questions</h3>
                  <button 
                    onClick={downloadTemplate} 
                    className="text-[#2e2877] text-[13px] font-medium hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">download</span> Download CSV Template
                  </button>
                </div>
                
                <label 
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`w-full border-2 border-dashed rounded-lg p-10 flex flex-col items-center justify-center transition-colors cursor-pointer group ${
                    isDragging 
                      ? 'border-[#2e2877] bg-[#f5f3f2]' 
                      : 'border-[#c8c5d2] bg-white hover:bg-[#f5f3f2]'
                  }`}
                >
                  <input type="file" accept=".csv" className="hidden" onChange={handleFileInput} />
                  
                  {isUploading ? (
                    <div className="flex flex-col items-center py-2">
                      <span className="material-symbols-outlined animate-spin text-[32px] text-[#2e2877] mb-3">progress_activity</span>
                      <p className="text-[14px] text-[#474551] font-semibold">Extracting questions...</p>
                    </div>
                  ) : (
                    <>
                      <div className="h-14 w-14 rounded-full bg-[#f0eded] flex items-center justify-center mb-3 group-hover:bg-[#2e2877] group-hover:text-white transition-colors">
                        <span className="material-symbols-outlined text-[28px]">cloud_upload</span>
                      </div>
                      <span className="text-[15px] font-semibold text-[#1b1c1c] mb-1">Click to upload or drag and drop</span>
                      <span className="text-[13px] font-normal text-[#474551]">CSV file formatted to Kanvise standard</span>
                    </>
                  )}
                </label>
              </div>

              <div className="flex items-center justify-center py-6">
                <div className="h-px bg-[#e4e2e1] w-full"></div>
                <span className="px-4 text-[#787582] text-[13px] font-medium bg-white">OR</span>
                <div className="h-px bg-[#e4e2e1] w-full"></div>
              </div>

              {/* Add Question Controls */}
              <div className="flex items-center gap-6 p-6 border-2 border-dashed border-[#c8c5d2] rounded-lg bg-[#fbf9f8] justify-center mt-2">
                <span className="text-[15px] text-[#474551]">Add new structural block:</span>
                <div className="flex gap-4">
                  <button 
                    onClick={handleAddMCQ}
                    className="flex items-center gap-2 px-5 py-2.5 border border-[#2e2877] text-[#2e2877] font-semibold text-sm rounded hover:bg-[#2e2877] hover:text-white transition-all bg-white cursor-pointer hover:shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[18px]">list_alt</span>
                    MCQ Question
                  </button>
                  <button 
                    onClick={handleAddTheory}
                    className="flex items-center gap-2 px-5 py-2.5 border border-[#2e2877] text-[#2e2877] font-semibold text-sm rounded hover:bg-[#2e2877] hover:text-white transition-all bg-white cursor-pointer hover:shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[18px]">subject</span>
                    Theory Question
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Right Column: General Settings (4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-4 sticky top-6">
          <div className="bg-white border border-[#e4e2e1] rounded-lg p-7 shadow-sm">
            <h3 className="text-[18px] font-semibold text-[#1b1c1c] mb-6 flex items-center gap-3 border-b border-[#e4e2e1] pb-4">
              <span className="material-symbols-outlined text-[#2e2877]">tune</span>
              Assessment Parameters
            </h3>
            
            <div className="space-y-6">
              <div>
                <label className="block text-[13px] text-[#474551] mb-1.5 font-medium">Mock Title</label>
                <input 
                  type="text" 
                  disabled={isReadOnly}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-white border border-[#c8c5d2] focus:border-[#2e2877] focus:ring-1 focus:ring-[#2e2877] rounded px-3.5 py-2.5 text-[15px] text-[#1b1c1c] outline-none transition-all disabled:bg-[#f5f3f2]" 
                />
              </div>
              
              <div>
                <label className="block text-[13px] text-[#474551] mb-1.5 font-medium">Description / Instructions</label>
                <textarea 
                  value={description}
                  disabled={isReadOnly}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-white border border-[#c8c5d2] focus:border-[#2e2877] focus:ring-1 focus:ring-[#2e2877] rounded px-3.5 py-2.5 text-[14px] text-[#474551] outline-none transition-all min-h-[100px] resize-y disabled:bg-[#f5f3f2]" 
                />
              </div>

              <div>
                <label className="block text-[13px] text-[#474551] mb-1.5 font-medium">Target Programme/Course</label>
                <select 
                  value={courseId}
                  disabled={isReadOnly}
                  onChange={(e) => setCourseId(e.target.value)}
                  className="w-full bg-white border border-[#c8c5d2] focus:border-[#2e2877] focus:ring-1 focus:ring-[#2e2877] rounded px-3.5 py-2.5 text-[15px] text-[#1b1c1c] outline-none transition-all appearance-none disabled:bg-[#f5f3f2]"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%23787582' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                    backgroundPosition: 'right 0.5rem center',
                    backgroundRepeat: 'no-repeat',
                    backgroundSize: '1.5em 1.5em',
                  }}
                >
                  <option value="" disabled>Select a course</option>
                  {courses.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="bg-[#fbf9f8] p-4 rounded-lg border border-[#e4e2e1]">
                <label className="block text-[13px] text-[#1b1c1c] mb-3 font-semibold">Publishing Strategy</label>
                <div className="flex gap-4 mb-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="radio" 
                      name="publishMode"
                      checked={publishMode === "immediate"}
                      onChange={() => setPublishMode("immediate")}
                      className="text-[#2e2877] focus:ring-[#2e2877] cursor-pointer"
                    />
                    <span className="text-[14px] text-[#474551]">Immediate</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="radio" 
                      name="publishMode"
                      checked={publishMode === "scheduled"}
                      onChange={() => setPublishMode("scheduled")}
                      className="text-[#2e2877] focus:ring-[#2e2877] cursor-pointer"
                    />
                    <span className="text-[14px] text-[#474551]">Schedule Date</span>
                  </label>
                </div>

                {publishMode === "scheduled" && (
                  <div className="grid grid-cols-2 gap-4 pt-2 border-t border-[#e4e2e1] mt-2">
                    <div>
                      <label className="block text-[12px] text-[#474551] mb-1.5 font-medium">Publish Date</label>
                      <input 
                        type="date" 
                        value={publishDate}
                        onChange={(e) => setPublishDate(e.target.value)}
                        className="w-full bg-white border border-[#c8c5d2] focus:border-[#2e2877] focus:ring-1 focus:ring-[#2e2877] rounded px-3 py-2 text-[13px] text-[#1b1c1c] outline-none transition-all" 
                      />
                    </div>
                    <div>
                      <label className="block text-[12px] text-[#474551] mb-1.5 font-medium">Publish Time</label>
                      <input 
                        type="time" 
                        value={publishTime}
                        onChange={(e) => setPublishTime(e.target.value)}
                        className="w-full bg-white border border-[#c8c5d2] focus:border-[#2e2877] focus:ring-1 focus:ring-[#2e2877] rounded px-3 py-2 text-[13px] text-[#1b1c1c] outline-none transition-all" 
                      />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[13px] text-[#474551] mb-2 font-medium flex items-center justify-between">
                  Time Limit
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={isUntimed}
                      onChange={(e) => setIsUntimed(e.target.checked)}
                      className="text-[#2e2877] rounded focus:ring-[#2e2877] cursor-pointer"
                    />
                    <span className="text-[12px] font-normal">Untimed Exam</span>
                  </label>
                </label>
                {!isUntimed && (
                  <div className="flex items-center gap-3">
                    <input 
                      type="number" 
                      disabled={isReadOnly}
                      value={timeLimit}
                      onChange={(e) => setTimeLimit(Number(e.target.value))}
                      className="w-24 bg-white border border-[#c8c5d2] focus:border-[#2e2877] focus:ring-1 focus:ring-[#2e2877] rounded px-3.5 py-2.5 text-[15px] text-[#1b1c1c] outline-none transition-all disabled:bg-[#f5f3f2]" 
                    />
                    <span className="text-[13px] text-[#787582]">Strict enforcement in minutes</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
