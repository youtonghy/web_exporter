"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { TextEncoder } = require("node:util");
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
    TextEncoder,
    Buffer,
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

function createKatexVListColumn(values) {
  const slots = values.map((value, index) =>
    el("span", { style: `top: -${4.21 - index * 1.2}em;` }, [
      el("span", { class: "pstrut", style: "height: 3em;" }),
      el("span", { class: "mord" }, [text(value)])
    ])
  );

  return el("span", { class: "col-align-c" }, [
    el("span", { class: "vlist-t vlist-t2" }, [
      el("span", { class: "vlist-r" }, [el("span", { class: "vlist", style: "height: 2.05em;" }, slots)]),
      el("span", { class: "vlist-s" }, [text("​")]),
      el("span", { class: "vlist-r" }, [el("span", { class: "vlist", style: "height: 1.55em;" }, [el("span")])])
    ])
  ]);
}

function createHtmlOnlyAugmentedMatrix() {
  const leftBracket = el("span", { class: "mopen" }, [
    el("span", { class: "delimsizing mult" }, [
      el("img", { class: "katex-svg", src: "data:image/svg+xml;utf8,<svg></svg>" })
    ])
  ]);
  const rightBracket = el("span", { class: "mclose" }, [
    el("span", { class: "delimsizing mult" }, [
      el("img", { class: "katex-svg", src: "data:image/svg+xml;utf8,<svg></svg>" })
    ])
  ]);
  const table = el("span", { class: "mtable" }, [
    createKatexVListColumn(["1", "0", "0"]),
    el("span", { class: "arraycolsep", style: "width: 0.5em;" }),
    createKatexVListColumn(["2", "0", "0"]),
    el("span", { class: "arraycolsep", style: "width: 0.5em;" }),
    createKatexVListColumn(["0", "1", "0"]),
    el("span", { class: "arraycolsep", style: "width: 0.5em;" }),
    createKatexVListColumn(["3", "-1", "0"]),
    el("span", { class: "arraycolsep", style: "width: 0.5em;" }),
    createKatexVListColumn(["|", "|", "|"]),
    el("span", { class: "arraycolsep", style: "width: 0.5em;" }),
    createKatexVListColumn(["2b-5a", "6a-2b", "7a-3b+c"])
  ]);
  const visibleLeaf = table.childNodes[0].querySelector(".mord");
  const html = el("span", { class: "katex-html", "aria-hidden": "true" }, [
    el("span", { class: "base" }, [leftBracket, el("span", { class: "mord" }, [table]), rightBracket])
  ]);
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

function createSimpleTable() {
  return el("table", {}, [
    el("tr", {}, [
      el("th", { align: "left" }, [text("Name")]),
      el("th", { align: "right" }, [text("Score")])
    ]),
    el("tr", {}, [
      el("td", {}, [text("Alice")]),
      el("td", {}, [text("10")])
    ]),
    el("tr", {}, [
      el("td", {}, [text("Bob")]),
      el("td", {}, [text("12")])
    ])
  ]);
}

function createComplexTable() {
  return el("table", {}, [
    el("tr", {}, [
      el("td", { rowspan: "2" }, [text("A")]),
      el("td", {}, [el("p", {}, [text("B")])])
    ]),
    el("tr", {}, [
      el("td", {}, [text("C")])
    ])
  ]);
}

function createFigureBlock() {
  return el("figure", {}, [
    el("img", { alt: "diagram", src: "https://example.com/diagram.png" }),
    el("figcaption", {}, [text("A simple caption")])
  ]);
}

function createDefinitionList() {
  return el("dl", {}, [
    el("dt", {}, [text("Term")]),
    el("dd", {}, [text("Definition")])
  ]);
}

function createDetailsBlock() {
  return el("details", {}, [
    el("summary", {}, [text("More")]),
    el("p", {}, [text("Hidden body")])
  ]);
}

function createInlineHtmlFormattingBlock() {
  return el("p", {}, [
    text("x"),
    el("sup", {}, [text("2")]),
    text(" and "),
    el("sub", {}, [text("i")]),
    text(" "),
    el("kbd", {}, [text("Esc")])
  ]);
}

function createNestedListBlock() {
  return el("ul", {}, [
    el("li", {}, [
      el("p", {}, [text("Parent")]),
      el("ul", {}, [
        el("li", {}, [text("Child 1")]),
        el("li", {}, [text("Child 2")])
      ])
    ])
  ]);
}

function createMixedBlockquote() {
  const codeBlock = createPlainPreBlock().root;
  return el("blockquote", {}, [
    el("p", {}, [text("Intro")]),
    el("ul", {}, [el("li", {}, [text("Nested item")])]),
    codeBlock
  ]);
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

test("collects markdown image assets and rewrites paths for package mode", async () => {
  const hooks = loadContentHooks();
  const root = el("p", {}, [text("Look "), el("img", { alt: "diagram", src: "data:image/png;base64,AQID" })]);
  const collected = hooks.collectMarkdownExport(root, { imagePackaging: true });

  assert.equal(collected.assets.length, 1);
  assert.equal(collected.markdown, "Look ![diagram](__WEB_EXPORTER_IMAGE_1__)");

  const resolved = await hooks.resolveMarkdownPackagingAssets(collected.assets);
  assert.equal(resolved[0].outputPath, "images/image-001.png");
  assert.deepEqual(Array.from(resolved[0].bytes), [1, 2, 3]);

  assert.equal(
    hooks.applyMarkdownAssetUrls(collected.markdown, resolved),
    "Look ![diagram](images/image-001.png)"
  );
});

test("deduplicates repeated image urls in package mode", () => {
  const hooks = loadContentHooks();
  const shared = "https://example.com/shared.png";
  const root = el("div", {}, [
    el("img", { alt: "one", src: shared }),
    el("p", {}, [el("img", { alt: "two", src: shared })])
  ]);

  const collected = hooks.collectMarkdownExport(root, { imagePackaging: true });

  assert.equal(collected.assets.length, 1);
  assert.match(collected.markdown, /__WEB_EXPORTER_IMAGE_1__/);
});

test("creates a valid zip blob for markdown image packages", async () => {
  const hooks = loadContentHooks();
  const zipBlob = hooks.createZipBlob([
    { name: "note.md", data: new TextEncoder().encode("# Title\n") },
    { name: "images/image-001.png", data: new Uint8Array([1, 2, 3, 4]) }
  ]);
  const bytes = new Uint8Array(await zipBlob.arrayBuffer());

  assert.equal(zipBlob.type, "application/zip");
  assert.deepEqual(Array.from(bytes.slice(0, 4)), [0x50, 0x4b, 0x03, 0x04]);
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

test("reconstructs html-only KaTeX augmented matrices into latex", () => {
  const hooks = loadContentHooks();
  const matrix = createHtmlOnlyAugmentedMatrix();
  const markdown = hooks.elementToMarkdown(matrix.root);

  assert.equal(hooks.resolveSelectableTarget(matrix.visibleLeaf), matrix.root);
  assert.equal(
    markdown,
    "$\\left(\\begin{array}{cccc|c} 1 & 2 & 0 & 3 & 2b-5a \\\\ 0 & 0 & 1 & -1 & 6a-2b \\\\ 0 & 0 & 0 & 0 & 7a-3b+c \\end{array}\\right)$"
  );
  assert.ok(!markdown.includes("data:image/svg+xml"));
  assert.ok(!markdown.includes("![]("));
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

test("exports simple tables as markdown tables", () => {
  const hooks = loadContentHooks();
  const table = createSimpleTable();

  assert.equal(
    hooks.elementToMarkdown(table),
    "| Name | Score |\n| :--- | ---: |\n| Alice | 10 |\n| Bob | 12 |"
  );
});

test("falls back to html for complex tables", () => {
  const hooks = loadContentHooks();
  const table = createComplexTable();
  const markdown = hooks.elementToMarkdown(table);

  assert.ok(markdown.startsWith("<table"));
  assert.ok(markdown.includes('rowspan="2"'));
});

test("exports figure captions as markdown paragraphs", () => {
  const hooks = loadContentHooks();
  const figure = createFigureBlock();

  assert.equal(
    hooks.elementToMarkdown(figure),
    "![diagram](https://example.com/diagram.png)\n\nA simple caption"
  );
});

test("exports definition lists as term definition pairs", () => {
  const hooks = loadContentHooks();
  const dl = createDefinitionList();

  assert.equal(hooks.elementToMarkdown(dl), "Term\n: Definition");
});

test("exports details blocks with summary text", () => {
  const hooks = loadContentHooks();
  const details = createDetailsBlock();

  assert.equal(hooks.elementToMarkdown(details), "**More**\n\nHidden body");
});

test("preserves sup sub and kbd tags inline", () => {
  const hooks = loadContentHooks();
  const block = createInlineHtmlFormattingBlock();

  assert.equal(hooks.elementToMarkdown(block), "x<sup>2</sup> and <sub>i</sub> <kbd>Esc</kbd>");
});

test("keeps nested lists separated from surrounding text blocks", () => {
  const hooks = loadContentHooks();
  const list = createNestedListBlock();

  assert.equal(
    hooks.elementToMarkdown(list),
    "- Parent\n\n    - Child 1\n    - Child 2"
  );
});

test("prefixes every line in blockquotes with markdown quote markers", () => {
  const hooks = loadContentHooks();
  const quote = createMixedBlockquote();

  assert.equal(
    hooks.elementToMarkdown(quote),
    "> Intro\n>\n> - Nested item\n>\n> ```\n> for i in range(n):\n>     print(i)\n> ```"
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
