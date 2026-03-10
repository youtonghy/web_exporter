"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

class MockNode {
  constructor(nodeType) {
    this.nodeType = nodeType;
    this.parentNode = null;
    this.childNodes = [];
  }

  appendChild(child) {
    child.parentNode = this;
    this.childNodes.push(child);
    return child;
  }

  get textContent() {
    return this.childNodes.map((child) => child.textContent).join("");
  }
}

class MockTextNode extends MockNode {
  constructor(value) {
    super(3);
    this.nodeValue = value;
  }

  get textContent() {
    return this.nodeValue;
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
  constructor(tagName, attrs = {}, children = []) {
    super(1);
    this.tagName = tagName.toUpperCase();
    this.attributes = {};
    this.classList = new MockClassList(this);

    Object.entries(attrs).forEach(([name, value]) => {
      this.setAttribute(name, value);
    });

    children.forEach((child) => this.appendChild(child));
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
    if (name === "class") {
      this.classList = new MockClassList(this);
    }
  }

  matches(selector) {
    const trimmed = selector.trim();
    if (!trimmed) {
      return false;
    }
    const tagAttrMatch = trimmed.match(/^([a-z0-9_-]+)(\[[^\]]+\])$/i);
    if (tagAttrMatch) {
      return this.matches(tagAttrMatch[1]) && this.matches(tagAttrMatch[2]);
    }
    if (trimmed.startsWith(".")) {
      return this.classList.contains(trimmed.slice(1));
    }
    if (trimmed.startsWith("#")) {
      return this.getAttribute("id") === trimmed.slice(1);
    }
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      const content = trimmed.slice(1, -1);
      const [name, rawValue] = content.split("=");
      if (!Object.prototype.hasOwnProperty.call(this.attributes, name)) {
        return false;
      }
      if (typeof rawValue === "undefined") {
        return true;
      }
      const expected = rawValue.trim().replace(/^['"]|['"]$/g, "");
      return this.getAttribute(name) === expected;
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
        if (child instanceof MockElement) {
          if (selectors.some((item) => child.matches(item))) {
            results.push(child);
          }
          visit(child);
        }
      });
    };

    visit(this);
    return results;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  get textContent() {
    return this.childNodes.map((child) => child.textContent).join("");
  }
}

class MockHTMLInputElement extends MockElement {}
class MockHTMLSelectElement extends MockElement {}
class MockHTMLScriptElement extends MockElement {}
class MockHTMLImageElement extends MockElement {}
class MockHTMLTextAreaElement extends MockElement {}

function text(value) {
  return new MockTextNode(value);
}

function el(tagName, attrs, children = []) {
  return new MockElement(tagName, attrs, children);
}

function loadContentHooks() {
  const source = fs.readFileSync(path.join(__dirname, "..", "content.js"), "utf8");
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
    document: {
      title: "fixture",
      body: new MockElement("body"),
      head: new MockElement("head"),
      documentElement: new MockElement("html"),
      addEventListener() {},
      removeEventListener() {},
      createElement(tagName) {
        return new MockElement(tagName);
      },
      getElementById() {
        return null;
      }
    },
    window: {
      addEventListener() {},
      removeEventListener() {},
      print() {},
      getComputedStyle() {
        return {
          length: 0,
          getPropertyValue() {
            return "";
          }
        };
      }
    },
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

  vm.createContext(context);
  vm.runInContext(source, context, { filename: "content.js" });
  return context.__WEB_EXPORTER_TEST_HOOKS__;
}

function createDisplayMath(latex, visibleText) {
  const annotation = el("annotation", { encoding: "application/x-tex" }, [text(latex)]);
  const semantics = el("semantics", {}, [el("mrow"), annotation]);
  const math = el("math", { display: "block" }, [semantics]);
  const mathml = el("span", { class: "katex-mathml" }, [math]);
  const visibleLeaf = el("span", { class: "mord" }, [text(visibleText)]);
  const base = el("span", { class: "base" }, [visibleLeaf]);
  const html = el("span", { class: "katex-html", "aria-hidden": "true" }, [base]);
  const katex = el("span", { class: "katex" }, [mathml, html]);
  return { root: el("span", { class: "katex-display" }, [katex]), visibleLeaf };
}

function createInlineMath(latex, visibleText) {
  const annotation = el("annotation", { encoding: "application/x-tex" }, [text(latex)]);
  const semantics = el("semantics", {}, [el("mrow"), annotation]);
  const math = el("math", {}, [semantics]);
  const mathml = el("span", { class: "katex-mathml" }, [math]);
  const visibleLeaf = el("span", { class: "mord" }, [text(visibleText)]);
  const base = el("span", { class: "base" }, [visibleLeaf]);
  const html = el("span", { class: "katex-html", "aria-hidden": "true" }, [base]);
  const root = el("span", { class: "katex" }, [mathml, html]);
  return { root, visibleLeaf };
}

function createGeminiInlineMath(latex, visibleText) {
  const visibleLeaf = el("span", { class: "mord" }, [text(visibleText)]);
  const base = el("span", { class: "base" }, [visibleLeaf]);
  const html = el("span", { class: "katex-html", "aria-hidden": "true" }, [base]);
  const katex = el("span", { class: "katex" }, [html]);
  const root = el("span", { class: "math-inline", "data-math": latex }, [katex]);
  return { root, visibleLeaf };
}

function createGeminiMatrixMath(latex, values) {
  const leftBracket = el("img", { class: "katex-svg", src: "data:image/svg+xml;utf8,<svg></svg>" });
  const rightBracket = el("img", { class: "katex-svg", src: "data:image/svg+xml;utf8,<svg></svg>" });
  const column = el(
    "span",
    { class: "mtable" },
    values.map((value) => el("span", { class: "mord" }, [text(value)]))
  );
  const html = el("span", { class: "katex-html", "aria-hidden": "true" }, [leftBracket, column, rightBracket]);
  const katex = el("span", { class: "katex" }, [html]);
  const root = el("span", { class: "math-inline", "data-math": latex }, [katex]);
  return { root, visibleLeaf: column.childNodes[0] };
}

function createFallbackMathWithoutLatex(visibleText) {
  const leftBracket = el("img", { class: "katex-svg", src: "data:image/svg+xml;utf8,<svg></svg>" });
  const rightBracket = el("img", { class: "katex-svg", src: "data:image/svg+xml;utf8,<svg></svg>" });
  const visibleLeaf = el("span", { class: "mord" }, [text(visibleText)]);
  const html = el("span", { class: "katex-html", "aria-hidden": "true" }, [leftBracket, visibleLeaf, rightBracket]);
  const root = el("span", { class: "katex" }, [html]);
  return { root, visibleLeaf };
}

function createPlainPreBlock() {
  const lineBreak = el("br", {}, []);
  const code = el("code", {}, [
    text("for i in range(n):"),
    lineBreak,
    text("    print(i)")
  ]);
  return { root: el("pre", {}, [code]), lineBreak };
}

function createCodeMirrorBlock() {
  const codeLeaf = el("span", { class: "tok" }, [text("range")]);
  const content = el("div", { class: "cm-content q9tKkq_readonly" }, [
    el("span", { class: "tok-keyword" }, [text("for")]),
    text(" "),
    el("span", { class: "tok-variable" }, [text("i")]),
    text(" "),
    el("span", { class: "tok-keyword" }, [text("in")]),
    text(" "),
    codeLeaf,
    text("(n):"),
    el("br", {}, []),
    text("    "),
    el("span", { class: "tok-keyword" }, [text("for")]),
    text(" "),
    el("span", { class: "tok-variable" }, [text("j")]),
    text(" "),
    el("span", { class: "tok-keyword" }, [text("in")]),
    text(" "),
    el("span", { class: "tok" }, [text("range")]),
    text("(n):"),
    el("br", {}, []),
    text("        "),
    el("span", { class: "tok" }, [text("print")]),
    text("(i, j)")
  ]);
  const editor = el("div", { class: "cm-editor" }, [
    el("div", { class: "cm-scroller" }, [content])
  ]);
  const toolbar = el("div", { class: "toolbar" }, [
    el("div", { class: "language-label" }, [text("Python")]),
    el("div", { class: "actions" }, [
      el("button", { "aria-label": "复制" }, [text("复制")]),
      el("button", { "aria-label": "运行代码" }, [text("运行")])
    ])
  ]);
  const root = el("pre", {}, [
    toolbar,
    el("div", { class: "viewer-shell" }, [editor])
  ]);
  return { root, editor, codeLeaf };
}

test("resolves clicks inside KaTeX display math to the display root", () => {
  const hooks = loadContentHooks();
  const formula = createDisplayMath("A = [4, 7, 1, 9, 3]", "A");

  assert.equal(hooks.resolveSelectableTarget(formula.visibleLeaf), formula.root);
  assert.equal(
    hooks.elementToMarkdown(hooks.resolveSelectableTarget(formula.visibleLeaf)),
    "$$\nA = [4, 7, 1, 9, 3]\n$$"
  );
});

test("exports mixed block and inline math without duplicating KaTeX visible text", () => {
  const hooks = loadContentHooks();
  const display = createDisplayMath("A = [4, 7, 1, 9, 3]", "A");
  const inline = createInlineMath("O(n)", "O");
  const root = el("div", {}, [
    el("p", {}, [text("假设有一个数组（array）：")]),
    display.root,
    el("p", {}, [text("最坏情况 "), inline.root])
  ]);

  assert.equal(
    hooks.elementToMarkdown(root),
    "假设有一个数组（array）：\n\n$$\nA = [4, 7, 1, 9, 3]\n$$\n\n最坏情况 $O(n)$"
  );
});

test("preserves inline math inside headings and list items", () => {
  const hooks = loadContentHooks();
  const headingFormula = createInlineMath("g(n)", "g");
  const listFormula = createInlineMath("c", "c");
  const root = el("div", {}, [
    el("h2", {}, [text("第三步：计算操作次数 "), headingFormula.root]),
    el("ul", {}, [
      el("li", {}, [listFormula.root, text(" = 每次比较花费的时间")])
    ])
  ]);

  assert.equal(
    hooks.elementToMarkdown(root),
    "## 第三步：计算操作次数 $g(n)$\n\n- $c$ = 每次比较花费的时间"
  );
});

test("extracts Gemini data-math wrappers instead of flattening visible text", () => {
  const hooks = loadContentHooks();
  const formula = createGeminiInlineMath("P_2", "P2");
  const root = el("p", {}, [text("空间 "), formula.root, text(" 很重要")]);

  assert.equal(hooks.resolveSelectableTarget(formula.visibleLeaf), formula.root);
  assert.equal(hooks.elementToMarkdown(root), "空间 $P_2$ 很重要");
});

test("exports Gemini matrix formulas from data-math without leaking KaTeX SVG images", () => {
  const hooks = loadContentHooks();
  const matrix = createGeminiMatrixMath("\\begin{pmatrix} a \\\\ b \\\\ c \\end{pmatrix}", ["a", "b", "c"]);
  const root = el("p", {}, [text("向量 "), matrix.root]);
  const markdown = hooks.elementToMarkdown(root);

  assert.equal(hooks.resolveSelectableTarget(matrix.visibleLeaf), matrix.root);
  assert.equal(markdown, "向量 $\\begin{pmatrix} a \\\\ b \\\\ c \\end{pmatrix}$");
  assert.ok(!markdown.includes("data:image/svg+xml"));
  assert.ok(!markdown.includes("![]("));
});

test("falls back to readable text when KaTeX source is missing", () => {
  const hooks = loadContentHooks();
  const formula = createFallbackMathWithoutLatex("abc");

  assert.equal(hooks.elementToMarkdown(formula.root), "abc");
});

test("preserves line breaks in plain preformatted code blocks", () => {
  const hooks = loadContentHooks();
  const block = createPlainPreBlock();

  assert.equal(
    hooks.elementToMarkdown(block.root),
    "```\nfor i in range(n):\n    print(i)\n```"
  );
});

test("exports CodeMirror code blocks as fenced code with detected language", () => {
  const hooks = loadContentHooks();
  const block = createCodeMirrorBlock();

  assert.equal(hooks.resolveSelectableTarget(block.codeLeaf), block.root);
  assert.equal(
    hooks.elementToMarkdown(hooks.resolveSelectableTarget(block.codeLeaf)),
    "```python\nfor i in range(n):\n    for j in range(n):\n        print(i, j)\n```"
  );
});

test("treats custom container elements with block children as block wrappers", () => {
  const hooks = loadContentHooks();
  const formula = createGeminiInlineMath("P_2", "P2");
  const root = el("message-content", {}, [
    el("p", {}, [text("第一段")]),
    el("h3", {}, [text("标题 "), formula.root]),
    el("ul", {}, [el("li", {}, [text("列表项")])]),
    el("hr", {}, []),
    el("p", {}, [text("第二段")])
  ]);

  assert.equal(
    hooks.elementToMarkdown(root),
    "第一段\n\n### 标题 $P_2$\n\n- 列表项\n\n---\n\n第二段"
  );
});
