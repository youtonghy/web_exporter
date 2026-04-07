"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadBackgroundHooks(fetchImpl) {
  const source = fs.readFileSync(path.join(__dirname, "..", "background.js"), "utf8");
  const context = {
    console,
    Uint8Array,
    ArrayBuffer,
    fetch: fetchImpl,
    chrome: {
      runtime: {
        onMessage: {
          addListener() {}
        }
      },
      tabs: {
        captureVisibleTab() {}
      }
    },
    globalThis: null
  };

  context.globalThis = context;
  context.__WEB_EXPORTER_TEST_HOOKS__ = true;
  vm.createContext(context);
  vm.runInContext(source, context, { filename: "background.js" });
  return context.__WEB_EXPORTER_TEST_HOOKS__;
}

test("fetchExportAsset returns bytes and metadata for successful requests", async () => {
  const hooks = loadBackgroundHooks(async () => ({
    ok: true,
    url: "https://cdn.example.com/image.webp",
    headers: {
      get(name) {
        return name === "content-type" ? "image/webp" : "";
      }
    },
    async arrayBuffer() {
      return new Uint8Array([10, 20, 30]).buffer;
    }
  }));

  const result = await hooks.fetchExportAsset("https://example.com/image.webp");

  assert.deepEqual(Array.from(result.bytes), [10, 20, 30]);
  assert.equal(result.contentType, "image/webp");
  assert.equal(result.finalUrl, "https://cdn.example.com/image.webp");
});

test("fetchExportAsset throws on failed requests", async () => {
  const hooks = loadBackgroundHooks(async () => ({
    ok: false,
    status: 403,
    statusText: "Forbidden",
    headers: {
      get() {
        return "";
      }
    },
    async arrayBuffer() {
      return new ArrayBuffer(0);
    }
  }));

  await assert.rejects(() => hooks.fetchExportAsset("https://example.com/forbidden.png"), /403 Forbidden/);
});
