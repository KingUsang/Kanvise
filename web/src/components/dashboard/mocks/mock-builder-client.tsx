"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Papa from "papaparse";
import { toast } from "sonner";
import { startNavigationProgress } from "@/components/navigation/NavigationProgress";
import { QuestionContent, type ContentBlock } from "@/components/questions/question-content";
import { buildPrePublishReview, type PrePublishReview } from "./mock-builder-validation";
import { MockDraftPreview, type DraftPreviewQuestion } from "./mock-draft-preview";

type Course = {
  id: string;
  name: string;
  programme_id?: string | null;
  is_published?: boolean;
};
type Programme = { id: string; name: string };
type DistributionMode = "centre";
type CentreAudienceScope = "course" | "programme" | "school";
type DeliveryMode = "fixed" | "subject_combination";
type BuilderStep = "setup" | "subjects" | "questions" | "settings" | "review";
const UNASSIGNED_SUBJECT_ID = "__unassigned__";

type OptionState = {
  id: string; // local id
  option_text: string;
  is_correct: boolean;
  content_blocks?: ContentBlock[];
};

type QuestionState = {
  id: string; // local id for mapping
  question_type: "mcq" | "theory";
  question_text: string;
  marks: number;
  options: OptionState[]; // only for MCQ
  grading_rubric?: string; // only for theory
  source_page?: number | null;
  review_reasons?: string[];
  content_blocks?: ContentBlock[];
  course_id?: string | null;
  subject_name?: string;
};

type Bank = { id: string; name: string; question_count: number };
type BankQuestion = {
  id: string;
  course_id: string | null;
  question_type: "mcq" | "theory";
  current_version: {
    id: string;
    plain_text: string;
    marks: number;
    options?: Array<{ id: string; plain_text: string; content_blocks?: ContentBlock[] }>;
  };
};
type SelectedBankQuestion = {
  questionId: string;
  questionVersionId: string;
  questionText: string;
  questionType: "mcq" | "theory";
  marks: number;
  bankName: string;
  courseId: string | null;
  options: Array<{ id: string; text: string; contentBlocks?: ContentBlock[] }>;
};

export function MockBuilderClient({ token }: { token: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editMockId = searchParams.get("id");
  const isEditMode = !!editMockId;
  
  const [courses, setCourses] = useState<Course[]>([]);
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isReadOnly, setIsReadOnly] = useState(false);

  // Assessment Parameters State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [courseId, setCourseId] = useState("");
  const [programmeId, setProgrammeId] = useState("");
  const [audienceScope, setAudienceScope] = useState<CentreAudienceScope>("course");
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>("fixed");
  const [builderStep, setBuilderStep] = useState<BuilderStep>("setup");
  const [activeSubjectCourseId, setActiveSubjectCourseId] = useState("");
  const [distributionMode, setDistributionMode] = useState<DistributionMode>("centre");
  // These fields are only relevant when the public marketplace audience is on.
  // They deliberately live in this builder instead of a second creation flow.
  const [marketplaceExam, setMarketplaceExam] = useState("");
  const [marketplaceSubjects, setMarketplaceSubjects] = useState("");
  const [marketplacePriceType, setMarketplacePriceType] = useState<"free" | "paid">("free");
  const [marketplacePrice, setMarketplacePrice] = useState("");
  const [marketplaceRightsConfirmed, setMarketplaceRightsConfirmed] = useState(false);
  
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
  const [publishReview, setPublishReview] = useState<PrePublishReview | null>(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [documentImportSummary, setDocumentImportSummary] = useState<{ pageCount: number | null; warnings: string[]; questionCount: number } | null>(null);
  const importedQuestionsRef = useRef<HTMLDivElement>(null);

  const showImportedQuestions = () => {
    window.requestAnimationFrame(() => importedQuestionsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const headers = { "Authorization": `Bearer ${token}` };
        const [res, banksRes, profileRes, programmesRes] = await Promise.all([
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/courses`, { headers }),
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/question-banks?page_size=100`, { headers }),
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, { headers }),
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/programmes`, { headers }),
        ]);
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error || "Could not load Subjects");
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
        if (profileRes.ok) {
          const profile = await profileRes.json();
          setIsAdmin(profile?.user?.role === "admin");
        }
        if (programmesRes.ok) {
          const { data } = await programmesRes.json();
          setProgrammes(data || []);
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
          setProgrammeId(mockData.programme_id || "");
          setAudienceScope(mockData.audience_scope || "course");
          setDeliveryMode(mockData.delivery_mode || "fixed");
          setDistributionMode(mockData.distribution_mode || "centre");
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

          const assembledQuestions = (assemblyData.sections || []).flatMap((section: any) => (section.questions || []).map((item: any) => ({
            ...item,
            section_course_id: section.course_id || null,
          })));
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
                is_correct: o.is_correct,
                content_blocks: o.content_blocks || [],
              })),
              content_blocks: q.current_version?.content_blocks || [],
              course_id: item.section_course_id || q.course_id || null,
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
              courseId: item.section_course_id || item.question.course_id || null,
              options: (item.question.current_version?.options || []).map((option: any) => ({ id: option.id, text: option.plain_text, contentBlocks: option.content_blocks || [] })),
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

  const changeDistributionMode = (value: DistributionMode) => {
    setDistributionMode(value);
    if (value !== "centre") setDeliveryMode("fixed");
  };

  const changeAudienceScope = (value: CentreAudienceScope) => {
    setAudienceScope(value);
    if (value !== "programme") setDeliveryMode("fixed");
  };

  const programmeCourses = courses.filter((course) => !programmeId || course.programme_id === programmeId);
  const resolveImportedCourseId = (subjectName: string | undefined) => {
    const normalized = (subjectName || "").toLowerCase().replace(/^use of\s+/, "").replace(/[^a-z0-9]/g, "");
    if (!normalized) return null;
    return programmeCourses.find((course) => course.name.toLowerCase().replace(/^use of\s+/, "").replace(/[^a-z0-9]/g, "") === normalized)?.id || null;
  };

  const resolvedActiveSubjectCourseId = deliveryMode === "subject_combination"
    ? (activeSubjectCourseId === UNASSIGNED_SUBJECT_ID && questions.some((question) => !question.course_id)
      ? UNASSIGNED_SUBJECT_ID
      : programmeCourses.some((course) => course.id === activeSubjectCourseId) ? activeSubjectCourseId : programmeCourses[0]?.id || "")
    : "";

  const handleAddMCQ = () => {
    setQuestions([
      ...questions,
      {
        id: `q${Date.now()}`,
        question_type: "mcq",
        question_text: "",
        marks: 2,
        course_id: deliveryMode === "subject_combination" ? resolvedActiveSubjectCourseId || null : courseId || null,
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
        course_id: deliveryMode === "subject_combination" ? resolvedActiveSubjectCourseId || null : courseId || null,
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
            grading_rubric: row['Grading Rubric'] || "",
            course_id: deliveryMode === "subject_combination" ? resolvedActiveSubjectCourseId || null : courseId || null,
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
    setDocumentImportSummary(null);
    try {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/mocks/import/document-text`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ document_text: result.value, file_name: file.name }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || "Could not import that Word document");
      const imported = body?.data;
      const parsedQuestions: QuestionState[] = (imported?.questions || []).map((question: any) => ({
        id: question.id || `docx_${Date.now()}_${Math.random()}`,
        question_type: question.question_type === "mcq" ? "mcq" : "theory",
        question_text: question.question_text || "",
        marks: Number(question.marks) || 1,
        options: (question.options || []).map((option: any, index: number) => ({ id: option.id || `docx_option_${Date.now()}_${index}`, option_text: option.option_text || "", is_correct: option.is_correct === true, content_blocks: option.content_blocks || [] })),
        grading_rubric: question.grading_rubric || "",
        source_page: question.source_page ?? null,
        review_reasons: [...(question.review_reasons || []), ...(deliveryMode === "subject_combination" && question.subject_name && !resolveImportedCourseId(question.subject_name) ? [`Assign imported subject “${question.subject_name}” to a programme subject.`] : [])],
        content_blocks: question.content_blocks || [],
        course_id: deliveryMode === "subject_combination" ? (question.subject_name ? resolveImportedCourseId(question.subject_name) : resolvedActiveSubjectCourseId || null) : courseId || null,
        subject_name: question.subject_name || undefined,
      }));
      setQuestions((current) => [...current, ...parsedQuestions]);
      const warnings = imported?.warnings || [];
      setDocumentImportSummary({ pageCount: imported?.page_count ?? null, warnings, questionCount: parsedQuestions.length });
      if (parsedQuestions.length) {
        toast.success(`Imported ${parsedQuestions.length} question${parsedQuestions.length === 1 ? "" : "s"}`, {
          description: warnings.length ? "Some items need your review before publishing." : "Review the imported questions before publishing.",
        });
        showImportedQuestions();
      } else {
        toast.warning("No questions were found in that Word document", { description: warnings[0] || "Try another document." });
      }
    } catch (error) {
      console.error("Could not read DOCX", error);
      toast.error("Could not import that Word document", { description: error instanceof Error ? error.message : "Please try again." });
    } finally {
      setIsUploading(false);
    }
  };

  const processPDF = async (file: File) => {
    setIsUploading(true);
    setDocumentImportSummary(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/mocks/import/pdf`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || "Could not import that PDF");
      const imported = body?.data;
      const parsedQuestions: QuestionState[] = (imported?.questions || []).map((question: any) => ({
        id: question.id || `pdf_${Date.now()}_${Math.random()}`,
        question_type: question.question_type === "mcq" ? "mcq" : "theory",
        question_text: question.question_text || "",
        marks: Number(question.marks) || 1,
        options: (question.options || []).map((option: any, index: number) => ({
          id: option.id || `pdf_option_${Date.now()}_${index}`,
          option_text: option.option_text || "",
          is_correct: option.is_correct === true,
          content_blocks: option.content_blocks || [],
        })),
        grading_rubric: question.grading_rubric || "",
        source_page: question.source_page ?? null,
        review_reasons: [...(question.review_reasons || []), ...(deliveryMode === "subject_combination" && question.subject_name && !resolveImportedCourseId(question.subject_name) ? [`Assign imported subject “${question.subject_name}” to a programme subject.`] : [])],
        content_blocks: question.content_blocks || [],
        course_id: deliveryMode === "subject_combination" ? (question.subject_name ? resolveImportedCourseId(question.subject_name) : resolvedActiveSubjectCourseId || null) : courseId || null,
        subject_name: question.subject_name || undefined,
      }));
      setQuestions((current) => [...current, ...parsedQuestions]);
      const warnings = imported?.warnings || [];
      setDocumentImportSummary({ pageCount: imported?.page_count ?? null, warnings, questionCount: parsedQuestions.length });
      if (parsedQuestions.length) {
        toast.success(`Imported ${parsedQuestions.length} question${parsedQuestions.length === 1 ? "" : "s"}`, {
          description: warnings.length ? "Some items need your review before publishing." : "Review the imported questions before publishing.",
        });
        showImportedQuestions();
      } else {
        toast.warning("No questions were found in that PDF", { description: warnings[0] || "Try another document." });
      }
    } catch (error) {
      console.error("Could not import PDF", error);
      toast.error("Could not import that PDF", { description: error instanceof Error ? error.message : "Please try again." });
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
    } else if (file.type === "application/pdf" || lowerName.endsWith(".pdf")) {
      void processPDF(file);
    } else {
      toast.error("Choose a PDF, CSV or DOCX file");
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

  const getPrePublishReview = () => buildPrePublishReview({
    title,
    distributionMode,
    courseId,
    programmeId,
    audienceScope,
    deliveryMode,
    questions,
    selectedBankQuestions,
    isUntimed,
    timeLimit,
    publishMode,
    publishDate,
    publishTime,
    availableFrom,
    closesAt,
    marketplaceExam,
    marketplaceSubjects,
    marketplacePriceType,
    marketplacePrice,
    marketplaceRightsConfirmed,
  });

  const requestPublish = () => {
    const review = getPrePublishReview();
    setPublishReview(review);
    setIsReviewOpen(true);
  };

  const handleSave = async (shouldPublish: boolean) => {
    const hasCentreTarget = audienceScope === "school" || (audienceScope === "course" ? Boolean(courseId) : Boolean(programmeId));
    if (!title || ((distributionMode === "centre" || distributionMode === "both") && !hasCentreTarget)) {
      toast.error("Add a mock title and choose who should receive it");
      return;
    }
    if (deliveryMode === "subject_combination" && questions.some((question) => !question.course_id)) {
      toast.error("Every multi-subject question must be assigned to a subject");
      return;
    }
    if (deliveryMode === "subject_combination" && selectedBankQuestions.some((question) => !question.courseId)) {
      toast.error("Every adaptive mock question must be linked to one programme subject");
      return;
    }

    if (shouldPublish) {
      const review = getPrePublishReview();
      if (review.errors.length) {
        toast.error("Finish the pre-publish checks", { description: review.errors[0] });
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
        course_id: audienceScope === "course" ? courseId || null : null,
        programme_id: audienceScope === "programme" ? programmeId || null : null,
        audience_scope: audienceScope,
        delivery_mode: deliveryMode,
        distribution_mode: distributionMode,
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

      if (selectedBankQuestions.length > 0 || deliveryMode === "subject_combination") {
        const assemblyResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/mocks/${mockId}/assembly`, {
          headers: { "Authorization": `Bearer ${token}` },
        });
        const assemblyBody = await assemblyResponse.json().catch(() => null);
        if (!assemblyResponse.ok) throw new Error(assemblyBody?.error || "Could not load the saved questions");
        const authored = (assemblyBody.data?.sections || []).flatMap((section: any) => section.questions || []);
        const combined = [
          ...authored.map((item: any, index: number) => ({
            question_id: item.question_id,
            question_version_id: item.question_version_id,
            marks_override: item.marks_override,
            course_id: questions[index]?.course_id || null,
          })),
          ...selectedBankQuestions.map((item) => ({
            question_id: item.questionId,
            question_version_id: item.questionVersionId,
            marks_override: null,
            course_id: item.courseId,
          })),
        ];
        const sections = deliveryMode === "subject_combination"
          ? courses.filter((course) => combined.some((item: any) => item.course_id === course.id)).map((course) => ({
              title: course.name,
              course_id: course.id,
              subject_name: course.name,
              instructions: null,
              questions: combined.filter((item: any) => item.course_id === course.id).map((item: any) => ({ question_id: item.question_id, question_version_id: item.question_version_id, marks_override: item.marks_override })),
              rules: [],
            }))
          : [{ title: "Questions", course_id: audienceScope === "course" ? courseId || null : null, instructions: null, questions: combined, rules: [] }];
        const replaceResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/mocks/${mockId}/assembly`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify({
            sections,
          }),
        });
        const replaceBody = await replaceResponse.json().catch(() => null);
        if (!replaceResponse.ok) throw new Error(replaceBody?.details?.[0] || replaceBody?.error || "Could not add bank questions");
      }



      // 3. Marketplace tutors submit immediately for approval. Marketplace admins
      // publish immediately but public availability can still be scheduled by the
      // configured date/time. Centre-only mocks retain their existing scheduler.
      let publishMessage: string | null = null;
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
        const body = await publishResponse.json().catch(() => null);
        publishMessage = typeof body?.message === "string" ? body.message : null;
      }

      // 4. Navigate away
      const publicationMessage = shouldPublish
        ? (publishMessage || (publishMode === "scheduled" ? "Mock scheduled" : "Mock published"))
        : "Draft saved";
      toast.success(publicationMessage);
      startNavigationProgress();
      router.push("/dashboard/mocks"); 
    } catch (err) {
      console.error(err);
      toast.error("Could not save the mock", { description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setIsSaving(false);
    }
  };

  const isMultiSubject = deliveryMode === "subject_combination";
  const visibleQuestions = isMultiSubject && resolvedActiveSubjectCourseId
    ? questions.filter((question) => resolvedActiveSubjectCourseId === UNASSIGNED_SUBJECT_ID ? !question.course_id : question.course_id === resolvedActiveSubjectCourseId)
    : questions;
  const visibleBankQuestions = isMultiSubject && resolvedActiveSubjectCourseId
    ? selectedBankQuestions.filter((question) => question.courseId === resolvedActiveSubjectCourseId)
    : selectedBankQuestions;
  const unassignedQuestionCount = questions.filter((question) => !question.course_id).length;
  const workflowSteps: Array<{ id: BuilderStep; label: string; icon: string }> = [
    { id: "setup", label: "Setup", icon: "edit_note" },
    ...(isMultiSubject ? [{ id: "subjects" as const, label: "Subjects", icon: "library_books" }] : []),
    { id: "questions", label: "Questions", icon: "quiz" },
    { id: "settings", label: "Delivery & settings", icon: "tune" },
    { id: "review", label: "Review", icon: "fact_check" },
  ];
  const draftPreviewQuestions: DraftPreviewQuestion[] = [
    ...questions.map((question) => ({ id: question.id, subject: courses.find((course) => course.id === question.course_id)?.name || question.subject_name || "Questions", text: question.question_text, marks: question.marks, type: question.question_type, contentBlocks: question.content_blocks, options: question.options.map((option) => ({ id: option.id, text: option.option_text, contentBlocks: option.content_blocks })) })),
    ...selectedBankQuestions.map((question) => ({ id: question.questionId, subject: courses.find((course) => course.id === question.courseId)?.name || "Questions", text: question.questionText, marks: question.marks, type: question.questionType, options: question.options })),
  ];

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

      {isReviewOpen && publishReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-[#e4e2e1] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#C26627]">Before you publish</p>
                <h3 className="mt-1 text-2xl font-bold text-[#1b1c1c]">Review this mock</h3>
                <p className="mt-2 text-sm leading-6 text-[#474551]">Check the questions and settings below. Imported content is still editable after this review.</p>
              </div>
              <button type="button" onClick={() => setIsReviewOpen(false)} className="rounded p-1 text-[#787582] hover:bg-[#f5f3f2]" aria-label="Close review">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-[#f8f6ff] p-4"><p className="text-xs text-[#787582]">Questions</p><p className="mt-1 text-lg font-bold text-[#1b1c1c]">{questions.length + selectedBankQuestions.length}</p></div>
              <div className="rounded-lg bg-[#f8f6ff] p-4"><p className="text-xs text-[#787582]">Audience</p><p className="mt-1 text-sm font-bold text-[#1b1c1c]">Centre students</p></div>
              <div className="rounded-lg bg-[#f8f6ff] p-4"><p className="text-xs text-[#787582]">Timing</p><p className="mt-1 text-sm font-bold text-[#1b1c1c]">{isUntimed ? "Untimed" : `${timeLimit} minutes`}</p></div>
            </div>

            {publishReview.errors.length > 0 && (
              <div className="mt-5 rounded-lg border border-[#f0b6b6] bg-[#fff4f2] p-4">
                <p className="font-semibold text-[#ba1a1a]">Fix these before publishing</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-5 text-[#7f1d1d]">{publishReview.errors.map((error) => <li key={error}>{error}</li>)}</ul>
              </div>
            )}
            {publishReview.warnings.length > 0 && (
              <div className="mt-5 rounded-lg border border-[#e8d7a5] bg-[#fffaf0] p-4">
                <p className="font-semibold text-[#7a4b00]">Please check these items</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-5 text-[#7a4b00]">{publishReview.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
              </div>
            )}
            {publishReview.errors.length === 0 && publishReview.warnings.length === 0 && (
              <div className="mt-5 rounded-lg border border-[#b7dec6] bg-[#f2fbf5] p-4 text-sm text-[#166534]">The mock passed the pre-publish checks. You can still edit it after closing this review.</div>
            )}
            <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-[#e4e2e1] pt-5">
              <button type="button" onClick={() => setIsReviewOpen(false)} className="rounded-lg border border-[#c8c5d2] px-4 py-2.5 text-sm font-semibold text-[#474551] hover:bg-[#f8f6ff]">Go back and edit</button>
              <button type="button" disabled={publishReview.errors.length > 0 || isSaving} onClick={() => { setIsReviewOpen(false); void handleSave(true); }} className="rounded-lg bg-[#C26627] px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{publishMode === "scheduled" ? "Confirm schedule" : "Confirm and publish"}</button>
            </div>
          </div>
        </div>
      )}
      {isPreviewOpen && <MockDraftPreview title={title} description={description} questions={draftPreviewQuestions} onClose={() => setIsPreviewOpen(false)} />}

      {/* Page Header */}
      <div className="mb-8 flex flex-col gap-4 border-b border-[#e4e2e1] pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-[32px] font-bold text-[#1b1c1c] leading-tight">{isEditMode ? "Edit Mock" : "Build a Mock"}</h2>
          <p className="text-[16px] text-[#474551] mt-1">Choose how the mock should work, then add or reuse questions for your students.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => setIsPreviewOpen(true)} disabled={draftPreviewQuestions.length === 0} className="inline-flex items-center gap-2 rounded border border-[#c8c5d2] px-4 py-2.5 text-sm font-semibold text-[#2e2877] disabled:cursor-not-allowed disabled:opacity-45"><span className="material-symbols-outlined text-[18px]">preview</span>Preview as student</button>
          <button 
            onClick={() => handleSave(false)}
            disabled={isReadOnly || isSaving}
            className="px-6 py-2.5 border border-[#c8c5d2] text-[#1b1c1c] font-semibold text-sm rounded hover:bg-gray-50 hover:shadow-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? "Saving…" : "Save as Draft"}
          </button>
          <button 
            onClick={requestPublish}
            disabled={isReadOnly || isSaving}
            className="px-6 py-2.5 bg-[#C26627] text-white font-semibold text-sm rounded hover:bg-[#a55621] hover:shadow-md transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-[18px]">publish</span>
            {publishMode === "immediate" ? "Publish Mock" : "Schedule Mock"}
          </button>
        </div>
      </div>

      <nav aria-label="Mock builder steps" className="sticky top-16 z-20 -mx-4 mb-8 border-y border-[#e4e2e1] bg-white/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border sm:px-3">
        <div className="flex gap-2 overflow-x-auto pb-1 sm:grid" style={{ gridTemplateColumns: `repeat(${workflowSteps.length}, minmax(0, 1fr))` }}>
          {workflowSteps.map((step, index) => (
            <button key={step.id} type="button" onClick={() => setBuilderStep(step.id)} aria-current={builderStep === step.id ? "step" : undefined}
              className={`flex min-w-max items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition sm:min-w-0 ${builderStep === step.id ? "bg-[#2e2877] text-white" : "text-[#5f5964] hover:bg-[#f5f3f8]"}`}>
              <span className="flex h-5 w-5 items-center justify-center rounded-full border border-current text-[11px]">{index + 1}</span>
              <span>{step.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {builderStep === "questions" && (
      <div className={isMultiSubject ? "grid items-start gap-6 lg:grid-cols-[240px_minmax(0,1fr)]" : "mx-auto max-w-5xl"}>
        {isMultiSubject && (
          <aside className="lg:sticky lg:top-36">
            <div className="rounded-xl border border-[#e4e2e1] bg-white p-3 shadow-sm">
              <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold text-[#1b1c1c]">Subjects</h3><span className="text-xs text-[#787582]">{programmeCourses.length}</span></div>
              <label className="block lg:hidden"><span className="sr-only">Active subject</span><select value={resolvedActiveSubjectCourseId} onChange={(event) => setActiveSubjectCourseId(event.target.value)} className="w-full rounded-lg border border-[#c8c5d2] bg-white px-3 py-2.5 text-sm">{programmeCourses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}{unassignedQuestionCount > 0 && <option value={UNASSIGNED_SUBJECT_ID}>Needs subject ({unassignedQuestionCount})</option>}</select></label>
              <div className="hidden space-y-1 lg:block">{programmeCourses.map((course) => { const count = questions.filter((question) => question.course_id === course.id).length + selectedBankQuestions.filter((question) => question.courseId === course.id).length; return <button key={course.id} type="button" onClick={() => setActiveSubjectCourseId(course.id)} className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm ${resolvedActiveSubjectCourseId === course.id ? "bg-[#eeeafe] font-semibold text-[#2e2877]" : "text-[#474551] hover:bg-[#f7f5f3]"}`}><span className="truncate">{course.name}</span><span className="ml-2 text-xs">{count}</span></button> })}{unassignedQuestionCount > 0 && <button type="button" onClick={() => setActiveSubjectCourseId(UNASSIGNED_SUBJECT_ID)} className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm ${resolvedActiveSubjectCourseId === UNASSIGNED_SUBJECT_ID ? "bg-[#fff1ed] font-semibold text-[#9b2f20]" : "text-[#9b2f20] hover:bg-[#fff8f5]"}`}><span>Needs subject</span><span className="text-xs">{unassignedQuestionCount}</span></button>}</div>
            </div>
          </aside>
        )}
        <div className="flex min-w-0 flex-col gap-6">
          {isMultiSubject && <div><p className="text-xs font-semibold uppercase tracking-wider text-[#994704]">Active subject</p><h2 className="mt-1 text-2xl font-bold text-[#1b1c1c]">{resolvedActiveSubjectCourseId === UNASSIGNED_SUBJECT_ID ? "Needs subject" : programmeCourses.find((course) => course.id === resolvedActiveSubjectCourseId)?.name || "Choose a subject"}</h2><p className="mt-1 text-sm text-[#716c76]">{resolvedActiveSubjectCourseId === UNASSIGNED_SUBJECT_ID ? "Assign every imported question before publishing." : "Questions added or imported here stay inside this subject section."}</p></div>}
          {documentImportSummary && (
            <div ref={importedQuestionsRef} tabIndex={-1} className="scroll-mt-6 rounded-lg border border-[#b7dec6] bg-[#f2fbf5] p-4 outline-none">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div aria-live="polite">
                  <p className="font-semibold text-[#166534]">AI import complete · {documentImportSummary.questionCount} question{documentImportSummary.questionCount === 1 ? "" : "s"} ready to review</p>
                  <p className="mt-1 text-xs leading-5 text-[#35654a]">{documentImportSummary.pageCount ? `${documentImportSummary.pageCount} pages read. ` : ""}{documentImportSummary.warnings.length ? `${documentImportSummary.warnings.length} item${documentImportSummary.warnings.length === 1 ? " needs" : "s need"} attention.` : "Check the imported questions before publishing."}</p>
                </div>
                <button type="button" onClick={showImportedQuestions} className="shrink-0 rounded border border-[#8fc7a2] bg-white px-3 py-2 text-xs font-semibold text-[#166534] hover:bg-[#edf8f1]">Review questions</button>
              </div>
            </div>
          )}
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
            {visibleBankQuestions.map((question, index) => (
              <div key={question.questionId} className="rounded-lg border border-[#c8c5d2] bg-[#f8f6ff] p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-[#2e2877]">
                      <span className="material-symbols-outlined text-base">inventory_2</span>
                      {question.bankName} · {question.questionType === "mcq" ? "Multiple choice" : "Theory"} · {question.marks} marks{deliveryMode === "subject_combination" ? ` · ${courses.find((course) => course.id === question.courseId)?.name || "No subject"}` : ""}
                    </div>
                    <p className="text-[15px] leading-6 text-[#1b1c1c]">{question.questionText}</p>
                  </div>
                  {!isReadOnly && <button type="button" onClick={() => setSelectedBankQuestions((current) => current.filter((item) => item.questionId !== question.questionId))} className="text-[#787582] hover:text-[#ba1a1a]" aria-label={`Remove bank question ${index + 1}`}>
                    <span className="material-symbols-outlined">close</span>
                  </button>}
                </div>
              </div>
            ))}
            {visibleQuestions.map((q, idx) => (
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
                {isMultiSubject && <label className="mb-4 block text-xs font-semibold text-[#474551]">Subject section<select value={q.course_id || ""} disabled={isReadOnly} onChange={(event) => updateQuestion(q.id, { course_id: event.target.value || null, review_reasons: event.target.value ? (q.review_reasons || []).filter((reason) => !reason.startsWith("Assign imported subject")) : q.review_reasons })} className="mt-1.5 w-full rounded-lg border border-[#c8c5d2] bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-[#2e2877]"><option value="">Needs subject assignment</option>{programmeCourses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}</select></label>}
                {(q.source_page || q.review_reasons?.length) && (
                  <div className="mb-4 rounded-lg border border-[#e8d7a5] bg-[#fffaf0] px-4 py-3 text-xs leading-5 text-[#7a4b00]">
                    {q.source_page && <p className="font-semibold">Imported from PDF page {q.source_page}.</p>}
                    {(q.review_reasons || []).map((reason) => <p key={reason}>Review: {reason}</p>)}
                  </div>
                )}

                <div>
                  <textarea 
                    value={q.question_text}
                    disabled={isReadOnly}
                    onChange={(e) => updateQuestion(q.id, { question_text: e.target.value })}
                    className="w-full bg-white border border-[#c8c5d2] focus:border-[#2e2877] focus:ring-1 focus:ring-[#2e2877] rounded px-4 py-3 text-[15px] text-[#1b1c1c] outline-none transition-all mb-5 min-h-[100px] resize-y disabled:bg-[#f5f3f2]" 
                    placeholder="Enter question text here..."
                  />
                  {q.content_blocks?.length ? (
                    <div className="mb-5 rounded-lg border border-[#d9d3ef] bg-[#faf9ff] p-4">
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#787582]">Formatted content preview</p>
                      {q.content_blocks.map((block, blockIndex) => (block.type === "equation" || block.type === "chemistry") ? (
                        <label key={`${q.id}_block_${blockIndex}`} className="mb-3 block text-xs font-semibold text-[#474551]">
                          {block.type === "equation" ? "Mathematical equation (LaTeX)" : "Chemical formula or reaction (mhchem/LaTeX)"}
                          <textarea
                            disabled={isReadOnly}
                            value={block.latex}
                            onChange={(event) => updateQuestion(q.id, { content_blocks: q.content_blocks?.map((currentBlock, index) => index === blockIndex ? { ...currentBlock, latex: event.target.value } : currentBlock) })}
                            className="mt-1.5 min-h-16 w-full rounded border border-[#c8c5d2] bg-white px-3 py-2 font-mono text-xs font-normal outline-none focus:border-[#2e2877] disabled:bg-[#f5f3f2]"
                          />
                        </label>
                      ) : null)}
                      <QuestionContent plainText={null} blocks={q.content_blocks} />
                    </div>
                  ) : null}

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
                          {opt.content_blocks?.length ? <QuestionContent plainText={null} blocks={opt.content_blocks} /> : null}
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
              <div className="order-2 mt-2 border-t border-[#e4e2e1] pt-6">
                <h3 className="text-[16px] font-semibold text-[#1b1c1c]">Other ways to add questions</h3>
                <p className="mt-1 text-sm text-[#474551]">Import a prepared set or reuse questions you have already created.</p>
              </div>

              <div className="order-2">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[16px] font-semibold text-[#1b1c1c]">Import a prepared set</h3>
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
                  <input type="file" accept=".pdf,.csv,.docx,application/pdf" className="hidden" onChange={handleFileInput} />
                  
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
                      <span className="text-[13px] font-normal text-[#474551]">PDF, CSV or Word (.docx) file</span>
                      <span className="mt-2 max-w-lg text-center text-[12px] leading-5 text-[#787582]">
                        PDFs and Word files are read with AI and returned as an editable draft. Review every imported question before publishing. CSV remains available for spreadsheet imports.
                      </span>
                    </>
                  )}
                </label>
                {documentImportSummary && (
                  <div className="mt-3 rounded-lg border border-[#d9d3ef] bg-[#faf9ff] p-3 text-xs leading-5 text-[#474551]">
                    <p className="font-semibold text-[#2e2877]">Document draft imported{documentImportSummary.pageCount ? ` · ${documentImportSummary.pageCount} pages` : ""}</p>
                    <p className="mt-1">{documentImportSummary.questionCount} question{documentImportSummary.questionCount === 1 ? "" : "s"} added above. {documentImportSummary.warnings.length ? `${documentImportSummary.warnings.length} item${documentImportSummary.warnings.length === 1 ? "" : "s"} need attention.` : "No provider warnings were returned."}</p>
                  </div>
                )}
              </div>

              <div className="order-2 flex items-center justify-center py-6">
                <div className="h-px bg-[#e4e2e1] w-full"></div>
                <span className="px-4 text-[#787582] text-[13px] font-medium bg-white">OR</span>
                <div className="h-px bg-[#e4e2e1] w-full"></div>
              </div>

              <div className="order-2 rounded-lg border border-[#c8c5d2] bg-white p-5">
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
                              <input type="checkbox" checked={selected} onChange={() => setSelectedBankQuestions((current) => {
                                if (selected) return current.filter((item) => item.questionId !== question.id);
                                const targetCourseId = deliveryMode === "subject_combination" ? resolvedActiveSubjectCourseId : question.course_id || null;
                                if (deliveryMode === "subject_combination" && (!targetCourseId || targetCourseId === UNASSIGNED_SUBJECT_ID)) {
                                  toast.error("Open a subject section before adding bank questions");
                                  return current;
                                }
                                return [...current, { questionId: question.id, questionVersionId: question.current_version.id, questionText: question.current_version.plain_text, questionType: question.question_type, marks: question.current_version.marks, bankName, courseId: targetCourseId, options: (question.current_version.options || []).map((option) => ({ id: option.id, text: option.plain_text, contentBlocks: option.content_blocks || [] })) }];
                              })} className="mt-1" />
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
              <div className="order-1 flex items-center gap-6 p-6 border-2 border-dashed border-[#c8c5d2] rounded-lg bg-[#fbf9f8] justify-center mt-2">
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
      </div>
      )}

      {builderStep === "subjects" && isMultiSubject && (
        <section className="mx-auto max-w-4xl">
          <div className="rounded-2xl border border-[#e4e2e1] bg-white p-5 shadow-sm sm:p-7">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-wider text-[#994704]">Multi-subject structure</p><h2 className="mt-1 text-2xl font-bold text-[#1b1c1c]">Subject sections</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[#716c76]">These subjects come from the selected programme. Open any subject to add or import its questions separately.</p></div><button type="button" onClick={() => setBuilderStep("setup")} className="text-sm font-semibold text-[#2e2877]">Change programme</button></div>
            {!programmeId ? <div className="mt-6 rounded-xl border border-dashed border-[#c8c5d2] p-8 text-center"><p className="font-semibold">Choose a programme first</p><p className="mt-1 text-sm text-[#716c76]">The programme determines which subject sections are available.</p><button type="button" onClick={() => setBuilderStep("setup")} className="mt-4 rounded-lg bg-[#2e2877] px-4 py-2.5 text-sm font-semibold text-white">Go to setup</button></div>
              : programmeCourses.length === 0 ? <div className="mt-6 rounded-xl border border-[#efd0b8] bg-[#fff8f1] p-5 text-sm text-[#7a431d]">This programme has no subjects yet. Add subjects to the programme before building its mock.</div>
              : <div className="mt-6 grid gap-3 sm:grid-cols-2">{programmeCourses.map((course, index) => { const authoredCount = questions.filter((question) => question.course_id === course.id).length; const bankCount = selectedBankQuestions.filter((question) => question.courseId === course.id).length; return <button key={course.id} type="button" onClick={() => { setActiveSubjectCourseId(course.id); setBuilderStep("questions"); }} className="group rounded-xl border border-[#ded8d3] p-4 text-left hover:border-[#2e2877] hover:bg-[#faf9ff]"><span className="flex items-start justify-between gap-3"><span><span className="text-xs font-semibold text-[#994704]">Subject {index + 1}</span><strong className="mt-1 block text-base text-[#1b1c1c]">{course.name}</strong></span><span className="rounded-full bg-[#f0edff] px-2.5 py-1 text-xs font-semibold text-[#2e2877]">{authoredCount + bankCount} questions</span></span><span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#2e2877]">Open question builder <span className="material-symbols-outlined text-base">arrow_forward</span></span></button> })}</div>}
          </div>
        </section>
      )}

      {builderStep === "review" && (
        <section className="mx-auto max-w-4xl space-y-5">
          <div className="rounded-2xl border border-[#e4e2e1] bg-white p-5 shadow-sm sm:p-7"><p className="text-xs font-semibold uppercase tracking-wider text-[#994704]">Final check</p><h2 className="mt-1 text-2xl font-bold text-[#1b1c1c]">Review and publish</h2><div className="mt-6 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-[#f8f6ff] p-4"><p className="text-xs text-[#716c76]">Format</p><p className="mt-1 font-semibold">{isMultiSubject ? "Multi-subject / JAMB" : "Single subject"}</p></div><div className="rounded-xl bg-[#f8f6ff] p-4"><p className="text-xs text-[#716c76]">Questions</p><p className="mt-1 font-semibold">{questions.length + selectedBankQuestions.length}</p></div><div className="rounded-xl bg-[#f8f6ff] p-4"><p className="text-xs text-[#716c76]">Time</p><p className="mt-1 font-semibold">{isUntimed ? "Untimed" : `${timeLimit} minutes`}</p></div></div>
            {isMultiSubject && <div className="mt-6"><h3 className="text-sm font-semibold">Subject readiness</h3><div className="mt-3 divide-y divide-[#eeeae6] rounded-xl border border-[#e4e2e1]">{programmeCourses.map((course) => { const count = questions.filter((question) => question.course_id === course.id).length + selectedBankQuestions.filter((question) => question.courseId === course.id).length; return <button key={course.id} type="button" onClick={() => { setActiveSubjectCourseId(course.id); setBuilderStep("questions"); }} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm hover:bg-[#faf9ff]"><span className="font-medium">{course.name}</span><span className={count ? "text-[#267045]" : "text-[#a43522]"}>{count ? `${count} questions` : "No questions"}</span></button> })}</div></div>}
            <div className="mt-6 flex flex-col gap-3 rounded-xl border border-[#d9d3ef] bg-[#faf9ff] p-4 text-sm text-[#474551] sm:flex-row sm:items-center sm:justify-between"><span><strong className="block text-[#2e2877]">Check the student experience</strong>Preview subject switching, question navigation, and mobile layout without creating an attempt or result.</span><button type="button" onClick={() => setIsPreviewOpen(true)} disabled={draftPreviewQuestions.length === 0} className="shrink-0 rounded-lg border border-[#2e2877] bg-white px-4 py-2.5 font-semibold text-[#2e2877] disabled:opacity-45">Preview as student</button></div>
            <div className="mt-6 flex flex-col-reverse gap-3 border-t border-[#eeeae6] pt-5 sm:flex-row sm:justify-end"><button type="button" onClick={() => setBuilderStep("questions")} className="rounded-lg border border-[#c8c5d2] px-4 py-2.5 text-sm font-semibold">Continue editing</button><button type="button" disabled={isReadOnly || isSaving} onClick={requestPublish} className="rounded-lg bg-[#994704] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{publishMode === "scheduled" ? "Review schedule" : "Review and publish"}</button></div>
          </div>
        </section>
      )}

        {(builderStep === "setup" || builderStep === "settings") && <div className="mx-auto max-w-3xl">
          <div className="bg-white border border-[#e4e2e1] rounded-lg p-7 shadow-sm">
            <h3 className="text-[18px] font-semibold text-[#1b1c1c] mb-6 flex items-center gap-3 border-b border-[#e4e2e1] pb-4">
              <span className="material-symbols-outlined text-[#2e2877]">tune</span>
              {builderStep === "setup" ? "Mock setup" : "Delivery & settings"}
            </h3>
            
            <div className="space-y-6">
              {builderStep === "setup" && <>
              <section>
                <p className="text-sm font-semibold text-[#1b1c1c]">What are you building?</p>
                <p className="mt-1 text-xs leading-5 text-[#787582]">Choose the structure first. It determines how questions are organised for you and for students.</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <button type="button" disabled={isReadOnly} onClick={() => setDeliveryMode("fixed")} className={`rounded-xl border p-4 text-left transition ${deliveryMode === "fixed" ? "border-[#2e2877] bg-[#f4f1ff] ring-1 ring-[#2e2877]" : "border-[#d8d2cd] hover:border-[#9d96a3]"}`}>
                    <span className="material-symbols-outlined text-2xl text-[#2e2877]">description</span><strong className="mt-2 block text-sm text-[#1b1c1c]">Single-subject mock</strong><span className="mt-1 block text-xs leading-5 text-[#716c76]">One continuous question set for a class or subject.</span>
                  </button>
                  {isAdmin && <button type="button" disabled={isReadOnly} onClick={() => { setDeliveryMode("subject_combination"); setDistributionMode("centre"); setAudienceScope("programme"); }} className={`rounded-xl border p-4 text-left transition ${deliveryMode === "subject_combination" ? "border-[#994704] bg-[#fff7ef] ring-1 ring-[#994704]" : "border-[#d8d2cd] hover:border-[#9d96a3]"}`}>
                    <span className="material-symbols-outlined text-2xl text-[#994704]">view_column</span><strong className="mt-2 block text-sm text-[#1b1c1c]">Multi-subject / JAMB mock</strong><span className="mt-1 block text-xs leading-5 text-[#716c76]">Separate subject sections with their own questions and progress.</span>
                  </button>}
                </div>
              </section>
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

              <div className="rounded-lg border border-[#e4e2e1] bg-[#fbf9f8] p-4">
                <p className="text-[13px] font-semibold text-[#1b1c1c]">Who is this mock for?</p>
                <p className="mt-1 text-xs leading-5 text-[#787582]">This controls access for enrolled centre students. After publishing, use Share & sell to create a separate direct link for anyone else.</p>
              </div>

              <div className="rounded-lg border border-[#e4e2e1] bg-[#fbf9f8] p-4">
                  <p className="text-[13px] font-semibold text-[#1b1c1c]">Centre audience</p>
                  <p className="mt-1 text-xs leading-5 text-[#787582]">Choose exactly who should receive this mock. Tutors can only create mocks for a subject they teach.</p>
                  <div className="mt-3 space-y-2">
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-[#474551]"><input type="radio" checked={audienceScope === "course"} disabled={isReadOnly} onChange={() => changeAudienceScope("course")} className="text-[#2e2877]" />One subject</label>
                    {isAdmin && <><label className="flex cursor-pointer items-center gap-2 text-sm text-[#474551]"><input type="radio" checked={audienceScope === "programme"} disabled={isReadOnly} onChange={() => changeAudienceScope("programme")} className="text-[#2e2877]" />One programme</label><label className="flex cursor-pointer items-center gap-2 text-sm text-[#474551]"><input type="radio" checked={audienceScope === "school"} disabled={isReadOnly} onChange={() => changeAudienceScope("school")} className="text-[#2e2877]" />Every active student in this centre</label></>}
                  </div>
              </div>

              {audienceScope === "course" && <div>
                <label className="block text-[13px] text-[#474551] mb-1.5 font-medium">Programme subject</label>
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
                  <option value="">Select a programme subject</option>
                  {courses.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                {courses.length === 0 && (
                  <p className="mt-2 text-xs leading-5 text-[#994704]">No Subjects are available. Ask the centre admin to create a Subject or assign one to you.</p>
                )}
              </div>}

              {audienceScope === "programme" && <div>
                <label className="block text-[13px] text-[#474551] mb-1.5 font-medium">Programme</label>
                <select value={programmeId} disabled={isReadOnly} onChange={(e) => setProgrammeId(e.target.value)} className="w-full rounded border border-[#c8c5d2] bg-white px-3.5 py-2.5 text-[15px] text-[#1b1c1c] outline-none focus:border-[#2e2877] disabled:bg-[#f5f3f2]">
                  <option value="">Select a programme</option>
                  {programmes.map((programme) => <option key={programme.id} value={programme.id}>{programme.name}</option>)}
                </select>
              </div>}

              {deliveryMode === "subject_combination" && <div className="rounded-lg border border-[#d9d3ef] bg-[#faf9ff] p-4 text-sm leading-6 text-[#474551]"><strong className="block text-[#2e2877]">Multi-subject structure selected</strong>Choose the programme above, then use the Subjects step to review its sections before adding questions.</div>}
              </>}

              {builderStep === "settings" && <>

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
              </>}
            </div>
          </div>
        </div>}
    </div>
  );
}
