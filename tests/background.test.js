"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadBackgroundHooks(debuggerImpl) {
  const source = fs.readFileSync(path.join(__dirname, "..", "background.js"), "utf8");
  const context = {
    console,
    chrome: {
      runtime: {
        onMessage: {
          addListener() {}
        }
      },
      tabs: {
        captureVisibleTab() {}
      },
      debugger: debuggerImpl
    },
    globalThis: null
  };

  context.globalThis = context;
  context.__WEB_EXPORTER_TEST_HOOKS__ = true;
  vm.createContext(context);
  vm.runInContext(source, context, { filename: "background.js" });
  return context.__WEB_EXPORTER_TEST_HOOKS__;
}

test("normalizes optional CDP paper dimensions", () => {
  const hooks = loadBackgroundHooks();

  assert.equal(hooks.normalizePaperDimension(13.5, 8.27), 13.5);
  assert.equal(hooks.normalizePaperDimension("25", 11.69), 25);
  assert.equal(hooks.normalizePaperDimension(0, 8.27), 8.27);
  assert.equal(hooks.normalizePaperDimension("bad", 11.69), 11.69);
});

test("passes custom paper dimensions to Page.printToPDF", async () => {
  let printDebuggee = null;
  let printCommand = "";
  let printParams = null;
  const debuggerImpl = {
    attach() {
      return Promise.resolve();
    },
    sendCommand(debuggee, command, params) {
      printDebuggee = debuggee;
      printCommand = command;
      printParams = params;
      return Promise.resolve({ data: "JVBERi0x" });
    },
    detach() {
      return Promise.resolve();
    }
  };
  const hooks = loadBackgroundHooks(debuggerImpl);
  const response = await new Promise((resolve) => {
    hooks.printToPdfCdp(
      { tab: { id: 42 } },
      resolve,
      { paperWidth: 13.3333, paperHeight: 27.0833 }
    );
  });

  assert.equal(response.ok, true);
  assert.equal(printDebuggee.tabId, 42);
  assert.equal(printCommand, "Page.printToPDF");
  assert.equal(printParams.paperWidth, 13.3333);
  assert.equal(printParams.paperHeight, 27.0833);
  assert.equal(printParams.preferCSSPageSize, true);
});

test("uses standard paper dimensions when CDP dimensions are missing", async () => {
  let printParams = null;
  const debuggerImpl = {
    attach() {
      return Promise.resolve();
    },
    sendCommand(debuggee, command, params) {
      printParams = params;
      return Promise.resolve({ data: "JVBERi0x" });
    },
    detach() {
      return Promise.resolve();
    }
  };
  const hooks = loadBackgroundHooks(debuggerImpl);

  await new Promise((resolve) => {
    hooks.printToPdfCdp({ tab: { id: 42 } }, resolve);
  });

  assert.equal(printParams.paperWidth, 8.27);
  assert.equal(printParams.paperHeight, 11.69);
});
