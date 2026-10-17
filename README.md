# PROJECT_SPEC.md
# Adaptive Study Planner — Gamified 3D Learning World

**Project type:** Full-stack-ready web application, initially sandbox-only  
**Primary experience:** Interactive 3D floating-island learning world  
**Development approach:** AI-assisted implementation, incremental testing, no manual coding required from the user wherever the coding agent can perform the work  
**Initial deployment status:** Sandbox only; no cloud deployment  
**Future integrations:** Supabase, authentication, Cloudflare, and hosted production services

---

# Running basic app

The first local-first React app is implemented, with the approved 3D model kit, editable subjects, Today plans, paste review, revisions, external test results, analytics and JSON backups.

```sh
# Node.js 22.12+; run inside this repository
npm ci
npm run dev
```

Use the **Study World planner** live preview in Arena, or Vite's printed local URL. Your personal workspace starts without fake tasks; explore the separate demo from World or Settings. Nothing has been deployed to a cloud service.

- [App guide: workflows, storage, limits and development](APP_GUIDE.md)
- [Verification results](APP_VERIFICATION.md)

---

# 0. Confirmed Product Decisions

Confirmed with the project owner on 2026-10-15. **Where this section conflicts with any later section, this section takes precedence.**

## 0.1 The problem we are solving

A self-studying learner (for example, someone preparing for SSC exams while also learning programming) needs to know **what to study today**, **remember what they have already studied**, and **see which topics are actually weak**. The planner, revision, and test logic is the core product. The 3D world is the engaging layer on top of it, never a replacement for it.

## 0.2 Core workflow

1. **Paste.** In the Today area (the user's "study area"), the user pastes the day's targets for any number of subjects in one go.
2. **Review.** The local parser splits the text into proposed tasks and assigns each one to a subject and topic. The user fixes or removes proposals, then confirms. Nothing is saved without confirmation.
3. **Plan.** Confirmed tasks go on today's plan. Tasks marked **Priority** come first.
4. **Complete.** The user explicitly marks work as completed.
5. **Revise.** Completing work schedules revisions counted from the **actual completion date**, not the date the task was created or first planned.
6. **Carry forward.** Work that is not marked completed moves to the next day automatically. It is never dropped.
7. **Test.** Revised topics become ready for a test. The user records the results of tests taken elsewhere, and those results adjust future revisions.

## 0.3 Subjects are dynamic

- The app starts with six editable starter subjects: SSC Mathematics, SSC Reasoning, English and Vocabulary, GK and General Studies, Data Structures and Algorithms, and Software Development.
- The user can add, rename, archive, and restore subjects. Archiving hides a subject but keeps its history. Permanent deletion is a separate action with a confirmation step.
- Each active subject appears as one island. The 3D layout and the 2D fallback must handle any number of subjects, not a fixed six.
- **Terminology:** the app calls an island a **Subject** (earlier versions of this spec said "Study Area"). The hierarchy is **Subject → Topic → Tasks and Resources**. A topic may carry an optional group label (for example, "Arithmetic") instead of a separate hierarchy level.

## 0.4 Reading pasted plans: local parser first

- Version 1 uses only the built-in deterministic local parser (Section 8.2). No AI key, paid service, or network access is required.
- Real AI parsing (for example, OpenRouter through a secure server-side component, Section 8.3) is deferred to a later phase.
- Scheduling never needs AI. It is deterministic rules: priority, carry-forward, revision dates, and available time.

## 0.5 Time-aware daily planning

- The user sets the available study time for each day.
- Every task has an estimated duration. The parser fills it in when the pasted text states one; otherwise a default applies. The user can edit it.
- Today's plan combines Priority tasks, due and overdue revisions, carried-forward tasks, and new tasks, in that default order.
- Unfinished tasks carry forward to the next day automatically and show how many days they have been carried.
- When the day's total exceeds the available time, the app shows the overload, explains what it recommends doing first, and suggests what to move (lowest-priority new learning first). **The user decides.** Nothing is moved or deleted silently.

## 0.6 Revision schedule: adaptive ladder

Default schedule (configurable). Each gap is counted from the day the previous step was **actually** completed:

| Revision | Gap after previous step | Day after completion, if every step is on time |
| --- | --- | --- |
| 1st | 1 day | Day 1 |
| 2nd | 2 days | Day 3 |
| 3rd | 4 days | Day 7 |
| 4th | 7 days | Day 14 |
| 5th | 16 days | Day 30 |
| 6th | 30 days | Day 60 |
| Maintenance | Every 60 days | Day 120, 180, ... until the topic is archived or revision is switched off |

After each revision, the user taps one rating:

| Rating | Next revision |
| --- | --- |
| Forgot | Restart at the 1st step (in 1 day) |
| Hard | Repeat the same step (same gap again) |
| Good | Move to the next step |
| Easy | Skip one step |

Rules:

- **One revision per topic per day of work.** Tasks for the same topic completed on the same day create one revision item (for example, "Revise Percentage") that lists what it covers.
- **Default, to confirm in Phase 6:** if a topic already has an active revision schedule when more work on it is completed, the schedule restarts at the 1st step from the new completion date and covers both. A topic never has two parallel schedules.
- **Exception:** range-based memorization (for example, vocabulary words 101–150) keeps one schedule per range, because each range is different material.
- **Revision toggle:** revision is on by default and can be switched off for individual tasks (for example, "take a mock test" or "build a feature").
- **Missed revisions** are overdue, not forgotten. They carry forward as a single item (never duplicated) and show how many days they are overdue. The next gap is counted from the day the revision is actually done.
- **Revision means active recall:** the revision screen prompts the user to recall or solve first and check notes afterwards, rather than simply re-reading.

Research basis: spaced practice and practice testing are the highest-rated study techniques, while re-reading is rated low (Dunlosky et al., 2013). The best gap depends on how far away the test is (Cepeda et al., 2008). Ever-expanding gaps have not been shown to beat other spacing for long-term retention (Karpicke & Roediger, 2007), and adaptive schedulers such as SM-2 and FSRS adjust gaps from the learner's own recall. No fixed sequence is scientifically proven optimal, so these values are transparent, configurable defaults, not validated optima. References are listed in Section 0.9.

## 0.7 Tests: scheduled revision exams and external results

- Version 1 records the results of tests taken outside the app (mock-test apps, books, PDFs): name or source, date, score and total (shown as a percentage), optional time taken, optional notes on mistakes, and per-topic results where available.
- **Scheduled revision exams (user-approved addition):** default every 7 days, adjustable from 1–90 days in Settings. Weekly is a practical starting cadence, not a scientifically fixed optimum. The first deadline starts from an actual recall revision, not learning completion. Build a syllabus from untested recall dates for active topics, retaining separate vocabulary ranges. Show a due reminder in Today and a bounded syllabus in Tests; take the exam outside the app.
- A missed exam stays as one due checkpoint, not a pile of duplicates. Explicitly recording a revision-exam result requires confirming that the whole displayed syllabus was covered. Store that syllabus with the test record; ordinary unrelated result records remain separate. Overall-only exam scores do not move revisions. New recalls build the next checkpoint from the actual exam date; after an inactive interval with no material, restart from the first new recall rather than inventing an overdue empty exam. Future recalls and exam-generated score evidence do not create a syllabus.
- A topic shows as **ready for test** after its 3rd revision (about one week after completion when revisions are on time). A test can still be recorded for any topic at any time.
- A recorded **topic-level** result counts as a revision of that topic on the test date. It maps to a rating using configurable thresholds: below 50% is Forgot, 50–69% is Hard, 70–89% is Good, and 90% or higher is Easy.
- An overall score without topic-level results is stored and shown in analytics, but it does not change revision timing.
- In-app question banks, quizzes, flashcards, and AI-generated questions are deferred to a later phase.

## 0.8 Deferred to later phases

- Real AI parsing (requires a secure server-side component).
- In-app quizzes, flashcards, and AI-generated questions.
- Everything already deferred by Sections 2 and 20 (Supabase, authentication, Cloudflare, deployment).

## 0.9 References for the revision design

- Dunlosky, J., Rawson, K. A., Marsh, E. J., Nathan, M. J., & Willingham, D. T. (2013). Improving students' learning with effective learning techniques. *Psychological Science in the Public Interest, 14*(1), 4–58. https://doi.org/10.1177/1529100612453266
- Cepeda, N. J., Vul, E., Rohrer, D., Wixted, J. T., & Pashler, H. (2008). Spacing effects in learning: A temporal ridgeline of optimal retention. *Psychological Science, 19*(11), 1095–1102. https://doi.org/10.1111/j.1467-9280.2008.02209.x
- Karpicke, J. D., & Roediger, H. L. (2007). Expanding retrieval practice promotes short-term retention, but equally spaced retrieval enhances long-term retention. *Journal of Experimental Psychology: Learning, Memory, and Cognition, 33*(4), 704–719. https://doi.org/10.1037/0278-7393.33.4.704
- Murre, J. M. J., & Dros, J. (2015). Replication and analysis of Ebbinghaus' forgetting curve. *PLoS ONE, 10*(7), e0120644. https://doi.org/10.1371/journal.pone.0120644
- SuperMemo algorithm SM-2 (Woźniak, 1987): https://supermemo.guru/wiki/History_of_spaced_repetition_(print)
- FSRS (Free Spaced Repetition Scheduler): https://github.com/open-spaced-repetition/fsrs4anki

---

# 1. Product Vision

Build an attractive, interactive, gamified study planner that transforms unstructured learning goals into organized study tasks, automatically schedules revisions, tracks performance, and helps users identify weak areas.

The application must combine the usefulness of a serious study-management tool with the visual appeal of a stylized 3D exploration game.

The 3D world is the primary visual experience, not merely a landing page or decorative background.

Users should be able to explore floating islands representing different subjects, enter an island, see their topics and activities, complete study tasks, take assessments, and watch their progress change.

The application must remain practical and usable. Core study activities must not depend on navigating a complicated 3D environment.

## Core principle

**Gamification should make studying more engaging without pretending that game activity equals actual learning.**

Opening an island, clicking a button, or spending time on a page must not automatically indicate mastery. Learning progress must be based on recorded study completion, recall, assessments, and other meaningful evidence.

---

# 2. Initial Scope: Sandbox Only

The first version must run entirely within the coding agent's available sandbox or development environment.

Do not configure production hosting or external infrastructure.

## 2.1 Explicitly excluded from the initial version

Do not implement or require:

- Supabase.
- PostgreSQL or another external database service.
- User registration or login.
- Authentication providers.
- Cloudflare Pages.
- Cloudflare Workers.
- Production deployment.
- Paid hosting.
- Paid AI APIs as a mandatory dependency.
- External backend servers that require a separate deployment.
- Local machine services or infrastructure that must remain running outside the sandbox.

Do not request passwords, API keys, payment information, or credentials from the user.

Do not create unnecessary cloud resources.

## 2.2 What sandbox-only means

The application should run in the coding agent's available development environment and use only the capabilities available there.

The coding agent may use its sandbox's existing tools and permitted development commands. It must not assume that it can write to the user's laptop or that its sandbox filesystem is automatically accessible from the user's browser.

If a command, preview, file operation, or network request is unavailable, explain the limitation and use the best supported alternative.

Do not claim the application has been executed or tested unless it actually has been.

## 2.3 Initial persistence

Use browser `localStorage` through a dedicated persistence adapter for the first version.

Requirements:

- Persist subjects, topics, resources, tasks, revision sessions, assessment results, preferences, and progress.
- Load saved state on application startup.
- Handle invalid or corrupted stored data safely.
- Version the stored data format.
- Include export and import of user data using JSON.
- Include a clear-data action with a confirmation step.
- Do not silently overwrite existing user data.
- Keep sample data separate from actual user data.

If the sandbox preview uses an environment where browser storage is unavailable or isolated, provide a working in-memory fallback and explain its limitations.

Do not use files on the user's computer as the application's database.

---

# 3. Required Technology Stack

Use the following stack unless a genuine compatibility problem requires a documented change.

## Frontend

- React.
- TypeScript with strict type checking.
- Vite.
- React Three Fiber.
- Three.js.
- Drei for common 3D helpers.
- Motion for appropriate UI animations.
- Tailwind CSS for styling.

Use stable, mutually compatible package versions.

## State and data

- React state and context, or a small state-management library only if genuinely necessary.
- A typed domain model independent of UI components.
- A repository/data-access abstraction.
- A localStorage-backed implementation for the initial version.
- A deterministic scheduling and workload engine implemented in TypeScript.

Do not add a complicated state-management framework without a concrete need.

## Testing

Use a suitable lightweight test framework such as Vitest.

Test business logic independently from the 3D renderer.

Include tests for scheduling, workload allocation, task completion, assessment scoring, persistence migration, and data validation.

## Initial backend strategy

There is no deployed backend in this phase.

Implement application logic in well-separated modules so that future server-side functionality can replace local implementations cleanly.

Do not put real API secrets in the frontend or repository.

---

# 4. Visual Direction

Create a premium stylized 3D floating-island world.

The visual quality should resemble a carefully art-directed indie exploration game rather than a conventional admin dashboard.

## 4.1 Art direction

Use:

- Floating islands with readable silhouettes.
- Stylized low-poly or gently rounded terrain.
- Small trees, rocks, vegetation, books, crystals, towers, bridges, and study-related landmarks.
- Soft directional lighting.
- Atmospheric depth and restrained fog where appropriate.
- Smooth shadows without excessive rendering cost.
- A cohesive palette, with different accents for different subjects.
- Thoughtful composition, camera framing, spacing, and scale.
- Smooth camera transitions.
- Subtle ambient animation.
- Meaningful visual feedback for completion and unlocking.

Avoid:

- Excessive neon effects.
- Unrelated floating glass cards everywhere.
- Generic dashboard templates.
- Uncontrolled particle effects.
- Overly complex realistic environments.
- Excessive animations that interfere with study.
- Unlicensed assets.
- Empty islands with only labels.
- Visuals that look good only in a static screenshot but do not work interactively.

Use procedural geometry and original simple shapes wherever possible. Use external assets only when their source and licence are appropriate and the assets are available through permitted tools.

The core application must not depend on downloading a collection of large 3D assets.

## 4.2 Camera and navigation

The world should provide:

- An attractive default isometric or three-quarter perspective.
- Smooth zoom.
- Controlled camera rotation if it improves navigation.
- Pan or island selection navigation where appropriate.
- Clickable islands.
- Clear hover and selection states.
- A home/reset-camera action.
- A way to return from a selected island to the world map.
- Responsive controls for touch devices.
- Keyboard-accessible navigation alternatives.

Avoid camera controls that make it easy to lose the entire world or become disoriented.

## 4.3 Performance

- Keep geometry and draw calls reasonable.
- Reuse materials and geometry for repeated objects.
- Use instancing when appropriate.
- Avoid unnecessarily large textures.
- Lazy-load the 3D experience if beneficial.
- Show a loading state while the scene initializes.
- Handle WebGL failure gracefully.
- Provide a useful 2D fallback with equivalent core navigation.
- Avoid rendering expensive animations when the scene is not visible.
- Respect reduced-motion preferences where practical.

The website must still be usable on ordinary laptops.

---

# 5. The Learning World

Start with six editable starter subjects, each shown as an island:

1. SSC Mathematics.
2. SSC Reasoning.
3. English and Vocabulary.
4. GK and General Studies.
5. Data Structures and Algorithms.
6. Software Development.

Subjects are dynamic: the user can add, rename, archive, restore, or permanently delete subjects (Section 0.3). The world shows one island per active subject and must lay out any number of islands, not a fixed six.

Each island represents a subject, not an individual task.

Each island should have:

- A distinctive visual identity.
- A visible name.
- An understandable progress indicator.
- An unlocked, locked, or available state where appropriate.
- An accessible selection mechanism.
- A selected-island information panel.
- A list of associated topics.
- Due and overdue revision counts.
- Current study milestones.
- A way to enter the island's topic view.

Provide a useful first-run experience without forcing the user to complete a tutorial.

## 5.1 Progress paths

Connect islands or important milestones with visible paths.

Path states may include:

- Not yet available.
- Available.
- In progress.
- Completed.

Use progress-based unlocking only when it improves the product.

Do not make core study features inaccessible behind arbitrary game requirements. Users must still be able to create subjects and tasks through the standard interface.

## 5.2 Visual rewards

Meaningful learning progress may change:

- Island vegetation.
- Landmark appearance.
- Path lighting.
- Small environmental details.
- Completion animations.
- Achievement displays.

Visual rewards must be derived from actual saved progress.

Avoid complex procedural world generation unless it is necessary.

---

# 6. Main Application Navigation

The 3D world is the home screen, but the application must provide a complete, functional 2D interface.

Create the following pages or equivalent navigable views.

## 6.1 World Map

Display the 3D island world, overall study progress, today's workload summary, due revisions, and quick actions.

## 6.2 Island / Subject

Show the topics (optionally grouped) of the selected subject's island.

Allow the user to:

- Create topics.
- Edit topics.
- Archive topics.
- Add study resources.
- Create tasks.
- View topic history.
- View revision status.
- View assessment performance.

## 6.3 Today

Show the current day's planned workload, including:

- New learning tasks.
- Revision sessions.
- Assessments.
- Overdue items.
- Estimated total duration.
- Priority indicators.

Allow completion, postponement, rescheduling, and opening task details.

Today is the user's main "study area": it offers the paste box for the day's targets (Section 6.4), lists Priority tasks first, carries unfinished work forward automatically, and shows overload against the day's available time (Sections 0.2 and 0.5).

## 6.4 Import Study Plan

Allow users to paste unstructured study material and convert it into structured tasks.

Provide a review-and-edit step before saving.

## 6.5 Task Details

Show task description, subject, topic, resources, estimated duration, status, completion history, and relevant revision sessions.

## 6.6 Revision Calendar

Display due, completed, postponed, and overdue revision sessions.

## 6.7 Practice and Assessments

Version 1 (Section 0.7): record the results of tests taken elsewhere, overall and per topic, with optional notes on mistakes, and show which topics are ready for a test. In-app quizzes, recall exercises, flashcards, and incorrect-answer review are deferred to a later phase.

## 6.8 Analytics

Display study consistency, completed work, revision adherence, assessment performance, weak topics, and learning progress.

## 6.9 Settings and Data

Include scheduling preferences, daily availability, appearance options, export/import, sample-data controls, and clear-data functionality.

The application must not become unusable on narrow screens. On mobile, use a simpler world view and accessible 2D panels.

---

# 7. Subjects, Topics, and Resources

Use a consistent hierarchy:

Subject (one island) → Topic → Tasks and Resources.

A topic may carry an optional group label (for example, "Arithmetic") instead of a separate hierarchy level.

The hierarchy must remain flexible enough to support different study styles.

For example:

Subject: SSC Mathematics\
Topic: Percentage (group: Arithmetic)\
Tasks:
- Learn percentage basics.
- Solve 30 questions.
- Review incorrect answers.
- Take a topic test.

A topic may have multiple tasks and resources.

Resources may include:

- URLs.
- Video links.
- Articles.
- Books.
- PDFs.
- Personal notes.
- External practice pages.

Preserve the original URL and make valid links clickable.

Do not assume every resource is accessible to the application or that external links can be fetched.

Allow users to create, edit, archive, and organize their own content.

---

# 8. AI-Assisted Study Plan Import

Implement a robust import interface.

Users may paste text containing:

- Study schedules.
- Notes.
- Numbered lists.
- Topic ranges.
- Day-wise plans.
- Video playlists.
- URLs.
- Alternatives.
- Mixed tasks.
- Informal descriptions.
- Revision instructions.

Example input:

"SSC Maths: Complete percentage videos 1–5. Solve 30 questions from the practice site. Revise vocabulary words 101–150. Learn DSA Day 1 of 5. OR complete one Java collection topic. Watch this video: https://example.com/video"

The application should identify candidate tasks, relevant subjects and topics, task types, quantities, URLs, and relationships.

## 8.1 Import workflow

1. User pastes content.
2. Parser generates proposed structured items.
3. User reviews the proposals.
4. User edits or removes incorrect items.
5. User confirms.
6. Confirmed items are saved.
7. The planner schedules the tasks and any required revisions.

Never automatically save unreviewed AI-generated content.

## 8.2 Parsing architecture

Create a parser interface with a deterministic local implementation.

The local parser should handle common patterns, including:

- Numbered lists.
- Day numbers.
- Quantities.
- Ranges.
- URLs.
- Basic alternatives.
- Common duration formats.
- Common task verbs.

Be honest about ambiguity.

If a sentence has multiple possible interpretations, flag it for user review instead of inventing certainty.

## 8.3 Optional AI provider

Design an optional AI adapter for OpenRouter.

The application must remain usable if no AI API key exists.

When no provider is configured:

- Use the local parser.
- Clearly label the result as locally parsed.
- Allow editing before saving.
- Do not pretend a remote model was used.

Do not hardcode API keys.

Do not expose API keys in browser JavaScript, committed files, or logs.

Because the initial version has no backend, do not implement an insecure direct browser-to-provider integration using a secret key.

If secure remote AI requires a server-side component, document the limitation and leave the integration ready for a later secure backend phase. Do not deploy a backend in this phase.

---

# 9. Task Types

Support distinct task types rather than treating every activity as an identical checkbox.

## 9.1 Timed problem-solving

For mathematics and reasoning:

- Set a question target.
- Track attempted and correct questions.
- Record time where useful.
- Allow a task to be completed without requiring perfect accuracy.
- Link results to the relevant topic.

## 9.2 Memorization

For vocabulary, GK, and fact ranges:

- Support ranges such as words 101–150.
- Track planned and completed ranges.
- Support recall checks.
- Avoid duplicate or overlapping ranges when detectable.

## 9.3 Video learning

Support:

- Video URL.
- Optional playlist.
- Video or lesson number.
- Planned duration.
- Completion status.
- Personal notes.

Do not assume an external video can be embedded or tracked automatically.

## 9.4 Reading and theory

Support reading targets, chapters, pages, concepts, and personal notes.

## 9.5 Mock tests and assessments

Track score, total marks or questions, accuracy, duration, and incorrect answers when provided.

## 9.6 DSA practice

Support problem-solving tasks with:

- Problem URL.
- Difficulty.
- Programming language.
- Attempt status.
- Solved status.
- Time spent.
- Notes and approach.
- Optional review of the solution.

## 9.7 Software development

Support practical learning tasks such as:

- Learn a concept.
- Build a feature.
- Debug an issue.
- Complete an API.
- Write tests.
- Review code.

Completion should be based on the user's explicit confirmation or recorded assessment, not inferred from time spent.

---

# 10. Adaptive Revision Engine

Implement revision scheduling as deterministic, testable TypeScript logic.

Use a configurable default schedule based on the actual completion date (Section 0.6):

- Day 0: initial learning (the day the work is marked completed).
- Day 1: first revision.
- Day 3: second revision.
- Day 7: third revision.
- Day 14: fourth revision.
- Day 30: fifth revision.
- Day 60: sixth revision.
- Then every 60 days (maintenance) until the topic is archived or revision is switched off.

These day numbers assume every revision is done on time. Each next revision is scheduled from the date the previous step was actually completed (gaps of 1, 2, 4, 7, 16, 30, then 60 days).

These are initial defaults, not scientifically guaranteed optimal intervals.

Allow users to configure the default intervals later through settings.

## 10.1 Scheduling rules

- Calculate future revisions from the actual completion date.
- Do not calculate every revision from the date a task was originally created.
- Use a consistent date and timezone policy.
- Avoid accidental duplicate active revision sessions.
- Mark missed sessions overdue.
- Preserve revision history.
- Allow users to complete, postpone, or reschedule a session.
- Record the user's recall result when available.
- Explain why the next session is scheduled.
- Track revisions per topic: work on the same topic completed on the same day creates one revision item (Section 0.6).
- Allow revision to be switched off for individual tasks.

## 10.2 Performance adjustment

Support simple recall outcomes such as:

- Again: could not recall.
- Difficult: recalled with substantial effort.
- Good: recalled correctly.
- Easy: recalled confidently.

Implement a documented and configurable interval-adjustment policy.

Default policy (UI labels: Forgot, Hard, Good, Easy): Again restarts at the first step (next revision in 1 day), Difficult repeats the current step's gap, Good moves to the next step, and Easy skips one step. Test results map to these outcomes (Section 0.7).

The algorithm must be transparent and unit-tested.

Do not claim that the initial algorithm is clinically or scientifically validated.

## 10.3 Missed revisions

A missed session is overdue, not proof that the user forgot the material.

Do not automatically mark a topic as forgotten.

Do not create unlimited duplicate revisions when a user misses several days.

Use a clear policy for handling overdue sessions and display that policy in the UI.

Default policy: a missed revision stays as a single overdue item that carries forward day to day (never duplicated) and shows how many days it is overdue. The next revision is counted from the day it is actually completed.

## 10.4 Assessment consolidation

Topic-level performance may influence revision scheduling.

A test covering several topics may record one overall score and individual results for each topic.

Do not lose topic-level information when consolidating assessments.

A recorded topic-level test result counts as a revision of that topic on the test date (Section 0.7).

---

# 11. Daily Workload Planner

Keep daily workload planning separate from the revision engine.

The revision engine determines what is due.

The workload planner determines what can realistically fit into the user's available time.

Allow users to configure:

- Available study time per day.
- Preferred study periods if useful.
- Lighter days.
- Task priorities.
- Preferred workload limits.

## 11.1 Scheduling behavior

Prioritize tasks using transparent factors such as:

- Due revision dates.
- Overdue status.
- User-defined priority.
- Importance.
- Estimated duration.
- Prerequisites.
- Available time.
- Assessment deadlines where configured.

Unfinished tasks automatically carry forward to the next day and are never dropped (Section 0.5). If carried-forward work, due revisions, and new tasks together exceed the day's available time, apply the overload handling below instead of silently cramming everything into one day.

When the planned workload exceeds availability:

- Show the overload.
- Preserve overdue and due information.
- Recommend what to complete first.
- Suggest postponing lower-priority new learning where appropriate.
- Let the user choose.
- Explain why a task was recommended or postponed.

Never silently delete tasks or revision history.

## 11.2 Task duration

Allow estimated durations to be edited.

Track actual duration only where useful and explicitly supported.

Do not infer mastery from the amount of time spent studying.

---

# 12. Quizzes, Recall, and Assessments

Build a usable assessment system.

**Version 1 scope (Section 0.7):** the Tests area records the results of tests taken elsewhere, overall and per topic, and lists topics that are ready for a test. The in-app question features below (multiple-choice, recall prompts, flashcards, generated questions) are deferred to a later phase; keep the data model ready for them.

Include:

- Multiple-choice questions.
- Short-answer recall prompts.
- Flashcards where appropriate.
- Manual assessment results.
- Topic-level scoring.
- Incorrect-answer review.
- Attempt history.

When question generation is unavailable, allow users to create questions manually.

Optional AI-generated questions must be clearly identified as generated and editable before use.

Do not fabricate authoritative answers for high-stakes examination questions.

For scoring:

- Validate answer formats.
- Calculate scores deterministically.
- Store attempts separately from question definitions.
- Preserve incorrect answers and feedback.
- Avoid treating one good score as proof of permanent mastery.

---

# 13. Progress and Analytics

Provide useful, interpretable metrics.

Include:

- Tasks completed.
- Planned versus completed study time, where available.
- Revisions due and completed.
- Revision adherence.
- Assessment scores.
- Topic-level accuracy.
- Repeated mistakes.
- Topics needing review.
- Progress by subject.
- Study consistency over time.

Distinguish clearly between:

1. Activity completed.
2. Material recalled.
3. Assessment performance.
4. Estimated mastery.

Do not present a fabricated universal mastery percentage as scientific truth.

If a composite progress score is used, document its calculation and allow the user to inspect its underlying data.

Use accessible charts and readable labels.

Do not require the 3D renderer to display analytics.

---

# 14. Gamification System

Implement a lightweight reward system based on meaningful activity.

Possible features:

- Experience points for verified task completion.
- Milestones for consistent study.
- Island visual upgrades.
- Achievement badges.
- Learning path progress.
- Completion animations.
- Personal bests.

Rewards must not be awarded simply for opening pages or clicking buttons.

Avoid punishment mechanics that shame users for missing a day.

Do not erase progress because the user missed a session.

Keep the reward rules transparent and deterministic.

Allow gamification elements to be disabled or reduced if desired.

---

# 15. Data Model

Create strongly typed domain entities and appropriate validation.

The initial implementation may use a versioned local data structure, but its logical model must support future migration to a relational database.

Include equivalents of the following entities:

- UserPreferences.
- Subject (one island; replaces the former StudyArea entity).
- Topic (with an optional group label, replacing the former middle Subject level).
- Resource.
- Task.
- TaskResource.
- TaskComponent.
- RevisionSession.
- Assessment.
- AssessmentItem.
- AssessmentAttempt.
- AssessmentResponse.
- TaskEvent.
- Achievement.
- DataSchemaVersion.

Each entity must have a stable identifier.

Use consistent timestamps and date handling.

Represent relationships explicitly.

Keep historical assessment attempts and revision records instead of overwriting all previous information.

Use a migration mechanism when the local schema changes.

Do not build a giant untyped JSON object with all business logic embedded in it.

---

# 16. Persistence Architecture

Create a data-access interface that separates application logic from the underlying storage mechanism.

For example, define interfaces for:

- Subject operations.
- Topic operations.
- Task operations.
- Revision session operations.
- Assessment operations.
- User preferences.
- Import and export.

Implement these interfaces with browser localStorage for the initial version.

Components should not directly manipulate localStorage throughout the codebase.

When the project later migrates to Supabase, the storage implementation should be replaceable without rewriting the 3D world or scheduling engine.

Include:

- Safe initialization.
- Schema versioning.
- Validation.
- Export to JSON.
- Import from JSON.
- Clear-data confirmation.
- Graceful handling of unavailable storage.
- Tests for persistence behavior.

Never assume localStorage synchronizes between devices.

Clearly explain that data remains in the current browser's storage and may be lost if browser data is cleared.

---

# 17. Suggested Project Structure

Use a structure similar to the following, adjusting it when the existing repository warrants a better choice.

    src/
      app/
        App.tsx
        routes/
        layout/
      components/
        ui/
        forms/
        feedback/
      world3d/
        WorldCanvas.tsx
        scenes/
        islands/
        objects/
        camera/
        interactions/
        fallback/
      features/
        subjects/
        topics/
        tasks/
        import-plan/
        revisions/
        workload/
        assessments/
        analytics/
        gamification/
        settings/
      domain/
        models/
        validation/
        scheduling/
        workload/
        scoring/
        progress/
      data/
        repositories/
        local-storage/
        migrations/
        import-export/
      services/
        parser/
        ai/
      hooks/
      lib/
      styles/
      tests/

    public/
    PROJECT_SPEC.md
    README.md
    .env.example
    package.json
    tsconfig.json
    vite.config.ts

This is a guide, not a requirement to create empty folders for every category.

Create modules only when they have real responsibilities.

---

# 18. Accessibility and Usability

The 3D world must not be the only way to access functionality.

Provide:

- Keyboard navigation.
- Accessible names for interactive controls.
- Visible focus states.
- Adequate text contrast.
- Readable font sizes.
- Reduced-motion support.
- Semantic forms and headings.
- Helpful error messages.
- Confirmation for destructive actions.
- A 2D alternative for major navigation and study tasks.
- Mobile-friendly layouts.

Ensure that users can create and complete tasks without manipulating a 3D camera.

---

# 19. Security and Privacy

Even though the initial version is sandbox-only:

- Do not collect unnecessary personal data.
- Do not request credentials.
- Do not commit real secrets.
- Do not hardcode API keys.
- Do not send study data to external services without an explicit configured integration.
- Do not expose private data in console logs.
- Do not assume browser storage is encrypted or secure against someone with access to the same browser profile.

Document the limitations of browser-only persistence and optional AI integration.

Future authentication and database security are explicitly deferred to a later phase.

---

# 20. Future Integration Requirements

Design the application so that these services can be added later:

## Supabase

For persistent relational data, account ownership, synchronization, and optional authentication.

## Cloudflare

For frontend hosting, secure server-side endpoints, environment secrets, and production deployment.

## OpenRouter

For secure server-side AI-assisted parsing, quiz generation, explanations, and learning support.

Do not implement or configure these integrations now.

Do not add fake login screens that imply real authentication exists.

Do not create placeholder cloud deployment workflows.

Document the intended future integration points and migration steps.

---

# 21. Implementation Phases

Implement the application incrementally.

## Phase 1 — Foundation

- Inspect the existing repository.
- Confirm the sandbox's capabilities.
- Set up React, TypeScript, and Vite if not already present.
- Configure styling and linting as appropriate.
- Establish the application structure.
- Add a minimal working application shell.
- Verify that the project builds.

## Phase 2 — 3D World Prototype

- Build the first stylized floating island.
- Add lighting, camera, terrain, and a few recognizable objects.
- Create one island per subject, starting with the six starter subjects; the layout must support any number of islands.
- Add selection and navigation.
- Add loading and WebGL fallback states.
- Verify that the scene renders and interactions work.

Do not spend the entire project budget on 3D polish before core functionality exists.

## Phase 3 — Data and Persistence

- Define domain models.
- Implement validation.
- Build the repository interfaces.
- Implement localStorage persistence.
- Add sample data and reset controls.
- Implement JSON import/export.
- Test persistence and migration behavior.

## Phase 4 — Study Management

- Add subjects (add, rename, archive, restore, delete), topics, resources, and tasks.
- Implement creation, editing, completion, archiving, and deletion where appropriate.
- Connect the world map to actual saved data.
- Add practical 2D panels.

## Phase 5 — Study-Plan Import

- Build the paste interface.
- Implement local deterministic parsing.
- Preserve URLs, quantities, ranges, and basic task relationships.
- Add preview and editing.
- Save confirmed tasks.
- Add tests for ambiguous and malformed inputs.

## Phase 6 — Revision Engine

- Implement the default revision intervals.
- Add recall outcomes.
- Implement performance-based adjustments.
- Handle overdue sessions and postponement.
- Add calendar views and history.
- Test date boundaries and duplicate prevention.

## Phase 7 — Workload Planning

- Add daily availability.
- Calculate estimated workload.
- Prioritize due revisions and important tasks.
- Handle overload transparently.
- Add user-controlled postponement.
- Test scheduling edge cases.

## Phase 8 — Assessments and Analytics

- Add the Tests area: record the results of external tests (overall and per topic) and show topics ready for a test. In-app quizzes, recall prompts, and flashcards come in a later phase.
- Implement scoring.
- Record topic-level results.
- Add weak-topic identification.
- Display progress and revision adherence.

## Phase 9 — Gamification and Polish

- Add verified completion rewards.
- Add milestones and island upgrades.
- Improve lighting, animations, and world navigation.
- Optimize rendering.
- Verify keyboard navigation and mobile behavior.

## Phase 10 — Verification and Documentation

- Run production builds.
- Run tests and type checks.
- Fix regressions.
- Test refresh and persistence.
- Test empty and error states.
- Test the 2D fallback.
- Update README.md with setup instructions, architecture, limitations, and known issues.
- Document future Supabase, Cloudflare, and secure AI integration.

---

# 22. Definition of Done

The sandbox version is complete only when the following are verified to the extent supported by the environment:

- The application builds successfully.
- The world renders in the available browser preview.
- Every subject's island can be selected, and adding or archiving a subject updates the world.
- The 2D navigation remains usable.
- Subjects, topics, and tasks can be managed.
- Unfinished tasks carry forward to the next day.
- Changes persist across refreshes when browser storage is available.
- Data can be exported and imported safely.
- Study-plan parsing has a review-before-save workflow.
- Revision sessions are generated according to the configured policy.
- Missed sessions are handled without destroying history.
- Workload planning respects available time and shows overload.
- Assessments produce correct deterministic scores.
- Analytics are based on recorded application data.
- Gamification rewards reflect meaningful activity.
- The application works without an AI key or cloud account.
- The WebGL fallback is useful.
- Important business logic has automated tests.
- Documentation accurately describes completed features and limitations.
- No Supabase, authentication, Cloudflare deployment, or external database is required.

If a requirement cannot be fully verified, identify it explicitly rather than claiming it is complete.

---

# 23. Instructions to the AI Coding Agent

You are responsible for implementing this project, not merely describing it.

Start by inspecting the existing repository and any available development instructions.

Then:

1. Report the current repository state.
2. Confirm which commands, file operations, and browser previews your environment supports.
3. Identify any missing requirements that genuinely block implementation.
4. Present a concise phased plan.
5. Begin Phase 1 immediately.
6. Implement actual files in the sandbox or connected repository as permitted.
7. Test changes after each logical phase.
8. Fix errors introduced by your changes.
9. Keep documentation current.
10. Clearly distinguish verified features from incomplete or unverified features.

Do not repeatedly ask for approval of routine technical choices.

Do not stop after generating a plan.

Do not provide only code snippets for the user to copy when you can directly edit the files.

Do not pretend to have browser access, filesystem access, network access, or deployment permissions that you do not have.

Do not replace the specified product with a generic to-do list.

Do not implement all phases as one enormous, unreviewable change.

Do not add Supabase, authentication, Cloudflare, or a mandatory external AI API during this phase.

**Immediate objective: create a working sandbox version with the foundation, the stylized 3D world, and a real connection between the world and subject data. Continue implementing the remaining phases in order, preserving all requirements in this document.**

