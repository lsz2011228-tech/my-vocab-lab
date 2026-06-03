# AI Handoff Notes

This project is a static vocabulary learning website. Please continue from the existing structure instead of rewriting the app from scratch unless the user explicitly asks.

## Current product goal

Help a Year 9 student newly studying in Australia build practical school English vocabulary. The first version should feel like a usable personal study tool, not a marketing landing page.

## Current implementation

- Entry point: `index.html`
- Stable local opener: `START_HERE.html`
- Current project summary: `PROJECT_STATUS.md`
- Main logic: `src/app.js`
- Starter word data: `src/data/vocabulary.js`
- Styling: `src/styles/main.css`
- Visual asset: `assets/study-banner.png`
- Generated CSV word packs: `word-packs/`
- Utility files:
  - `src/utils/html.js`: `escapeHtml`
  - `src/utils/storage.js`: `loadJson`, `saveJson`
  - `src/utils/wordForms.js`: word family helpers and labels
  - `src/utils/speech.js`: pronunciation rendering and speech synthesis

The app uses plain HTML, CSS, and browser-loaded JavaScript files. There is no build step and no framework dependency. Keep `index.html` script order intact because utilities are loaded before `src/app.js`.

For local use, prefer opening `START_HERE.html` or `index.html` with a `file://` URL. Old `localhost` preview URLs are temporary and fail whenever the preview server/background terminal stops.

The UI is a single-page app with six internal sections controlled by `activeView`:

- `home`: dashboard and quick actions.
- `words`: full word bank, filters, and bulk status changes for the current filtered list.
- `learn`: guided learning path before testing.
- `quiz`: spelling quiz and flashcard review.
- `add`: custom word form and CSV batch import.
- `settings`: backup export/import and storage summary.

The current UI is intentionally app-like rather than a landing page: Home is a dashboard, Words is the main vocabulary workbench, and mobile uses a fixed bottom navigation bar.

## Important behavior

- Progress and custom words are saved to browser `localStorage`.
- Built-in vocabulary entries must keep stable unique `id` values.
- User-created words are stored separately from the starter pack.
- CSV batch import lives in `src/app.js` and reads files from the Add view. Required columns are `word`, `meaningZh`, `definition`, and `example`; optional columns include `category`, `level`, `notes`, and word family keys.
- CSV import skips duplicate words against all current words, adds valid rows to `customWords`, lets the user choose whether imported words start as `new` or `learning`, and reports added/skipped/error counts.
- `word-packs/year9-australia-pack-100.csv` contains 100 extra Year 9 vocabulary words generated for import. It was checked with the app's CSV parser: 100 importable rows, 0 duplicates against the starter pack, 0 row errors.
- `word-packs/year9-australia-pack-2-100.csv` contains the second 100-word CSV pack. It was checked against the starter pack and pack 1: 100 data rows, 0 duplicate words, 0 missing required fields.
- Word family support is optional per word through a `forms` object with keys such as `noun`, `verb`, `adjective`, `adverb`, `past`, `participle`, `ing`, and `plural`.
- Search includes `forms`, so derived forms can surface the root word card.
- Words view has a bulk status panel. It applies the chosen status to the current `getFilteredWords()` result after confirmation.
- The Learn view is controlled by `learnFilters` with source presets, category, level, and count filters. It can study `new`, `learning`, `new + learning`, or `difficult` words.
- Learn UI includes a three-step path, source preset cards, summary counts, progress bar, and info-grid learning cards.
- In Learn mode, `我懂了` marks a word as `learning`, `还不熟` marks it as `difficult`, and a completed Learn set can be sent directly into Quiz.
- Home/quick practice buttons still pick up to 12 words.
- The Quiz view has one unified range panel controlled by `quizFilters` with quick presets, category, level, status, and count filters. `getScopedPracticeWords()` is used for both the scoped spelling quiz and scoped flashcard review.
- The spelling quiz flow shows Chinese meaning and asks for the English word. Wrong answers are marked `difficult`; correct answers increase score and can become `mastered`.
- Pronunciation uses browser `speechSynthesis`, so no audio files are stored. It reads `item.word` for built-in and custom words, preferring `en-AU` when available.
- Section navigation does not change storage keys; existing local progress and custom words should survive UI restructuring.
- Export downloads a JSON backup containing custom words and progress.
- Import reads a JSON backup from `Settings`, validates the backup shape, normalizes custom words/forms/progress, and asks for confirmation with before/after counts.
- Import has two modes: `merge` keeps current custom words, adds non-duplicate backup words, keeps current progress when keys overlap, and filters out progress records for skipped duplicate custom-word ids; `restore` replaces current custom words and progress with the backup.

## Recommended next features

1. Import `word-packs/year9-australia-pack-100.csv` and `word-packs/year9-australia-pack-2-100.csv` through the Add page and check the new words in Learn/Quiz.
2. Generate future CSV packs by subject if the first two packs feel useful.
3. Fill word family data for more starter words.
4. Add optional real dictionary audio if browser speech quality is not enough.
5. Add spaced repetition dates.
6. Add mobile install/PWA support.
7. Later, add GitHub backup, cloud storage, or account login if the user wants sync.

## Style guidance

- Keep the interface quiet, practical, and student-friendly.
- Prefer clear controls over decorative sections.
- Keep cards compact and readable on mobile.
- Avoid adding thousands of words at once; grow word packs gradually.
