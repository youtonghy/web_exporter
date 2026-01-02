const api = typeof browser !== "undefined" ? browser : chrome;

const statusEl = document.getElementById("status");
const formatSelect = document.getElementById("exportFormat");
const preserveToggle = document.getElementById("preserveStyles");
const preserveRow = document.getElementById("preserveStylesRow");
const selectButton = document.getElementById("selectAndExport");
let lastPreserveValue = preserveToggle.checked;

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
      reject(new Error("Tabs API unavailable"));
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

  return Promise.reject(new Error("Scripting API unavailable"));
}

function updateFormatUI() {
  const isMarkdown = formatSelect.value === "markdown";
  if (isMarkdown) {
    lastPreserveValue = preserveToggle.checked;
    preserveToggle.checked = false;
    preserveToggle.disabled = true;
    preserveRow.classList.add("is-disabled");
  } else {
    preserveToggle.disabled = false;
    preserveRow.classList.remove("is-disabled");
    preserveToggle.checked = lastPreserveValue;
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
      throw new Error("No active tab");
    }

    const payload = {
      type: "START_SELECTION",
      preserveStyles: preserveToggle.checked,
      exportFormat: formatSelect.value
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
    const baseMessage = "无法发送到页面或页面禁止注入脚本，请刷新页面或确认权限。";
    setStatus(detail ? `${baseMessage} (${detail})` : baseMessage);
  } finally {
    selectButton.disabled = false;
  }
});
