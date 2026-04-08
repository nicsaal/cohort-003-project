# Plan: Lesson Comments with Instructor Moderation

## Context

Students currently have no way to ask questions or discuss lesson content. Instructors have no way to engage with students on individual lessons. This adds a flat comment thread to each lesson: students post comments (which start as `pending`), and instructors approve or hide them from their lesson editor page.

---

## Implementation Sequence

1. `app/db/schema.ts` — add `CommentStatus` enum + `lessonComments` table
2. Run `npm run db:generate` then `npm run db:migrate`
3. `app/services/commentService.ts` — create new service file
4. `app/routes/courses.$slug.lessons.$lessonId.tsx` — loader + action + student UI
5. `app/routes/instructor.$courseId.lessons.$lessonId.tsx` — loader + action + moderation UI

---

## 1. Schema — `app/db/schema.ts`

Add after existing enum definitions:

```ts
export type CommentStatus = "pending" | "approved" | "hidden";
```

Add after the `courseReviews` table definition:

```ts
export const lessonComments = sqliteTable("lesson_comments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  lessonId: integer("lesson_id").notNull().references(() => lessons.id),
  userId: integer("user_id").notNull().references(() => users.id),
  body: text("body").notNull(),
  status: text("status").notNull().$type<CommentStatus>(),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});
```

---

## 2. New Service — `app/services/commentService.ts`

Follow patterns from `app/services/reviewService.ts` (join with users, orderBy desc createdAt).

**Query functions:**
- `getApprovedCommentsForLesson(lessonId)` — approved comments joined with user name/avatar, ASC order
- `getPendingCommentsForStudent(lessonId, userId)` — current user's pending comments only
- `getAllCommentsForLesson(lessonId)` — all statuses, for instructor view, ASC order
- `getCommentById(commentId)` — single row by id
- `getCommentCountsByStatus(lessonId)` — returns `{ pending, approved, hidden }` counts

**Mutation functions:**
- `createComment(lessonId, userId, body)` — inserts with `status: "pending"`, returns via `.returning().get()`
- `setCommentStatus(commentId, status)` — updates status + updatedAt, returns via `.returning().get()`
- `deleteComment(commentId, userId)` — deletes WHERE id AND userId (student can only delete own)
- `deleteCommentAsInstructor(commentId)` — deletes WHERE id only

---

## 3. Student Lesson Route — `app/routes/courses.$slug.lessons.$lessonId.tsx`

**Loader additions** (inside existing `if (enrolled && currentUserId)` block):
```ts
const approvedComments = getApprovedCommentsForLesson(lessonId);
const myPendingComments = getPendingCommentsForStudent(lessonId, currentUserId);
```
Add both to loader return.

**New action intents:**

`post-comment` — validate `body` (min 1, max 2000), check enrollment, call `createComment()`, return `{ commentPosted: true }`

`delete-comment` — validate `commentId` (coerce number), call `deleteComment(commentId, currentUserId)`, return `{ commentDeleted: true }`

**New UI component** (local, below the quiz section):

- `<Card>` with "Discussion" heading + MessageSquare icon (lucide-react)
- Student's own pending comments at top — amber background, "(Awaiting approval)" badge, Delete button
- Approved comments — avatar initials or avatarUrl, username, timestamp, Delete button if own
- Textarea + "Post Comment" submit form using a dedicated `useFetcher`
- On `commentPosted`: clear textarea, `toast.success("Comment posted — awaiting approval.")`
- Only rendered when `enrolled && currentUserId`

---

## 4. Instructor Lesson Route — `app/routes/instructor.$courseId.lessons.$lessonId.tsx`

**Loader additions** (after existing `quiz` fetch):
```ts
const allComments = getAllCommentsForLesson(lessonId);
const commentCounts = getCommentCountsByStatus(lessonId);
```
Add both to loader return.

**New action intents** (after existing `update-lesson` block):

Schema: discriminated union of `"approve-comment" | "hide-comment" | "delete-comment-instructor"` + `commentId: z.coerce.number().int()`

Before mutating, verify comment belongs to the lesson:
```ts
const comment = getCommentById(parsed.data.commentId);
if (!comment || comment.lessonId !== lessonId) throw data("Not found", { status: 404 });
```

- `approve-comment` → `setCommentStatus(id, "approved")`
- `hide-comment` → `setCommentStatus(id, "hidden")`
- `delete-comment-instructor` → `deleteCommentAsInstructor(id)`

**New UI component** (local, added at bottom of page before save button):

- `<Card>` with "Comments" heading + count badges (amber=pending, green=approved, muted=hidden)
- Amber info banner if `pending > 0`: "N comment(s) awaiting approval"
- `<Tabs>` (reuse existing `app/components/ui/tabs.tsx`) with "Pending" | "Approved" | "Hidden" tabs
- Each tab lists comments: avatar, author name, timestamp, body, action buttons
  - Pending: [Approve] [Hide] [Delete]
  - Approved: [Hide] [Delete]
  - Hidden: [Approve] [Delete]
- Each button uses a `useFetcher` form with the appropriate intent

---

## Verification

1. As a student enrolled in a course, navigate to a lesson → comment section appears at bottom
2. Post a comment → toast shows "awaiting approval", comment appears in amber pending state
3. As instructor, open the lesson editor → Comments card shows the pending count badge
4. Approve the comment → switches to Approved tab
5. Return to lesson as student → approved comment now visible in the main feed
6. Hide a comment → disappears from student view, visible in instructor's Hidden tab
7. Student deletes own pending comment → removed
8. Run `npm test` — add/verify any relevant service tests

---

## Critical Files

- `app/db/schema.ts`
- `app/services/commentService.ts` (new)
- `app/routes/courses.$slug.lessons.$lessonId.tsx`
- `app/routes/instructor.$courseId.lessons.$lessonId.tsx`
- Reference: `app/services/reviewService.ts` (closest structural analog)
- Reference: `app/lib/validation.ts` (`parseFormData`)
- Reference: `app/components/ui/tabs.tsx` (reuse in instructor UI)
