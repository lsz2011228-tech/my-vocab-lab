# My Vocab Lab Project Status

Date: 2026-06-03

## Current status

My Vocab Lab is now a usable local vocabulary learning website. It is built as a static website, so it can open directly from local files without needing a running `localhost` server.

Recommended local opener:

- `START_HERE.html`

Main website file:

- `index.html`

If an old `localhost` link stops working, that usually means the temporary preview server stopped. It does not mean the website files are broken.

## What was completed today

- Added a stable local opener: `START_HERE.html`.
- Added pronunciation buttons using the browser speech feature.
- Added word family support for custom words.
- Added search support for word family forms and Chinese text.
- Split the project into clearer files under `src/`.
- Added backup export for custom words and learning progress.
- Added backup import with two modes:
  - `合并导入`: keeps current words and adds non-duplicate backup words.
  - `恢复备份`: replaces current custom words and progress with the backup.
- Added before/after import confirmation messages.
- Added a unified Quiz range panel.
- Added Quiz quick presets:
  - `全部词`
  - `正在学`
  - `只练易忘`
  - `已掌握`
- Added Quiz filters:
  - Category
  - Level
  - Status
  - Number
- Cleaned up the old duplicate Quiz cards so the Quiz page now has one main workflow.
- Added CSV batch import on the Add page.
- Added a downloadable CSV template.
- CSV import supports required columns plus optional word family columns.
- CSV import skips duplicate words and reports added/skipped/error counts.
- CSV import now lets the user choose whether imported words start as `新单词` or `正在学`.
- Generated `word-packs/year9-australia-pack-100.csv` with 100 extra Year 9 vocabulary words.
- Generated `word-packs/year9-australia-pack-2-100.csv` with a second 100-word Year 9 vocabulary pack.
- Added `src/data/csvPacks.js` for automatic built-in CSV pack loading, so the published website opens with 277 built-in words automatically.
- Added duplicate protection while combining starter words with the two built-in CSV packs.
- Added Supabase email/password login gate using the project publishable key.
- Added a new Learn page.
- Learn mode lets the user study `新单词`, `正在学`, `新单词 + 正在学`, or `容易忘` words.
- Optimized Learn page with a three-step learning path, source preset cards, summary counts, progress bar, and clearer learning cards.
- Learn cards show pronunciation, Chinese meaning, English definition, example, notes, and word family.
- Learn actions can mark words as `正在学` or `容易忘`, then send the learned set into Quiz.
- Added bulk status changes in the Words view for the current filtered word list.
- Updated `README.md` and `AI_HANDOFF.md`.

## What works now

- Home dashboard.
- Word bank with search and filters.
- Bulk status editing for filtered words.
- Guided Learn mode before Quiz.
- Add custom words.
- Import custom words from CSV.
- Optional word family fields when adding words.
- Search by English, Chinese, definitions, examples, notes, and word family forms.
- Mark words as new, learning, difficult, or mastered.
- Spelling quiz: Chinese prompt, English answer.
- Flashcard review.
- Quiz range selection for large future word packs.
- Browser pronunciation for built-in and custom words.
- Local saving with browser `localStorage`.
- JSON backup export/import.
- CSV word-list import.
- Supabase login/register/sign-out gate.

## Supabase status

- Project URL: `https://aahrmanmulxjxjttfboj.supabase.co`
- Frontend key type: publishable key
- Login gate: implemented
- Cloud database sync: not implemented yet
- Important: never add a Supabase secret key, service role key, or database password to frontend files.

## Verified checks

The following code checks passed:

- `src/app.js`
- `src/utils/html.js`
- `src/utils/storage.js`
- `src/utils/wordForms.js`
- `src/utils/speech.js`
- `src/data/vocabulary.js`
- `src/utils/cloud.js`

Also tested with simulated page checks:

- Settings backup import UI renders.
- Add page CSV import UI renders.
- Backup validation accepts valid backups and blocks invalid backups.
- Merge import adds new words and skips duplicates.
- CSV import accepts valid rows, skips duplicates, and records row errors.
- `word-packs/year9-australia-pack-100.csv` was checked with the app CSV parser: 100 importable rows, 0 duplicate rows against the starter pack, 0 row errors.
- `word-packs/year9-australia-pack-2-100.csv` was checked as a second CSV pack: 100 data rows, 0 duplicate words against the starter pack and pack 1, 0 missing required fields.
- Built-in vocabulary count was checked: 77 starter words + 200 extra-pack words = 277 built-in words.
- Supabase auth files passed JavaScript syntax checks.
- Learn page renders and updates word status correctly in simulation.
- Words bulk status changes update the filtered word set correctly in simulation.
- Quiz range UI renders.
- Quiz count filters work.
- Unified Quiz UI removed the old duplicate cards.
- `只练易忘` preset switches the Quiz range correctly.

Browser automation note: the in-app browser control tool returned `Browser is not available: iab`, so visual browser automation was not available from Codex. The user manually viewed the UI and said it looks good.

## Data notes

The app stores personal data in the browser:

- Custom words
- Learning progress

Storage keys:

- `my-vocab-lab-state-v1`
- `my-vocab-lab-custom-words-v1`

Use `Settings -> 导出备份` regularly. Keep the JSON backup somewhere safe, such as iCloud, Google Drive, USB, or GitHub.

## Recommended next steps

1. Open the GitHub Pages site and confirm it shows 277 words on phone and computer.
2. Add larger word packs by category, such as School, Science, Writing, Daily Life, and Humanities.
3. Add more word family data for starter words.
4. Add spaced repetition dates so review timing becomes smarter.
5. Add PWA support so the site can be installed like an app on phone/tablet.
6. Add Supabase database tables, Row Level Security policies, and cloud save/load for custom words and progress.

## Advice for the next AI

Continue from the existing files. Do not rewrite the app from scratch. Keep the site static unless the user explicitly asks for a backend/cloud version.

Before making changes:

- Read `README.md`.
- Read `AI_HANDOFF.md`.
- Read this `PROJECT_STATUS.md`.
- Run syntax checks after editing.

The user prefers practical, beginner-friendly explanations in Chinese.
