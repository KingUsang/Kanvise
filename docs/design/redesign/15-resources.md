# 15 · Resources

Status: draft for owner review. Builds on `00-decisions.md`, `04`, `07`, `09`,
`10`. Replaces today's Notes / Materials and the separate slides feature.

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

## RS-01 · Library

**Header:** **Resources** · "Your teaching files. Share them with a course, or
use them in a lesson." · secondary **New folder**, primary **Upload files**.

**Toolbar:** search **Search files…**, **Filter** (Type: PDFs, Documents,
Slides, Images, Video; Shared with: a course; Uploaded: date range), and a view
switch **Folders** · **All files**.

**Folders view:** folders as cards first (name, file count), then files not in
a folder.
**All files view:** a table: Name (with type icon), Folder, Shared with (course
dots), Size, Uploaded.

Each file row's **⋯**: **Open**, **Share with a course**, **Move to folder**,
**Rename**, **Download**, **Delete**.

**Agencies:** the library has two tabs: **Mine** · **Shared with the team**
(folders an admin shared with every tutor).

**Empty:** folder icon, **No files yet.** "Upload worksheets, notes and slides
once, then use them in any course or lesson." **Upload files**.

## RS-02 · Upload files

A dialog. Title **Upload files**.
- A drop area: **Drop files here, or choose files.**
- Accepted: PDF, Word, PowerPoint, images (PNG, JPG), and video (MP4) for short
  explainers. 20 MB per file (video 200 MB). Line: **For lessons on mobile data,
  smaller files load faster. Compress large PDFs first.**
- **Folder (optional)** dropdown, and **Share with a course (optional)**.
- Each file shows a progress bar, then a tick. Failed files show **Couldn't
  upload. Try again.** with a retry, and the others carry on.
- Not allowed: **Kanvise can't use .exe files.** (and similar, per type).
- Done: toast **3 files uploaded.**

## RS-03 · New folder

Dialog: **Folder name** (required) and, for agency admins, **Share with the
team** (toggle, off). **Create folder**.

## RS-04 · Sharing with a course

- From the file's **⋯ › Share with a course**, or from the course's
  **Resources** tab (**Add resources**: **Upload files** · **Choose from your
  library** · **Choose a folder**).
- Line in the dialog: **Students on this course can open and download these.**
- Sharing a folder shares everything in it, including files added later.
- **Stop sharing** on the course's Resources tab removes it from the course
  only; the file stays in the library.

## RS-05 · Files for a lesson

- On the lesson page (planned), a **Materials** card: **+ Add files** (upload or
  from the library). Line: **You'll see these in Lesson tools, ready to present.**
- In the classroom, Lesson tools › **Materials** lists the lesson's files plus
  the course's files, with **Present** for PDFs and slides (puts them on the
  PlugNMeet whiteboard) and **Open** for the rest.
- After the lesson, files presented or attached show to students under **Files
  from this lesson** (spec 09, SA-05).

## RS-06 · Deleting

**Delete this file?**
- "It will be removed from 2 courses and 1 homework. Students won't be able to
  open it any more."
- **Cancel** · **Delete** (red).
- Deleted files go to **Recently deleted** for 30 days (a link at the bottom of
  the library), with **Restore**.

## Student view

See spec 09: course › **Resources** (by folder, **Open**, **Download**), homework
files, and **Files from this lesson**.

## Permissions

| Action | Independent tutor | Agency admin | Agency tutor | Student |
|---|---|---|---|---|
| Upload, organise, delete | Yes | Yes | Their own files | No |
| Share with a course | Yes | Any course | Their courses | No |
| Use team folders | n/a | Manage | Use (read-only) | No |
| Open shared files | Yes | Yes | Yes | Files shared with their courses, homework and lessons |

## Data needed (for the build)

- Files in R2 with folder, owner, size, type, upload intents (built in Round 9B).
- Sharing links: file or folder to course; file to homework; file to lesson.
- Conversion for the whiteboard (today's presentation processing, which now runs
  as a durable job).
- Soft delete with a 30-day restore window, then the durable delete job.
