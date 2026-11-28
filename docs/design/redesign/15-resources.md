# 15 · Resources

Status: draft for owner review. Builds on `00-decisions.md` (§14e, §18, §19),
`04`, `07`, `09`, `10`. Replaces today's Notes / Materials and the separate
slides feature.

**Who:** tutors and agency admins manage files; students open the ones shared
with them.
**Goal:** keep teaching files in one library, attach them where they're needed
(a course, a homework, a lesson), and present them in the classroom.

## Flow at a glance

```
/resources (RS-01 library)
  → Upload files (RS-02) · New folder (RS-03)
  → Attach to a course (RS-04) · to homework (spec 10) · to a lesson (RS-05)
  → Present in the classroom (spec 07, Lesson tools › Materials)
Student app › course › Resources (spec 09)
```

---

## Upload limits

The one table of upload limits. Specs 07, 09 and 10 point here instead of
stating their own numbers.

| What | Limit | Where it applies | When it's over the limit |
|---|---|---|---|
| File types | PDF, Word (.doc, .docx), PowerPoint (.ppt, .pptx), images (PNG, JPG). The type is checked from the file's contents, not only its name | Library, homework files, hand-ins, lesson files | **Kanvise can't use .exe files. Upload a PDF, Word, PowerPoint or image file.** (the file's own type named) |
| Library and homework files | 20 MB per file; up to 10 files per homework | RS-02, 10 HW-01 | **That file is too big. The limit is 20 MB.** |
| Whiteboard (Present) | 10 MB per file, PDF and images only (PlugNMeet's limit today, 00 section 19) | 07 CR-03 Materials, RS-05 | **Present** is not shown. In Lesson tools: **This file is over 10 MB. Compress it first for students on mobile data.** |
| PowerPoint and Word on the whiteboard | Not presented; they open or download | 07 CR-03, RS-05 | Beside the file: **To present slides, save them as a PDF first (in PowerPoint: File › Save As › PDF).** |
| Homework hand-ins | Up to 10 files per hand-in, 20 MB each; photos are resized on the phone before upload (longest side 2,000 px); typed answers up to 10,000 characters | 10 HW-04, 09 SA-06 | **That file is too big. The limit is 20 MB.** |
| Video | Not accepted in this version | Everywhere | **Kanvise can't store videos yet. Put a link in the instructions instead.** |
| Storage | 5 GB per account (00 section 19). Recordings don't count; they follow 12 CFG-L **Keep recordings for** | Every upload by the account's tutors and admins | At 80%: a banner on Resources **You've used 4.1 GB of 5 GB.** Full: **Your account's storage is full. Delete files you no longer need to upload more.** |
| Uploads per day | 200 per account per day, counting tutors' and admins' uploads. Each student has their own 50 hand-in files a day, so a busy tutor never blocks a student | Every upload | **You've uploaded a lot today. Try again tomorrow.** |
| CSV student import | 2 MB and 500 rows | 06 STU-03 import | As stated in 06 |
| Virus scan | **None for now.** A known gap, recorded as a deferral of ledger INT-006 (00 section 18) | Everywhere | Nothing is shown. Files are only ever downloaded or shown in the viewer, never run, and the type check above blocks programs |

## RS-01 · Library

Checked against `10-resources/screenshots/page--default.png`,
`folder-created--library.png`, `resources-filter-type.png` and
`resources-filter-visibility.png`.

**Header:** **Resources** · "Your file library. Upload worksheets and images,
put them in folders, and attach them to courses." · secondary **New folder**,
primary **Upload files**.

**FOLDERS:** folder cards (name, file count, chevron), then a dashed **+ New
folder** card.

**FILES:** search **Search files…**, a **Show files in folders** checkbox (off:
only files outside folders; on: every file with its folder), and **Filter**
(Type: **PDFs**, **Documents** (Word and PowerPoint), **Images**; Visibility, agencies only: **Shared with
the team** · **Not shared**; Shared with: a course; Uploaded from / to).

**Files table:** Name (with type icon), Folder, Shared with (course swatches),
Size, Uploaded. Each row's **⋯**: **Open**, **Attach to a course**, **Move to
folder**, **Rename**, **Download**, **Delete**.

Agency tutors see their own files and the team's shared files (read-only);
admins see everything in the agency.

**Empty:** folder icon, **No files yet.** "Upload worksheets, past papers and
images to build your library. Files here can be attached to courses and used
in lessons." **Upload files**.
**Empty with folders:** **No files outside folders.** "Everything is filed in a
folder. Show the files inside them here, or open a folder." **Show files in
folders**.

## RS-02 · Upload files

Checked against `10-resources/screenshots/upload-files--dialog.png`,
`upload-files--selected.png`, `upload-files--completed.png` and
`15-tutor-role/screenshots/tutor-resource-upload.png`.

A dialog. Title **Upload files**.
- A dashed drop area: **Click to choose files or drag them here** ·
  **PNG, JPG, PDF, Word or PowerPoint · up to 20 MB each**.
- **Add to folder** dropdown (**No folder** by default).
- After choosing: **+ Add more files** replaces the drop area, and each file
  is a row with **Rename** and **Remove**. Files over a limit show the reason
  from the Upload limits table on their row and are left out.
- **Share with the team** (agency admins only, ticked by default as in Bobbin):
  **Every tutor in your agency can see these files and use them in their
  lessons.** Agency tutors and independent tutors don't see this.
- **Attach to a course (optional)**, shown filled in and locked when opened
  from a course's Resources tab.
- Buttons **Cancel** · **Upload 3 files** (disabled until a file is chosen).
- While uploading, each row shows a progress bar, then a tick. A failed row
  shows **Couldn't upload. Try again.** with a retry; the others carry on.
- Done: toast **3 files uploaded.**

## RS-03 · New folder

Checked against `10-resources/screenshots/new-folder--filled.png`.

Dialog: **Name** (required) and, for agency admins, **Share with the team**
(unticked for a folder, as in Bobbin): **Every tutor in your agency can see
this folder.** **Cancel** · **Create folder**. Toast: **Folder created.**

## RS-04 · Attaching to a course

Checked against `15-tutor-role/screenshots/tutor-course-add-resources.png`.

- The course's **Resources** tab has **Add resources ▾**: **Upload files** ·
  **Attach from library** · **Attach a folder** (Bobbin's three choices).
- From the library: a file's **⋯ › Attach to a course**.
- Line in the dialogs: **Students on this course can open and download these.**
- Attaching a folder attaches everything in it, including files added later.
- **Remove from course** on the course's Resources tab removes it from the
  course only; the file stays in the library.
- Empty tab: **No resources attached.** "Attach files and folders from your
  library, or upload new ones, to use them in this course's lessons and share
  them with its students." **Upload files**.

## RS-05 · Files for a lesson

- On the lesson page (planned), a **Materials** card: **+ Add files** (upload or
  from the library). Line: **You'll see these in Lesson tools, ready to present.**
- In the classroom, Lesson tools › **Materials** (07 CR-03) lists the lesson's
  files plus the course's files. **Present** (puts the file on the PlugNMeet
  whiteboard) is shown only for PDFs and images within the whiteboard limit.
  Every other file has **Open**, and PowerPoint files carry the save-as-PDF
  line from the Upload limits table.
- After the lesson, files presented or attached show to students under **Files
  from this lesson** (spec 09, SA-05).

## RS-06 · Deleting

**Delete this file?**
- "It will be removed from 2 courses and 1 homework. Students won't be able to
  open it any more."
- **Cancel** · **Delete** (red).
- Deleted files go to **Recently deleted** for 30 days (a link at the bottom of
  the library), with **Restore**. They still count towards storage until then.

## Student view

See spec 09: course › **Resources** (by folder, **Open**, **Download**), homework
files, and **Files from this lesson**.

### Kavi

No Kavi feature in Resources in this version. Kavi does not read, tag or
summarise library files.
- Input: none.
- Output: none.
- Failure state: none.
- What the tutor must confirm: nothing.
- Without Kavi: Resources works as written; this spec has no Kavi path to
  replace.

## Permissions

| Action | Independent tutor | Agency admin | Agency tutor | Student |
|---|---|---|---|---|
| Upload, organise, delete | Yes | Yes, any file in the agency | Their own files | No |
| Attach to a course | Yes | Any course in the agency | Their courses | No |
| Team folders | n/a | Manage | Use (read-only) | No |
| Open attached files | Yes | Yes | Yes | Files attached to their courses, homework and lessons |

## Data needed (for the build)

Tables are in `20-data-model.md`: resources and uploads DM-18.

- Files in R2 with folder, owner, size, type (checked from contents), upload
  intents (built in Round 9B), team-shared flag.
- Attachments: file or folder to course; file to homework; file to lesson.
- Storage and daily upload counters per account, and daily hand-in counters
  per student.
- Whiteboard eligibility (PDF or image, 10 MB or less) computed per file, so
  **Present** is shown only when it will work. Today's presentation processing
  runs as a durable job.
- Soft delete with a 30-day restore window, then the durable delete job.

## Checked against Bobbin

- `10-resources/screenshots/page--default.png`: header line, **New folder**
  and **Upload files**, FILES label, search, **Show files in folders**,
  **Filter**, empty state wording (RS-01).
- `10-resources/screenshots/folder-created--library.png`: FOLDERS row with a
  folder card and the dashed **New folder** card, and the "No files outside
  folders" empty state (RS-01). The old Folders / All files switch and the
  Mine / Shared with the team tabs are replaced by Bobbin's checkbox and
  Visibility filter.
- `10-resources/screenshots/resources-filter-type.png`, `resources-filter-visibility.png`:
  Filter groups Type (Images, PDFs, Documents) and Visibility (Shared with
  everyone, Not shared with everyone). The Uploaded from / to filters are
  taken from the atlas text (`10-resources/spec.md`).
- `10-resources/screenshots/upload-files--dialog.png`, `upload-files--selected.png`,
  `upload-files--completed.png`: drop area wording, accepted types (PNG, JPG,
  PDF, Word or PowerPoint; no video), Add to folder, Add more files, Rename and
  Remove per file, Share with everyone (ticked), **Upload 1 file** (RS-02).
- `15-tutor-role/screenshots/tutor-resource-upload.png`: a tutor's upload
  dialog has no team sharing option (RS-02).
- `10-resources/screenshots/new-folder--filled.png`: New folder dialog, Share
  with everyone unticked (RS-03).
- `15-tutor-role/screenshots/tutor-course-add-resources.png`: Add resources
  menu (Upload files, Attach from library, Attach a folder) and **No resources
  attached** (RS-04).
- `15-tutor-role/screenshots/tutor-resources-show-folders.png`: the tutor's
  library matches the admin's (Show files in folders ticked, No files yet).
- Bobbin states no size limits in these screens; the Upload limits table is
  Kanvise's own.
