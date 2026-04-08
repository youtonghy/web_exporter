(() => {
  const HIGHLIGHT_CLASS = "__web_exporter_highlight__";
  const OVERLAY_ID = "__web_exporter_overlay__";
  const STYLE_ID = "__web_exporter_style__";
  const PRINT_CONTAINER_ID = "__web_exporter_print_container__";
  const PRINT_STYLE_ID = "__web_exporter_print_style__";
  const IMAGE_LOAD_TIMEOUT_MS = 2000;
  const ENHANCED_IMAGE_LOAD_TIMEOUT_MS = 8000;
  const IFRAME_LOAD_TIMEOUT_MS = 3000;
  const SCROLLABLE_OVERFLOW_VALUES = new Set(["auto", "scroll", "overlay"]);
  const GENERIC_CODE_CLASS_HINTS = ["pre", "code", "highlight", "syntax", "editor", "snippet"];
  const GENERIC_CODE_FONT_STACK = 'ui-monospace, "SFMono-Regular", Menlo, Consolas, "Liberation Mono", monospace';
  const CODE_BLOCK_CONTROL_LABELS = new Set([
    "copy",
    "copied",
    "run",
    "edit",
    "preview",
    "expand",
    "collapse",
    "复制",
    "运行"
  ]);
  const MATH_SOURCE_ATTRIBUTES = ["data-math", "data-tex", "data-latex", "alttext", "data-formula"];
  const BLOCK_TAGS = new Set([
    "address",
    "article",
    "aside",
    "blockquote",
    "div",
    "dl",
    "fieldset",
    "figcaption",
    "figure",
    "footer",
    "form",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "header",
    "hr",
    "main",
    "nav",
    "ol",
    "p",
    "pre",
    "section",
    "table",
    "ul"
  ]);

  let selecting = false;
  let preserveStyles = true;
  let exportFormat = "pdf";
  let enhancedImageLoading = false;
  let imagePackaging = false;
  let lastHighlighted = null;
  let overlay = null;

  const api = typeof browser !== "undefined" ? browser : chrome;
  const i18n = globalThis.WebExporterI18n;

  function ensureStyleTag() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .${HIGHLIGHT_CLASS} {
        outline: 2px solid #ff6a00 !important;
        outline-offset: 2px !important;
        cursor: crosshair !important;
      }
      #${OVERLAY_ID} {
        position: fixed;
        top: 12px;
        right: 12px;
        padding: 8px 12px;
        background: rgba(26, 31, 54, 0.92);
        color: #ffffff;
        font-size: 12px;
        border-radius: 8px;
        z-index: 2147483647;
        pointer-events: none;
        font-family: "Segoe UI", "PingFang SC", "Microsoft Yahei", sans-serif;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function createOverlay() {
    if (overlay) {
      return;
    }
    overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    overlay.textContent = i18n.t("overlay.select_prompt");
    document.body.appendChild(overlay);
  }

  function removeOverlay() {
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
    overlay = null;
  }

  function clearHighlight() {
    if (lastHighlighted) {
      lastHighlighted.classList.remove(HIGHLIGHT_CLASS);
      lastHighlighted = null;
    }
  }

  function highlightElement(target) {
    if (!target || target === lastHighlighted) {
      return;
    }
    clearHighlight();
    target.classList.add(HIGHLIGHT_CLASS);
    lastHighlighted = target;
  }

  function isOverlayTarget(target) {
    return target && (target.id === OVERLAY_ID || target.closest(`#${OVERLAY_ID}`));
  }

  function normalizeSelectableNode(node) {
    if (isElementNode(node)) {
      return node;
    }

    let current = node;
    while (current && current.nodeType === Node.TEXT_NODE) {
      current = current.parentNode;
      if (isElementNode(current)) {
        return current;
      }
    }

    return isElementNode(current) ? current : null;
  }

  function getVisualCodeBlockRoot(node) {
    const element = normalizeSelectableNode(node);
    if (!isElementNode(element)) {
      return null;
    }

    const prioritizedSelectors = [
      ".amber-display-codeblock",
      ".amdiscb-slot",
      ".amber-pre",
      ".syntax-highlight",
      ".snippet",
      ".snip-inner",
      ".snip-editor",
      ".ed-monaco",
      ".monaco-editor",
      ".cm-editor",
      "pre"
    ];
    for (const selector of prioritizedSelectors) {
      const match = element.closest(selector);
      if (match) {
        return match;
      }
    }

    const genericCodeRoot = getGenericCodeBlockRoot(element);
    if (genericCodeRoot) {
      return genericCodeRoot;
    }

    return null;
  }

  function getVisualExportRoot(node) {
    const element = normalizeSelectableNode(node);
    if (!isElementNode(element)) {
      return node;
    }

    const codeBlockRoot = getVisualCodeBlockRoot(element);
    if (codeBlockRoot) {
      return codeBlockRoot;
    }

    const mathRoot = getMathRoot(element);
    return mathRoot || element;
  }

  function resolveSelectableTarget(target, formatOverride = "markdown") {
    const element = normalizeSelectableNode(target);
    if (!isElementNode(element)) {
      return target;
    }

    const codeBlockRoot = formatOverride === "markdown" ? getCodeBlockRoot(element) : getVisualCodeBlockRoot(element);
    if (codeBlockRoot) {
      return codeBlockRoot;
    }

    const mathRoot = getMathRoot(element);
    return mathRoot || element;
  }

  function startSelection(keepStyles, format, enhancedImages, packImages) {
    if (selecting) {
      return;
    }
    preserveStyles = Boolean(keepStyles);
    exportFormat = format === "markdown" ? "markdown" : format === "png" ? "png" : "pdf";
    enhancedImageLoading = Boolean(enhancedImages);
    imagePackaging = Boolean(packImages);
    selecting = true;
    ensureStyleTag();
    createOverlay();

    document.addEventListener("mouseover", onMouseOver, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKeyDown, true);
  }

  function stopSelection() {
    if (!selecting) {
      return;
    }
    selecting = false;
    document.removeEventListener("mouseover", onMouseOver, true);
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("keydown", onKeyDown, true);
    clearHighlight();
    removeOverlay();
  }

  function onMouseOver(event) {
    if (!selecting) {
      return;
    }
    const target = resolveSelectableTarget(event.target, exportFormat);
    if (!target || isOverlayTarget(target)) {
      return;
    }
    highlightElement(target);
  }

  function onClick(event) {
    if (!selecting) {
      return;
    }
    const target = resolveSelectableTarget(event.target, exportFormat);
    if (!target || isOverlayTarget(target)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    stopSelection();
    if (exportFormat === "markdown") {
      exportElementToMarkdown(target);
    } else if (exportFormat === "png") {
      exportElementToPng(target);
    } else {
      exportElementToPdf(target);
    }
  }

  function onKeyDown(event) {
    if (!selecting) {
      return;
    }
    if (event.key === "Escape") {
      stopSelection();
    }
  }

  function removeScriptTags(root) {
    const scripts = root.querySelectorAll("script");
    scripts.forEach((node) => node.remove());
  }

  function stripEventHandlers(node) {
    if (!node.attributes) {
      return;
    }
    Array.from(node.attributes).forEach((attr) => {
      if (attr.name.toLowerCase().startsWith("on")) {
        node.removeAttribute(attr.name);
      }
    });
  }

  function inlineComputedStyle(source, target) {
    const computed = window.getComputedStyle(source);
    let cssText = "";
    for (let i = 0; i < computed.length; i += 1) {
      const prop = computed[i];
      cssText += `${prop}:${computed.getPropertyValue(prop)};`;
    }
    const existing = target.getAttribute("style");
    target.setAttribute("style", existing ? `${existing};${cssText}` : cssText);
  }

  function getAttributeValue(node, name) {
    if (!node || !node.getAttribute) {
      return "";
    }
    const value = node.getAttribute(name);
    return value ? value.trim() : "";
  }

  function prepareImagesForPrint(images, enhancedImages) {
    if (!enhancedImages || !images.length) {
      return;
    }
    images.forEach((img) => {
      const src = getAttributeValue(img, "src");
      const dataSrc = getAttributeValue(img, "data-src");
      if (!src && dataSrc) {
        img.setAttribute("src", dataSrc);
      }

      const srcset = getAttributeValue(img, "srcset");
      const dataSrcset = getAttributeValue(img, "data-srcset");
      if (!srcset && dataSrcset) {
        img.setAttribute("srcset", dataSrcset);
      }

      img.loading = "eager";
      img.decoding = "sync";
      if ("fetchPriority" in img) {
        img.fetchPriority = "high";
      }
    });
  }

  function getImageLoadTimeout(enhancedImages) {
    return enhancedImages ? ENHANCED_IMAGE_LOAD_TIMEOUT_MS : IMAGE_LOAD_TIMEOUT_MS;
  }

  function syncImageSource(source, target) {
    if (!(source instanceof HTMLImageElement) || !(target instanceof HTMLImageElement)) {
      return;
    }
    const currentSrc = source.currentSrc || source.src;
    if (currentSrc) {
      target.src = currentSrc;
      target.removeAttribute("srcset");
      target.removeAttribute("sizes");
    }
    target.removeAttribute("loading");
    target.decoding = "sync";
  }

  function extractFirstCssUrl(value) {
    if (!value) {
      return "";
    }
    const match = /url\((['"]?)(.*?)\1\)/.exec(value);
    if (!match) {
      return "";
    }
    return (match[2] || "").trim();
  }

  function hasMeaningfulChildren(node) {
    if (!node || !node.childNodes) {
      return false;
    }
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        return true;
      }
      if (child.nodeType === Node.TEXT_NODE && (child.nodeValue || "").trim()) {
        return true;
      }
    }
    return false;
  }

  function syncBackgroundImageAsImg(source, target) {
    if (!(source instanceof Element) || !(target instanceof Element)) {
      return;
    }

    const computed = window.getComputedStyle(source);
    const url = extractFirstCssUrl(computed.backgroundImage);
    if (!url) {
      return;
    }

    if (hasMeaningfulChildren(source) || hasMeaningfulChildren(target)) {
      return;
    }

    const doc = target.ownerDocument || document;
    const img = doc.createElement("img");
    img.src = url;
    img.alt = source.getAttribute("aria-label") || source.getAttribute("alt") || "";
    img.loading = "eager";
    img.decoding = "sync";
    if ("fetchPriority" in img) {
      img.fetchPriority = "high";
    }

    const bgSize = (computed.backgroundSize || "").toLowerCase();
    const fit = bgSize.includes("cover") ? "cover" : bgSize.includes("contain") ? "contain" : "cover";
    img.style.width = "100%";
    img.style.height = "100%";
    img.style.display = "block";
    img.style.objectFit = fit;

    target.style.backgroundImage = "none";
    target.style.background = "none";

    target.appendChild(img);
  }

  function stripPresentationAttributes(node) {
    if (!node || !node.removeAttribute) {
      return;
    }
    node.removeAttribute("style");
    node.removeAttribute("class");
    node.removeAttribute("id");
  }

  function normalizeWhitespace(text) {
    return text.replace(/\u00a0/g, " ").replace(/\s+/g, " ");
  }

  function escapeMarkdownText(text) {
    return text
      .replace(/\\/g, "\\\\")
      .replace(/`/g, "\\`")
      .replace(/\*/g, "\\*")
      .replace(/_/g, "\\_")
      .replace(/\[/g, "\\[")
      .replace(/]/g, "\\]")
      .replace(/#/g, "\\#")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function normalizeMarkdown(text) {
    return text
      .replace(/\r\n/g, "\n")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function isIgnorableTag(tag) {
    return tag === "script" || tag === "style" || tag === "noscript";
  }

  function isCustomElementTag(tag) {
    return typeof tag === "string" && tag.includes("-");
  }

  function hasBlockLikeChildren(node) {
    if (!(node instanceof Element)) {
      return false;
    }
    return Array.from(node.childNodes).some((child) => {
      if (!(child instanceof Element)) {
        return false;
      }
      const tag = child.tagName.toLowerCase();
      return BLOCK_TAGS.has(tag) || isCustomElementTag(tag);
    });
  }

  function shouldTreatAsBlockContainer(node) {
    if (!(node instanceof Element)) {
      return false;
    }
    const tag = node.tagName.toLowerCase();
    return isCustomElementTag(tag) || hasBlockLikeChildren(node);
  }

  function convertInlineChildren(node, context) {
    return Array.from(node.childNodes)
      .map((child) => convertInlineNode(child, context))
      .join("");
  }

  function formatInputValue(node) {
    if (!(node instanceof HTMLInputElement)) {
      return "";
    }
    const type = (node.getAttribute("type") || "text").toLowerCase();
    if (type === "checkbox" || type === "radio") {
      return node.checked ? "[x]" : "[ ]";
    }
    return escapeMarkdownText(node.value || "");
  }

  function formatSelectValue(node) {
    if (!(node instanceof HTMLSelectElement)) {
      return "";
    }
    const selected = node.querySelector("option:checked");
    const text = selected ? selected.textContent : node.textContent;
    return escapeMarkdownText(normalizeWhitespace(text || ""));
  }

  function hasClass(node, name) {
    return node instanceof Element && node.classList && node.classList.contains(name);
  }

  function isCodeBlockRoot(node) {
    return node instanceof Element && getCodeBlockRoot(node) === node;
  }

  function getCodeBlockRoot(node) {
    if (!(node instanceof Element)) {
      return null;
    }

    const pre = node.closest("pre");
    if (pre) {
      return pre;
    }

    const editor = node.closest(".cm-editor");
    if (editor) {
      return editor;
    }

    const viewer = node.closest("#code-block-viewer");
    if (viewer) {
      return viewer;
    }

    const content = node.closest(".cm-content");
    return content instanceof Element ? content : null;
  }

  function nodeContains(root, node) {
    if (!(root instanceof Element) || !node) {
      return false;
    }
    let current = node;
    while (current) {
      if (current === root) {
        return true;
      }
      current = current.parentNode;
    }
    return false;
  }

  function getCodeContentRoot(node) {
    if (!(node instanceof Element)) {
      return null;
    }
    if (hasClass(node, "cm-content")) {
      return node;
    }
    const tag = node.tagName.toLowerCase();
    if (tag === "code") {
      return node;
    }
    const cmContent = node.querySelector(".cm-content");
    if (cmContent instanceof Element) {
      return cmContent;
    }
    const code = node.querySelector("code");
    if (code instanceof Element) {
      return code;
    }
    return node;
  }

  function isCodeTextLineContainer(node) {
    if (!(node instanceof Element)) {
      return false;
    }
    const tag = node.tagName.toLowerCase();
    return hasClass(node, "cm-line") || tag === "div" || tag === "p";
  }

  function extractCodeText(node, isRoot = false) {
    if (!node) {
      return "";
    }
    if (node.nodeType === Node.TEXT_NODE) {
      return node.nodeValue || "";
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return "";
    }

    const tag = node.tagName.toLowerCase();
    if (isIgnorableTag(tag)) {
      return "";
    }
    if (tag === "br") {
      return "\n";
    }

    let content = "";
    node.childNodes.forEach((child) => {
      content += extractCodeText(child);
    });

    if (!isRoot && isCodeTextLineContainer(node) && content && !content.endsWith("\n")) {
      content += "\n";
    }

    return content;
  }

  function normalizeCodeBlockContent(text) {
    return (text || "").replace(/\r\n?/g, "\n").replace(/\u00a0/g, " ").replace(/\n+$/, "");
  }

  function getLanguageFromClassName(node) {
    if (!(node instanceof Element)) {
      return "";
    }
    const className = node.getAttribute("class") || "";
    const match = className.match(/(?:^|\s)(?:lang|language)-([A-Za-z0-9_+#.-]+)(?:\s|$)/i);
    return match ? match[1] : "";
  }

  function normalizeCodeLanguage(value) {
    const normalized = (value || "").trim().toLowerCase();
    if (!normalized) {
      return "";
    }
    const collapsed = normalized.replace(/\s+/g, " ");
    const aliases = {
      plaintext: "text",
      "plain text": "text",
      text: "text",
      py: "python",
      python: "python",
      js: "javascript",
      javascript: "javascript",
      ts: "typescript",
      typescript: "typescript",
      shell: "bash",
      sh: "bash",
      bash: "bash",
      zsh: "bash",
      console: "bash",
      csharp: "csharp",
      "c#": "csharp",
      "c++": "cpp"
    };
    if (aliases[collapsed]) {
      return aliases[collapsed];
    }
    return collapsed.replace(/\s+/g, "");
  }

  function isPotentialLanguageLabel(value) {
    const normalized = normalizeWhitespace(value || "").trim();
    if (!normalized || normalized.length > 30) {
      return false;
    }
    if (!/^[A-Za-z0-9+#._ -]+$/.test(normalized)) {
      return false;
    }
    return !CODE_BLOCK_CONTROL_LABELS.has(normalized.toLowerCase());
  }

  function findCodeBlockLanguageLabel(node, contentRoot) {
    if (!(node instanceof Element) || node === contentRoot) {
      return "";
    }
    const tag = node.tagName.toLowerCase();
    if (tag === "button" || tag === "svg" || tag === "use") {
      return "";
    }

    const directText = normalizeWhitespace(node.textContent || "").trim();
    if (isPotentialLanguageLabel(directText) && !node.querySelector("button")) {
      return directText;
    }

    for (const child of Array.from(node.childNodes)) {
      if (!(child instanceof Element)) {
        continue;
      }
      if (child === contentRoot || nodeContains(contentRoot, child)) {
        continue;
      }
      const nested = findCodeBlockLanguageLabel(child, contentRoot);
      if (nested) {
        return nested;
      }
    }

    return "";
  }

  function getCodeBlockLanguage(node, contentRoot) {
    if (!(node instanceof Element)) {
      return "";
    }

    const directAttributes = ["data-language", "data-lang"];
    for (const current of [node, contentRoot]) {
      if (!(current instanceof Element)) {
        continue;
      }
      for (const name of directAttributes) {
        const value = normalizeCodeLanguage(current.getAttribute(name) || "");
        if (value) {
          return value;
        }
      }
      const classValue = normalizeCodeLanguage(getLanguageFromClassName(current));
      if (classValue) {
        return classValue;
      }
    }

    const labeledNode = node.querySelector("[data-language], [data-lang], [class]");
    if (labeledNode instanceof Element) {
      for (const name of directAttributes) {
        const value = normalizeCodeLanguage(labeledNode.getAttribute(name) || "");
        if (value) {
          return value;
        }
      }
      const classValue = normalizeCodeLanguage(getLanguageFromClassName(labeledNode));
      if (classValue) {
        return classValue;
      }
    }

    const label = findCodeBlockLanguageLabel(node, contentRoot);
    return normalizeCodeLanguage(label);
  }

  function formatCodeBlock(node) {
    const codeRoot = getCodeBlockRoot(node);
    if (!codeRoot || codeRoot !== node) {
      return "";
    }
    const contentRoot = getCodeContentRoot(codeRoot);
    const content = normalizeCodeBlockContent(extractCodeText(contentRoot, true));
    if (!content) {
      return "";
    }
    const language = getCodeBlockLanguage(codeRoot, contentRoot);
    const fence = language ? `\`\`\`${language}` : "```";
    return `${fence}\n${content}\n\`\`\``;
  }

  function isMathScriptNode(node) {
    if (!(node instanceof HTMLScriptElement)) {
      return false;
    }
    const type = (node.getAttribute("type") || "").toLowerCase();
    return type.startsWith("math/tex");
  }

  function isMathAnnotationEncoding(value) {
    return /(?:^|\/)(?:x-)?(?:tex|latex)$/i.test((value || "").trim());
  }

  function getMathAnnotation(node) {
    if (!(node instanceof Element)) {
      return null;
    }
    if (node.tagName && node.tagName.toLowerCase() === "annotation") {
      const encoding = node.getAttribute("encoding") || "";
      if (isMathAnnotationEncoding(encoding)) {
        return node;
      }
    }
    const annotations = node.querySelectorAll("annotation[encoding]");
    for (const annotation of annotations) {
      const encoding = annotation.getAttribute("encoding") || "";
      if (isMathAnnotationEncoding(encoding)) {
        return annotation;
      }
    }
    return null;
  }

  function getMathSourceNode(node) {
    if (!(node instanceof Element)) {
      return null;
    }

    let current = node;
    while (current instanceof Element) {
      if (
        current.getAttribute("data-math") &&
        (current.classList.contains("math-inline") || current.classList.contains("math-display"))
      ) {
        return current;
      }
      current = current.parentNode instanceof Element ? current.parentNode : null;
    }
    return null;
  }

  function getMathRoot(node) {
    if (!(node instanceof Element)) {
      return null;
    }

    const sourcedRoot = getMathSourceNode(node);
    if (sourcedRoot) {
      return sourcedRoot;
    }

    const displayRoot = node.closest(".katex-display");
    if (displayRoot) {
      return displayRoot;
    }

    const inlineRoot = node.closest(".katex");
    if (inlineRoot) {
      return inlineRoot;
    }

    const tag = node.tagName.toLowerCase();
    if (tag === "script" && isMathScriptNode(node)) {
      return node;
    }
    if (tag === "mjx-container" || tag === "math") {
      return node;
    }

    const mathContainer = node.closest("mjx-container, math");
    return mathContainer instanceof Element ? mathContainer : null;
  }

  function isMathRoot(node) {
    return node instanceof Element && getMathRoot(node) === node;
  }

  function stripMathDelimiters(text) {
    const trimmed = (text || "").trim();
    if (!trimmed) {
      return "";
    }
    const dollarBlockMatch = trimmed.match(/^\$\$([\s\S]*?)\$\$$/);
    if (dollarBlockMatch) {
      return dollarBlockMatch[1].trim();
    }
    const dollarInlineMatch = trimmed.match(/^\$([\s\S]*?)\$$/);
    if (dollarInlineMatch) {
      return dollarInlineMatch[1].trim();
    }
    const bracketBlockMatch = trimmed.match(/^\\\[([\s\S]*?)\\\]$/);
    if (bracketBlockMatch) {
      return bracketBlockMatch[1].trim();
    }
    const parenInlineMatch = trimmed.match(/^\\\(([\s\S]*?)\\\)$/);
    if (parenInlineMatch) {
      return parenInlineMatch[1].trim();
    }
    return trimmed;
  }

  function getMathSourceFromAttribute(node, name) {
    if (!(node instanceof Element)) {
      return "";
    }
    return stripMathDelimiters(node.getAttribute(name) || "");
  }

  function extractLatex(node) {
    if (isMathScriptNode(node)) {
      return stripMathDelimiters(node.textContent || "");
    }
    if (!(node instanceof Element)) {
      return "";
    }

    const annotation = getMathAnnotation(node);
    if (annotation) {
      const encoding = annotation.getAttribute("encoding") || "";
      if (isMathAnnotationEncoding(encoding)) {
        return stripMathDelimiters(annotation.textContent || "");
      }
    }

    for (const name of MATH_SOURCE_ATTRIBUTES) {
      const value = getMathSourceFromAttribute(node, name);
      if (value) {
        return value;
      }
    }

    const attributeSelectors = MATH_SOURCE_ATTRIBUTES.map((name) => `[${name}]`).join(", ");
    if (attributeSelectors) {
      const sourceNode = node.querySelector(attributeSelectors);
      if (sourceNode instanceof Element) {
        for (const name of MATH_SOURCE_ATTRIBUTES) {
          const value = getMathSourceFromAttribute(sourceNode, name);
          if (value) {
            return value;
          }
        }
      }
    }

    return "";
  }

  function normalizeKatexFallbackText(text) {
    return (text || "")
      .replace(/\u200b/g, "")
      .replace(/\u2212/g, "-")
      .replace(/\u2223/g, "|")
      .replace(/\u2225/g, "||")
      .replace(/\s+/g, " ")
      .trim();
  }

  function extractKatexRawText(node) {
    if (!node) {
      return "";
    }
    if (node.nodeType === Node.TEXT_NODE) {
      return node.nodeValue || "";
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return "";
    }

    const tag = node.tagName.toLowerCase();
    if (tag === "img") {
      return "";
    }
    if (
      node.classList.contains("arraycolsep") ||
      node.classList.contains("pstrut") ||
      node.classList.contains("vlist-s")
    ) {
      return "";
    }
    if (node.classList.contains("mspace")) {
      return " ";
    }

    let result = "";
    node.childNodes.forEach((child) => {
      result += extractKatexRawText(child);
    });
    return result;
  }

  function getKatexHtmlRoot(node) {
    if (!(node instanceof Element)) {
      return null;
    }
    if (node.classList.contains("katex-html")) {
      return node;
    }
    const root = node.querySelector(".katex-html");
    return root instanceof Element ? root : null;
  }

  function parseKatexTopValue(node) {
    if (!(node instanceof Element)) {
      return null;
    }
    const style = node.getAttribute("style") || "";
    const match = style.match(/top:\s*(-?\d+(?:\.\d+)?)em/i);
    if (!match) {
      return null;
    }
    return Number.parseFloat(match[1]);
  }

  function getKatexColumnEntries(node) {
    if (!(node instanceof Element)) {
      return [];
    }
    const vlist = node.querySelector(".vlist");
    if (!(vlist instanceof Element)) {
      return [];
    }

    const entries = [];
    vlist.childNodes.forEach((child) => {
      if (!(child instanceof Element)) {
        return;
      }
      const top = parseKatexTopValue(child);
      if (!Number.isFinite(top)) {
        return;
      }
      const text = normalizeKatexFallbackText(extractKatexRawText(child));
      if (!text) {
        return;
      }
      entries.push({ top, text });
    });

    entries.sort((left, right) => left.top - right.top);
    return entries.map((entry) => entry.text);
  }

  function getKatexTableColumns(tableNode) {
    if (!(tableNode instanceof Element)) {
      return [];
    }

    return Array.from(tableNode.childNodes)
      .filter((child) => child instanceof Element)
      .map((child) => {
        const className = child.getAttribute("class") || "";
        if (!/(?:^|\s)col-align-/.test(className)) {
          return null;
        }
        const entries = getKatexColumnEntries(child);
        if (!entries.length) {
          return null;
        }
        return {
          entries,
          separator: entries.every((entry) => /^\|+$/.test(entry))
        };
      })
      .filter(Boolean);
  }

  function getKatexDelimiterPair(node) {
    if (!(node instanceof Element)) {
      return null;
    }

    const openNode = node.querySelector(".mopen");
    const closeNode = node.querySelector(".mclose");
    if (!(openNode instanceof Element) && !(closeNode instanceof Element)) {
      return null;
    }

    const openText = normalizeKatexFallbackText(extractKatexRawText(openNode));
    const closeText = normalizeKatexFallbackText(extractKatexRawText(closeNode));
    const delimiterPairs = {
      "(": { open: "\\left(", close: "\\right)" },
      ")": { open: "\\left(", close: "\\right)" },
      "[": { open: "\\left[", close: "\\right]" },
      "]": { open: "\\left[", close: "\\right]" },
      "{": { open: "\\left\\{", close: "\\right\\}" },
      "}": { open: "\\left\\{", close: "\\right\\}" },
      "|": { open: "\\left|", close: "\\right|" },
      "||": { open: "\\left\\Vert", close: "\\right\\Vert" },
      "⟨": { open: "\\left\\langle", close: "\\right\\rangle" },
      "⟩": { open: "\\left\\langle", close: "\\right\\rangle" }
    };

    if (openText && delimiterPairs[openText]) {
      return delimiterPairs[openText];
    }
    if (closeText && delimiterPairs[closeText]) {
      return delimiterPairs[closeText];
    }
    return { open: "\\left(", close: "\\right)" };
  }

  function reconstructKatexMatrixLatex(node) {
    const htmlRoot = getKatexHtmlRoot(node);
    if (!(htmlRoot instanceof Element)) {
      return "";
    }

    const table = htmlRoot.querySelector(".mtable");
    if (!(table instanceof Element)) {
      return "";
    }

    const columns = getKatexTableColumns(table);
    if (!columns.length) {
      return "";
    }

    const dataColumns = columns.filter((column) => !column.separator);
    if (!dataColumns.length) {
      return "";
    }

    const rowCount = dataColumns.reduce((max, column) => Math.max(max, column.entries.length), 0);
    if (!rowCount) {
      return "";
    }

    const rows = [];
    for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
      const row = dataColumns.map((column) => column.entries[rowIndex] || "").join(" & ").trim();
      if (row) {
        rows.push(row);
      }
    }
    if (!rows.length) {
      return "";
    }

    const columnSpec = columns
      .map((column) => (column.separator ? "|" : "c"))
      .join("")
      .replace(/^\|+/, "")
      .replace(/\|+$/, "");
    if (!columnSpec) {
      return "";
    }

    const body = rows.join(" \\\\ ");
    const delimiters = getKatexDelimiterPair(htmlRoot);
    if (!delimiters) {
      if (columnSpec.includes("|")) {
        return `\\begin{array}{${columnSpec}} ${body} \\end{array}`;
      }
      return `\\begin{matrix} ${body} \\end{matrix}`;
    }

    return `${delimiters.open}\\begin{array}{${columnSpec}} ${body} \\end{array}${delimiters.close}`;
  }

  function detectMathDisplayMode(node) {
    if (isMathScriptNode(node)) {
      const type = (node.getAttribute("type") || "").toLowerCase();
      return type.includes("mode=display");
    }
    if (!(node instanceof Element)) {
      return false;
    }

    if (node.classList.contains("katex-display")) {
      return true;
    }
    if (node.classList.contains("math-display")) {
      return true;
    }

    const display = (node.getAttribute("display") || "").toLowerCase();
    if (display === "block" || display === "true") {
      return true;
    }

    const mode = (node.getAttribute("mode") || "").toLowerCase();
    if (mode === "display") {
      return true;
    }

    const role = (node.getAttribute("data-display") || "").toLowerCase();
    if (role === "true" || role === "block") {
      return true;
    }

    return false;
  }

  function formatMarkdownMath(latex, displayMode) {
    const content = stripMathDelimiters(latex);
    if (!content) {
      return "";
    }
    if (displayMode) {
      return `$$\n${content}\n$$`;
    }
    return `$${content}$`;
  }

  function convertMathNode(node) {
    const mathRoot = getMathRoot(node);
    if (!mathRoot || mathRoot !== node) {
      return "";
    }
    const latex = extractLatex(mathRoot) || reconstructKatexMatrixLatex(mathRoot);
    if (!latex) {
      return "";
    }
    return formatMarkdownMath(latex, detectMathDisplayMode(mathRoot));
  }

  function isMathRenderingImage(node) {
    if (!(node instanceof Element) || node.tagName.toLowerCase() !== "img") {
      return false;
    }
    if (node.classList.contains("katex-svg")) {
      return true;
    }
    const src = node.getAttribute("src") || "";
    return Boolean(getMathRoot(node)) && /^data:image\/svg\+xml/i.test(src);
  }

  function convertInlineNode(node, context) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = normalizeWhitespace(node.nodeValue || "");
      return escapeMarkdownText(text);
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return "";
    }
    const math = convertMathNode(node);
    if (math) {
      return math;
    }
    const tag = node.tagName.toLowerCase();
    if (isIgnorableTag(tag) && !isMathScriptNode(node)) {
      return "";
    }
    if (tag === "br") {
      return "\n";
    }
    if (tag === "strong" || tag === "b") {
      const content = convertInlineChildren(node, context).trim();
      return content ? `**${content}**` : "";
    }
    if (tag === "em" || tag === "i") {
      const content = convertInlineChildren(node, context).trim();
      return content ? `*${content}*` : "";
    }
    if (tag === "code") {
      const content = node.textContent || "";
      return content ? `\`${escapeMarkdownText(content)}\`` : "";
    }
    if (tag === "a") {
      const href = node.getAttribute("href");
      const text = convertInlineChildren(node, context).trim() || escapeMarkdownText(node.textContent || "");
      if (!href) {
        return text;
      }
      return `[${text || href}](${href})`;
    }
    if (tag === "img") {
      if (isMathRenderingImage(node)) {
        return "";
      }
      const alt = escapeMarkdownText(node.getAttribute("alt") || "");
      const src = node.getAttribute("src") || "";
      if (!src) {
        return alt;
      }
      return `![${alt}](${src})`;
    }
    if (tag === "input") {
      return formatInputValue(node);
    }
    if (tag === "textarea") {
      return escapeMarkdownText(node.value || node.textContent || "");
    }
    if (tag === "select") {
      return formatSelectValue(node);
    }
    return convertInlineChildren(node, context);
  }

  function convertBlockChildren(node, context) {
    const blocks = [];
    node.childNodes.forEach((child) => {
      const block = convertNode(child, context);
      if (block && block.trim()) {
        blocks.push(block.trim());
      }
    });
    return blocks.join("\n\n");
  }

  function convertListItem(node, context) {
    const blocks = [];
    const inlineParts = [];
    node.childNodes.forEach((child) => {
      if (child.nodeType === Node.ELEMENT_NODE) {
        if (isMathRoot(child) && detectMathDisplayMode(child)) {
          if (inlineParts.length) {
            const inlineText = inlineParts.join("").trim();
            if (inlineText) {
              blocks.push(inlineText);
            }
            inlineParts.length = 0;
          }
          const mathBlock = convertNode(child, context);
          if (mathBlock) {
            blocks.push(mathBlock);
          }
          return;
        }
        const tag = child.tagName.toLowerCase();
        if (tag === "ul" || tag === "ol") {
          if (inlineParts.length) {
            const inlineText = inlineParts.join("").trim();
            if (inlineText) {
              blocks.push(inlineText);
            }
            inlineParts.length = 0;
          }
          const nested = convertList(child, context);
          if (nested) {
            blocks.push(nested);
          }
          return;
        }
        if (BLOCK_TAGS.has(tag) && tag !== "li") {
          if (inlineParts.length) {
            const inlineText = inlineParts.join("").trim();
            if (inlineText) {
              blocks.push(inlineText);
            }
            inlineParts.length = 0;
          }
          const block = convertNode(child, context);
          if (block) {
            blocks.push(block);
          }
          return;
        }
      }
      inlineParts.push(convertInlineNode(child, context));
    });

    if (inlineParts.length) {
      const inlineText = inlineParts.join("").trim();
      if (inlineText) {
        blocks.push(inlineText);
      }
    }

    return blocks.join("\n");
  }

  function convertList(node, context) {
    const ordered = node.tagName.toLowerCase() === "ol";
    let index = Number.parseInt(node.getAttribute("start") || "1", 10);
    if (!Number.isFinite(index) || index < 1) {
      index = 1;
    }

    const lines = [];
    node.childNodes.forEach((child) => {
      if (!child.tagName || child.tagName.toLowerCase() !== "li") {
        return;
      }
      const itemContext = { ...context, listDepth: (context.listDepth || 0) + 1 };
      const content = convertListItem(child, itemContext).trim();
      if (!content) {
        index += 1;
        return;
      }
      const indent = "  ".repeat(context.listDepth || 0);
      const prefix = ordered ? `${index}. ` : "- ";
      const indentedContent = content.replace(/\n/g, `\n${indent}  `);
      lines.push(`${indent}${prefix}${indentedContent}`);
      index += 1;
    });
    return lines.join("\n");
  }

  function convertNode(node, context) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = normalizeWhitespace(node.nodeValue || "");
      return escapeMarkdownText(text);
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return "";
    }
    const codeBlock = formatCodeBlock(node);
    if (codeBlock) {
      return codeBlock;
    }
    const math = convertMathNode(node);
    if (math) {
      return math;
    }

    const tag = node.tagName.toLowerCase();
    if (isIgnorableTag(tag) && !isMathScriptNode(node)) {
      return "";
    }

    if (tag === "h1" || tag === "h2" || tag === "h3" || tag === "h4" || tag === "h5" || tag === "h6") {
      const level = Number.parseInt(tag.slice(1), 10);
      const content = convertInlineChildren(node, context).trim();
      return content ? `${"#".repeat(level)} ${content}` : "";
    }
    if (tag === "p") {
      return convertInlineChildren(node, context).trim();
    }
    if (tag === "pre") {
      const content = node.textContent || "";
      return `\`\`\`\n${content.replace(/\n$/, "")}\n\`\`\``;
    }
    if (tag === "blockquote") {
      const content = convertBlockChildren(node, context);
      if (!content) {
        return "";
      }
      return content
        .split("\n")
        .map((line) => (line ? `> ${line}` : ">"))
        .join("\n");
    }
    if (tag === "ul" || tag === "ol") {
      return convertList(node, context);
    }
    if (tag === "hr") {
      return "---";
    }
    if (tag === "br") {
      return "\n";
    }
    if (tag === "img") {
      return convertInlineNode(node, context);
    }
    if (BLOCK_TAGS.has(tag)) {
      return convertBlockChildren(node, context);
    }
    if (shouldTreatAsBlockContainer(node)) {
      return convertBlockChildren(node, context);
    }
    return convertInlineChildren(node, context).trim();
  }

  function elementToMarkdown(root) {
    const content = convertNode(root, { listDepth: 0 });
    return normalizeMarkdown(content);
  }

  function collectMarkdownExport(root, options) {
    const imagePackaging = options && options.imagePackaging;
    if (!imagePackaging) {
      return { markdown: elementToMarkdown(root), assets: [] };
    }
    const srcToIndex = new Map();
    const assets = [];
    const restore = [];
    const rootIsImg =
      root.nodeType === Node.ELEMENT_NODE && root.tagName && root.tagName.toLowerCase() === "img";
    const imgs = [
      ...(rootIsImg ? [root] : []),
      ...(root.querySelectorAll ? root.querySelectorAll("img") : [])
    ];
    for (const img of imgs) {
      if (isMathRenderingImage(img)) continue;
      const originalSrc = img.getAttribute("src") || "";
      const assetSrc = img.currentSrc || originalSrc;
      if (!assetSrc) continue;
      let idx = srcToIndex.get(assetSrc);
      if (idx === undefined) {
        idx = assets.length + 1;
        srcToIndex.set(assetSrc, idx);
        assets.push({ placeholder: `__WEB_EXPORTER_IMAGE_${idx}__`, src: assetSrc, index: idx });
      }
      restore.push({ img, src: originalSrc });
      img.setAttribute("src", `__WEB_EXPORTER_IMAGE_${idx}__`);
    }
    let markdown;
    try {
      markdown = elementToMarkdown(root);
    } finally {
      for (const { img, src } of restore) {
        img.setAttribute("src", src);
      }
    }
    return { markdown, assets };
  }

  function resolveMarkdownPackagingAssets(assets) {
    function base64ToBytes(b64) {
      if (typeof Buffer !== "undefined") {
        return new Uint8Array(Buffer.from(b64, "base64"));
      }
      const bin = atob(b64);
      return Uint8Array.from(bin, (c) => c.charCodeAt(0));
    }
    function mimeToExt(mime) {
      const map = {
        "image/png": "png",
        "image/jpeg": "jpg",
        "image/gif": "gif",
        "image/webp": "webp",
        "image/svg+xml": "svg",
        "image/bmp": "bmp",
        "image/tiff": "tiff",
        "image/avif": "avif"
      };
      return map[mime] || "bin";
    }
    return Promise.all(
      assets.map(async ({ placeholder, src, index }) => {
        const dataUriMatch = /^data:([^;]+);base64,(.+)$/.exec(src);
        if (dataUriMatch) {
          const mime = dataUriMatch[1];
          const bytes = base64ToBytes(dataUriMatch[2]);
          const num = String(index).padStart(3, "0");
          return { placeholder, outputPath: `images/image-${num}.${mimeToExt(mime)}`, bytes };
        }
        const response = await fetch(src);
        const arrayBuffer = await response.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        const mime = (response.headers.get("content-type") || "image/png").split(";")[0].trim();
        const num = String(index).padStart(3, "0");
        return { placeholder, outputPath: `images/image-${num}.${mimeToExt(mime)}`, bytes };
      })
    );
  }

  function applyMarkdownAssetUrls(markdown, resolved) {
    let result = markdown;
    for (const { placeholder, outputPath } of resolved) {
      result = result.split(placeholder).join(outputPath);
    }
    return result;
  }

  function createZipBlob(entries) {
    const entriesArr = Array.from(entries);
    const encoder = new TextEncoder();
    const crcTable = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      crcTable[i] = c;
    }
    function crc32(data) {
      let crc = 0xffffffff;
      for (let i = 0; i < data.length; i++) {
        crc = (crc >>> 8) ^ crcTable[(crc ^ data[i]) & 0xff];
      }
      return (crc ^ 0xffffffff) >>> 0;
    }
    const parts = [];
    const centralDir = [];
    let offset = 0;
    for (const entry of entriesArr) {
      const nameBytes = encoder.encode(entry.name);
      const data = entry.data instanceof Uint8Array ? entry.data : new Uint8Array(entry.data);
      const fileCrc = crc32(data);
      const fileSize = data.length;
      const localHeader = new Uint8Array(30 + nameBytes.length);
      const lhView = new DataView(localHeader.buffer);
      lhView.setUint32(0, 0x04034b50, true);
      lhView.setUint16(4, 20, true);
      lhView.setUint16(6, 0x800, true);
      lhView.setUint16(8, 0, true);
      lhView.setUint16(10, 0, true);
      lhView.setUint16(12, 0, true);
      lhView.setUint32(14, fileCrc, true);
      lhView.setUint32(18, fileSize, true);
      lhView.setUint32(22, fileSize, true);
      lhView.setUint16(26, nameBytes.length, true);
      lhView.setUint16(28, 0, true);
      localHeader.set(nameBytes, 30);
      parts.push(localHeader);
      parts.push(data);
      const cdEntry = new Uint8Array(46 + nameBytes.length);
      const cdView = new DataView(cdEntry.buffer);
      cdView.setUint32(0, 0x02014b50, true);
      cdView.setUint16(4, 20, true);
      cdView.setUint16(6, 20, true);
      cdView.setUint16(8, 0x800, true);
      cdView.setUint16(10, 0, true);
      cdView.setUint16(12, 0, true);
      cdView.setUint16(14, 0, true);
      cdView.setUint32(16, fileCrc, true);
      cdView.setUint32(20, fileSize, true);
      cdView.setUint32(24, fileSize, true);
      cdView.setUint16(28, nameBytes.length, true);
      cdView.setUint16(30, 0, true);
      cdView.setUint16(32, 0, true);
      cdView.setUint16(34, 0, true);
      cdView.setUint16(36, 0, true);
      cdView.setUint32(38, 0, true);
      cdView.setUint32(42, offset, true);
      cdEntry.set(nameBytes, 46);
      centralDir.push(cdEntry);
      offset += 30 + nameBytes.length + fileSize;
    }
    const centralDirStart = offset;
    let centralDirSize = 0;
    for (const cd of centralDir) {
      parts.push(cd);
      centralDirSize += cd.length;
    }
    const eocd = new Uint8Array(22);
    const eocdView = new DataView(eocd.buffer);
    eocdView.setUint32(0, 0x06054b50, true);
    eocdView.setUint16(4, 0, true);
    eocdView.setUint16(6, 0, true);
    eocdView.setUint16(8, entriesArr.length, true);
    eocdView.setUint16(10, entriesArr.length, true);
    eocdView.setUint32(12, centralDirSize, true);
    eocdView.setUint32(16, centralDirStart, true);
    eocdView.setUint16(20, 0, true);
    parts.push(eocd);
    return new Blob(parts, { type: "application/zip" });
  }

  function sanitizeFilename(name) {
    const trimmed = (name || "").trim();
    const base = trimmed || i18n.t("file.default_name");
    return base.replace(/[\\/:*?"<>|]+/g, "_");
  }

  function downloadMarkdown(content, filename) {
    const blob = new Blob([content || ""], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      anchor.remove();
    }, 0);
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      anchor.remove();
    }, 0);
  }

  function sendRuntimeMessage(message) {
    if (!api || !api.runtime || typeof api.runtime.sendMessage !== "function") {
      return Promise.reject(new Error(i18n.t("error.runtime_unavailable")));
    }

    try {
      const result = api.runtime.sendMessage(message);
      if (result && typeof result.then === "function") {
        return result;
      }
    } catch (error) {
      // Fall back to callback style.
    }

    return new Promise((resolve, reject) => {
      api.runtime.sendMessage(message, (response) => {
        const err = api.runtime && api.runtime.lastError;
        if (err) {
          reject(err);
          return;
        }
        resolve(response);
      });
    });
  }

  async function captureVisibleTabPng() {
    const response = await sendRuntimeMessage({ type: "CAPTURE_VISIBLE_TAB" });
    if (response && response.ok && response.dataUrl) {
      return response.dataUrl;
    }
    const error = response && response.error ? response.error : i18n.t("error.capture_failed");
    throw new Error(error);
  }

  function decodeImage(img) {
    if (img && typeof img.decode === "function") {
      return img.decode().catch(() => undefined);
    }
    return new Promise((resolve) => {
      const done = () => resolve();
      img.addEventListener("load", done, { once: true });
      img.addEventListener("error", done, { once: true });
    });
  }

  async function exportElementToPng(target) {
    try {
      target.scrollIntoView({ block: "center", inline: "nearest" });
    } catch (error) {
      // ignore
    }

    await new Promise((resolve) => setTimeout(resolve, 120));

    await waitForImages(target, getImageLoadTimeout(enhancedImageLoading), enhancedImageLoading).catch(() => undefined);

    const rect = target.getBoundingClientRect();
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    if (!viewportWidth || !viewportHeight) {
      alert(i18n.t("error.capture_failed"));
      return;
    }

    const left = Math.max(0, Math.floor(rect.left));
    const top = Math.max(0, Math.floor(rect.top));
    const right = Math.min(viewportWidth, Math.ceil(rect.right));
    const bottom = Math.min(viewportHeight, Math.ceil(rect.bottom));
    if (right <= left || bottom <= top) {
      alert(i18n.t("alert.png_not_visible"));
      return;
    }

    const dataUrl = await captureVisibleTabPng();
    const screenshot = new Image();
    screenshot.src = dataUrl;
    await decodeImage(screenshot);

    const imageWidth = screenshot.naturalWidth || screenshot.width;
    const imageHeight = screenshot.naturalHeight || screenshot.height;
    if (!imageWidth || !imageHeight) {
      alert(i18n.t("error.capture_failed"));
      return;
    }

    const scaleX = imageWidth / viewportWidth;
    const scaleY = imageHeight / viewportHeight;

    const sx = Math.max(0, Math.round(left * scaleX));
    const sy = Math.max(0, Math.round(top * scaleY));
    const sw = Math.max(1, Math.round((right - left) * scaleX));
    const sh = Math.max(1, Math.round((bottom - top) * scaleY));

    const canvas = document.createElement("canvas");
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      alert(i18n.t("error.capture_failed"));
      return;
    }

    ctx.drawImage(screenshot, sx, sy, sw, sh, 0, 0, sw, sh);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) {
      alert(i18n.t("error.capture_failed"));
      return;
    }

    const filename = `${sanitizeFilename(document.title)}.png`;
    downloadBlob(blob, filename);
  }

  function syncFormValue(source, target) {
    if (source instanceof HTMLInputElement) {
      target.setAttribute("value", source.value);
      if (source.type === "checkbox" || source.type === "radio") {
        if (source.checked) {
          target.setAttribute("checked", "checked");
        } else {
          target.removeAttribute("checked");
        }
      }
    }

    if (source instanceof HTMLTextAreaElement) {
      target.textContent = source.value;
    }

    if (source instanceof HTMLSelectElement) {
      const sourceOptions = Array.from(source.options);
      const targetOptions = Array.from(target.options || []);
      sourceOptions.forEach((option, index) => {
        const targetOption = targetOptions[index];
        if (targetOption) {
          if (option.selected) {
            targetOption.setAttribute("selected", "selected");
          } else {
            targetOption.removeAttribute("selected");
          }
        }
      });
    }
  }

  function replaceCanvasWithImage(sourceCanvas, targetCanvas, inlineStyles) {
    const img = document.createElement("img");
    img.width = sourceCanvas.width;
    img.height = sourceCanvas.height;

    try {
      img.src = sourceCanvas.toDataURL("image/png");
    } catch (error) {
      img.alt = "[canvas]";
    }

    if (inlineStyles) {
      inlineComputedStyle(sourceCanvas, img);
    }

    targetCanvas.replaceWith(img);
  }

  function prepareClone(sourceRoot, cloneRoot, options) {
    removeScriptTags(cloneRoot);

    const sourceNodes = [sourceRoot, ...sourceRoot.querySelectorAll("*")];
    const cloneNodes = [cloneRoot, ...cloneRoot.querySelectorAll("*")];
    const inlineStyles = options && options.inlineStyles;
    const stripStyles = options && options.stripStyles;
    const syncImages = options && options.syncImages;
    const enhancedImages = options && options.enhancedImages;

    for (let i = 0; i < sourceNodes.length; i += 1) {
      const sourceNode = sourceNodes[i];
      let cloneNode = cloneNodes[i];

      if (!cloneNode) {
        continue;
      }

      stripEventHandlers(cloneNode);
      if (stripStyles) {
        stripPresentationAttributes(cloneNode);
      }
      if (syncImages) {
        syncImageSource(sourceNode, cloneNode);
        if (enhancedImages) {
          syncBackgroundImageAsImg(sourceNode, cloneNode);
        }
      }
      syncFormValue(sourceNode, cloneNode);

      if (sourceNode instanceof HTMLCanvasElement) {
        replaceCanvasWithImage(sourceNode, cloneNode, inlineStyles);
        continue;
      }

      if (inlineStyles) {
        inlineComputedStyle(sourceNode, cloneNode);
      }
    }
  }

  function getElementTagName(node) {
    return node && node.tagName ? node.tagName.toLowerCase() : "";
  }

  function isElementNode(node) {
    return Boolean(node && node.nodeType === Node.ELEMENT_NODE && typeof node.tagName === "string");
  }

  function getElementTree(root) {
    if (!isElementNode(root)) {
      return [];
    }
    const descendants = typeof root.querySelectorAll === "function" ? Array.from(root.querySelectorAll("*")) : [];
    return [root, ...descendants];
  }

  function getClassTokens(node) {
    const classValue = getAttributeValue(node, "class");
    return classValue ? classValue.split(/\s+/).filter(Boolean) : [];
  }

  function hasCodeLikeClass(node) {
    return getClassTokens(node).some((token) => {
      const normalized = token.toLowerCase();
      return GENERIC_CODE_CLASS_HINTS.some((hint) => normalized.includes(hint));
    });
  }

  function getTextLineCount(text) {
    if (typeof text !== "string" || !text) {
      return 0;
    }
    return text.split(/\r?\n/).filter((line) => line.length || /\n/.test(text)).length;
  }

  function hasPreformattedTextShape(node) {
    if (!isElementNode(node)) {
      return false;
    }

    const text = (node.textContent || "").replace(/\u00a0/g, " ");
    if (!text.includes("\n")) {
      return false;
    }

    const meaningfulLines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    return meaningfulLines.length >= 2;
  }

  function isGenericTextCodeBlock(node) {
    return isElementNode(node) && hasCodeLikeClass(node) && hasPreformattedTextShape(node);
  }

  function getGenericCodeBlockRoot(node) {
    if (!isElementNode(node)) {
      return null;
    }

    let current = node;
    let match = null;
    while (current && isElementNode(current)) {
      if (isGenericTextCodeBlock(current)) {
        match = current;
      }
      current = current.parentNode;
    }

    return match;
  }

  function hasPrintHiddenClass(node) {
    return getClassTokens(node).some((token) => token.includes("print-hidden") || token.includes("hidden-print"));
  }

  function forceStyleProperty(node, name, value) {
    if (!isElementNode(node) || !node.style || typeof value !== "string" || !value) {
      return;
    }

    if (typeof node.style.setProperty === "function") {
      node.style.setProperty(name, value, "important");
      return;
    }

    node.style[name] = value;
  }

  function isNodeVisibleOnScreen(node) {
    if (!isElementNode(node)) {
      return false;
    }

    const computed = window.getComputedStyle(node);
    if (!computed) {
      return false;
    }

    if (computed.display === "none") {
      return false;
    }
    if (computed.visibility === "hidden" || computed.visibility === "collapse") {
      return false;
    }

    const opacity = computed.opacity == null ? "" : String(computed.opacity).trim();
    return opacity !== "0";
  }

  function applyPrintVisibilityOverrides(sourceRoot, cloneRoot) {
    const sourceNodes = getElementTree(sourceRoot);
    const cloneNodes = getElementTree(cloneRoot);
    let applied = 0;

    for (let i = 0; i < sourceNodes.length; i += 1) {
      const sourceNode = sourceNodes[i];
      const cloneNode = cloneNodes[i];

      if (!isElementNode(sourceNode) || !isElementNode(cloneNode)) {
        continue;
      }
      if (!hasPrintHiddenClass(sourceNode) || !isNodeVisibleOnScreen(sourceNode)) {
        continue;
      }

      syncVisiblePrintStyles(sourceNode, cloneNode);
      applied += 1;
    }

    return applied;
  }

  function syncVisiblePrintStyles(sourceNode, cloneNode) {
    if (!isElementNode(sourceNode) || !isElementNode(cloneNode)) {
      return false;
    }

    const computed = window.getComputedStyle(sourceNode);
    const display = computed && typeof computed.display === "string" ? computed.display : "";
    const visibility = computed && typeof computed.visibility === "string" ? computed.visibility : "";
    const opacity = computed && computed.opacity != null ? String(computed.opacity) : "";

    if (display && display !== "none") {
      forceStyleProperty(cloneNode, "display", display);
    }
    if (visibility && visibility !== "hidden" && visibility !== "collapse") {
      forceStyleProperty(cloneNode, "visibility", visibility);
    }
    if (opacity && opacity !== "0") {
      forceStyleProperty(cloneNode, "opacity", opacity);
    }
    return true;
  }

  function isEdAmberCodeBlockNode(node) {
    return hasAnyClass(node, ["amber-display-codeblock", "amdiscb-slot", "amber-pre", "syntax-highlight"]);
  }

  function isEdAmberScreenCodeBlock(node) {
    return isEdAmberCodeBlockNode(node) && hasAnyClass(node, ["ed-print-hidden"]);
  }

  function isEdAmberPrintOnlyCodeBlock(node) {
    return isEdAmberCodeBlockNode(node) && hasAnyClass(node, ["ed-print-visible"]);
  }

  function findSiblingEdPrintVisibleNodes(node) {
    const parent = node && node.parentNode;
    if (!isElementNode(parent) || !parent.childNodes) {
      return [];
    }

    return Array.from(parent.childNodes).filter((child) => child !== node && isEdAmberPrintOnlyCodeBlock(child));
  }

  function applyEdPrintPairOverrides(sourceRoot, cloneRoot) {
    const sourceNodes = getElementTree(sourceRoot);
    const cloneNodes = getElementTree(cloneRoot);
    const sourceIndexMap = new Map();
    let applied = 0;

    sourceNodes.forEach((node, index) => {
      sourceIndexMap.set(node, index);
    });

    for (let i = 0; i < sourceNodes.length; i += 1) {
      const sourceNode = sourceNodes[i];
      const cloneNode = cloneNodes[i];

      if (!isElementNode(sourceNode) || !isElementNode(cloneNode) || !isEdAmberScreenCodeBlock(sourceNode) || !isNodeVisibleOnScreen(sourceNode)) {
        continue;
      }

      const siblingPrintNodes = findSiblingEdPrintVisibleNodes(sourceNode);
      if (!siblingPrintNodes.length) {
        continue;
      }

      syncVisiblePrintStyles(sourceNode, cloneNode);
      siblingPrintNodes.forEach((siblingNode) => {
        const siblingIndex = sourceIndexMap.get(siblingNode);
        const cloneSibling = typeof siblingIndex === "number" ? cloneNodes[siblingIndex] : null;
        if (!isElementNode(cloneSibling)) {
          return;
        }

        forceStyleProperty(cloneSibling, "display", "none");
        forceStyleProperty(cloneSibling, "visibility", "hidden");
        forceStyleProperty(cloneSibling, "opacity", "0");
        applied += 1;
      });
    }

    return applied;
  }

  function applyGenericCodeBlockFormatting(sourceRoot, cloneRoot) {
    const sourceNodes = getElementTree(sourceRoot);
    const cloneNodes = getElementTree(cloneRoot);
    let applied = 0;

    for (let i = 0; i < sourceNodes.length; i += 1) {
      const sourceNode = sourceNodes[i];
      const cloneNode = cloneNodes[i];

      if (!isElementNode(sourceNode) || !isElementNode(cloneNode) || !isGenericTextCodeBlock(sourceNode)) {
        continue;
      }

      const computed = window.getComputedStyle(sourceNode);
      const display = computed && typeof computed.display === "string" ? computed.display.trim() : "";

      forceStyleProperty(cloneNode, "white-space", "pre-wrap");
      forceStyleProperty(cloneNode, "overflow-wrap", "anywhere");
      if (display && display !== "none") {
        forceStyleProperty(cloneNode, "display", display);
      }

      const fontFamily = computed && typeof computed.fontFamily === "string" ? computed.fontFamily.trim() : "";
      forceStyleProperty(cloneNode, "font-family", fontFamily || GENERIC_CODE_FONT_STACK);

      const sourceHeight = getNodeMeasuredHeight(sourceNode);
      const cloneHeight = Math.max(getNodeMeasuredHeight(cloneNode), Number(cloneNode.scrollHeight) || 0, sourceHeight);
      if (cloneHeight > 0) {
        forceStyleProperty(cloneNode, "overflow", "visible");
        forceStyleProperty(cloneNode, "overflow-y", "visible");
        forceStyleProperty(cloneNode, "max-height", "none");
        forceStyleProperty(cloneNode, "height", `${Math.ceil(cloneHeight)}px`);
      }

      applied += 1;
    }

    return applied;
  }

  function applyEdAmberCodeBlockFormatting(sourceRoot, cloneRoot) {
    const sourceNodes = getElementTree(sourceRoot);
    const cloneNodes = getElementTree(cloneRoot);
    let applied = 0;

    for (let i = 0; i < sourceNodes.length; i += 1) {
      const sourceNode = sourceNodes[i];
      const cloneNode = cloneNodes[i];

      if (!isElementNode(sourceNode) || !isElementNode(cloneNode) || !isEdAmberCodeBlockNode(sourceNode)) {
        continue;
      }

      const computed = window.getComputedStyle(sourceNode);
      const fontFamily = computed && typeof computed.fontFamily === "string" ? computed.fontFamily.trim() : "";
      const display = computed && typeof computed.display === "string" ? computed.display.trim() : "";
      const height = Math.max(getNodeMeasuredHeight(sourceNode), getNodeMeasuredHeight(cloneNode), Number(cloneNode.scrollHeight) || 0);

      if (display && display !== "none") {
        forceStyleProperty(cloneNode, "display", display);
      }
      forceStyleProperty(cloneNode, "white-space", "pre-wrap");
      forceStyleProperty(cloneNode, "overflow-wrap", "anywhere");
      forceStyleProperty(cloneNode, "overflow", "visible");
      forceStyleProperty(cloneNode, "overflow-y", "visible");
      forceStyleProperty(cloneNode, "max-height", "none");
      forceStyleProperty(cloneNode, "font-family", fontFamily || GENERIC_CODE_FONT_STACK);

      if (height > 0) {
        forceStyleProperty(cloneNode, "height", `${Math.ceil(height)}px`);
      }

      applied += 1;
    }

    return applied;
  }

  function isIframeElement(node) {
    if (typeof HTMLIFrameElement !== "undefined" && node instanceof HTMLIFrameElement) {
      return true;
    }
    return getElementTagName(node) === "iframe";
  }

  function isTextAreaElement(node) {
    if (typeof HTMLTextAreaElement !== "undefined" && node instanceof HTMLTextAreaElement) {
      return true;
    }
    return getElementTagName(node) === "textarea";
  }

  function isIgnoredScrollableRoot(node) {
    const tag = getElementTagName(node);
    return tag === "html" || tag === "body";
  }

  function getComputedOverflowY(node) {
    const computed = window.getComputedStyle(node);
    const overflowY = computed && typeof computed.overflowY === "string" ? computed.overflowY : "";
    const overflow = computed && typeof computed.overflow === "string" ? computed.overflow : "";
    return (overflowY || overflow || "").trim().toLowerCase();
  }

  function isExpandableScrollableElement(node) {
    if (!isElementNode(node) || isIgnoredScrollableRoot(node) || isIframeElement(node)) {
      return false;
    }

    const scrollHeight = Number(node.scrollHeight) || 0;
    const clientHeight = Number(node.clientHeight) || 0;
    if (!scrollHeight || scrollHeight <= clientHeight + 1) {
      return false;
    }

    if (isTextAreaElement(node)) {
      return true;
    }

    return SCROLLABLE_OVERFLOW_VALUES.has(getComputedOverflowY(node));
  }

  function setExpandedBlockHeight(node, height) {
    if (!isElementNode(node) || !node.style) {
      return false;
    }

    const nextHeight = Math.max(0, Math.ceil(Number(height) || 0));
    if (!nextHeight) {
      return false;
    }

    node.style.overflowY = "visible";
    node.style.maxHeight = "none";
    node.style.height = `${nextHeight}px`;
    return true;
  }

  function expandScrollableElements(root) {
    const nodes = getElementTree(root).reverse();
    let expanded = 0;

    nodes.forEach((node) => {
      if (!isExpandableScrollableElement(node)) {
        return;
      }

      if (setExpandedBlockHeight(node, node.scrollHeight)) {
        expanded += 1;
      }
    });

    return expanded;
  }

  function parsePixelValue(value) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value !== "string") {
      return 0;
    }

    const match = value.trim().match(/^(-?\d+(?:\.\d+)?)px$/i);
    if (!match) {
      return 0;
    }

    return Number(match[1]) || 0;
  }

  function getNodeMeasuredHeight(node) {
    if (!isElementNode(node)) {
      return 0;
    }

    const styleHeight = node.style && typeof node.style.height === "string" ? parsePixelValue(node.style.height) : 0;
    const attributeHeight = parsePixelValue((getAttributeValue(node, "style").match(/(?:^|;)\s*height\s*:\s*([^;]+)/i) || [])[1] || "");
    const scrollHeight = Number(node.scrollHeight) || 0;
    const clientHeight = Number(node.clientHeight) || 0;
    const offsetHeight = Number(node.offsetHeight) || 0;
    const computed = window.getComputedStyle(node);
    const computedHeight = computed && typeof computed.height === "string" ? parsePixelValue(computed.height) : 0;

    return Math.max(styleHeight, attributeHeight, scrollHeight, clientHeight, offsetHeight, computedHeight);
  }

  function hasAnyClass(node, classNames) {
    if (!isElementNode(node) || !node.classList) {
      return false;
    }

    return classNames.some((name) => node.classList.contains(name));
  }

  function getMonacoEditorContainers(root) {
    if (!isElementNode(root)) {
      return [];
    }

    const candidates = [];
    const pushUnique = (node) => {
      if (isElementNode(node) && !candidates.includes(node)) {
        candidates.push(node);
      }
    };

    if (hasAnyClass(root, ["snippet", "snip-inner", "snip-editor", "ed-monaco", "monaco-editor"])) {
      pushUnique(root);
    }

    const selectors = [".snippet", ".snip-inner", ".snip-editor", ".ed-monaco", ".monaco-editor"];
    selectors.forEach((selector) => {
      root.querySelectorAll(selector).forEach(pushUnique);
    });

    return candidates.filter((node) => node.querySelector(".monaco-editor") || hasAnyClass(node, ["monaco-editor"]));
  }

  function getMonacoContentHeight(root) {
    let maxHeight = 0;
    const heightCarrierClasses = ["view-lines", "lines-content", "margin-view-overlays", "margin", "monaco-scrollable-element", "overflow-guard", "monaco-editor"];

    getElementTree(root).forEach((node) => {
      if (!isElementNode(node)) {
        return;
      }

      if (!hasAnyClass(node, heightCarrierClasses) && node !== root) {
        return;
      }

      maxHeight = Math.max(maxHeight, getNodeMeasuredHeight(node));
    });

    return Math.ceil(maxHeight);
  }

  function getMonacoHeightTargets(root) {
    if (!isElementNode(root)) {
      return [];
    }

    const targets = [];
    const pushUnique = (node) => {
      if (isElementNode(node) && !targets.includes(node)) {
        targets.push(node);
      }
    };

    if (hasAnyClass(root, ["snippet", "snip-inner", "snip-editor", "ed-monaco", "monaco-editor", "overflow-guard", "monaco-scrollable-element"])) {
      pushUnique(root);
    }

    const primarySelectors = [".snip-editor", ".ed-monaco", ".monaco-editor", ".overflow-guard", ".monaco-scrollable-element"];
    primarySelectors.forEach((selector) => {
      root.querySelectorAll(selector).forEach(pushUnique);
    });

    return targets;
  }

  function expandMonacoEditors(root) {
    const editors = getMonacoEditorContainers(root);
    let expanded = 0;

    editors.forEach((editorRoot) => {
      const height = getMonacoContentHeight(editorRoot);
      if (!height) {
        return;
      }

      getMonacoHeightTargets(editorRoot).forEach((node) => {
        if (!node.style) {
          return;
        }
        node.style.overflow = "visible";
        node.style.overflowY = "visible";
        node.style.maxHeight = "none";
        node.style.height = `${height}px`;
      });

      expanded += 1;
    });

    return expanded;
  }

  function readIframeDocument(iframe) {
    try {
      return {
        accessible: true,
        doc: iframe.contentDocument || (iframe.contentWindow ? iframe.contentWindow.document : null) || null
      };
    } catch (error) {
      return {
        accessible: false,
        doc: null
      };
    }
  }

  function getIframeDocument(iframe) {
    return readIframeDocument(iframe).doc;
  }

  function getDocumentContentHeight(doc) {
    if (!doc) {
      return 0;
    }

    const body = doc.body || null;
    const docEl = doc.documentElement || null;
    const bodyHeight = body
      ? Math.max(Number(body.scrollHeight) || 0, Number(body.offsetHeight) || 0, Number(body.clientHeight) || 0)
      : 0;
    const docHeight = docEl
      ? Math.max(Number(docEl.scrollHeight) || 0, Number(docEl.offsetHeight) || 0, Number(docEl.clientHeight) || 0)
      : 0;
    return Math.max(bodyHeight, docHeight);
  }

  function waitForIframeLoad(iframe) {
    const initial = readIframeDocument(iframe);
    if (!initial.accessible) {
      return Promise.resolve(null);
    }
    if (initial.doc && (!initial.doc.readyState || initial.doc.readyState === "complete" || initial.doc.readyState === "interactive")) {
      return Promise.resolve(initial.doc);
    }
    if (!initial.doc && iframe && typeof iframe.getAttribute === "function" && !iframe.getAttribute("src") && !iframe.getAttribute("srcdoc")) {
      return Promise.resolve(null);
    }

    return new Promise((resolve) => {
      let settled = false;
      let timer = null;

      const finish = () => {
        if (settled) {
          return;
        }
        settled = true;
        if (timer) {
          clearTimeout(timer);
        }
        resolve(getIframeDocument(iframe));
      };

      timer = setTimeout(finish, IFRAME_LOAD_TIMEOUT_MS);

      if (iframe && typeof iframe.addEventListener === "function") {
        iframe.addEventListener("load", finish, { once: true });
        iframe.addEventListener("error", finish, { once: true });
        return;
      }

      finish();
    });
  }

  async function expandIframeElementToContent(iframe) {
    if (!isIframeElement(iframe) || !iframe.style) {
      return false;
    }

    const doc = await waitForIframeLoad(iframe);
    if (!doc) {
      return false;
    }

    const root = doc.body || doc.documentElement;
    if (isElementNode(root)) {
      expandMonacoEditors(root);
      expandScrollableElements(root);
    }

    const height = getDocumentContentHeight(doc);
    if (!height) {
      return false;
    }

    iframe.style.overflow = "hidden";
    iframe.style.overflowY = "hidden";
    iframe.style.maxHeight = "none";
    iframe.style.height = `${Math.ceil(height)}px`;
    return true;
  }

  function expandSameOriginIframes(root) {
    if (!isElementNode(root) || typeof root.querySelectorAll !== "function") {
      return Promise.resolve([]);
    }

    const iframes = Array.from(root.querySelectorAll("iframe"));
    if (!iframes.length) {
      return Promise.resolve([]);
    }

    return Promise.all(iframes.map((iframe) => expandIframeElementToContent(iframe)));
  }

  async function prepareMountedPrintRoot(sourceRoot, cloneRoot) {
    const mountedRoot = cloneRoot || sourceRoot;
    if (!isElementNode(mountedRoot)) {
      return;
    }

    if (isElementNode(sourceRoot) && isElementNode(cloneRoot)) {
      applyPrintVisibilityOverrides(sourceRoot, cloneRoot);
      applyEdPrintPairOverrides(sourceRoot, cloneRoot);
      applyGenericCodeBlockFormatting(sourceRoot, cloneRoot);
      applyEdAmberCodeBlockFormatting(sourceRoot, cloneRoot);
    }

    expandMonacoEditors(mountedRoot);
    expandScrollableElements(mountedRoot);
    await expandSameOriginIframes(mountedRoot);
    expandMonacoEditors(mountedRoot);
    expandScrollableElements(mountedRoot);
  }

  // Dynamically sets @page size to match content dimensions, producing a
  // single-page PDF as tall as the content rather than paginating across
  // multiple A4 sheets.  styleEl must be the <style> element that already
  // contains the @page rule so we can overwrite it in-place.
  function applyDynamicPageSize(element, styleEl) {
    if (!isElementNode(element) || !styleEl) {
      return;
    }
    // Clear explicit height/min-height that inlined computed styles may have set
    // (keepStyles=true inlines the source element's computed height, which can be
    // larger than the actual content and would inflate scrollHeight).
    // Also remove left margin so the content starts at the page edge.
    element.style.height = "";
    element.style.minHeight = "";
    element.style.marginLeft = "0";
    // Add 1px padding-bottom to prevent margin collapsing between the element
    // and its last child — collapsed margins are excluded from scrollHeight,
    // causing the measured height to be too small and content to overflow onto
    // a second page.  The padding stays in place during printing for consistency.
    element.style.paddingBottom = "1px";
    // Temporarily set overflow:hidden so scrollHeight also captures any
    // margin-bottom on the last child that would otherwise collapse.
    const prevOverflow = element.style.overflow;
    element.style.overflow = "hidden";
    void element.offsetHeight; // flush layout before measuring
    const contentW = element.scrollWidth;
    const contentH = element.scrollHeight;
    element.style.overflow = prevOverflow;
    if (!contentW || !contentH) {
      return;
    }
    styleEl.textContent = styleEl.textContent.replace(
      /@page\s*\{[^}]*\}/,
      `@page { size: ${contentW}px ${contentH}px; margin: 0; }`
    );
  }

  function buildPrintPayload(target, keepStyles, enhancedImages) {
    const clone = target.cloneNode(true);
    prepareClone(target, clone, {
      inlineStyles: keepStyles,
      stripStyles: !keepStyles,
      syncImages: true,
      enhancedImages
    });

    const baseHref = document.baseURI || location.href;
    const bodyStyle = keepStyles
      ? "margin:0;padding:0;background:#ffffff;"
      : "margin:0;padding:0;font-family:Arial, sans-serif;background:#ffffff;";

    return { clone, baseHref, bodyStyle, sourceRoot: target };
  }

  function populatePrintDocument(doc, payload) {
    const { clone, baseHref, bodyStyle } = payload;

    while (doc.head.firstChild) {
      doc.head.removeChild(doc.head.firstChild);
    }
    while (doc.body.firstChild) {
      doc.body.removeChild(doc.body.firstChild);
    }

    const metaCharset = doc.createElement("meta");
    metaCharset.setAttribute("charset", "utf-8");

    const metaViewport = doc.createElement("meta");
    metaViewport.setAttribute("name", "viewport");
    metaViewport.setAttribute("content", "width=device-width, initial-scale=1");

    doc.head.appendChild(metaCharset);
    doc.head.appendChild(metaViewport);

    if (baseHref) {
      const base = doc.createElement("base");
      base.setAttribute("href", baseHref);
      doc.head.appendChild(base);
    }

    const style = doc.createElement("style");
    style.textContent = `
      @page { size: A4 portrait; margin: 0; }
      html, body { margin: 0 !important; padding: 0 !important; }
      body { ${bodyStyle} display: block !important; max-width: none !important; }
      * { box-sizing: border-box; }
    `;
    doc.head.appendChild(style);
    doc.title = i18n.t("print.window_title");

    const imported = doc.importNode(clone, true);
    doc.body.appendChild(imported);
    return { importedRoot: imported, styleEl: style };
  }

  function waitForFontsInDocument(doc) {
    if (doc && doc.fonts && doc.fonts.ready) {
      return doc.fonts.ready;
    }
    return Promise.resolve();
  }

  function openPrintWindow(payload, enhancedImages) {
    const printWindow = window.open("", "_blank", "noopener,noreferrer");
    if (!printWindow) {
      return false;
    }

    const doc = printWindow.document;
    const { importedRoot, styleEl } = populatePrintDocument(doc, payload);

    const triggerPrint = () => {
      try {
        printWindow.focus();
        printWindow.print();
      } catch (error) {
        // Ignore print errors caused by user settings.
      }
    };

    const schedulePrint = () => {
      const printableRoot = isElementNode(importedRoot) ? importedRoot : doc.body.firstElementChild || doc.body;
      waitForPrintAssets(printableRoot, doc, payload.sourceRoot, enhancedImages).finally(() => {
        applyDynamicPageSize(printableRoot, styleEl);
        setTimeout(triggerPrint, 50);
      });
    };

    if (doc.readyState === "complete") {
      schedulePrint();
    } else {
      printWindow.addEventListener("load", schedulePrint, { once: true });
    }

    printWindow.onafterprint = () => {
      printWindow.close();
    };

    return true;
  }

  function cleanupPrintArtifacts() {
    const container = document.getElementById(PRINT_CONTAINER_ID);
    if (container) {
      container.remove();
    }
    const style = document.getElementById(PRINT_STYLE_ID);
    if (style) {
      style.remove();
    }
  }

  function waitForFonts() {
    return waitForFontsInDocument(document);
  }

  function waitForImages(root, timeoutMs, enhancedImages) {
    const images = Array.from(root.querySelectorAll("img"));
    if (!images.length) {
      return Promise.resolve();
    }

    prepareImagesForPrint(images, enhancedImages);

    const loaders = images.map((img) => {
      if (img.complete && img.naturalWidth > 0) {
        return Promise.resolve();
      }
      const loadPromise = new Promise((resolve) => {
        const done = () => resolve();
        img.addEventListener("load", done, { once: true });
        img.addEventListener("error", done, { once: true });
      });
      if (enhancedImages && typeof img.decode === "function") {
        return img.decode().then(() => undefined, () => loadPromise);
      }
      return loadPromise;
    });

    return Promise.race([
      Promise.all(loaders),
      new Promise((resolve) => setTimeout(resolve, timeoutMs))
    ]);
  }

  function waitForPrintAssets(container, doc, sourceRoot, enhancedImages) {
    return Promise.all([
      waitForFontsInDocument(doc || document).catch(() => undefined),
      waitForImages(container, getImageLoadTimeout(enhancedImages), enhancedImages)
    ]).then(() => prepareMountedPrintRoot(sourceRoot || container, container).catch(() => undefined));
  }

  async function printInPage(target, keepStyles, enhancedImages) {
    cleanupPrintArtifacts();

    const clone = target.cloneNode(true);
    prepareClone(target, clone, {
      inlineStyles: keepStyles,
      stripStyles: !keepStyles,
      syncImages: true,
      enhancedImages
    });

    const container = document.createElement("div");
    container.id = PRINT_CONTAINER_ID;
    container.style.position = "fixed";
    container.style.inset = "0";
    container.style.overflow = "auto";
    container.style.background = "#ffffff";
    container.style.padding = "16px";
    container.style.zIndex = "2147483647";
    container.appendChild(clone);

    const style = document.createElement("style");
    style.id = PRINT_STYLE_ID;
    const resetRules = keepStyles
      ? ""
      : `
        #${PRINT_CONTAINER_ID},
        #${PRINT_CONTAINER_ID} * {
          all: revert;
        }
        #${PRINT_CONTAINER_ID} {
          font-family: Arial, sans-serif;
          font-size: 14px;
          color: #111111;
        }
      `;

    style.textContent = `
      ${resetRules}
      @page { size: A4 portrait; margin: 0; }
      @media print {
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          display: block !important;
          max-width: none !important;
          overflow: visible !important;
        }
        body > *:not(#${PRINT_CONTAINER_ID}) {
          display: none !important;
        }
        #${PRINT_CONTAINER_ID} {
          position: static !important;
          inset: auto !important;
          overflow: visible !important;
          padding: 0 !important;
        }
      }
    `;

    (document.head || document.documentElement).appendChild(style);
    document.body.appendChild(container);

    const cleanup = () => {
      cleanupPrintArtifacts();
    };

    window.addEventListener("afterprint", cleanup, { once: true });
    await waitForPrintAssets(clone, document, target, enhancedImages);
    applyDynamicPageSize(clone, style);
    window.print();
  }

  async function exportElementToPdf(target) {
    try {
      await printInPage(target, preserveStyles, enhancedImageLoading);
    } catch (error) {
      const payload = buildPrintPayload(target, preserveStyles, enhancedImageLoading);
      const opened = openPrintWindow(payload, enhancedImageLoading);
      if (!opened) {
        alert(i18n.t("alert.print_blocked"));
      }
    }
  }

  function exportElementToMarkdown(target) {
    const baseName = sanitizeFilename(document.title);
    if (!imagePackaging) {
      downloadMarkdown(elementToMarkdown(target), `${baseName}.md`);
      return;
    }
    const plainMarkdown = elementToMarkdown(target);
    const collected = collectMarkdownExport(target, { imagePackaging: true });
    if (!collected.assets.length) {
      downloadMarkdown(collected.markdown, `${baseName}.md`);
      return;
    }
    resolveMarkdownPackagingAssets(collected.assets)
      .then((resolved) => {
        const finalMarkdown = applyMarkdownAssetUrls(collected.markdown, resolved);
        const entries = [
          { name: `${baseName}.md`, data: new TextEncoder().encode(finalMarkdown) },
          ...resolved.map((r) => ({ name: r.outputPath, data: r.bytes }))
        ];
        downloadBlob(createZipBlob(entries), `${baseName}.zip`);
      })
      .catch(() => {
        downloadMarkdown(plainMarkdown, `${baseName}.md`);
      });
  }

  if (globalThis.__WEB_EXPORTER_TEST_HOOKS__) {
    globalThis.__WEB_EXPORTER_TEST_HOOKS__ = {
      applyEdAmberCodeBlockFormatting,
      applyEdPrintPairOverrides,
      applyGenericCodeBlockFormatting,
      applyMarkdownAssetUrls,
      applyPrintVisibilityOverrides,
      collectMarkdownExport,
      convertMathNode,
      createZipBlob,
      formatCodeBlock,
      detectMathDisplayMode,
      elementToMarkdown,
      expandIframeElementToContent,
      expandMonacoEditors,
      expandScrollableElements,
      getCodeBlockRoot,
      getCodeContentRoot,
      getDocumentContentHeight,
      getGenericCodeBlockRoot,
      getMathRoot,
      getVisualExportRoot,
      isGenericTextCodeBlock,
      isExpandableScrollableElement,
      isMathRoot,
      isCodeBlockRoot,
      prepareMountedPrintRoot,
      resolveMarkdownPackagingAssets,
      resolveSelectableTarget
    };
  }

  if (api && api.runtime && api.runtime.onMessage) {
    api.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (!message || !message.type) {
        if (typeof sendResponse === "function") {
          sendResponse({ ok: false, error: "Missing message type" });
        }
        return;
      }

      if (message.type === "START_SELECTION") {
        startSelection(message.preserveStyles, message.exportFormat, message.enhancedImageLoading, message.imagePackaging);
        if (typeof sendResponse === "function") {
          sendResponse({ ok: true });
        }
        return;
      }

      if (message.type === "CANCEL_SELECTION") {
        stopSelection();
        if (typeof sendResponse === "function") {
          sendResponse({ ok: true });
        }
        return;
      }

      if (typeof sendResponse === "function") {
        sendResponse({ ok: false, error: "Unknown message type" });
      }
    });
  }
})();
