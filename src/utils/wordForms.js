const formLabels = {
  noun: "Noun",
  verb: "Verb",
  adjective: "Adjective",
  adverb: "Adverb",
  past: "Past",
  participle: "Participle",
  ing: "-ing",
  plural: "Plural"
};

function collectFormsFromForm(data) {
  const forms = {
    noun: parseForms(data.get("formNoun")),
    verb: parseForms(data.get("formVerb")),
    adjective: parseForms(data.get("formAdjective")),
    adverb: parseForms(data.get("formAdverb")),
    past: parseForms(data.get("formPast")),
    participle: parseForms(data.get("formParticiple")),
    ing: parseForms(data.get("formIng")),
    plural: parseForms(data.get("formPlural"))
  };

  return Object.fromEntries(Object.entries(forms).filter(([, values]) => values.length));
}

function parseForms(value) {
  return String(value || "")
    .split(/[,;，；\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getFormsSearchTokens(forms) {
  if (!forms) return [];
  return Object.entries(forms).flatMap(([key, values]) => [
    key,
    formLabels[key] || key,
    ...normaliseFormValues(values)
  ]);
}

function normaliseFormValues(values) {
  if (!values) return [];
  return Array.isArray(values) ? values : [values];
}

function renderWordForms(forms) {
  const entries = Object.entries(forms || {}).filter(([, values]) => normaliseFormValues(values).length);
  if (!entries.length) return "";

  return `
    <div class="forms-box">
      <p class="forms-title">Word Family</p>
      <div class="forms-list">
        ${entries
          .map(
            ([key, values]) => `
              <div class="form-row">
                <span>${escapeHtml(formLabels[key] || key)}</span>
                <strong>${normaliseFormValues(values).map(escapeHtml).join(", ")}</strong>
              </div>
            `
          )
          .join("")}
      </div>
    </div>
  `;
}

window.formLabels = formLabels;
window.collectFormsFromForm = collectFormsFromForm;
window.getFormsSearchTokens = getFormsSearchTokens;
window.renderWordForms = renderWordForms;
