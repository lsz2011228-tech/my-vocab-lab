(() => {
  const packs = [
    { path: "./word-packs/year9-australia-pack-100.csv", prefix: "pack1" },
    { path: "./word-packs/year9-australia-pack-2-100.csv", prefix: "pack2" }
  ];

  const starter = Array.isArray(window.starterVocabulary) ? window.starterVocabulary : [];
  const knownWords = new Set(starter.map((item) => normaliseWord(item.word)));
  const extraWords = [];

  packs.forEach((pack) => {
    const csv = loadCsv(pack.path);
    if (!csv) return;

    csvRowsToWords(csv, pack.prefix).forEach((item) => {
      const key = normaliseWord(item.word);
      if (!key || knownWords.has(key)) return;
      knownWords.add(key);
      extraWords.push(item);
    });
  });

  window.starterVocabulary = [...starter, ...extraWords];

  function loadCsv(path) {
    try {
      const request = new XMLHttpRequest();
      request.open("GET", path, false);
      request.send(null);
      return request.status === 200 || request.status === 0 ? request.responseText : "";
    } catch (error) {
      console.warn(`Could not load built-in CSV pack: ${path}`, error);
      return "";
    }
  }

  function csvRowsToWords(text, prefix) {
    const rows = parseCsvRows(text);
    if (rows.length < 2) return [];

    const headers = rows[0].map(normaliseHeader);
    return rows
      .slice(1)
      .map((row, index) => {
        const record = Object.fromEntries(headers.map((key, cellIndex) => [key, clean(row[cellIndex])]));
        if (!record.word || !record.meaningZh || !record.definition || !record.example) return null;

        return {
          id: `${prefix}-${slug(record.word, index + 2)}`,
          word: record.word,
          meaningZh: record.meaningZh,
          definition: record.definition,
          example: record.example,
          category: record.category || "My Words",
          level: record.level || "Useful",
          notes: record.notes || "",
          forms: collectForms(record)
        };
      })
      .filter(Boolean);
  }

  function parseCsvRows(text) {
    const rows = [];
    let row = [];
    let cell = "";
    let inQuotes = false;
    const csvText = String(text || "").replace(/^\uFEFF/, "");

    for (let index = 0; index < csvText.length; index += 1) {
      const char = csvText[index];
      const nextChar = csvText[index + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          cell += '"';
          index += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (char === "," && !inQuotes) {
        row.push(cell);
        cell = "";
        continue;
      }

      if ((char === "\n" || char === "\r") && !inQuotes) {
        if (char === "\r" && nextChar === "\n") index += 1;
        row.push(cell);
        rows.push(row);
        row = [];
        cell = "";
        continue;
      }

      cell += char;
    }

    row.push(cell);
    rows.push(row);
    return rows.filter((item) => item.some((cellValue) => clean(cellValue)));
  }

  function normaliseHeader(header) {
    const key = String(header || "")
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, "");
    const aliases = {
      meaningzh: "meaningZh",
      chinese: "meaningZh",
      zh: "meaningZh",
      meaning: "meaningZh",
      note: "notes",
      adj: "adjective",
      adv: "adverb"
    };
    return aliases[key] || key;
  }

  function collectForms(record) {
    const forms = {
      noun: splitForms(record.noun),
      verb: splitForms(record.verb),
      adjective: splitForms(record.adjective),
      adverb: splitForms(record.adverb),
      past: splitForms(record.past),
      participle: splitForms(record.participle),
      ing: splitForms(record.ing),
      plural: splitForms(record.plural)
    };
    return Object.fromEntries(Object.entries(forms).filter(([, values]) => values.length));
  }

  function splitForms(value) {
    return clean(value)
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function slug(word, fallback) {
    return normaliseWord(word)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || `word-${fallback}`;
  }

  function normaliseWord(value) {
    return clean(value).toLowerCase().replace(/\s+/g, " ");
  }

  function clean(value) {
    return String(value || "").trim();
  }
})();
