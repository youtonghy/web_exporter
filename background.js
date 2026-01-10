const api = typeof browser !== "undefined" ? browser : chrome;

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

if (api && api.runtime && api.runtime.onMessage) {
  api.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || message.type !== "CAPTURE_VISIBLE_TAB") {
      return;
    }

    const windowId = sender && sender.tab ? sender.tab.windowId : undefined;
    captureVisibleTab(windowId)
      .then((dataUrl) => {
        sendResponse({ ok: true, dataUrl });
      })
      .catch((error) => {
        sendResponse({ ok: false, error: error && error.message ? error.message : String(error) });
      });

    return true;
  });
}
