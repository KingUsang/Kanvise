const fs = require('fs');
const file = 'web/src/components/dashboard/mocks/mock-builder-client.tsx';
let code = fs.readFileSync(file, 'utf8');

// Add upload helper before "const addQuestion"
const uploadHelper = `
  const handleImageUpload = async (questionId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = "";
    
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image too large. Maximum size is 5MB.");
      return;
    }
    
    setUploadingImageQuestionId(questionId);
    try {
      let currentMockId = editMockId;
      if (!currentMockId) {
        toast("Saving draft to enable image uploads...");
        currentMockId = await handleSave(false, false);
        if (!currentMockId) throw new Error("Failed to save draft");
      }
      
      // Get bankId
      const mockRes = await fetch(\`\${process.env.NEXT_PUBLIC_API_URL}/mocks/\${currentMockId}\`, {
        headers: { "Authorization": \`Bearer \${token}\` }
      });
      const mockData = (await mockRes.json()).data;
      const bankId = mockData?.bank?.[0]?.id || mockData?.bank?.id;
      
      if (!bankId) throw new Error("Question bank not ready. Please manually save draft first.");
      
      const presignRes = await fetch(\`\${process.env.NEXT_PUBLIC_API_URL}/storage/presign/upload\`, {
        method: "POST",
        headers: { "Authorization": \`Bearer \${token}\`, "Content-Type": "application/json" },
        body: JSON.stringify({
          entity_type: "question_media",
          bank_id: bankId,
          file_name: file.name,
          content_type: file.type,
          file_size_bytes: file.size
        })
      });
      const presignData = await presignRes.json();
      if (!presignRes.ok) throw new Error(presignData.error || "Could not start upload");
      
      const { upload_url, file_key } = presignData.data;
      
      const request = new XMLHttpRequest();
      request.open('PUT', upload_url);
      request.setRequestHeader('Content-Type', file.type);
      await new Promise<void>((resolve, reject) => {
        request.addEventListener('load', () => request.status >= 200 && request.status < 300 ? resolve() : reject(new Error('Upload failed')));
        request.addEventListener('error', () => reject(new Error('Network error')));
        request.send(file);
      });
      
      const confirmRes = await fetch(\`\${process.env.NEXT_PUBLIC_API_URL}/question-banks/media/confirm\`, {
        method: "POST",
        headers: { "Authorization": \`Bearer \${token}\`, "Content-Type": "application/json" },
        body: JSON.stringify({
          bank_id: bankId,
          file_key,
          file_name: file.name,
          content_type: file.type,
          file_size_bytes: file.size,
          alt_text: file.name,
          width: 800,
          height: 600
        })
      });
      const confirmData = await confirmRes.json();
      if (!confirmRes.ok) throw new Error(confirmData.error || "Failed to confirm upload");
      
      const registeredImage = confirmData.data;
      
      setQuestions(current => current.map(q => {
        if (q.id === questionId) {
          const blocks = [...(q.content_blocks || [])];
          blocks.push({
            type: 'image',
            media_id: registeredImage.id,
            url: registeredImage.id, // url might not resolve instantly without download url, but frontend components usually handle media_id
            alt_text: registeredImage.alt_text
          });
          return { ...q, content_blocks: blocks };
        }
        return q;
      }));
      toast.success("Image added to question");
      
    } catch (err: any) {
      toast.error(err.message || "Could not upload image");
    } finally {
      setUploadingImageQuestionId(null);
    }
  };

`;

code = code.replace(
  'const addQuestion = (subjectId?: string) => {',
  uploadHelper + 'const addQuestion = (subjectId?: string) => {'
);

// Add the button right after the textarea in the questions map
const buttonUI = `
                  <div className="flex gap-3 mb-5">
                    <label className="flex items-center gap-2 text-sm font-semibold text-[#2e2877] cursor-pointer hover:underline disabled:opacity-50">
                      <span className="material-symbols-outlined text-[18px]">add_photo_alternate</span>
                      {uploadingImageQuestionId === q.id ? "Uploading..." : "Add Image"}
                      <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={isReadOnly || uploadingImageQuestionId === q.id} onChange={(e) => handleImageUpload(q.id, e)} />
                    </label>
                  </div>
`;
code = code.replace(
  'placeholder="Enter question text here..."\n                  />',
  'placeholder="Enter question text here..."\n                  />\n' + buttonUI
);

fs.writeFileSync(file, code);
