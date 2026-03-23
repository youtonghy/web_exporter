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

  get textContent() {
    return this.childNodes.map((child) => child.textContent || "").join("");
  }
}

class MockTextNode extends MockNode {
  constructor(value, ownerDocument = null) {
    super(3, ownerDocument);
    this.nodeValue = value;
  }

  get textContent() {
    return this.nodeValue;
  }
}

class MockStyleDeclaration {
  constructor() {
    this.__priorities = {};
  }

  setProperty(name, value, priority = "") {
    this[toCamelCase(name)] = String(value);
    this.__priorities[toCamelCase(name)] = String(priority || "");
  }

  getPropertyValue(name) {
    return this[toCamelCase(name)] || "";
  }

  getPropertyPriority(name) {
    return this.__priorities[toCamelCase(name)] || "";
  }
}

class MockClassList {
  constructor(owner, initial = []) {
    this.owner = owner;
    this.values = new Set(initial.filter(Boolean));
  }

  add(...tokens) {
    tokens.filter(Boolean).forEach((token) => this.values.add(token));
    this.owner.attributes.class = Array.from(this.values).join(" ");
  }

  remove(...tokens) {
    tokens.filter(Boolean).forEach((token) => this.values.delete(token));
    this.owner.attributes.class = Array.from(this.values).join(" ");
  }

  contains(token) {
    return this.values.has(token);
  }
}

class MockElement extends MockNode {
  constructor(tagName, ownerDocument, attrs = {}) {
    super(1, ownerDocument);
    this.tagName = tagName.toUpperCase();
    this.attributes = {};
    this.style = new MockStyleDeclaration();
    this.classList = new MockClassList(this);
    this.__computedStyle = {
      length: 0,
      overflow: "",
      overflowY: "",
      display: "",
      visibility: "",
      opacity: "1",
      height: "",
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
    const normalized = String(value);
    this.attributes[name] = normalized;
    if (name === "class") {
      this.classList = new MockClassList(this, normalized.split(/\s+/));
    }
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

  matches(selector) {
    const trimmed = selector.trim();
    if (!trimmed) {
      return false;
    }
    if (trimmed === "*") {
      return true;
    }
    if (trimmed.startsWith(".")) {
      return this.classList.contains(trimmed.slice(1));
    }
    if (trimmed.startsWith("#")) {
      return this.getAttribute("id") === trimmed.slice(1);
    }
    return this.tagName.toLowerCase() === trimmed.toLowerCase();
  }

  closest(selector) {
    const selectors = selector.split(",").map((item) => item.trim()).filter(Boolean);
    let current = this;
    while (current) {
      if (selectors.some((item) => current.matches(item))) {
        return current;
      }
      current = current.parentNode instanceof MockElement ? current.parentNode : null;
    }
    return null;
  }

  querySelectorAll(selector) {
    const selectors = selector.split(",").map((item) => item.trim()).filter(Boolean);
    const results = [];

    const visit = (node) => {
      node.childNodes.forEach((child) => {
        if (!(child instanceof MockElement)) {
          return;
        }
        if (selectors.some((item) => child.matches(item))) {
          results.push(child);
        }
        visit(child);
      });
    };

    visit(this);
    return results;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  get textContent() {
    return this.childNodes.map((child) => child.textContent || "").join("");
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

function text(value, ownerDocument = null) {
  return new MockTextNode(value, ownerDocument);
}

function loadContentHooks() {
  const source = fs.readFileSync(path.join(__dirname, "..", "content.js"), "utf8");
  const context = createTestContext();
  vm.createContext(context);
  vm.runInContext(source, context, { filename: "content.js" });
  return context.__WEB_EXPORTER_TEST_HOOKS__;
}

function setComputedStyle(node, values = {}) {
  node.__computedStyle = {
    length: 0,
    overflow: "",
    overflowY: "",
    display: "",
    visibility: "",
    opacity: "1",
    height: "",
    getPropertyValue(name) {
      return this[toCamelCase(name)] || "";
    },
    ...values
  };
}

function createMonacoSnippet(ownerDocument) {
  const snippet = createElement("div", ownerDocument, { class: "snippet ed-print-hidden" });
  const snipInner = createElement("div", ownerDocument, { class: "snip-inner" });
  const snipEditor = createElement("div", ownerDocument, { class: "snip-editor" });
  const edMonaco = createElement("div", ownerDocument, { class: "ed-monaco" });
  const monacoEditor = createElement("div", ownerDocument, { class: "monaco-editor" });
  const overflowGuard = createElement("div", ownerDocument, { class: "overflow-guard" });
  const scrollable = createElement("div", ownerDocument, { class: "monaco-scrollable-element editor-scrollable" });
  const linesContent = createElement("div", ownerDocument, { class: "lines-content" });
  const viewLines = createElement("div", ownerDocument, { class: "view-lines" });
  const viewLine = createElement("div", ownerDocument, { class: "view-line" });

  snippet.appendChild(snipInner);
  snipInner.appendChild(snipEditor);
  snipEditor.appendChild(edMonaco);
  edMonaco.appendChild(monacoEditor);
  monacoEditor.appendChild(overflowGuard);
  overflowGuard.appendChild(scrollable);
  scrollable.appendChild(linesContent);
  linesContent.appendChild(viewLines);
  viewLines.appendChild(viewLine);

  monacoEditor.style.height = "300px";
  overflowGuard.style.height = "300px";
  scrollable.style.height = "300px";
  viewLines.style.height = "6268px";
  linesContent.style.height = "6268px";

  monacoEditor.clientHeight = 300;
  monacoEditor.offsetHeight = 300;
  overflowGuard.clientHeight = 300;
  overflowGuard.offsetHeight = 300;
  scrollable.clientHeight = 300;
  scrollable.offsetHeight = 300;
  viewLines.scrollHeight = 6268;
  viewLines.clientHeight = 6268;
  viewLines.offsetHeight = 6268;
  linesContent.scrollHeight = 6268;
  linesContent.clientHeight = 6268;
  linesContent.offsetHeight = 6268;

  setComputedStyle(snippet, { display: "block", visibility: "visible", opacity: "1" });
  setComputedStyle(snipInner, { display: "block", visibility: "visible", opacity: "1" });
  setComputedStyle(snipEditor, { display: "block", visibility: "visible", opacity: "1" });
  setComputedStyle(edMonaco, { display: "block", visibility: "visible", opacity: "1" });
  setComputedStyle(monacoEditor, { display: "block", visibility: "visible", opacity: "1", height: "300px" });
  setComputedStyle(overflowGuard, { display: "block", visibility: "visible", opacity: "1", overflow: "hidden", overflowY: "hidden", height: "300px" });
  setComputedStyle(scrollable, { display: "block", visibility: "visible", opacity: "1", overflow: "hidden", overflowY: "hidden", height: "300px" });
  setComputedStyle(linesContent, { display: "block", visibility: "visible", opacity: "1", height: "6268px" });
  setComputedStyle(viewLines, { display: "block", visibility: "visible", opacity: "1", height: "6268px" });

  return {
    snippet,
    snipInner,
    snipEditor,
    edMonaco,
    monacoEditor,
    overflowGuard,
    scrollable,
    linesContent,
    viewLines,
    viewLine
  };
}

function createGenericCodeBlock(ownerDocument) {
  const wrapper = createElement("div", ownerDocument, { class: "amber-el amber-pre" });
  const content = createElement("div", ownerDocument, { class: "syntax-highlight" });
  content.appendChild(
    text(
      "Total time: 100\nNumber of drones: 2\nNumber of lanterns: 15\nDrones (starting location):\n1\n10\nLanterns (location, arrival time):\n1 1\n1 2\n1 3\n1 4\n1 5\n",
      ownerDocument
    )
  );
  wrapper.appendChild(content);

  wrapper.clientHeight = 80;
  wrapper.offsetHeight = 80;
  wrapper.scrollHeight = 240;
  content.clientHeight = 80;
  content.offsetHeight = 80;
  content.scrollHeight = 240;

  setComputedStyle(wrapper, {
    display: "block",
    visibility: "visible",
    opacity: "1",
    overflow: "hidden",
    overflowY: "hidden",
    fontFamily: '"Fira Code", monospace',
    height: "80px"
  });
  setComputedStyle(content, {
    display: "block",
    visibility: "visible",
    opacity: "1",
    overflow: "hidden",
    overflowY: "hidden",
    fontFamily: '"Fira Code", monospace',
    height: "80px"
  });

  return { wrapper, content };
}

function createEdAmberCodePair(ownerDocument) {
  const sourceText =
    "Total time: 100\nNumber of drones: 2\nNumber of lanterns: 15\nDrones (starting location):\n1\n10\nLanterns (location, arrival time):\n1 1\n1 2\n1 3\n1 4\n1 5\n";
  const root = createElement("section", ownerDocument);
  const screenCard = createElement("div", ownerDocument, { class: "amber-display-codeblock amber-el amber-content ed-print-hidden" });
  const screenSlot = createElement("div", ownerDocument, { class: "amdiscb-slot" });
  const screenPre = createElement("div", ownerDocument, { class: "amber-el amber-pre" });
  const screenSyntax = createElement("div", ownerDocument, { class: "syntax-highlight" });
  const printCard = createElement("div", ownerDocument, { class: "amber-display-codeblock amber-el amber-content ed-print-visible" });
  const printSlot = createElement("div", ownerDocument, { class: "amdiscb-slot" });
  const printPre = createElement("div", ownerDocument, { class: "amber-el amber-pre" });
  const printSyntax = createElement("div", ownerDocument, { class: "syntax-highlight" });

  screenSyntax.appendChild(text(sourceText, ownerDocument));
  printSyntax.appendChild(text(sourceText, ownerDocument));
  screenPre.appendChild(screenSyntax);
  printPre.appendChild(printSyntax);
  screenSlot.appendChild(screenPre);
  printSlot.appendChild(printPre);
  screenCard.appendChild(screenSlot);
  printCard.appendChild(printSlot);
  root.appendChild(screenCard);
  root.appendChild(printCard);

  [screenCard, screenSlot, screenPre, screenSyntax, printCard, printSlot, printPre, printSyntax].forEach((node) => {
    node.clientHeight = 90;
    node.offsetHeight = 90;
    node.scrollHeight = 260;
  });

  setComputedStyle(screenCard, {
    display: "block",
    visibility: "visible",
    opacity: "1",
    overflow: "hidden",
    overflowY: "hidden",
    fontFamily: '"Source Code Pro", monospace',
    height: "90px"
  });
  setComputedStyle(screenSlot, {
    display: "block",
    visibility: "visible",
    opacity: "1",
    overflow: "hidden",
    overflowY: "hidden",
    whiteSpace: "pre",
    fontFamily: '"Source Code Pro", monospace',
    height: "90px"
  });
  setComputedStyle(screenPre, {
    display: "block",
    visibility: "visible",
    opacity: "1",
    overflow: "hidden",
    overflowY: "hidden",
    fontFamily: '"Source Code Pro", monospace',
    height: "90px"
  });
  setComputedStyle(screenSyntax, {
    display: "block",
    visibility: "visible",
    opacity: "1",
    overflow: "hidden",
    overflowY: "hidden",
    fontFamily: '"Source Code Pro", monospace',
    height: "90px"
  });
  setComputedStyle(printCard, {
    display: "none",
    visibility: "visible",
    opacity: "1",
    overflow: "hidden",
    overflowY: "hidden",
    fontFamily: '"Source Code Pro", monospace',
    height: "90px"
  });
  setComputedStyle(printSlot, {
    display: "block",
    visibility: "visible",
    opacity: "1",
    overflow: "hidden",
    overflowY: "hidden",
    whiteSpace: "pre",
    fontFamily: '"Source Code Pro", monospace',
    height: "90px"
  });
  setComputedStyle(printPre, {
    display: "block",
    visibility: "visible",
    opacity: "1",
    overflow: "hidden",
    overflowY: "hidden",
    fontFamily: '"Source Code Pro", monospace',
    height: "90px"
  });
  setComputedStyle(printSyntax, {
    display: "block",
    visibility: "visible",
    opacity: "1",
    overflow: "hidden",
    overflowY: "hidden",
    fontFamily: '"Source Code Pro", monospace',
    height: "90px"
  });

  return {
    root,
    screenCard,
    screenSlot,
    screenPre,
    screenSyntax,
    printCard,
    printSlot,
    printPre,
    printSyntax
  };
}

test("resolves Monaco visual selection to the snippet root for pdf exports", () => {
  const hooks = loadContentHooks();
  const ownerDocument = { defaultView: { getComputedStyle(node) { return node.__computedStyle; } } };
  const snippet = createMonacoSnippet(ownerDocument);

  assert.equal(hooks.resolveSelectableTarget(snippet.viewLine, "pdf"), snippet.snippet);
  assert.equal(hooks.getVisualExportRoot(snippet.viewLine), snippet.snippet);
});

test("keeps print-hidden Monaco cards visible in the print clone", () => {
  const hooks = loadContentHooks();
  const ownerDocument = { defaultView: { getComputedStyle(node) { return node.__computedStyle; } } };
  const source = createMonacoSnippet(ownerDocument).snippet;
  const clone = createMonacoSnippet(ownerDocument).snippet;

  const applied = hooks.applyPrintVisibilityOverrides(source, clone);

  assert.equal(applied, 1);
  assert.equal(clone.style.display, "block");
  assert.equal(clone.style.visibility, "visible");
  assert.equal(clone.style.opacity, "1");
  assert.equal(clone.style.getPropertyPriority("display"), "important");
});

test("expands Monaco editor containers to full content height", () => {
  const hooks = loadContentHooks();
  const ownerDocument = { defaultView: { getComputedStyle(node) { return node.__computedStyle; } } };
  const snippet = createMonacoSnippet(ownerDocument);

  const expanded = hooks.expandMonacoEditors(snippet.snippet);

  assert.equal(expanded, 5);
  assert.equal(snippet.snipEditor.style.height, "6268px");
  assert.equal(snippet.edMonaco.style.height, "6268px");
  assert.equal(snippet.monacoEditor.style.height, "6268px");
  assert.equal(snippet.overflowGuard.style.height, "6268px");
  assert.equal(snippet.scrollable.style.height, "6268px");
  assert.equal(snippet.scrollable.style.overflow, "visible");
});

test("resolves generic code-like div blocks to the outer wrapper for pdf exports", () => {
  const hooks = loadContentHooks();
  const ownerDocument = { defaultView: { getComputedStyle(node) { return node.__computedStyle; } } };
  const block = createGenericCodeBlock(ownerDocument);

  assert.equal(hooks.resolveSelectableTarget(block.content, "pdf"), block.wrapper);
  assert.equal(hooks.getVisualExportRoot(block.content), block.wrapper);
  assert.equal(hooks.getGenericCodeBlockRoot(block.content), block.wrapper);
});

test("resolves Ed Amber visual selection to the outer code card for pdf exports", () => {
  const hooks = loadContentHooks();
  const ownerDocument = { defaultView: { getComputedStyle(node) { return node.__computedStyle; } } };
  const block = createEdAmberCodePair(ownerDocument);

  assert.equal(hooks.resolveSelectableTarget(block.screenSyntax, "pdf"), block.screenCard);
  assert.equal(hooks.getVisualExportRoot(block.screenSyntax), block.screenCard);
});

test("preserves line breaks for generic div code blocks in print clone", () => {
  const hooks = loadContentHooks();
  const ownerDocument = { defaultView: { getComputedStyle(node) { return node.__computedStyle; } } };
  const source = createGenericCodeBlock(ownerDocument).wrapper;
  const clone = createGenericCodeBlock(ownerDocument).wrapper;

  const applied = hooks.applyGenericCodeBlockFormatting(source, clone);

  assert.equal(applied, 2);
  assert.equal(clone.style.whiteSpace, "pre-wrap");
  assert.equal(clone.style.overflowWrap, "anywhere");
  assert.equal(clone.style.display, "block");
  assert.equal(clone.style.fontFamily, '"Fira Code", monospace');
  assert.equal(clone.style.height, "240px");
});

test("expands generic div code block containers with hidden overflow", async () => {
  const hooks = loadContentHooks();
  const ownerDocument = { defaultView: { getComputedStyle(node) { return node.__computedStyle; } } };
  const source = createGenericCodeBlock(ownerDocument).wrapper;
  const clone = createGenericCodeBlock(ownerDocument).wrapper;

  await hooks.prepareMountedPrintRoot(source, clone);

  assert.equal(clone.style.height, "240px");
  assert.equal(clone.style.maxHeight, "none");
  assert.equal(clone.style.overflow, "visible");
  assert.equal(clone.style.whiteSpace, "pre-wrap");
});

test("keeps only the visible Ed Amber screen clone and expands it for print", async () => {
  const hooks = loadContentHooks();
  const ownerDocument = { defaultView: { getComputedStyle(node) { return node.__computedStyle; } } };
  const source = createEdAmberCodePair(ownerDocument);
  const clone = createEdAmberCodePair(ownerDocument);

  await hooks.prepareMountedPrintRoot(source.root, clone.root);

  assert.equal(clone.screenCard.style.display, "block");
  assert.equal(clone.screenCard.style.getPropertyPriority("display"), "important");
  assert.equal(clone.printCard.style.display, "none");
  assert.equal(clone.printCard.style.getPropertyPriority("display"), "important");
  assert.equal(clone.screenSlot.style.whiteSpace, "pre-wrap");
  assert.equal(clone.screenSyntax.style.whiteSpace, "pre-wrap");
  assert.equal(clone.screenSlot.style.overflow, "visible");
  assert.equal(clone.screenSlot.style.maxHeight, "none");
  assert.equal(clone.screenSlot.style.height, "260px");
  assert.equal(clone.screenPre.style.height, "260px");
});

test("expands vertically scrollable block containers", () => {
  const hooks = loadContentHooks();
  const ownerDocument = { defaultView: { getComputedStyle(node) { return node.__computedStyle; } } };
  const root = createElement("section", ownerDocument);
  const block = createElement("div", ownerDocument);
  block.scrollHeight = 480;
  block.clientHeight = 120;
  setComputedStyle(block, { overflowY: "auto" });
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
  setComputedStyle(block, { overflowY: "auto" });
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
