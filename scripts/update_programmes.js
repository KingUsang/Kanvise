const fs = require('fs');

const path = '/home/kingusang/Kanvise/web/src/components/dashboard/programmes/programmes-client.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add new state variables
content = content.replace(
  "const [entityType, setEntityType] = useState<'programme' | 'sub_programme' | 'course'>('programme')",
  "const [entityType, setEntityType] = useState<'programme' | 'sub_programme' | 'course'>('programme')\n  const [editingId, setEditingId] = useState<string | null>(null)\n  const [isUploading, setIsUploading] = useState(false)\n  const [schoolSlug, setSchoolSlug] = useState('')"
);

// 2. Add thumbnail_url to formData
content = content.replace(
  "tutor_id: ''",
  "tutor_id: '',\n    thumbnail_url: ''"
);

// 3. Update handleSave method (POST -> POST or PATCH)
content = content.replace(
  "let payload: any = {\n        name: formData.name,",
  "let payload: any = {\n        name: formData.name,\n        thumbnail_url: formData.thumbnail_url,"
);

content = content.replace(
  "const res = await fetch(endpoint, {\n        method: 'POST',",
  "const url = editingId ? `${endpoint}/${editingId}` : endpoint\n      const method = editingId ? 'PATCH' : 'POST'\n      const res = await fetch(url, {\n        method: method,"
);

// 4. Update the reset state in handleSave
content = content.replace(
  "assign_tutor: false, tutor_id: '' \n      })",
  "assign_tutor: false, tutor_id: '', thumbnail_url: '' \n      })\n      setEditingId(null)"
);

// Fetch schoolSlug in fetchData
content = content.replace(
  "fetch(`${baseUrl}/courses`, { headers }),\n        fetch(`${baseUrl}/users?roles=admin,tutor`, { headers })",
  "fetch(`${baseUrl}/courses`, { headers }),\n        fetch(`${baseUrl}/users?roles=admin,tutor`, { headers }),\n        fetch(`${baseUrl}/schools/mine`, { headers })"
);
content = content.replace(
  "const { data: tutorsData } = await tutorsRes.json()",
  "const { data: tutorsData } = await tutorsRes.json()\n      const schoolRes = await arguments[0][4].json()\n      setSchoolSlug(schoolRes.data.slug)"
);
// Wait, arguments[0][4] is wrong because Promise.all returns an array of responses. Let's fix that safely.
// Let's replace the whole Promise.all block.
content = content.replace(
  /const \[progRes, subProgRes, coursesRes, tutorsRes\] = await Promise\.all\(\[[\s\S]*?\]\)/,
  `const [progRes, subProgRes, coursesRes, tutorsRes, schoolRes] = await Promise.all([
        fetch(\`\${baseUrl}/programmes\`, { headers }),
        fetch(\`\${baseUrl}/sub-programmes\`, { headers }),
        fetch(\`\${baseUrl}/courses\`, { headers }),
        fetch(\`\${baseUrl}/users?roles=admin,tutor\`, { headers }),
        fetch(\`\${baseUrl}/schools/mine\`, { headers })
      ])`
);

content = content.replace(
  "const { data: tutorsData } = await tutorsRes.json()",
  "const { data: tutorsData } = await tutorsRes.json()\n      const { data: schoolData } = await schoolRes.json()\n      setSchoolSlug(schoolData.slug)"
);


// 5. Add openEdit / openNew helpers just before `const toggleNode`
const helpers = `
  const openNew = (type: 'programme' | 'sub_programme' | 'course') => {
    setEditingId(null)
    setEntityType(type)
    setFormData({
      name: '', slug: '', description: '', price: '', is_published: true, 
      programme_id: '', sub_programme_id: '', course_placement: 'standalone', 
      assign_tutor: false, tutor_id: '', thumbnail_url: ''
    })
    setIsModalOpen(true)
  }

  const openEdit = (entity: any, type: 'programme' | 'sub_programme' | 'course') => {
    setEditingId(entity.id)
    setEntityType(type)
    setFormData({
      name: entity.name,
      slug: entity.slug,
      description: entity.description || '',
      price: entity.price || '',
      is_published: entity.is_published,
      programme_id: entity.programme_id || '',
      sub_programme_id: entity.sub_programme_id || '',
      course_placement: entity.programme_id ? 'programme' : entity.sub_programme_id ? 'sub_programme' : 'standalone',
      assign_tutor: false,
      tutor_id: '',
      thumbnail_url: entity.thumbnail_url || ''
    })
    setIsModalOpen(true)
  }

  const copyLink = (path: string) => {
    const fullUrl = \`\${window.location.origin}\${path}\`
    navigator.clipboard.writeText(fullUrl)
    alert("Copied public link: " + fullUrl)
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsUploading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const fileExt = file.name.split('.').pop()
      const fileName = \`\${Math.random()}.\${fileExt}\`
      const filePath = \`thumbnails/\${fileName}\`
      
      const { error } = await supabase.storage.from('kanvise-media').upload(filePath, file)
      if (error) throw error
      
      const { data: { publicUrl } } = supabase.storage.from('kanvise-media').getPublicUrl(filePath)
      setFormData(p => ({ ...p, thumbnail_url: publicUrl }))
    } catch (err) {
      console.error(err)
      alert("Upload failed")
    } finally {
      setIsUploading(false)
    }
  }
`;
content = content.replace("const toggleNode = (nodeId: string) => {", helpers + "\n  const toggleNode = (nodeId: string) => {");

// 6. Update New buttons to use openNew
content = content.replace(
  "onClick={() => { setEntityType('course'); setIsModalOpen(true); }}",
  "onClick={() => openNew('course')}"
);
content = content.replace(
  "onClick={() => setIsModalOpen(true)}",
  "onClick={() => openNew('programme')}"
);

// Add Storefront button
content = content.replace(
  "New Course\n            </button>",
  "New Course\n            </button>\n            {schoolSlug && (\n              <button onClick={() => window.open(`/${schoolSlug}`, '_blank')} className=\"bg-[#fbf9f8] border border-[#c8c5d2] text-[#474551] hover:bg-[#e4e2e1] transition-colors px-6 py-2.5 rounded text-sm font-semibold flex items-center gap-2\">\n                <span className=\"material-symbols-outlined text-[18px]\">storefront</span>\n                Storefront\n              </button>\n            )}"
);

// 7. Update course edit button
content = content.replace(
  '<button className="p-1 text-[#474551] hover:text-[#2e2877] rounded">\n            <span className="material-symbols-outlined text-[18px]">edit</span>\n          </button>',
  `{course.is_published && (
            <button onClick={() => copyLink(\`/\${schoolSlug}/course/\${course.slug}\`)} className="p-1 text-[#474551] hover:text-[#2e2877] rounded" title="Copy Public Link">
              <span className="material-symbols-outlined text-[18px]">link</span>
            </button>
          )}
          <button onClick={() => openEdit(course, "course")} className="p-1 text-[#474551] hover:text-[#2e2877] rounded">
            <span className="material-symbols-outlined text-[18px]">edit</span>
          </button>`
);

// 8. Update programme edit button
content = content.replace(
  '<button className="p-1 text-[#474551] hover:text-[#2e2877] rounded">\n                                <span className="material-symbols-outlined text-[18px]">edit</span>\n                              </button>',
  `{prog.is_published && (
                                <button onClick={() => copyLink(\`/\${schoolSlug}/\${prog.slug}\`)} className="p-1 text-[#474551] hover:text-[#2e2877] rounded" title="Copy Public Link">
                                  <span className="material-symbols-outlined text-[18px]">link</span>
                                </button>
                              )}
                              <button onClick={() => openEdit(prog, "programme")} className="p-1 text-[#474551] hover:text-[#2e2877] rounded">
                                <span className="material-symbols-outlined text-[18px]">edit</span>
                              </button>`
);

// 9. Update sub-programme edit button
content = content.replace(
  '<button className="p-1 text-[#474551] hover:text-[#2e2877] rounded">\n                                          <span className="material-symbols-outlined text-[18px]">edit</span>\n                                        </button>',
  '<button onClick={() => openEdit(sp, "sub_programme")} className="p-1 text-[#474551] hover:text-[#2e2877] rounded">\n                                          <span className="material-symbols-outlined text-[18px]">edit</span>\n                                        </button>'
);

// 10. Fix modal title
content = content.replace(
  '<h2 className="text-lg font-bold text-[#2e2877]">Create New Programme</h2>',
  '<h2 className="text-lg font-bold text-[#2e2877]">{editingId ? "Edit" : "Create"} {entityType === "programme" ? "Programme" : entityType === "course" ? "Course" : "Sub-Programme"}</h2>'
);

// 11. Add thumbnail file input and preview
const thumbnailHtml = `
                    <div className="border-2 border-dashed border-[#c8c5d2] rounded p-6 flex flex-col items-center justify-center bg-white hover:bg-[#f5f3f2] transition-colors relative">
                      {formData.thumbnail_url ? (
                        <img src={formData.thumbnail_url} alt="Thumbnail" className="h-32 object-contain" />
                      ) : (
                        <>
                          <div className="h-12 w-12 rounded-full bg-[#f0eded] flex items-center justify-center mb-2 text-[#474551]">
                            <span className="material-symbols-outlined">{isUploading ? 'hourglass_empty' : 'cloud_upload'}</span>
                          </div>
                          <span className="text-sm font-semibold text-[#1b1c1c]">{isUploading ? 'Uploading...' : 'Click to upload'}</span>
                          <span className="text-xs font-normal text-[#474551] mt-1">SVG, PNG, JPG (max. 2MB)</span>
                        </>
                      )}
                      <input type="file" onChange={handleUpload} className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" disabled={isUploading} />
                    </div>
`;

content = content.replace(
  /<div className="border-2 border-dashed border-\[#c8c5d2\] rounded p-6 flex flex-col items-center justify-center bg-white hover:bg-\[#f5f3f2\] transition-colors cursor-pointer group">[\s\S]*?<\/div>/,
  thumbnailHtml
);

fs.writeFileSync(path, content, 'utf8');
console.log('Successfully updated programmes client.');
