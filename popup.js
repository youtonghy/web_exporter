const api = typeof browser !== "undefined" ? browser : chrome;
const i18n = globalThis.WebExporterI18n;
const { t, applyTranslations, getLocale } = i18n;

const statusEl = document.getElementById("status");
const formatSelect = document.getElementById("exportFormat");
const pdfEngineSelect = document.getElementById("pdfEngine");
const pdfEngineRow = document.getElementById("pdfEngineRow");
const pdfEngineHint = document.getElementById("pdfEngineHint");
const preserveToggle = document.getElementById("preserveStyles");
const preserveRow = document.getElementById("preserveStylesRow");
const enhancedToggle = document.getElementById("enhancedImageLoading");
const enhancedRow = document.getElementById("enhancedImageLoadingRow");
const imagePackagingToggle = document.getElementById("imagePackaging");
const imagePackagingRow = document.getElementById("imagePackagingRow");
const selectButton = document.getElementById("selectAndExport");
let lastPreserveValue = preserveToggle.checked;
let lastEnhancedValue = enhancedToggle.checked;
let lastImagePackagingValue = imagePackagingToggle.checked;
let lastPdfEngineValue = pdfEngineSelect.value;

const isChrome = typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getManifest && chrome.runtime.getManifest().manifest_version === 3;
const isFirefox = typeof browser !== "undefined" && browser.runtime && typeof browser.runtime.getBrowserInfo === "function";

applyTranslations(document);
document.documentElement.lang = getLocale();
document.title = t("app.title");
if (api.action && api.action.setTitle) {
  api.action.setTitle({ title: t("action.title") });
} else if (api.browserAction && api.browserAction.setTitle) {
  api.browserAction.setTitle({ title: t("action.title") });
}

function setStatus(message) {
  statusEl.textContent = message || "";
}

function formatError(error) {
  if (!error) {
    return "";
  }
  if (typeof error === "string") {
    return error;
  }
  if (error.message) {
    return error.message;
  }
  return String(error);
}

function queryActiveTab() {
  return new Promise((resolve, reject) => {
    if (!api.tabs || !api.tabs.query) {
      reject(new Error(t("error.tabs_unavailable")));
      return;
    }
    api.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const err = api.runtime && api.runtime.lastError;
      if (err) {
        reject(err);
        return;
      }
      resolve(tabs);
    });
  });
}

function injectContentScript(tabId) {
  if (api.scripting && api.scripting.executeScript) {
    return new Promise((resolve, reject) => {
      api.scripting.executeScript(
        {
          target: { tabId },
          files: ["src/i18n/index.js", "content.js"]
        },
        () => {
          const err = api.runtime && api.runtime.lastError;
          if (err) {
            reject(err);
            return;
          }
          resolve();
        }
      );
    });
  }

  if (api.tabs && api.tabs.executeScript) {
    const executeFile = (file) => new Promise((resolve, reject) => {
      api.tabs.executeScript(tabId, { file }, () => {
        const err = api.runtime && api.runtime.lastError;
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
    return executeFile("src/i18n/index.js").then(() => executeFile("content.js"));
  }

  return Promise.reject(new Error(t("error.scripting_unavailable")));
}

function normalizeScriptResult(result) {
  if (Array.isArray(result) && result.length) {
    const first = result[0];
    return first && Object.prototype.hasOwnProperty.call(first, "result") ? first.result : first;
  }
  return result;
}

function callContentApi(tabId, payload) {
  const invoke = (data) => {
    const contentApi = globalThis.__WEB_EXPORTER_CONTENT_API__;
    if (!contentApi || contentApi.version < 2 || typeof contentApi.startSelectionFromPopup !== "function") {
      return { ok: false, error: "Content API unavailable" };
    }
    return contentApi.startSelectionFromPopup(data);
  };

  if (api.scripting && api.scripting.executeScript) {
    return new Promise((resolve, reject) => {
      api.scripting.executeScript(
        {
          target: { tabId },
          func: invoke,
          args: [payload]
        },
        (result) => {
          const err = api.runtime && api.runtime.lastError;
          if (err) {
            reject(err);
            return;
          }
          resolve(normalizeScriptResult(result));
        }
      );
    });
  }

  if (api.tabs && api.tabs.executeScript) {
    const code = `(${invoke.toString()})(${JSON.stringify(payload)});`;
    return new Promise((resolve, reject) => {
      api.tabs.executeScript(tabId, { code }, (result) => {
        const err = api.runtime && api.runtime.lastError;
        if (err) {
          reject(err);
          return;
        }
        resolve(normalizeScriptResult(result));
      });
    });
  }

  return Promise.reject(new Error(t("error.scripting_unavailable")));
}

async function startSelectionInTab(tabId, payload) {
  let response = null;
  try {
    response = await callContentApi(tabId, payload);
  } catch (error) {
    response = null;
  }

  if (response && response.ok) {
    return response;
  }

  await injectContentScript(tabId);
  response = await callContentApi(tabId, payload);
  if (!response || !response.ok) {
    throw new Error((response && response.error) || t("status.injection_error"));
  }
  return response;
}

function updatePdfEngineUI() {
  const isPdf = formatSelect.value === "pdf";
  if (!isPdf) {
    pdfEngineRow.style.display = "none";
    pdfEngineHint.style.display = "none";
    return;
  }

  pdfEngineRow.style.display = "";
  pdfEngineHint.style.display = "";

  const cdpOption = pdfEngineSelect.querySelector('option[value="cdp"]');
  const html2canvasOption = pdfEngineSelect.querySelector('option[value="html2canvas"]');
  const nativeOption = pdfEngineSelect.querySelector('option[value="native"]');

  if (isChrome) {
    cdpOption.disabled = false;
    nativeOption.disabled = false;
    html2canvasOption.disabled = true;
    if (pdfEngineSelect.value === "html2canvas" || !pdfEngineSelect.value) {
      pdfEngineSelect.value = "cdp";
    }
  } else if (isFirefox) {
    cdpOption.disabled = true;
    nativeOption.disabled = false;
    html2canvasOption.disabled = false;
    if (pdfEngineSelect.value === "cdp" || !pdfEngineSelect.value) {
      pdfEngineSelect.value = "html2canvas";
    }
  } else {
    cdpOption.disabled = true;
    html2canvasOption.disabled = true;
    nativeOption.disabled = false;
    pdfEngineSelect.value = "native";
  }

  const hintKey = pdfEngineSelect.value === "cdp"
    ? "hint.pdf_engine_cdp"
    : pdfEngineSelect.value === "html2canvas"
      ? "hint.pdf_engine_html2canvas"
      : "hint.pdf_engine_native";
  pdfEngineHint.setAttribute("data-i18n", hintKey);
  applyTranslations(pdfEngineHint.parentNode || pdfEngineHint);
}

function updateFormatUI() {
  const isMarkdown = formatSelect.value === "markdown";
  const isPng = formatSelect.value === "png";
  const isDebug = formatSelect.value === "debug";
  const isPdf = !isMarkdown && !isPng && !isDebug;

  if (isPdf) {
    preserveRow.style.display = "";
    preserveToggle.disabled = false;
    preserveToggle.checked = lastPreserveValue;
  } else {
    lastPreserveValue = preserveToggle.checked;
    preserveToggle.checked = false;
    preserveRow.style.display = "none";
    preserveToggle.disabled = true;
  }

  if (isPng) {
    enhancedRow.style.display = "";
    enhancedToggle.disabled = false;
    enhancedToggle.checked = lastEnhancedValue;
  } else {
    lastEnhancedValue = enhancedToggle.checked;
    enhancedToggle.checked = false;
    enhancedRow.style.display = "none";
    enhancedToggle.disabled = true;
  }

  if (isMarkdown) {
    imagePackagingRow.style.display = "";
    imagePackagingToggle.disabled = false;
    imagePackagingToggle.checked = lastImagePackagingValue;
  } else {
    lastImagePackagingValue = imagePackagingToggle.checked;
    imagePackagingToggle.checked = false;
    imagePackagingRow.style.display = "none";
    imagePackagingToggle.disabled = true;
  }

  updatePdfEngineUI();
}

formatSelect.addEventListener("change", updateFormatUI);
pdfEngineSelect.addEventListener("change", updatePdfEngineUI);
updateFormatUI();

selectButton.addEventListener("click", async () => {
  setStatus("");
  selectButton.disabled = true;

  try {
    const tabs = await queryActiveTab();
    const tab = tabs && tabs[0];
    if (!tab || typeof tab.id !== "number") {
      throw new Error(t("error.no_active_tab"));
    }

    const payload = {
      type: "START_SELECTION",
      preserveStyles: preserveToggle.checked,
      exportFormat: formatSelect.value,
      enhancedImageLoading: enhancedToggle.checked,
      imagePackaging: imagePackagingToggle.checked,
      pdfEngine: formatSelect.value === "pdf" ? pdfEngineSelect.value : undefined
    };

    await startSelectionInTab(tab.id, payload);

    window.close();
  } catch (error) {
    const detail = formatError(error);
    const baseMessage = t("status.injection_error");
    setStatus(detail ? `${baseMessage} (${detail})` : baseMessage);
  } finally {
    selectButton.disabled = false;
  }
});
