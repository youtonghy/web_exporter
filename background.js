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

async function fetchExportAsset(url, fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== "function") {
    throw new Error("Fetch API unavailable");
  }

  const response = await fetchImpl(url, {
    credentials: "include",
    redirect: "follow"
  });

  if (!response || !response.ok) {
    const status = response ? `${response.status} ${response.statusText || ""}`.trim() : "Unknown error";
    throw new Error(`Asset request failed: ${status}`);
  }

  const buffer = await response.arrayBuffer();
  return {
    bytes: Array.from(new Uint8Array(buffer)),
    contentType: response.headers && typeof response.headers.get === "function" ? response.headers.get("content-type") || "" : "",
    finalUrl: response.url || url
  };
}

if (globalThis.__WEB_EXPORTER_TEST_HOOKS__) {
  globalThis.__WEB_EXPORTER_TEST_HOOKS__ = {
    captureVisibleTab,
    fetchExportAsset
  };
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

    if (message.type === "FETCH_EXPORT_ASSET") {
      fetchExportAsset(message.url)
        .then((asset) => {
          sendResponse({ ok: true, ...asset });
        })
        .catch((error) => {
          sendResponse({ ok: false, error: error && error.message ? error.message : String(error) });
        });

      return true;
    }
  });
}
