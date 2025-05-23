// Inject fonts
const style = document.createElement("style");
style.textContent = `
  @font-face {
    font-family: 'Boldonse';
    src: url('${chrome.runtime.getURL("fonts/Boldonse-Regular.ttf")}') format('truetype');
    font-weight: normal;
    font-style: normal;
  }
  @font-face {
    font-family: 'ComicSans';
    src: url('${chrome.runtime.getURL("fonts/ComicSansMS.ttf")}') format('truetype');
    font-weight: normal;
    font-style: normal;
  }
  @font-face {
    font-family: 'Nunito';
    src: url('${chrome.runtime.getURL(
      "fonts/Nunito-Medium.ttf",
    )}') format('truetype');
    font-weight: normal;
    font-style: normal;
  }
  @font-face {
    font-family: 'OpenDyslexic';
    src: url('${chrome.runtime.getURL(
      "fonts/OpenDyslexic-Regular.otf",
    )}') format('opentype');
    font-weight: normal;
    font-style: normal;
  }
  @font-face {
    font-family: 'Roboto';
    src: url('${chrome.runtime.getURL(
      "fonts/Roboto-Regular.ttf",
    )}') format('truetype');
    font-weight: normal;
    font-style: normal;
  }
  @font-face {
    font-family: 'SourGummy';
    src: url('${chrome.runtime.getURL("fonts/SourGummy-Regular.ttf")}') format('truetype');
    font-weight: normal;
    font-style: normal;
  }
  @font-face {
    font-family: 'IRANSansWeb_FaNum';
    src: url('${chrome.runtime.getURL("fonts/IRANSansWeb_FaNum.ttf")}') format('truetype');
    font-weight: normal;
    font-style: normal;
  }
`;
document.head.appendChild(style);

let speechSynthesisActive = false;

let originalStyles = {};
run_once = false;
let colorblindModeEnabled = false;

function saveSelection() {
  if (window.getSelection) {
    const sel = window.getSelection();
    if (sel.getRangeAt && sel.rangeCount) {
      return sel.getRangeAt(0);
    }
  }
  return null;
}

function restoreSelection(range) {
  if (range) {
    if (window.getSelection) {
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }
}

function speakText(text) {
  stopSpeech();

  const utterance = new SpeechSynthesisUtterance(text);

  chrome.storage.sync.get(
    ["speechVoice", "speechRate", "speechPitch"],
    (data) => {
      // Set default values if not found
      let voiceName = data.speechVoice || "";
      let rate = data.speechRate || 1;
      let pitch = data.speechPitch || 1;

      if (voiceName) {
        const voices = window.speechSynthesis.getVoices();
        const voice = voices.find((v) => v.name === voiceName);
        if (voice) {
          utterance.voice = voice;
        }
      }

      utterance.rate = rate;
      utterance.pitch = pitch;

      utterance.onstart = () => {
        speechSynthesisActive = true;
        console.log("Speech started");
      };

      utterance.onend = () => {
        speechSynthesisActive = false;
        console.log("Speech ended");
      };

      utterance.onerror = (event) => {
        speechSynthesisActive = false;
        console.error("Speech error:", event);
      };

      // Speak the text
      window.speechSynthesis.speak(utterance);
    },
  );
}

// Stop ongoing speech
function stopSpeech() {
  if (speechSynthesisActive) {
    window.speechSynthesis.cancel();
    speechSynthesisActive = false;
  }
}

function captureOriginalStyles() {
  originalStyles.body = {
    fontFamily: document.body.style.fontFamily,
    fontSize: document.body.style.fontSize,
    fontSpacing: document.body.style.letterSpacing,
    fontWeight: document.body.style.fontWeight,
    filter: document.body.style.filter,
  };

  // Capture the original font family and size of all elements
  originalStyles.elements = [];
  const allElements = document.querySelectorAll("*:not(script):not(style)");
  allElements.forEach((el) => {
    const style = window.getComputedStyle(el);
    const isVisible = style.display !== "none" && style.visibility !== "hidden";
    if (isVisible) {
      originalStyles.elements.push({
        element: el,
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        fontSpacing: style.letterSpacing,
        fontWeight: style.fontWeight,
      });
    }
  });

  originalStyles.html = document.documentElement.innerHTML;
}

if (run_once == false) {
  captureOriginalStyles();
  run_once = true;
}

function applyColorblindMode(enabled) {
  colorblindModeEnabled = enabled;
  console.log("Colorblind mode:", enabled ? "enabled" : "disabled");

  if (enabled) {
    document.body.style.filter = "contrast(105%) saturate(200%)";
  } else {
    document.body.style.filter = "none";
  }
}

async function callCohere(prompt) {
  try {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    if (!selectedText) return { error: "No text selected" };
    
    const savedRange = saveSelection();
    
    // Create loading overlay for selected text
    const loadingOverlay = document.createElement("span");
    loadingOverlay.style.display = "inline";
    loadingOverlay.style.position = "relative";
    loadingOverlay.style.animation = "highlight-pulse 1.5s ease-in-out infinite";
    loadingOverlay.innerHTML = selectedText;
    
    // Add loading animation styles if not already added
    if (!document.getElementById('loading-animation-style')) {
      const style = document.createElement("style");
      style.id = 'loading-animation-style';
      style.textContent = `
        @keyframes highlight-pulse {
          0% { background-color: rgba(200, 200, 200, 0.8); }
          50% { background-color: rgba(180, 180, 180, 0.9); }
          100% { background-color: rgba(200, 200, 200, 0.8); }
        }
        .processing-text {
          background-color: rgba(200, 200, 200, 0.8);
          border-radius: 2px;
          padding: 0 1px;
          margin: 0 -1px;
        }
      `;
      document.head.appendChild(style);
    }
    loadingOverlay.className = 'processing-text';

    // Replace selection with loading overlay
    savedRange.deleteContents();
    savedRange.insertNode(loadingOverlay);

    const res = await fetch(
      "https://textsavvy-backend.onrender.com/api/modify",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        mode: "cors",
        credentials: "omit",
        body: JSON.stringify({
          text: prompt,
          prompt: prompt,
        }),
      },
    );

    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    const data = await res.json();
    
    // Clean up loading animation
    loadingOverlay.remove();
    style.remove();
    
    return { text: data.text };
  } catch (error) {
    console.error("API error:", error);
    
    // Restore original text and remove loading animation
    if (loadingOverlay) {
      loadingOverlay.remove();
    }
    if (style) {
      style.remove();
    }
    
    // Show error message overlay
    const errorOverlay = document.createElement("span");
    errorOverlay.textContent = "Error processing text. Please try again.";
    errorOverlay.style.backgroundColor = "#ffebee";
    errorOverlay.style.color = "#c62828";
    errorOverlay.style.padding = "2px 5px";
    errorOverlay.style.borderRadius = "3px";
    errorOverlay.style.display = "inline-block";
    
    range.insertNode(errorOverlay);
    setTimeout(() => errorOverlay.remove(), 3000);
    
    return { error: error.message };
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.table(request);

  if (request.action === "modifyPageText") {
    const selection = window.getSelection().toString();
    if (!selection) return;

    const savedRange = saveSelection();
    const selectedText = selection;

    const prompt = request.prompt.replace("{{text}}", selectedText);
    callCohere(prompt).then((response) => {
      if (!response || !response.text) return;

      restoreSelection(savedRange);

      const newText = `<span style="background:rgba(132, 177, 132, 0.03);">${response.text}</span>`;
      const range = window.getSelection().getRangeAt(0);
      range.deleteContents();
      const temp = document.createElement("div");
      temp.innerHTML = newText;
      range.insertNode(temp.firstChild);
    });
  }

  if (request.action === "updateFont") {
    applyFontToAll(request.font, request.size, request.spacing);
  }

  if (request.action === "speakText") {
    const selection = window.getSelection().toString().trim();
    if (selection) {
      speakText(selection);
    }
  }

  function applyFontToAll(font, size, spacing) {
    document.body.style.fontFamily = font;
    document.body.style.fontSize = size + "px";
    console.log("Font: " + document.body.style.fontFamily);

    document.body.style.letterSpacing = spacing + "px";

    const allElements = document.querySelectorAll("*:not(script):not(style)");

    allElements.forEach((el) => {
      const style = window.getComputedStyle(el);
      const isVisible =
        style.display !== "none" && style.visibility !== "hidden";
      if (isVisible) {
        el.style.fontFamily = font;
        el.style.fontSize = size + "px";
        el.style.letterSpacing = spacing + "px";
      }
    });
  }

  if (request.action === "resetToDefault") {
    stopSpeech();

    resetToOriginalStyles();
  }

  function resetToOriginalStyles() {
    // Restore the original font family and size of the body
    document.body.style.fontFamily = originalStyles.body.fontFamily;
    document.body.style.fontSize = originalStyles.body.fontSize;
    document.body.style.letterSpacing = originalStyles.body.fontSpacing;
    document.body.style.fontWeight = originalStyles.body.fontWeight;
    document.body.style.filter = originalStyles.body.filter;

    // Restore the original font family and size of all elements
    originalStyles.elements.forEach((item) => {
      try {
        if (item.element && item.element.style) {
          item.element.style.fontFamily = item.fontFamily;
          item.element.style.fontSize = item.fontSize;
          item.element.style.letterSpacing = item.fontSpacing;
          item.element.style.fontWeight = item.fontWeight;
        }
      } catch (e) {
        console.log("Error resetting element:", e);
      }
    });

    const allSpans = document.querySelectorAll("span[style*='background']");
    allSpans.forEach((span) => {
      span.outerHTML = span.innerHTML;
    });

    colorblindModeEnabled = false;
    document.body.style.filter = "none";
  }

  if (request.action === "toggleBold") {
    toggleBoldAll(request.bold);
  }

  function toggleBoldAll(applyBold) {
    const allElements = document.querySelectorAll("*:not(script):not(style)");

    allElements.forEach((el) => {
      const style = window.getComputedStyle(el);
      const isVisible =
        style.display !== "none" && style.visibility !== "hidden";
      if (isVisible) {
        el.style.fontWeight = applyBold ? "bold" : "normal";
      }
    });
  }

  if (request.action === "translatePage") {
    handleTranslatePage(request.language);
  }

  if (request.action === "toggleColorblindMode") {
    applyColorblindMode(!colorblindModeEnabled);

    sendResponse({ colorblindModeEnabled: colorblindModeEnabled });
    return true;
  }
});

async function handleTranslatePage(language) {
  const selection = window.getSelection();
  const selectedText = selection.toString().trim();
  if (!selectedText) return;

  const savedRange = saveSelection();

  try {
    // Create loading overlay for selected text
    const loadingOverlay = document.createElement("span");
    loadingOverlay.style.display = "inline";
    loadingOverlay.style.position = "relative";
    loadingOverlay.style.animation = "highlight-pulse 1.5s ease-in-out infinite";
    loadingOverlay.innerHTML = selectedText;
    loadingOverlay.className = 'processing-text';
    
    // Add loading animation styles if not already added
    if (!document.getElementById('loading-animation-style')) {
      const style = document.createElement("style");
      style.id = 'loading-animation-style';
      style.textContent = `
        @keyframes highlight-pulse {
          0% { background-color: rgba(200, 200, 200, 0.8); }
          50% { background-color: rgba(180, 180, 180, 0.9); }
          100% { background-color: rgba(200, 200, 200, 0.8); }
        }
        .processing-text {
          background-color: rgba(200, 200, 200, 0.8);
          border-radius: 2px;
          padding: 0 1px;
          margin: 0 -1px;
        }
      `;
      document.head.appendChild(style);
    }

    // Replace selection with loading overlay
    savedRange.deleteContents();
    savedRange.insertNode(loadingOverlay);

    const res = await fetch(
      "https://textsavvy-backend.onrender.com/api/translate",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        mode: "cors",
        credentials: "omit",
        body: JSON.stringify({
          text: selectedText,
          language: language,
        }),
      },
    );

    // Remove loading indicator
    loadingOverlay.remove();

    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    const data = await res.json();

    if (!data || !data.text) {
      throw new Error("No translation received");
    }

    const newText = `<span style="background: #e3f2fd;">${data.text}</span>`;
    savedRange.deleteContents();
    const temp = document.createElement("div");
    temp.innerHTML = newText;
    savedRange.insertNode(temp.firstChild);
  } catch (error) {
    console.error("Translation error:", error);
    
    // Remove loading animation
    if (loadingOverlay) {
      loadingOverlay.remove();
    }
    
    // Show error message overlay
    const errorOverlay = document.createElement("span");
    errorOverlay.textContent = "Translation failed. Please try again.";
    errorOverlay.style.backgroundColor = "#ffebee";
    errorOverlay.style.color = "#c62828";
    errorOverlay.style.padding = "2px 5px";
    errorOverlay.style.borderRadius = "3px";
    errorOverlay.style.display = "inline-block";
    
    savedRange.insertNode(errorOverlay);
    setTimeout(() => errorOverlay.remove(), 3000);
  }
}
