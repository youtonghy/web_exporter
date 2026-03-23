"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function toCamelCase(value) {
  return String(value).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

class MockNode {
  constructor(nodeType, ownerDocument = null) {
    this.nodeType = nodeType;
    this.ownerDocument = ownerDocument;
    this.parentNode = null;
    this.childNodes = [];
  }

  appendChild(child) {
    child.parentNode = this;
    child.ownerDocument = this.ownerDocument;
    this.childNodes.push(child);
    return child;
  }
}

class MockStyleDeclaration {
  setProperty(name, value) {
    this[toCamelCase(name)] = String(value);
  }

  getPropertyValue(name) {
    return this[toCamelCase(name)] || "";
  }
}

class MockElement extends MockNode {
  constructor(tagName, ownerDocument, attrs = {}) {
    super(1, ownerDocument);
    this.tagName = tagName.toUpperCase();
    this.attributes = {};
    this.style = new MockStyleDeclaration();
    this.__computedStyle = {
      length: 0,
      overflow: "",
      overflowY: "",
      getPropertyValue() {
        return "";
      }
    };
    this.scrollHeight = 0;
    this.clientHeight = 0;
    this.offsetHeight = 0;
    this._listeners = new Map();

    Object.entries(attrs).forEach(([name, value]) => {
      this.setAttribute(name, value);
    });
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }

  getAttribute(name) {
    return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null;
  }

  removeAttribute(name) {
    delete this.attributes[name];
  }

  addEventListener(type, handler) {
    const handlers = this._listeners.get(type) || [];
    handlers.push(handler);
    this._listeners.set(type, handlers);
  }

  removeEventListener(type, handler) {
    const handlers = this._listeners.get(type) || [];
    this._listeners.set(
      type,
      handlers.filter((item) => item !== handler)
    );
  }

  dispatchEvent(type) {
    const handlers = this._listeners.get(type) || [];
    handlers.slice().forEach((handler) => handler());
  }

  querySelectorAll(selector) {
    const normalized = selector.trim().toLowerCase();
    const results = [];

    const visit = (node) => {
      node.childNodes.forEach((child) => {
        if (!(child instanceof MockElement)) {
          return;
        }
        if (normalized === "*" || child.tagName.toLowerCase() === normalized) {
          results.push(child);
        }
        visit(child);
      });
    };

    visit(this);
    return results;
  }
}

class MockHTMLInputElement extends MockElement {}
class MockHTMLSelectElement extends MockElement {}
class MockHTMLScriptElement extends MockElement {}
class MockHTMLImageElement extends MockElement {}
class MockHTMLTextAreaElement extends MockElement {}
class MockHTMLIFrameElement extends MockElement {}
class MockHTMLCanvasElement extends MockElement {}

function createTestContext() {
  const document = {
    title: "fixture",
    fonts: { ready: Promise.resolve() },
    addEventListener() {},
    removeEventListener() {},
    getElementById() {
      return null;
    },
    createElement(tagName) {
      return createElement(tagName, document);
    }
  };

  const body = createElement("body", document);
  const head = createElement("head", document);
  const documentElement = createElement("html", document);
  document.body = body;
  document.head = head;
  document.documentElement = documentElement;
  document.defaultView = null;

  const window = {
    addEventListener() {},
    removeEventListener() {},
    print() {},
    open() {
      return null;
    },
    getComputedStyle(node) {
      return node.__computedStyle || {
        length: 0,
        overflow: "",
        overflowY: "",
        getPropertyValue() {
          return "";
        }
      };
    }
  };

  document.defaultView = window;

  const context = {
    console,
    setTimeout,
    clearTimeout,
    Blob,
    URL,
    Node: { ELEMENT_NODE: 1, TEXT_NODE: 3 },
    Element: MockElement,
    HTMLInputElement: MockHTMLInputElement,
    HTMLSelectElement: MockHTMLSelectElement,
    HTMLScriptElement: MockHTMLScriptElement,
    HTMLImageElement: MockHTMLImageElement,
    HTMLTextAreaElement: MockHTMLTextAreaElement,
    HTMLIFrameElement: MockHTMLIFrameElement,
    HTMLCanvasElement: MockHTMLCanvasElement,
    document,
    window,
    chrome: {
      runtime: {
        onMessage: {
          addListener() {}
        },
        sendMessage() {}
      }
    },
    WebExporterI18n: {
      t(key) {
        return key;
      }
    },
    alert() {},
    globalThis: null
  };

  context.globalThis = context;
  context.__WEB_EXPORTER_TEST_HOOKS__ = true;

  return context;
}

function createElement(tagName, ownerDocument, attrs = {}) {
  const normalized = tagName.toLowerCase();
  switch (normalized) {
    case "textarea":
      return new MockHTMLTextAreaElement(tagName, ownerDocument, attrs);
    case "iframe":
      return new MockHTMLIFrameElement(tagName, ownerDocument, attrs);
    case "img":
      return new MockHTMLImageElement(tagName, ownerDocument, attrs);
    case "input":
      return new MockHTMLInputElement(tagName, ownerDocument, attrs);
    case "select":
      return new MockHTMLSelectElement(tagName, ownerDocument, attrs);
    case "script":
      return new MockHTMLScriptElement(tagName, ownerDocument, attrs);
    case "canvas":
      return new MockHTMLCanvasElement(tagName, ownerDocument, attrs);
    default:
      return new MockElement(tagName, ownerDocument, attrs);
  }
}

function loadContentHooks() {
  const source = fs.readFileSync(path.join(__dirname, "..", "content.js"), "utf8");
  const context = createTestContext();
  vm.createContext(context);
  vm.runInContext(source, context, { filename: "content.js" });
  return context.__WEB_EXPORTER_TEST_HOOKS__;
}

test("expands vertically scrollable block containers", () => {
  const hooks = loadContentHooks();
  const ownerDocument = { defaultView: { getComputedStyle(node) { return node.__computedStyle; } } };
  const root = createElement("section", ownerDocument);
  const block = createElement("div", ownerDocument);
  block.scrollHeight = 480;
  block.clientHeight = 120;
  block.__computedStyle = {
    length: 0,
    overflow: "",
    overflowY: "auto",
    getPropertyValue() {
      return "";
    }
  };
  root.appendChild(block);

  const expanded = hooks.expandScrollableElements(root);

  assert.equal(expanded, 1);
  assert.equal(block.style.overflowY, "visible");
  assert.equal(block.style.maxHeight, "none");
  assert.equal(block.style.height, "480px");
});

test("does not touch non-scrollable containers", () => {
  const hooks = loadContentHooks();
  const ownerDocument = { defaultView: { getComputedStyle(node) { return node.__computedStyle; } } };
  const root = createElement("section", ownerDocument);
  const block = createElement("pre", ownerDocument);
  block.scrollHeight = 160;
  block.clientHeight = 160;
  block.__computedStyle = {
    length: 0,
    overflow: "",
    overflowY: "auto",
    getPropertyValue() {
      return "";
    }
  };
  root.appendChild(block);

  const expanded = hooks.expandScrollableElements(root);

  assert.equal(expanded, 0);
  assert.equal(block.style.height, undefined);
});

test("expands textarea content even without overflow style hints", () => {
  const hooks = loadContentHooks();
  const ownerDocument = { defaultView: { getComputedStyle(node) { return node.__computedStyle; } } };
  const root = createElement("section", ownerDocument);
  const textarea = createElement("textarea", ownerDocument);
  textarea.scrollHeight = 320;
  textarea.clientHeight = 100;
  root.appendChild(textarea);

  const expanded = hooks.expandScrollableElements(root);

  assert.equal(expanded, 1);
  assert.equal(textarea.style.height, "320px");
  assert.equal(textarea.style.maxHeight, "none");
});

test("expands same-origin iframe height to its document content", async () => {
  const hooks = loadContentHooks();
  const ownerDocument = { defaultView: { getComputedStyle(node) { return node.__computedStyle; } } };
  const root = createElement("section", ownerDocument);
  const iframe = createElement("iframe", ownerDocument);
  const iframeDocument = {
    readyState: "complete",
    body: createElement("body", ownerDocument),
    documentElement: createElement("html", ownerDocument)
  };
  iframeDocument.body.scrollHeight = 640;
  iframeDocument.body.clientHeight = 640;
  iframeDocument.body.offsetHeight = 640;
  iframeDocument.documentElement.scrollHeight = 640;
  iframeDocument.documentElement.clientHeight = 640;
  iframeDocument.documentElement.offsetHeight = 640;
  iframe.contentDocument = iframeDocument;
  root.appendChild(iframe);

  await hooks.prepareMountedPrintRoot(root);

  assert.equal(iframe.style.height, "640px");
  assert.equal(iframe.style.overflow, "hidden");
  assert.equal(iframe.style.maxHeight, "none");
});

test("skips inaccessible cross-origin iframes without throwing", async () => {
  const hooks = loadContentHooks();
  const ownerDocument = { defaultView: { getComputedStyle(node) { return node.__computedStyle; } } };
  const root = createElement("section", ownerDocument);
  const iframe = createElement("iframe", ownerDocument);

  Object.defineProperty(iframe, "contentDocument", {
    configurable: true,
    get() {
      throw new Error("cross-origin");
    }
  });

  root.appendChild(iframe);

  await assert.doesNotReject(async () => {
    await hooks.prepareMountedPrintRoot(root);
  });
  assert.equal(iframe.style.height, undefined);
});
