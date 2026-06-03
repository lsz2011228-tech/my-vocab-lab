# My Vocab Lab

My Vocab Lab is a personal English vocabulary website for a Year 9 student studying in Australia. It starts with a focused built-in word pack for school, writing, daily life, science, maths, humanities, feelings, and study skills.

## Open the website

Open `START_HERE.html` in a browser, or open `index.html` directly. The app is static and does not need a server for the first version.

Do not rely on an old `localhost` link unless a preview server is currently running. A `localhost` link can stop working when the background terminal/server stops. The file version is the stable local way to open this project.

## What works in version 1

- Six-section app structure: Home, Words, Learn, Quiz, Add, and Settings.
- Responsive app-style UI with a dashboard Home view and mobile bottom navigation.
- Built-in starter vocabulary pack.
- Built-in extra vocabulary packs loaded from CSV, so the published website opens with 277 words before any personal imports.
- Search by English, Chinese, definition, example, or note.
- Search by word family forms, such as finding `improve` when searching `improvement`.
- Filter by category, level, and learning status.
- Add your own words.
- Import your own words from a CSV file.
- Optionally add word family forms when adding a custom word.
- Delete words that you added yourself.
- Mark words as new, learning, difficult, or mastered.
- Bulk change the status of the current filtered word list.
- Learn mode with a guided path, source presets, learning cards, and direct Quiz handoff.
- Quick review mode with show-answer flow.
- Spelling quiz mode: Chinese prompt, English typing, first-letter hint, and automatic difficult-word marking for wrong answers.
- Unified Quiz range mode with quick presets, category, level, status, and practice-count filters.
- Pronunciation buttons for built-in and custom words using the browser's speech feature.
- Browser local saving for custom words and progress.
- Supabase email/password login gate for private access.
- Export a JSON backup of custom words and progress.
- Import a JSON backup with either safe merge mode or full restore mode.

## App sections

- `Home`: dashboard, quick actions, category shortcuts, and difficult-word preview.
- `Words`: full word bank with search, category, level, status filters, and bulk status changes.
- `Learn`: guided learning path with source presets, category, level, count filters, learning cards, and direct Quiz handoff.
- `Quiz`: spelling quiz and flashcard review with optional range filters.
- `Add`: form for adding one custom word, plus CSV batch import.
- `Settings`: backup export/import and local storage summary.

## Project structure

```text
assets/
  study-banner.png
word-packs/
  year9-australia-pack-100.csv
  year9-australia-pack-2-100.csv
src/
  app.js
  data/csvPacks.js
  data/vocabulary.js
  styles/main.css
  utils/
    cloud.js
    html.js
    speech.js
    storage.js
    wordForms.js
index.html
START_HERE.html
README.md
AI_HANDOFF.md
PROJECT_STATUS.md
```

## Code structure

- `src/app.js`: main app state, page rendering, navigation, quiz, review, and word actions.
- `src/data/csvPacks.js`: loads the two CSV packs into the built-in vocabulary before the app starts.
- `src/utils/cloud.js`: Supabase project URL, publishable key, and auth client setup.
- `src/utils/storage.js`: localStorage helpers.
- `src/utils/wordForms.js`: word family parsing, search tokens, and display.
- `src/utils/speech.js`: pronunciation button and browser speech.
- `src/utils/html.js`: safe text escaping for HTML output.

## How to add built-in words

Add new objects to `src/data/vocabulary.js` using this shape:

```js
{
  id: "unique-id",
  word: "assignment",
  meaningZh: "作业 / 任务",
  definition: "a piece of work given by a teacher",
  example: "I need to submit my assignment by Friday.",
  category: "School",
  level: "Essential",
  notes: "Optional study note.",
  forms: {
    noun: ["assignment"],
    verb: ["assign"],
    adjective: ["assigned"],
    past: ["assigned"],
    participle: ["assigned"],
    ing: ["assigning"],
    plural: ["assignments"]
  }
}
```

Keep `id` unique and stable because progress is saved by id.

`forms` is optional. When present, it appears on the word card and is included in search. This lets a search for a derived form show the root word card instead of needing a separate card for every form.

## Data storage

The app saves data in the browser with `localStorage`:

- `my-vocab-lab-state-v1`
- `my-vocab-lab-custom-words-v1`

This is good for the local data layer. The current app also has a Supabase login gate, and a future version can move custom words and progress into Supabase tables for true phone/computer sync.

## Supabase login

The app loads Supabase from the official CDN package and creates a browser client in `src/utils/cloud.js`.

- Project URL: `https://aahrmanmulxjxjttfboj.supabase.co`
- Key type used in the app: publishable key

Do not put a `secret` key, `service_role` key, or database password in the frontend files.

Use `Settings -> 导出备份` to download a JSON backup.

Use `Settings -> 导入备份` to choose that JSON file. There are two import modes:

- `合并导入`: the safer default. It keeps the current words, adds backup words that are not already present, and skips duplicates.
- `恢复备份`: replaces the current saved custom words and progress with the backup file. Use this when moving to a new computer or recovering from broken/missing data.

Before importing, the app shows the current word count, backup word count, and expected result. After importing, it shows how many words were added, skipped, or restored.

## CSV word import

Use `Add -> 批量导入词表` to import a CSV file. The required columns are:

- `word`
- `meaningZh`
- `definition`
- `example`

Optional columns:

- `category`
- `level`
- `notes`
- `noun`
- `verb`
- `adjective`
- `adverb`
- `past`
- `participle`
- `ing`
- `plural`

Before choosing the CSV file, select whether imported words should start as `新单词` or `正在学`. The app skips duplicate words and reports how many rows were added, skipped, or invalid. Use the `下载模板` button in the app to download a starter CSV template.

A ready-made pack is included:

- `word-packs/year9-australia-pack-100.csv`
- `word-packs/year9-australia-pack-2-100.csv`

Import these files from the Add page to add extra Year 9 vocabulary words. Each pack contains 100 words and is designed to be imported as a CSV file.

The published app also loads these two packs as built-in vocabulary from the `word-packs/` folder, so a fresh browser opens with 277 words automatically. The CSV files are still kept as reusable import/export-style word pack files.

## Pronunciation

Pronunciation uses the browser Web Speech API (`speechSynthesis`). It reads the English word text directly, so custom words added by the user also get pronunciation automatically. Voice quality and accent depend on the device/browser; the app prefers `en-AU`, then falls back to other English voices.
