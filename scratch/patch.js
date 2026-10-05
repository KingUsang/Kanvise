const fs = require('fs');
const file = 'web/src/components/dashboard/mocks/mock-builder-client.tsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Add upload state
code = code.replace(
  'const [questions, setQuestions] = useState<QuestionState[]>([]);',
  'const [uploadingImageQuestionId, setUploadingImageQuestionId] = useState<string | null>(null);\n  const [questions, setQuestions] = useState<QuestionState[]>([]);'
);

// 2. Modify handleSave
code = code.replace(
  'const handleSave = async (shouldPublish: boolean) => {',
  'const handleSave = async (shouldPublish: boolean, navigateOnSuccess: boolean = true) => {'
);
code = code.replace(
  'toast.success(publicationMessage);\n      await queryClient.invalidateQueries({ queryKey: ["mocks"] });\n      startNavigationProgress();\n      router.push("/dashboard/mocks");\n    } catch (err) {',
  'if (navigateOnSuccess) {\n        toast.success(publicationMessage);\n        await queryClient.invalidateQueries({ queryKey: ["mocks"] });\n        startNavigationProgress();\n        router.push("/dashboard/mocks");\n      } else {\n        if (!isEditMode && mockId) {\n          window.history.replaceState(null, "", `/dashboard/mocks/${mockId}/edit`);\n        }\n        return mockId;\n      }\n    } catch (err) {'
);

fs.writeFileSync(file, code);
