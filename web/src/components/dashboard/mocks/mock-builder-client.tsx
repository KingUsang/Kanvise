"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Papa from "papaparse";
import { toast } from "sonner";
import { startNavigationProgress } from "@/components/navigation/NavigationProgress";

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

type Bank = { id: string; name: string; question_count: number };
type BankQuestion = {
  id: string;
  question_type: "mcq" | "theory";
  current_version: {
    id: string;
    plain_text: string;
    marks: number;
  };
};
type SelectedBankQuestion = {
  questionId: string;
  questionVersionId: string;
  questionText: string;
  questionType: "mcq" | "theory";
  marks: number;
  bankName: string;
};

export function parseDocxQuestionText(rawText: string): QuestionState[] {
  const blocks = rawText
    .replace(/\r/g, "")
    .split(/\n\s*(?:---+|={3,})\s*\n/g)
    .map((block) => block.trim())
    .filter(Boolean);

  return blocks.flatMap<QuestionState>((block, blockIndex) => {
    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
    const field = (name: string) => lines.find((line) => line.toLowerCase().startsWith(`${name.toLowerCase()}:`))
      ?.slice(name.length + 1).trim();
    const type = field("Type")?.toLowerCase();
    const questionText = field("Question");
    if (!questionText || (type !== "mcq" && type !== "theory")) return [];

    const marks = Number(field("Marks")) || 1;
    const id = `docx_${Date.now()}_${blockIndex}`;
    if (type === "theory") {
      return [{
        id,
        question_type: "theory" as const,
        question_text: questionText,
        marks,
        options: [],
        grading_rubric: field("Rubric") || "",
      }];
    }

    const answer = field("Answer")?.toUpperCase();
    const options = lines.flatMap((line, optionIndex) => {
      const match = line.match(/^([A-Z])[\).:-]\s+(.+)$/i);
      if (!match) return [];
      return [{
        id: `${id}_option_${optionIndex}`,
        option_text: match[2].trim(),
        is_correct: match[1].toUpperCase() === answer,
      }];
    });
    if (options.length < 2 || options.filter((option) => option.is_correct).length !== 1) return [];
    return [{ id, question_type: "mcq" as const, question_text: questionText, marks, options }];
  });
}

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
  const [calculatorMode, setCalculatorMode] = useState<"none" | "basic" | "scientific">("none");
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [shuffleOptions, setShuffleOptions] = useState(false);
  const [maxAttempts, setMaxAttempts] = useState(1);
  const [passMark, setPassMark] = useState(50);
  const [resultReleaseMode, setResultReleaseMode] = useState<
    "score_only" | "immediately_with_corrections" | "after_close" | "after_theory_grading"
  >("score_only");
  const [availableFrom, setAvailableFrom] = useState("");
  const [closesAt, setClosesAt] = useState("");

  // Questions State
  const [questions, setQuestions] = useState<QuestionState[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [selectedBankId, setSelectedBankId] = useState("");
  const [bankQuestions, setBankQuestions] = useState<BankQuestion[]>([]);
  const [selectedBankQuestions, setSelectedBankQuestions] = useState<SelectedBankQuestion[]>([]);
  const [showBankPicker, setShowBankPicker] = useState(false);
  const [isLoadingBankQuestions, setIsLoadingBankQuestions] = useState(false);

  // CSV Upload & Modal State
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [questionToDelete, setQuestionToDelete] = useState<string | null>(null);

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const headers = { "Authorization": `Bearer ${token}` };
        const [res, banksRes] = await Promise.all([
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/courses`, { headers }),
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/question-banks?page_size=100`, { headers }),
        ]);
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error || "Could not load Courses");
        }
        const { data } = await res.json();
        setCourses(data || []);
        if (data && data.length > 0 && !isEditMode) {
          setCourseId(data[0].id);
        }
        if (banksRes.ok) {
          const { data } = await banksRes.json();
          setBanks(data || []);
          setSelectedBankId(data?.[0]?.id || "");
        } else {
          toast.error("Could not load question banks", { description: "You can still type questions manually." });
        }
      } catch (err) {
        console.error("Failed to fetch courses", err);
        toast.error("Could not prepare the mock builder", {
          description: err instanceof Error ? err.message : "Refresh the page and try again.",
        });
      } finally {
        if (!isEditMode) setIsLoading(false);
      }
    };

    const fetchMockData = async () => {
      if (!editMockId) return;
      try {
        const [mockRes, assemblyRes] = await Promise.all([
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/mocks/${editMockId}`, {
            headers: { "Authorization": `Bearer ${token}` }
          }),
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/mocks/${editMockId}/assembly`, {
            headers: { "Authorization": `Bearer ${token}` }
          })
        ]);

        if (mockRes.ok && assemblyRes.ok) {
          const mockData = (await mockRes.json()).data;
          const assemblyData = (await assemblyRes.json()).data;

          if (mockData.status !== "draft") {
            setIsReadOnly(true);
          }

          setTitle(mockData.title || "");
          setDescription(mockData.description || "");
          setCourseId(mockData.course_id || "");
          setCalculatorMode(mockData.calculator_mode || "none");
          setShuffleQuestions(!!mockData.shuffle_questions);
          setShuffleOptions(!!mockData.shuffle_options);
          setMaxAttempts(mockData.max_attempts || 1);
          setPassMark(mockData.pass_mark ?? 50);
          setResultReleaseMode(mockData.result_release_mode || "score_only");
          setAvailableFrom(mockData.available_from ? new Date(mockData.available_from).toISOString().slice(0, 16) : "");
          setClosesAt(mockData.closes_at ? new Date(mockData.closes_at).toISOString().slice(0, 16) : "");
          
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

          const assembledQuestions = (assemblyData.sections || []).flatMap((section: any) => section.questions || []);
          const authoredQuestions = assembledQuestions.filter((item: any) => item.question?.bank?.source_mock_exam_id === editMockId);
          const reusedQuestions = assembledQuestions.filter((item: any) => item.question?.bank?.source_mock_exam_id !== editMockId);
          if (authoredQuestions.length > 0) {
            setQuestions(authoredQuestions.map((item: any) => {
              const q = item.question;
              return {
              id: `q_${q.id}`,
              question_type: q.question_type,
              question_text: q.current_version?.plain_text || "",
              marks: item.marks_override || q.current_version?.marks,
              options: (q.current_version?.options || []).map((o: any) => ({
                id: `o_${o.id}`,
                option_text: o.plain_text,
                is_correct: o.is_correct
              })),
              grading_rubric: (q.current_version?.grading_rubric_blocks || [])
                .filter((block: any) => block?.type === "text").map((block: any) => block.text).join("\n")
            }}));
          }
          setSelectedBankQuestions(reusedQuestions.map((item: any) => ({
            questionId: item.question.id,
            questionVersionId: item.question_version_id,
            questionText: item.question.current_version?.plain_text || "",
            questionType: item.question.question_type,
            marks: item.marks_override || item.question.current_version?.marks,
            bankName: item.question.bank?.name || "Question bank",
          })));
        } else {
          toast.error("Could not open this mock", { description: "It may no longer exist or you may not have access." });
          startNavigationProgress();
          router.push("/dashboard/mocks");
        }
      } catch (err) {
        console.error("Failed to fetch mock data", err);
        toast.error("Could not open this mock", { description: "Check your connection and try again." });
      } finally {
        setIsLoading(false);
      }
    };

    fetchCourses().then(() => {
      if (isEditMode) fetchMockData();
    });
  }, [token, editMockId, isEditMode, router]);

  useEffect(() => {
    if (!showBankPicker || !selectedBankId) return;
    const load = async () => {
      setIsLoadingBankQuestions(true);
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/question-banks/${selectedBankId}/questions?page_size=100`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Could not load questions");
        setBankQuestions(body.data || []);
      } catch (error) {
        toast.error("Could not load the question bank", { description: error instanceof Error ? error.message : "Please try again." });
      } finally {
        setIsLoadingBankQuestions(false);
      }
    };
    void load();
  }, [selectedBankId, showBankPicker, token]);

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
        if (parsedQuestions.length > 0) {
          toast.success(`Imported ${parsedQuestions.length} question${parsedQuestions.length === 1 ? "" : "s"}`);
        } else {
          toast.warning("No valid questions found", { description: "Check the CSV headings and question types, then try again." });
        }
      },
      error: (error) => {
        console.error(error);
        toast.error("Could not read the CSV file");
        setIsUploading(false);
      }
    });
  };

  const processDocx = async (file: File) => {
    setIsUploading(true);
    try {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
      const parsedQuestions = parseDocxQuestionText(result.value);
      setQuestions((current) => [...current, ...parsedQuestions]);
      if (parsedQuestions.length) {
        toast.success(`Imported ${parsedQuestions.length} question${parsedQuestions.length === 1 ? "" : "s"}`, {
          description: "Please review every question before publishing.",
        });
      } else {
        toast.warning("No questions matched the Word template", {
          description: "Separate questions with --- and include Type, Question, Marks and Answer fields.",
        });
      }
    } catch (error) {
      console.error("Could not read DOCX", error);
      toast.error("Could not read that Word document");
    } finally {
      setIsUploading(false);
    }
  };

  const processImportFile = (file: File) => {
    const lowerName = file.name.toLowerCase();
    if (file.type === "text/csv" || lowerName.endsWith(".csv")) {
      processCSV(file);
    } else if (lowerName.endsWith(".docx")) {
      void processDocx(file);
    } else {
      toast.error("Choose a CSV or DOCX file");
    }
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
    if (file) processImportFile(file);
  };
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processImportFile(file);
  };

  const handleSave = async (shouldPublish: boolean) => {
    if (!title || !courseId) {
      toast.error("Add a mock title and choose a course");
      return;
    }

    if (shouldPublish) {
      if (questions.length + selectedBankQuestions.length === 0) {
        toast.error("Add at least one question before publishing");
        return;
      }
      const invalidQuestionIndex = questions.findIndex((question) => {
        if (!question.question_text.trim() || !Number.isFinite(question.marks) || question.marks <= 0) return true;
        if (question.question_type !== "mcq") return false;
        const completedOptions = question.options.filter((option) => option.option_text.trim());
        return completedOptions.length < 2 || completedOptions.filter((option) => option.is_correct).length !== 1;
      });
      if (invalidQuestionIndex >= 0) {
        toast.error(`Check question ${invalidQuestionIndex + 1}`, {
          description: "Every question needs text and positive marks. MCQs need at least two options and exactly one correct answer.",
        });
        return;
      }
      if (!isUntimed && (!Number.isFinite(timeLimit) || timeLimit <= 0)) {
        toast.error("Set a positive time limit or choose Untimed Exam");
        return;
      }
      if (publishMode === "scheduled" && (!publishDate || !publishTime || new Date(`${publishDate}T${publishTime}:00`).getTime() <= Date.now())) {
        toast.error("Choose a future publication date and time");
        return;
      }
      if (availableFrom && closesAt && new Date(closesAt) <= new Date(availableFrom)) {
        toast.error("Closing time must be after the opening time");
        return;
      }
    }

    setIsSaving(true);
    try {
      let mockId = editMockId;
      const finalPublishAt = publishMode === "scheduled" && publishDate && publishTime 
        ? new Date(`${publishDate}T${publishTime}:00`).toISOString()
        : null;

      const payload = {
        title,
        description,
        course_id: courseId,
        publish_at: finalPublishAt,
        time_limit_minutes: isUntimed ? 0 : timeLimit,
        calculator_mode: calculatorMode,
        shuffle_questions: shuffleQuestions,
        shuffle_options: shuffleOptions,
        max_attempts: maxAttempts,
        pass_mark: passMark,
        result_release_mode: resultReleaseMode,
        available_from: availableFrom ? new Date(availableFrom).toISOString() : null,
        closes_at: closesAt ? new Date(closesAt).toISOString() : null,
      };

      if (isEditMode) {
        // 1. Update existing Mock
        const mockRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/mocks/${mockId}`, {
          method: "PUT",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });
        const mockBody = await mockRes.json().catch(() => null);
        if (!mockRes.ok) throw new Error(mockBody?.details?.[0] || mockBody?.error || "Failed to update mock");
      } else {
        // 1. Create Parent Mock
        const mockRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/mocks`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });
        const mockBody = await mockRes.json().catch(() => null);
        if (!mockRes.ok) throw new Error(mockBody?.details?.[0] || mockBody?.error || "Failed to create mock");
        mockId = mockBody.data.id;
      }

      // 2. Insert/Update Questions
      const qRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/mocks/${mockId}/questions`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ questions })
      });
      if (!qRes.ok) {
        const body = await qRes.json().catch(() => null);
        throw new Error(body?.details?.[0] || body?.error || "Failed to save questions");
      }

      if (selectedBankQuestions.length > 0) {
        const assemblyResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/mocks/${mockId}/assembly`, {
          headers: { "Authorization": `Bearer ${token}` },
        });
        const assemblyBody = await assemblyResponse.json().catch(() => null);
        if (!assemblyResponse.ok) throw new Error(assemblyBody?.error || "Could not load the saved questions");
        const authored = (assemblyBody.data?.sections || []).flatMap((section: any) => section.questions || []);
        const combined = [
          ...authored.map((item: any) => ({
            question_id: item.question_id,
            question_version_id: item.question_version_id,
            marks_override: item.marks_override,
          })),
          ...selectedBankQuestions.map((item) => ({
            question_id: item.questionId,
            question_version_id: item.questionVersionId,
            marks_override: null,
          })),
        ];
        const replaceResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/mocks/${mockId}/assembly`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify({
            sections: [{
              title: "Questions",
              course_id: courseId,
              instructions: null,
              questions: combined,
              rules: [],
            }],
          }),
        });
        const replaceBody = await replaceResponse.json().catch(() => null);
        if (!replaceResponse.ok) throw new Error(replaceBody?.details?.[0] || replaceBody?.error || "Could not add bank questions");
      }



      // 3. Publish if immediate
      if (shouldPublish && publishMode === "immediate") {
        const publishResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/mocks/${mockId}/publish`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          }
        });
        if (!publishResponse.ok) {
          const body = await publishResponse.json().catch(() => null);
          throw new Error(body?.error || "Failed to publish mock");
        }
      }

      // 4. Navigate away
      toast.success(shouldPublish ? (publishMode === "scheduled" ? "Mock scheduled" : "Mock published") : "Draft saved");
      startNavigationProgress();
      router.push("/dashboard/mocks"); 
    } catch (err) {
      console.error(err);
      toast.error("Could not save the mock", { description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-[#474551]">Loading builder...</div>;
  }

  return (
    <div className="w-full pb-20">
      {isReadOnly && (
        <div className="bg-[#fff4f2] border-l-4 border-[#ba1a1a] text-[#ba1a1a] p-4 mb-6 rounded shadow-sm">
          <p className="font-semibold text-[15px] flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px]">lock</span>
            Published mock
          </p>
          <p className="text-[13px] mt-1">This version has already been given to students, so its questions and settings are locked to keep their results fair.</p>
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
      <div className="mb-8 flex flex-col gap-4 border-b border-[#e4e2e1] pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-[32px] font-bold text-[#1b1c1c] leading-tight">{isEditMode ? "Edit Mock" : "Build a Mock"}</h2>
          <p className="text-[16px] text-[#474551] mt-1">Choose how the mock should work, then add or reuse questions for your students.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button 
            onClick={() => handleSave(false)}
            disabled={isReadOnly || isSaving}
            className="px-6 py-2.5 border border-[#c8c5d2] text-[#1b1c1c] font-semibold text-sm rounded hover:bg-gray-50 hover:shadow-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? "Saving…" : "Save as Draft"}
          </button>
          <button 
            onClick={() => handleSave(true)}
            disabled={isReadOnly || isSaving}
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
          {!isReadOnly && questions.length === 0 && selectedBankQuestions.length === 0 && (
            <div className="rounded-lg border border-dashed border-[#c2b59b] bg-white px-6 py-10 text-center shadow-sm">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#f0eded] text-[#2e2877]">
                <span className="material-symbols-outlined text-[28px]">quiz</span>
              </div>
              <h3 className="mt-4 text-xl font-bold text-[#180d62]">Add your first question</h3>
              <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[#474551]">
                Type a question now, reuse one from your question bank, or import several questions below.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-3">
                <button type="button" onClick={handleAddMCQ} className="rounded-md bg-[#2e2877] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#180d62]">
                  Add multiple-choice question
                </button>
                <button type="button" onClick={handleAddTheory} className="rounded-md border border-[#2e2877] px-4 py-2.5 text-sm font-semibold text-[#2e2877] hover:bg-[#2e2877]/5">
                  Add theory question
                </button>
              </div>
            </div>
          )}
          <div className="space-y-6">
            {selectedBankQuestions.map((question, index) => (
              <div key={question.questionId} className="rounded-lg border border-[#c8c5d2] bg-[#f8f6ff] p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-[#2e2877]">
                      <span className="material-symbols-outlined text-base">inventory_2</span>
                      {question.bankName} · {question.questionType === "mcq" ? "Multiple choice" : "Theory"} · {question.marks} marks
                    </div>
                    <p className="text-[15px] leading-6 text-[#1b1c1c]">{question.questionText}</p>
                  </div>
                  {!isReadOnly && <button type="button" onClick={() => setSelectedBankQuestions((current) => current.filter((item) => item.questionId !== question.questionId))} className="text-[#787582] hover:text-[#ba1a1a]" aria-label={`Remove bank question ${index + 1}`}>
                    <span className="material-symbols-outlined">close</span>
                  </button>}
                </div>
              </div>
            ))}
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
                        Marking guide (only tutors see this)
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
                  <input type="file" accept=".csv,.docx" className="hidden" onChange={handleFileInput} />
                  
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
                      <span className="text-[13px] font-normal text-[#474551]">CSV or Word (.docx) file using the Kanvise format</span>
                      <span className="mt-2 max-w-lg text-center text-[12px] leading-5 text-[#787582]">
                        In Word, separate questions with <strong>---</strong>. Use: Type: MCQ, Question:, Marks:, A. to D., and Answer: A. For theory, use Type: Theory and Rubric:.
                      </span>
                    </>
                  )}
                </label>
              </div>

              <div className="flex items-center justify-center py-6">
                <div className="h-px bg-[#e4e2e1] w-full"></div>
                <span className="px-4 text-[#787582] text-[13px] font-medium bg-white">OR</span>
                <div className="h-px bg-[#e4e2e1] w-full"></div>
              </div>

              <div className="rounded-lg border border-[#c8c5d2] bg-white p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div><h3 className="font-semibold text-[#1b1c1c]">Reuse questions from your bank</h3><p className="mt-1 text-sm text-[#474551]">Choose prepared questions instead of typing them again.</p></div>
                  <button type="button" onClick={() => setShowBankPicker((open) => !open)} className="rounded bg-[#2e2877] px-4 py-2 text-sm font-semibold text-white">{showBankPicker ? "Close question bank" : "Choose questions"}</button>
                </div>
                {showBankPicker && (
                  <div className="mt-5 border-t border-[#e4e2e1] pt-5">
                    {banks.length === 0 ? <p className="text-sm text-[#474551]">Create a question bank first, then return here to reuse its questions.</p> : <>
                      <select value={selectedBankId} onChange={(event) => setSelectedBankId(event.target.value)} className="mb-4 w-full rounded border border-[#c8c5d2] bg-white px-3 py-2 text-sm">
                        {banks.map((bank) => <option key={bank.id} value={bank.id}>{bank.name} ({bank.question_count})</option>)}
                      </select>
                      {isLoadingBankQuestions ? <p className="py-6 text-center text-sm text-[#474551]">Loading questions…</p> : (
                        <div className="max-h-80 space-y-2 overflow-y-auto">
                          {bankQuestions.map((question) => {
                            const selected = selectedBankQuestions.some((item) => item.questionId === question.id);
                            const bankName = banks.find((bank) => bank.id === selectedBankId)?.name || "Question bank";
                            return <label key={question.id} className="flex cursor-pointer items-start gap-3 rounded border border-[#e4e2e1] p-3 hover:bg-[#f8f6ff]">
                              <input type="checkbox" checked={selected} onChange={() => setSelectedBankQuestions((current) => selected
                                ? current.filter((item) => item.questionId !== question.id)
                                : [...current, { questionId: question.id, questionVersionId: question.current_version.id, questionText: question.current_version.plain_text, questionType: question.question_type, marks: question.current_version.marks, bankName }])} className="mt-1" />
                              <span><span className="block text-sm text-[#1b1c1c]">{question.current_version.plain_text}</span><span className="mt-1 block text-xs text-[#787582]">{question.question_type === "mcq" ? "Multiple choice" : "Theory"} · {question.current_version.marks} marks</span></span>
                            </label>;
                          })}
                        </div>
                      )}
                    </>}
                  </div>
                )}
              </div>

              {/* Add Question Controls */}
              <div className="flex items-center gap-6 p-6 border-2 border-dashed border-[#c8c5d2] rounded-lg bg-[#fbf9f8] justify-center mt-2">
                <span className="text-[15px] text-[#474551]">Add another question:</span>
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
              Mock settings
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
                <label className="block text-[13px] text-[#474551] mb-1.5 font-medium">Course</label>
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
                {courses.length === 0 && (
                  <p className="mt-2 text-xs leading-5 text-[#994704]">No Courses are available. Ask the centre admin to create a Course or assign one to you.</p>
                )}
              </div>

              <div className="bg-[#fbf9f8] p-4 rounded-lg border border-[#e4e2e1]">
                <label className="block text-[13px] text-[#1b1c1c] mb-3 font-semibold">When students should see it</label>
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

              <div className="border-t border-[#e4e2e1] pt-5">
                <label className="mb-1.5 block text-[13px] font-medium text-[#474551]">Calculator students can use</label>
                <select
                  value={calculatorMode}
                  disabled={isReadOnly}
                  onChange={(event) => setCalculatorMode(event.target.value as typeof calculatorMode)}
                  className="w-full rounded border border-[#c8c5d2] bg-white px-3.5 py-2.5 text-[14px] text-[#1b1c1c] outline-none focus:border-[#2e2877] disabled:bg-[#f5f3f2]"
                >
                  <option value="none">No calculator</option>
                  <option value="basic">Basic calculator</option>
                  <option value="scientific">Scientific calculator</option>
                </select>
                <p className="mt-1.5 text-xs leading-5 text-[#787582]">The calculator opens inside the exam, so students do not need to leave the page.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-[#474551]">Attempts allowed</label>
                  <input type="number" min={1} max={20} value={maxAttempts} disabled={isReadOnly}
                    onChange={(event) => setMaxAttempts(Number(event.target.value))}
                    className="w-full rounded border border-[#c8c5d2] bg-white px-3 py-2.5 text-sm disabled:bg-[#f5f3f2]" />
                </div>
                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-[#474551]">Pass mark (%)</label>
                  <input type="number" min={0} max={100} value={passMark} disabled={isReadOnly}
                    onChange={(event) => setPassMark(Number(event.target.value))}
                    className="w-full rounded border border-[#c8c5d2] bg-white px-3 py-2.5 text-sm disabled:bg-[#f5f3f2]" />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-[#474551]">What students see after submitting</label>
                <select value={resultReleaseMode} disabled={isReadOnly}
                  onChange={(event) => setResultReleaseMode(event.target.value as typeof resultReleaseMode)}
                  className="w-full rounded border border-[#c8c5d2] bg-white px-3.5 py-2.5 text-[14px] disabled:bg-[#f5f3f2]">
                  <option value="score_only">Score only</option>
                  <option value="immediately_with_corrections">Score and corrections immediately</option>
                  <option value="after_close">Corrections after the mock closes</option>
                  <option value="after_theory_grading">Corrections after theory is graded</option>
                </select>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-[#474551]">Students can start from</label>
                  <input type="datetime-local" value={availableFrom} disabled={isReadOnly}
                    onChange={(event) => setAvailableFrom(event.target.value)}
                    className="w-full rounded border border-[#c8c5d2] bg-white px-3 py-2.5 text-sm disabled:bg-[#f5f3f2]" />
                </div>
                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-[#474551]">Mock closes</label>
                  <input type="datetime-local" value={closesAt} disabled={isReadOnly}
                    onChange={(event) => setClosesAt(event.target.value)}
                    className="w-full rounded border border-[#c8c5d2] bg-white px-3 py-2.5 text-sm disabled:bg-[#f5f3f2]" />
                </div>
              </div>

              <div className="space-y-3 rounded-lg border border-[#e4e2e1] bg-[#fbf9f8] p-4">
                <label className="flex cursor-pointer items-start gap-3 text-sm text-[#474551]">
                  <input type="checkbox" checked={shuffleQuestions} disabled={isReadOnly}
                    onChange={(event) => setShuffleQuestions(event.target.checked)} className="mt-1" />
                  <span><strong className="block text-[#1b1c1c]">Mix question order</strong>Each student sees the questions in a stable but different order.</span>
                </label>
                <label className="flex cursor-pointer items-start gap-3 text-sm text-[#474551]">
                  <input type="checkbox" checked={shuffleOptions} disabled={isReadOnly}
                    onChange={(event) => setShuffleOptions(event.target.checked)} className="mt-1" />
                  <span><strong className="block text-[#1b1c1c]">Mix answer options</strong>Useful for reducing answer copying during timed mocks.</span>
                </label>
              </div>

              <div>
                <label className="block text-[13px] text-[#474551] mb-2 font-medium flex items-center justify-between">
                  Time allowed
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={isUntimed}
                      onChange={(e) => setIsUntimed(e.target.checked)}
                      className="text-[#2e2877] rounded focus:ring-[#2e2877] cursor-pointer"
                    />
                    <span className="text-[12px] font-normal">Untimed mock</span>
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
                    <span className="text-[13px] text-[#787582]">Minutes</span>
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
