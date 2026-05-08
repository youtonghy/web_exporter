const api = typeof browser !== "undefined" ? browser : chrome;
const DEFAULT_PAPER_WIDTH_IN = 8.27;
const DEFAULT_PAPER_HEIGHT_IN = 11.69;

function normalizePaperDimension(value, fallback) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    return fallback;
  }
  return numberValue;
}

function captureVisibleTab(windowId) {
  if (!api || !api.tabs || typeof api.tabs.captureVisibleTab !== "function") {
    return Promise.reject(new Error("Tabs capture API unavailable"));
  }

  return new Promise((resolve, reject) => {
    try {
      const maybePromise = api.tabs.captureVisibleTab(
        windowId,
        { format: "png" },
        (dataUrl) => {
          const err = api.runtime && api.runtime.lastError;
          if (err) {
            reject(err);
            return;
          }
          resolve(dataUrl);
        }
      );

      if (maybePromise && typeof maybePromise.then === "function") {
        maybePromise.then(resolve, reject);
      }
    } catch (error) {
      reject(error);
    }
  });
}

function printToPdfCdp(sender, sendResponse, options = {}) {
  const tabId = sender && sender.tab ? sender.tab.id : undefined;
  if (!tabId) {
    sendResponse({ ok: false, error: "No active tab" });
    return;
  }
  if (!api.debugger || typeof api.debugger.attach !== "function") {
    sendResponse({ ok: false, error: "Debugger API not available" });
    return;
  }

  const debuggee = { tabId };
  api.debugger.attach(debuggee, "1.3")
    .then(() => api.debugger.sendCommand(debuggee, "Page.printToPDF", {
      printBackground: true,
      paperWidth: normalizePaperDimension(options.paperWidth, DEFAULT_PAPER_WIDTH_IN),
      paperHeight: normalizePaperDimension(options.paperHeight, DEFAULT_PAPER_HEIGHT_IN),
      marginTop: 0,
      marginBottom: 0,
      marginLeft: 0,
      marginRight: 0,
      displayHeaderFooter: false,
      preferCSSPageSize: true
    }))
    .then(({ data }) => {
      api.debugger.detach(debuggee).catch(() => {});
      sendResponse({ ok: true, base64: data });
    })
    .catch((error) => {
      api.debugger.detach(debuggee).catch(() => {});
      sendResponse({ ok: false, error: error && error.message ? error.message : String(error) });
    });
}

if (api && api.runtime && api.runtime.onMessage) {
  api.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || !message.type) {
      return;
    }

    if (message.type === "CAPTURE_VISIBLE_TAB") {
      const windowId = sender && sender.tab ? sender.tab.windowId : undefined;
      captureVisibleTab(windowId)
        .then((dataUrl) => {
          sendResponse({ ok: true, dataUrl });
        })
        .catch((error) => {
          sendResponse({ ok: false, error: error && error.message ? error.message : String(error) });
        });
      return true;
    }

    if (message.type === "PRINT_TO_PDF_CDP") {
      printToPdfCdp(sender, sendResponse, message);
      return true;
    }
  });
}

if (globalThis.__WEB_EXPORTER_TEST_HOOKS__) {
  globalThis.__WEB_EXPORTER_TEST_HOOKS__ = {
    normalizePaperDimension,
    printToPdfCdp
  };
}
