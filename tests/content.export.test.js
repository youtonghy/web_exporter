"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { TextEncoder } = require("node:util");
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
    TextEncoder,
    Buffer,
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

function inlineStyleText(node) {
  return node.getAttribute("style") || "";
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
  const toolbar = createElement("div", ownerDocument, { class: "code-toolbar" });
  const runButton = createElement("button", ownerDocument, { class: "run-button" });
  const content = createElement("div", ownerDocument, { class: "syntax-highlight" });
  const inlineCode = createElement("code", ownerDocument);
  const keyword = createElement("span", ownerDocument, { class: "token keyword" });
  const stringToken = createElement("span", ownerDocument, { class: "token string" });

  runButton.appendChild(text("Run", ownerDocument));
  toolbar.appendChild(runButton);
  inlineCode.appendChild(text("Program.java", ownerDocument));
  keyword.appendChild(text("class", ownerDocument));
  stringToken.appendChild(text('"Hello World!"', ownerDocument));
  content.appendChild(keyword);
  content.appendChild(text(" Program {\n  System.out.println(", ownerDocument));
  content.appendChild(stringToken);
  content.appendChild(text(");\n}\n", ownerDocument));
  wrapper.appendChild(content);
  wrapper.appendChild(inlineCode);
  wrapper.appendChild(toolbar);

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
  setComputedStyle(toolbar, {
    display: "flex",
    visibility: "visible",
    opacity: "1",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
    height: "32px"
  });
  setComputedStyle(runButton, {
    display: "inline-flex",
    visibility: "visible",
    opacity: "1",
    alignItems: "center",
    gap: "6px",
    backgroundColor: "rgb(0, 84, 166)",
    color: "rgb(255, 255, 255)",
    boxShadow: "rgba(0, 0, 0, 0.2) 0px 1px 2px",
    outline: "rgb(0, 84, 166) solid 1px"
  });
  setComputedStyle(inlineCode, {
    display: "inline",
    visibility: "visible",
    opacity: "1",
    backgroundColor: "rgb(245, 245, 245)",
    color: "rgb(30, 30, 30)",
    fontFamily: '"Fira Code", monospace',
    fontSize: "14px",
    borderRadius: "4px",
    padding: "2px 5px"
  });
  setComputedStyle(keyword, {
    display: "inline",
    visibility: "visible",
    opacity: "1",
    color: "rgb(127, 0, 170)",
    fontWeight: "700",
    textShadow: "rgba(127, 0, 170, 0.2) 0px 0px 1px",
    tabSize: "4"
  });
  setComputedStyle(stringToken, {
    display: "inline",
    visibility: "visible",
    opacity: "1",
    color: "rgb(163, 21, 21)",
    fontVariantLigatures: "none"
  });

  return { wrapper, toolbar, runButton, content, inlineCode, keyword, stringToken };
}

function createEdAmberCodePair(ownerDocument) {
  const sourceText =
    "Total time: 100\nNumber of drones: 2\nNumber of lanterns: 15\nDrones (starting location):\n1\n10\nLanterns (location, arrival time):\n1 1\n1 2\n1 3\n1 4\n1 5\n";
  const root = createElement("section", ownerDocument);
  const screenCard = createElement("div", ownerDocument, { class: "amber-display-codeblock amber-el amber-content ed-print-hidden" });
  const screenSlot = createElement("div", ownerDocument, { class: "amdiscb-slot" });
  const screenPre = createElement("div", ownerDocument, { class: "amber-el amber-pre" });
  const screenSyntax = createElement("div", ownerDocument, { class: "syntax-highlight" });
  const screenKeyword = createElement("span", ownerDocument, { class: "token keyword" });
  const screenClassName = createElement("span", ownerDocument, { class: "token class-name" });
  const screenLineNumber = createElement("span", ownerDocument, { class: "line-number" });
  const printCard = createElement("div", ownerDocument, { class: "amber-display-codeblock amber-el amber-content ed-print-visible" });
  const printSlot = createElement("div", ownerDocument, { class: "amdiscb-slot" });
  const printPre = createElement("div", ownerDocument, { class: "amber-el amber-pre" });
  const printSyntax = createElement("div", ownerDocument, { class: "syntax-highlight" });
  const printKeyword = createElement("span", ownerDocument, { class: "token keyword" });
  const printClassName = createElement("span", ownerDocument, { class: "token class-name" });
  const printLineNumber = createElement("span", ownerDocument, { class: "line-number" });

  screenLineNumber.appendChild(text("1", ownerDocument));
  screenKeyword.appendChild(text("class", ownerDocument));
  screenClassName.appendChild(text("Program", ownerDocument));
  printLineNumber.appendChild(text("1", ownerDocument));
  printKeyword.appendChild(text("class", ownerDocument));
  printClassName.appendChild(text("Program", ownerDocument));
  screenSyntax.appendChild(screenLineNumber);
  screenSyntax.appendChild(text(" ", ownerDocument));
  screenSyntax.appendChild(screenKeyword);
  screenSyntax.appendChild(text(" ", ownerDocument));
  screenSyntax.appendChild(screenClassName);
  screenSyntax.appendChild(text(` {\n${sourceText}`, ownerDocument));
  printSyntax.appendChild(printLineNumber);
  printSyntax.appendChild(text(" ", ownerDocument));
  printSyntax.appendChild(printKeyword);
  printSyntax.appendChild(text(" ", ownerDocument));
  printSyntax.appendChild(printClassName);
  printSyntax.appendChild(text(` {\n${sourceText}`, ownerDocument));
  screenPre.appendChild(screenSyntax);
  printPre.appendChild(printSyntax);
  screenSlot.appendChild(screenPre);
  printSlot.appendChild(printPre);
  screenCard.appendChild(screenSlot);
  printCard.appendChild(printSlot);
  root.appendChild(screenCard);
  root.appendChild(printCard);

  [screenCard, screenSlot, screenPre, screenSyntax, screenKeyword, screenClassName, screenLineNumber, printCard, printSlot, printPre, printSyntax, printKeyword, printClassName, printLineNumber].forEach((node) => {
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
  setComputedStyle(screenKeyword, {
    display: "inline",
    visibility: "visible",
    opacity: "1",
    color: "rgb(127, 0, 170)",
    fontWeight: "700",
    fontVariantLigatures: "none",
    tabSize: "4"
  });
  setComputedStyle(screenClassName, {
    display: "inline",
    visibility: "visible",
    opacity: "1",
    color: "rgb(38, 127, 153)",
    textShadow: "rgba(38, 127, 153, 0.25) 0px 0px 1px"
  });
  setComputedStyle(screenLineNumber, {
    display: "inline-block",
    visibility: "visible",
    opacity: "1",
    color: "rgb(160, 160, 160)",
    minWidth: "24px",
    textAlign: "right",
    marginRight: "12px"
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
  setComputedStyle(printKeyword, {
    display: "inline",
    visibility: "visible",
    opacity: "1",
    color: "rgb(127, 0, 170)",
    fontWeight: "700",
    fontVariantLigatures: "none",
    tabSize: "4"
  });
  setComputedStyle(printClassName, {
    display: "inline",
    visibility: "visible",
    opacity: "1",
    color: "rgb(38, 127, 153)",
    textShadow: "rgba(38, 127, 153, 0.25) 0px 0px 1px"
  });
  setComputedStyle(printLineNumber, {
    display: "inline-block",
    visibility: "visible",
    opacity: "1",
    color: "rgb(160, 160, 160)",
    minWidth: "24px",
    textAlign: "right",
    marginRight: "12px"
  });

  return {
    root,
    screenCard,
    screenSlot,
    screenPre,
    screenSyntax,
    screenKeyword,
    screenClassName,
    screenLineNumber,
    printCard,
    printSlot,
    printPre,
    printSyntax,
    printKeyword,
    printClassName,
    printLineNumber
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

test("resolves text-node clicks inside generic code blocks to the outer wrapper for pdf exports", () => {
  const hooks = loadContentHooks();
  const ownerDocument = { defaultView: { getComputedStyle(node) { return node.__computedStyle; } } };
  const block = createGenericCodeBlock(ownerDocument);
  const textNode = block.content.childNodes[0];

  assert.equal(hooks.resolveSelectableTarget(textNode, "pdf"), block.wrapper);
  assert.equal(hooks.getVisualExportRoot(textNode), block.wrapper);
});

test("resolves Ed Amber visual selection to the outer code card for pdf exports", () => {
  const hooks = loadContentHooks();
  const ownerDocument = { defaultView: { getComputedStyle(node) { return node.__computedStyle; } } };
  const block = createEdAmberCodePair(ownerDocument);

  assert.equal(hooks.resolveSelectableTarget(block.screenSyntax, "pdf"), block.screenCard);
  assert.equal(hooks.getVisualExportRoot(block.screenSyntax), block.screenCard);
});

test("resolves text-node clicks inside Ed Amber code blocks to the outer code card for pdf exports", () => {
  const hooks = loadContentHooks();
  const ownerDocument = { defaultView: { getComputedStyle(node) { return node.__computedStyle; } } };
  const block = createEdAmberCodePair(ownerDocument);
  const textNode = block.screenSyntax.childNodes[0];

  assert.equal(hooks.resolveSelectableTarget(textNode, "pdf"), block.screenCard);
  assert.equal(hooks.getVisualExportRoot(textNode), block.screenCard);
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

test("copies only the whitelisted computed styles into inline style text", () => {
  const hooks = loadContentHooks();
  const ownerDocument = { defaultView: { getComputedStyle(node) { return node.__computedStyle; } } };
  const source = createElement("div", ownerDocument, { style: "border:1px solid red" });
  const target = createElement("div", ownerDocument);

  setComputedStyle(source, {
    display: "grid",
    color: "rgb(10, 20, 30)",
    fontFamily: '"IBM Plex Sans", sans-serif',
    cursor: "pointer",
    backgroundImage: "url(example.png)",
    getPropertyValue(name) {
      return this[toCamelCase(name)] || "";
    }
  });

  hooks.inlineStyleSubset(source, target, hooks.createNodeMeasureCache());

  const style = target.getAttribute("style");
  assert.match(style, /display:grid;/);
  assert.match(style, /color:rgb\(10, 20, 30\);/);
  assert.match(style, /font-family:"IBM Plex Sans", sans-serif;/);
  assert.match(style, /background-image:url\(example\.png\);/);
  assert.doesNotMatch(style, /cursor:pointer;/);
});

test("prepareClone preserves high fidelity styles inside generic code blocks", () => {
  const hooks = loadContentHooks();
  const ownerDocument = { defaultView: { getComputedStyle(node) { return node.__computedStyle; } } };
  const source = createGenericCodeBlock(ownerDocument);
  const clone = createGenericCodeBlock(ownerDocument);

  hooks.prepareClone(source.wrapper, clone.wrapper, {
    inlineStyles: true,
    stripStyles: false,
    syncImages: false,
    enhancedImages: false
  });

  assert.match(inlineStyleText(clone.keyword), /color:rgb\(127, 0, 170\);/);
  assert.match(inlineStyleText(clone.keyword), /text-shadow:rgba\(127, 0, 170, 0\.2\) 0px 0px 1px;/);
  assert.match(inlineStyleText(clone.keyword), /tab-size:4;/);
  assert.match(inlineStyleText(clone.stringToken), /font-variant-ligatures:none;/);
  assert.match(inlineStyleText(clone.inlineCode), /background-color:rgb\(245, 245, 245\);/);
  assert.match(inlineStyleText(clone.inlineCode), /border-radius:4px;/);
  assert.match(inlineStyleText(clone.toolbar), /display:flex;/);
  assert.match(inlineStyleText(clone.toolbar), /align-items:center;/);
  assert.match(inlineStyleText(clone.toolbar), /justify-content:space-between;/);
  assert.match(inlineStyleText(clone.toolbar), /gap:8px;/);
  assert.match(inlineStyleText(clone.runButton), /box-shadow:rgba\(0, 0, 0, 0\.2\) 0px 1px 2px;/);
  assert.match(inlineStyleText(clone.runButton), /outline:rgb\(0, 84, 166\) solid 1px;/);
});

test("prepareClone applies print preparation in a single traversal context", () => {
  const hooks = loadContentHooks();
  const ownerDocument = { defaultView: { getComputedStyle(node) { return node.__computedStyle; } } };
  const source = createEdAmberCodePair(ownerDocument);
  const clone = createEdAmberCodePair(ownerDocument);

  hooks.prepareClone(source.root, clone.root, {
    inlineStyles: true,
    stripStyles: false,
    syncImages: false,
    enhancedImages: false
  });

  assert.equal(clone.screenCard.style.display, "block");
  assert.equal(clone.printCard.style.display, "none");
  assert.equal(clone.screenSlot.style.whiteSpace, "pre-wrap");
  assert.equal(clone.screenPre.style.height, "260px");
});

test("prepareClone preserves Ed Amber token and line number styles", () => {
  const hooks = loadContentHooks();
  const ownerDocument = { defaultView: { getComputedStyle(node) { return node.__computedStyle; } } };
  const source = createEdAmberCodePair(ownerDocument);
  const clone = createEdAmberCodePair(ownerDocument);

  hooks.prepareClone(source.root, clone.root, {
    inlineStyles: true,
    stripStyles: false,
    syncImages: false,
    enhancedImages: false
  });

  assert.match(inlineStyleText(clone.screenKeyword), /color:rgb\(127, 0, 170\);/);
  assert.match(inlineStyleText(clone.screenKeyword), /font-variant-ligatures:none;/);
  assert.match(inlineStyleText(clone.screenKeyword), /tab-size:4;/);
  assert.match(inlineStyleText(clone.screenClassName), /color:rgb\(38, 127, 153\);/);
  assert.match(inlineStyleText(clone.screenClassName), /text-shadow:rgba\(38, 127, 153, 0\.25\) 0px 0px 1px;/);
  assert.match(inlineStyleText(clone.screenLineNumber), /display:inline-block;/);
  assert.match(inlineStyleText(clone.screenLineNumber), /min-width:24px;/);
  assert.match(inlineStyleText(clone.screenLineNumber), /text-align:right;/);
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

test("reuses measured heights within the same cache", () => {
  const hooks = loadContentHooks();
  const ownerDocument = { defaultView: { getComputedStyle(node) { return node.__computedStyle; } } };
  const node = createElement("div", ownerDocument);
  setComputedStyle(node, { height: "120px" });

  const cache = hooks.createNodeMeasureCache();
  const first = hooks.getNodeMeasuredHeight(node, cache);
  node.scrollHeight = 999;
  node.clientHeight = 999;
  node.offsetHeight = 999;
  setComputedStyle(node, { height: "999px" });
  const second = hooks.getNodeMeasuredHeight(node, cache);
  const refreshed = hooks.getNodeMeasuredHeight(node, hooks.createNodeMeasureCache());

  assert.equal(first, 120);
  assert.equal(second, 120);
  assert.equal(refreshed, 999);
});

test("builds a standard portrait A4 page rule", () => {
  const hooks = loadContentHooks();

  assert.equal(hooks.buildPdfPageRule(), "@page { size: A4 portrait; margin: 0; }");
  assert.equal(hooks.buildPdfPageRule(640), "@page { size: A4 portrait; margin: 0; }");
});

test("normalizes print root layout to remove centered margins", () => {
  const hooks = loadContentHooks();
  const ownerDocument = { defaultView: { getComputedStyle(node) { return node.__computedStyle; } } };
  const root = createElement("section", ownerDocument);
  root.style.marginLeft = "auto";
  root.style.marginRight = "auto";
  root.style.marginInlineStart = "auto";
  root.style.marginInlineEnd = "auto";

  hooks.normalizePrintRootLayout(root);

  assert.equal(root.style.marginLeft, "0");
  assert.equal(root.style.marginRight, "0");
  assert.equal(root.style.marginInlineStart, "0");
  assert.equal(root.style.marginInlineEnd, "0");
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
