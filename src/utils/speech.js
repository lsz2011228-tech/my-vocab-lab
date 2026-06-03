function audioButton(text) {
  return `
    <button
      class="audio-button"
      type="button"
      data-speak="${escapeHtml(text)}"
      title="Listen to pronunciation"
      aria-label="Listen to ${escapeHtml(text)}"
    >♪</button>
  `;
}

function speakWord(text) {
  if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
    alert("This browser does not support pronunciation yet.");
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  const voices = window.speechSynthesis.getVoices();
  utterance.lang = "en-AU";
  utterance.rate = 0.86;
  utterance.pitch = 1;
  utterance.voice =
    voices.find((voice) => voice.lang === "en-AU") ||
    voices.find((voice) => voice.lang === "en-GB") ||
    voices.find((voice) => voice.lang === "en-US") ||
    voices.find((voice) => voice.lang?.startsWith("en")) ||
    null;

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

window.audioButton = audioButton;
window.speakWord = speakWord;
