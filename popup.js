const api = typeof browser !== "undefined" ? browser : chrome;
const i18n = globalThis.WebExporterI18n;
const { t, applyTranslations, getLocale } = i18n;

const statusEl = document.getElementById("status");
const formatSelect = document.getElementById("exportFormat");
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

function sendMessage(tabId, message) {
  return new Promise((resolve, reject) => {
    api.tabs.sendMessage(tabId, message, (response) => {
      const err = api.runtime && api.runtime.lastError;
      if (err) {
        reject(err);
        return;
      }
      resolve(response);
    });
  });
}

function injectContentScript(tabId) {
  if (api.scripting && api.scripting.executeScript) {
    return new Promise((resolve, reject) => {
      api.scripting.executeScript(
        {
          target: { tabId },
          files: ["content.js"]
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
    return new Promise((resolve, reject) => {
      api.tabs.executeScript(tabId, { file: "content.js" }, () => {
        const err = api.runtime && api.runtime.lastError;
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  return Promise.reject(new Error(t("error.scripting_unavailable")));
}

function updateFormatUI() {
  const isMarkdown = formatSelect.value === "markdown";
  const isPng = formatSelect.value === "png";
  const isPdf = !isMarkdown && !isPng;

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
}

formatSelect.addEventListener("change", updateFormatUI);
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
      imagePackaging: imagePackagingToggle.checked
    };

    try {
      await sendMessage(tab.id, payload);
    } catch (error) {
      await injectContentScript(tab.id);
      await sendMessage(tab.id, payload);
    }

    window.close();
  } catch (error) {
    const detail = formatError(error);
    const baseMessage = t("status.injection_error");
    setStatus(detail ? `${baseMessage} (${detail})` : baseMessage);
  } finally {
    selectButton.disabled = false;
  }
});
