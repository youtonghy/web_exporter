(() => {
  const HIGHLIGHT_CLASS = "__web_exporter_highlight__";
  const OVERLAY_ID = "__web_exporter_overlay__";
  const STYLE_ID = "__web_exporter_style__";
  const PRINT_CONTAINER_ID = "__web_exporter_print_container__";
  const PRINT_STYLE_ID = "__web_exporter_print_style__";
  const CONTENT_API_VERSION = 2;
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
  const INLINE_STYLE_PROPERTIES = [
    "display",
    "visibility",
    "position",
    "top",
    "right",
    "bottom",
    "left",
    "z-index",
    "overflow",
    "overflow-x",
    "overflow-y",
    "white-space",
    "word-break",
    "overflow-wrap",
    "box-sizing",
    "width",
    "min-width",
    "max-width",
    "height",
    "min-height",
    "max-height",
    "margin",
    "margin-top",
    "margin-right",
    "margin-bottom",
    "margin-left",
    "padding",
    "padding-top",
    "padding-right",
    "padding-bottom",
    "padding-left",
    "border",
    "border-top",
    "border-right",
    "border-bottom",
    "border-left",
    "border-radius",
    "background",
    "background-color",
    "background-image",
    "background-size",
    "background-position",
    "background-repeat",
    "color",
    "font",
    "font-family",
    "font-size",
    "font-style",
    "font-weight",
    "letter-spacing",
    "line-height",
    "text-align",
    "text-decoration",
    "text-indent",
    "text-transform",
    "vertical-align",
    "object-fit",
    "object-position",
    "transform",
    "transform-origin"
  ];
  const CODE_FIDELITY_STYLE_PROPERTIES = Array.from(new Set([
    ...INLINE_STYLE_PROPERTIES,
    "align-content",
    "align-items",
    "align-self",
    "appearance",
    "box-shadow",
    "column-gap",
    "flex",
    "flex-basis",
    "flex-direction",
    "flex-flow",
    "flex-grow",
    "flex-shrink",
    "flex-wrap",
    "font-feature-settings",
    "font-kerning",
    "font-optical-sizing",
    "font-variant",
    "font-variant-caps",
    "font-variant-east-asian",
    "font-variant-ligatures",
    "font-variant-numeric",
    "gap",
    "grid",
    "grid-area",
    "grid-auto-columns",
    "grid-auto-flow",
    "grid-auto-rows",
    "grid-column",
    "grid-column-end",
    "grid-column-gap",
    "grid-column-start",
    "grid-row",
    "grid-row-end",
    "grid-row-gap",
    "grid-row-start",
    "grid-template",
    "grid-template-areas",
    "grid-template-columns",
    "grid-template-rows",
    "justify-content",
    "justify-items",
    "justify-self",
    "outline",
    "outline-color",
    "outline-offset",
    "outline-style",
    "outline-width",
    "place-content",
    "place-items",
    "place-self",
    "row-gap",
    "tab-size",
    "text-shadow"
  ]));
  const INLINE_STYLE_TAGS = new Set([
    "article",
    "aside",
    "blockquote",
    "code",
    "figure",
    "figcaption",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "hr",
    "iframe",
    "img",
    "li",
    "math",
    "ol",
    "p",
    "pre",
    "section",
    "svg",
    "table",
    "tbody",
    "td",
    "th",
    "thead",
    "tr",
    "ul"
  ]);

  let selecting = false;
  let preserveStyles = true;
  let exportFormat = "pdf";
  let enhancedImageLoading = false;
  let imagePackaging = false;
  let pdfEngine = "native";
  let lastHighlighted = null;
  let overlay = null;

  const api = typeof browser !== "undefined" ? browser : chrome;
  const i18n = globalThis.WebExporterI18n;
  const previousContentApi = globalThis.__WEB_EXPORTER_CONTENT_API__;
  if (previousContentApi && typeof previousContentApi.dispose === "function") {
    previousContentApi.dispose();
  }

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

  function normalizeExportFormat(format) {
    if (format === "markdown" || format === "png" || format === "debug") {
      return format;
    }
    return "pdf";
  }

  function startSelection(keepStyles, format, enhancedImages, packImages, engine) {
    if (selecting) {
      return;
    }
    preserveStyles = Boolean(keepStyles);
    exportFormat = normalizeExportFormat(format);
    enhancedImageLoading = Boolean(enhancedImages);
    imagePackaging = Boolean(packImages);
    pdfEngine = engine === "cdp" ? "cdp" : engine === "html2canvas" ? "html2canvas" : "native";
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
    if (exportFormat === "debug") {
      exportDebugPackage(target);
    } else if (exportFormat === "markdown") {
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

  function createNodeMeasureCache() {
    return {
      computedStyles: new WeakMap(),
      measuredHeights: new WeakMap()
    };
  }

  function getCachedComputedStyle(node, cache, pseudo) {
    if (!isElementNode(node)) {
      return null;
    }

    if (pseudo) {
      try {
        return window.getComputedStyle(node, pseudo);
      } catch (e) {
        return null;
      }
    }

    const styleCache = cache && cache.computedStyles;
    if (styleCache && styleCache.has(node)) {
      return styleCache.get(node);
    }

    const computed = window.getComputedStyle(node);
    if (styleCache) {
      styleCache.set(node, computed);
    }
    return computed;
  }

  function inlineStyleSubset(source, target, cache, properties = INLINE_STYLE_PROPERTIES) {
    const computed = getCachedComputedStyle(source, cache);
    if (!computed) {
      return;
    }

    const declarations = [];
    properties.forEach((prop) => {
      const value = computed.getPropertyValue(prop);
      if (value) {
        declarations.push(`${prop}:${value};`);
      }
    });

    if (!declarations.length) {
      return;
    }

    const existing = target.getAttribute("style");
    const cssText = declarations.join("");
    target.setAttribute("style", existing ? `${existing};${cssText}` : cssText);
  }

  function shouldInlineComputedStyles(node) {
    if (!isElementNode(node)) {
      return false;
    }

    const tag = getElementTagName(node);
    if (INLINE_STYLE_TAGS.has(tag) || BLOCK_TAGS.has(tag)) {
      return true;
    }

    if (sourceHasClassOrStyle(node) || hasPrintHiddenClass(node)) {
      return true;
    }

    if (tag === "div" || tag === "span") {
      return hasElementChildren(node);
    }

    return false;
  }

  function sourceHasClassOrStyle(node) {
    return Boolean(getAttributeValue(node, "class") || getAttributeValue(node, "style"));
  }

  function isCodeFidelityNode(node) {
    if (!isElementNode(node)) {
      return false;
    }

    const tag = getElementTagName(node);
    if (tag === "code" || tag === "pre") {
      return true;
    }

    if (isEdAmberCodeBlockNode(node) || isGenericTextCodeBlock(node)) {
      return true;
    }

    return Boolean(getGenericCodeBlockRoot(node) || closestEdAmberCodeBlockNode(node));
  }

  function closestEdAmberCodeBlockNode(node) {
    let current = node;
    while (current && isElementNode(current)) {
      if (isEdAmberCodeBlockNode(current)) {
        return current;
      }
      current = current.parentNode;
    }
    return null;
  }

  function hasElementChildren(node) {
    if (!node || !node.childNodes) {
      return false;
    }
    return Array.from(node.childNodes).some((child) => child && child.nodeType === Node.ELEMENT_NODE);
  }

  function collectPrintPreparationContext(sourceRoot, cloneRoot) {
    const sourceNodes = getElementTree(sourceRoot);
    const cloneNodes = getElementTree(cloneRoot);
    const sourceIndexMap = new Map();
    sourceNodes.forEach((node, index) => {
      sourceIndexMap.set(node, index);
    });

    return {
      sourceNodes,
      cloneNodes,
      sourceIndexMap,
      cache: createNodeMeasureCache()
    };
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

  function copyIframePresentation(sourceIframe, snapshotRoot, height) {
    if (!isElementNode(sourceIframe) || !isElementNode(snapshotRoot)) {
      return;
    }

    const cache = createNodeMeasureCache();
    inlineStyleSubset(sourceIframe, snapshotRoot, cache, CODE_FIDELITY_STYLE_PROPERTIES);
    snapshotRoot.setAttribute("data-web-exporter-iframe-snapshot", "true");
    snapshotRoot.style.display = "block";
    snapshotRoot.style.overflow = "visible";
    snapshotRoot.style.maxHeight = "none";
    snapshotRoot.style.border = snapshotRoot.style.border || "0";
    if (height) {
      snapshotRoot.style.height = `${Math.ceil(height)}px`;
      snapshotRoot.style.minHeight = `${Math.ceil(height)}px`;
    }
  }

  function getIframeSnapshotSourceRoot(doc) {
    if (!doc) {
      return null;
    }
    return doc.body || doc.documentElement || null;
  }

  async function createIframeSnapshot(sourceIframe, targetIframe) {
    if (!isIframeElement(sourceIframe) || !isElementNode(targetIframe)) {
      return false;
    }

    const doc = await waitForIframeLoad(sourceIframe);
    const sourceRoot = getIframeSnapshotSourceRoot(doc);
    if (!isElementNode(sourceRoot)) {
      return false;
    }

    const targetDocument = targetIframe.ownerDocument && typeof targetIframe.ownerDocument.createElement === "function"
      ? targetIframe.ownerDocument
      : document;
    const snapshotRoot = targetDocument.createElement("div");
    const snapshotContent = sourceRoot.cloneNode(true);
    prepareClone(sourceRoot, snapshotContent, {
      inlineStyles: true,
      stripStyles: false,
      syncImages: true,
      enhancedImages: true
    });
    snapshotRoot.appendChild(snapshotContent);
    await prepareMountedPrintRoot(sourceRoot, snapshotContent);
    copyIframePresentation(sourceIframe, snapshotRoot, getDocumentContentHeight(doc));
    targetIframe.replaceWith(snapshotRoot);
    return true;
  }

  async function snapshotSameOriginIframes(sourceRoot, cloneRoot) {
    if (!isElementNode(sourceRoot) || !isElementNode(cloneRoot)) {
      return [];
    }

    const sourceIframes = [
      ...(isIframeElement(sourceRoot) ? [sourceRoot] : []),
      ...Array.from(sourceRoot.querySelectorAll("iframe"))
    ];
    if (!sourceIframes.length) {
      return [];
    }

    const cloneNodes = getElementTree(cloneRoot);
    const cloneIframes = cloneNodes.filter((node) => isIframeElement(node));
    const results = [];
    for (let i = 0; i < sourceIframes.length; i += 1) {
      results.push(await createIframeSnapshot(sourceIframes[i], cloneIframes[i]));
    }
    return results;
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

  function formatInlineCodeSpan(text) {
    const content = String(text || "").replace(/\r\n?/g, "\n").replace(/\u00a0/g, " ");
    if (!content) {
      return "";
    }
    const runs = content.match(/`+/g) || [];
    const delimiter = "`".repeat(Math.max(1, ...runs.map((run) => run.length + 1)));
    const needsPadding = content.startsWith("`") || content.endsWith("`");
    const body = needsPadding ? ` ${content} ` : content;
    return `${delimiter}${body}${delimiter}`;
  }

  function escapeHtmlAttribute(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function escapeHtmlText(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function getSerializableAttributes(node) {
    if (!node || !node.attributes) {
      return [];
    }
    if (typeof node.attributes.length === "number") {
      return Array.from(node.attributes).map((attr) => [attr.name, attr.value]);
    }
    return Object.keys(node.attributes).map((name) => [name, node.attributes[name]]);
  }

  function serializeHtmlNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      return escapeHtmlText(node.nodeValue || "");
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return "";
    }
    const tag = node.tagName.toLowerCase();
    const attrs = getSerializableAttributes(node)
      .map(([name, value]) => ` ${name}="${escapeHtmlAttribute(value)}"`)
      .join("");
    const content = Array.from(node.childNodes).map((child) => serializeHtmlNode(child)).join("");
    return `<${tag}${attrs}>${content}</${tag}>`;
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

  function isInputChecked(node) {
    if (!(node instanceof HTMLInputElement)) {
      return false;
    }
    if (typeof node.checked === "boolean") {
      return node.checked;
    }
    return hasAttribute(node, "checked");
  }

  function formatInputValue(node) {
    if (!(node instanceof HTMLInputElement)) {
      return "";
    }
    const type = (node.getAttribute("type") || "text").toLowerCase();
    if (type === "checkbox") {
      return isInputChecked(node) ? "[x]" : "[ ]";
    }
    if (type === "radio") {
      return isInputChecked(node) ? "(x)" : "( )";
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

  function isCanvasQuestionElement(node) {
    return node instanceof Element && hasClass(node, "display_question") && hasClass(node, "question");
  }

  function getCanvasQuestionTitle(node, context) {
    const nameNode = node.querySelector(".question_name");
    const title = nameNode ? convertInlineChildren(nameNode, context).trim() : "";
    return title || "";
  }

  function getCanvasQuestionPoints(node, context) {
    const pointsNode = node.querySelector(".question_points_holder");
    const points = pointsNode ? convertInlineChildren(pointsNode, context).trim() : "";
    return points || "";
  }

  function formatChoiceMarker(input, checkedOverride) {
    if (!(input instanceof HTMLInputElement)) {
      return "-";
    }
    const type = (input.getAttribute("type") || "text").toLowerCase();
    const checked = typeof checkedOverride === "boolean" ? checkedOverride : isInputChecked(input);
    if (type === "checkbox") {
      return checked ? "[x]" : "[ ]";
    }
    if (type === "radio") {
      return checked ? "(x)" : "( )";
    }
    return "-";
  }

  function isCanvasCorrectAnswerChoice(answerNode) {
    if (!(answerNode instanceof Element)) {
      return false;
    }
    return hasClass(answerNode, "correct_answer") || Boolean(answerNode.querySelector('[aria-label="Correct Answer"]'));
  }

  function hasCanvasCorrectAnswerChoices(answers) {
    return answers.some((answer) => isCanvasCorrectAnswerChoice(answer));
  }

  function formatCanvasAnswerChoice(answerNode, context, options = {}) {
    if (!(answerNode instanceof Element) || isMarkdownHiddenElement(answerNode, context)) {
      return "";
    }
    const input = answerNode.querySelector("input");
    const labelNode = answerNode.querySelector(".answer_label") || answerNode.querySelector("label") || answerNode;
    const content = convertNode(labelNode, context).trim();
    if (!content) {
      return "";
    }

    const marker = formatChoiceMarker(
      input,
      options.useCorrectAnswerMarkers ? isCanvasCorrectAnswerChoice(answerNode) : undefined
    );
    const lines = content.split("\n");
    const firstLine = lines.shift() || "";
    const rest = lines.map((line) => (line ? `  ${line}` : "")).join("\n");
    return [`- ${marker} ${firstLine}`.trimEnd(), rest].filter(Boolean).join("\n");
  }

  function convertCanvasAnswers(node, context) {
    const answersRoot = node.querySelector(".answers");
    if (!(answersRoot instanceof Element) || isMarkdownHiddenElement(answersRoot, context)) {
      return "";
    }

    const answerNodes = Array.from(answersRoot.querySelectorAll(".answer"));
    if (!answerNodes.length) {
      return convertBlockChildren(answersRoot, context);
    }

    const blocks = [];
    const legend = answersRoot.querySelector("legend");
    const legendText = legend ? escapeMarkdownText(normalizeWhitespace(legend.textContent || "").trim()) : "";
    if (legendText) {
      blocks.push(legendText);
    }

    const useCorrectAnswerMarkers = hasCanvasCorrectAnswerChoices(answerNodes);
    const choices = answerNodes
      .map((answer) => formatCanvasAnswerChoice(answer, context, { useCorrectAnswerMarkers }))
      .filter(Boolean)
      .join("\n");
    if (choices) {
      blocks.push(choices);
    }

    return blocks.join("\n\n");
  }

  function convertCanvasQuestion(node, context) {
    const blocks = [];
    const title = getCanvasQuestionTitle(node, context);
    const points = getCanvasQuestionPoints(node, context);
    if (title) {
      blocks.push(points ? `## ${title} (${points})` : `## ${title}`);
    }

    const questionTextNode = node.querySelector(".question_text");
    const questionText = questionTextNode ? convertNode(questionTextNode, context).trim() : "";
    if (questionText) {
      blocks.push(questionText);
    }

    const answers = convertCanvasAnswers(node, context);
    if (answers) {
      blocks.push(answers);
    }

    return blocks.join("\n\n");
  }

  function hasClass(node, name) {
    return node instanceof Element && node.classList && node.classList.contains(name);
  }

  function hasAttribute(node, name) {
    return node instanceof Element && node.getAttribute(name) !== null;
  }

  function getClassTokens(node) {
    return getAttributeValue(node, "class").split(/\s+/).filter(Boolean);
  }

  function hasAnyClassToken(node, names) {
    const candidates = new Set(names);
    return getClassTokens(node).some((token) => candidates.has(token.toLowerCase()));
  }

  function getInlineStyleProperty(node, property) {
    const style = getAttributeValue(node, "style");
    if (!style) {
      return "";
    }
    const pattern = new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`, "i");
    const match = style.match(pattern);
    return match ? match[1].replace(/!important/gi, "").trim().toLowerCase() : "";
  }

  function getMarkdownComputedStyle(node, context) {
    if (!isElementNode(node) || typeof window === "undefined" || typeof window.getComputedStyle !== "function") {
      return null;
    }
    try {
      return getCachedComputedStyle(node, context && context.cache);
    } catch (e) {
      return null;
    }
  }

  function isMarkdownHiddenElement(node, context) {
    if (!(node instanceof Element)) {
      return false;
    }

    const tag = node.tagName.toLowerCase();
    if (tag === "input" && (node.getAttribute("type") || "").toLowerCase() === "hidden") {
      return true;
    }
    if (hasAttribute(node, "hidden")) {
      return true;
    }
    if (hasAnyClassToken(node, [
      "screenreader-only",
      "sr-only",
      "visually-hidden",
      "visuallyhidden",
      "visually_hidden",
      "offscreen",
      "a11y-only"
    ])) {
      return true;
    }

    const inlineDisplay = getInlineStyleProperty(node, "display");
    if (inlineDisplay === "none") {
      return true;
    }
    const inlineVisibility = getInlineStyleProperty(node, "visibility");
    if (inlineVisibility === "hidden" || inlineVisibility === "collapse") {
      return true;
    }

    const computed = getMarkdownComputedStyle(node, context);
    if (computed) {
      if (computed.display === "none") {
        return true;
      }
      if (computed.visibility === "hidden" || computed.visibility === "collapse") {
        return true;
      }
    }

    return false;
  }

  function getCurrentHostname() {
    const candidates = [
      typeof location !== "undefined" ? location : null,
      typeof window !== "undefined" ? window.location : null,
      typeof document !== "undefined" ? document.location : null
    ];
    for (const candidate of candidates) {
      if (candidate && typeof candidate.hostname === "string") {
        return candidate.hostname.toLowerCase();
      }
    }
    return "";
  }

  function isEdStemHostname(hostname) {
    const normalized = (hostname || "").toLowerCase();
    return normalized === "edstem.org" || normalized.endsWith(".edstem.org");
  }

  function isEdStemMarkdownMode() {
    return isEdStemHostname(getCurrentHostname());
  }

  function hasAnyClassName(node, names) {
    return node instanceof Element && names.some((name) => hasClass(node, name));
  }

  function isEdStemElement(node, names) {
    return isEdStemMarkdownMode() && hasAnyClassName(node, names);
  }

  function isCodeBlockRoot(node) {
    return node instanceof Element && getCodeBlockRoot(node) === node;
  }

  function getEdStemCodeBlockRoot(node) {
    if (!isEdStemMarkdownMode() || !(node instanceof Element)) {
      return null;
    }

    const selectors = [
      ".amber-display-codeblock",
      ".syntax-highlight",
      ".monaco-editor",
      ".view-lines",
      ".snippet",
      ".amber-pre"
    ];
    for (const selector of selectors) {
      const match = node.closest(selector);
      if (match) {
        return match;
      }
    }
    return null;
  }

  function getCodeBlockRoot(node) {
    if (!(node instanceof Element)) {
      return null;
    }

    const edStemRoot = getEdStemCodeBlockRoot(node);
    if (edStemRoot) {
      return edStemRoot;
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

  function findFirstDescendant(node, selector) {
    if (!(node instanceof Element) || typeof node.querySelector !== "function") {
      return null;
    }
    const match = node.querySelector(selector);
    return match instanceof Element ? match : null;
  }

  function getEdStemCodeContentRoot(node) {
    if (!isEdStemMarkdownMode() || !(node instanceof Element)) {
      return null;
    }

    const printVisible = Array.from(node.querySelectorAll ? node.querySelectorAll(".ed-print-visible") : [])
      .map((visible) => findFirstDescendant(visible, ".syntax-highlight"))
      .find(Boolean);
    if (printVisible) {
      return printVisible;
    }

    if (hasClass(node, "syntax-highlight")) {
      return node;
    }

    const syntax = findFirstDescendant(node, ".syntax-highlight");
    if (syntax) {
      return syntax;
    }

    if (hasClass(node, "view-lines")) {
      return node;
    }

    const viewLines = findFirstDescendant(node, ".view-lines");
    if (viewLines) {
      return viewLines;
    }

    return null;
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

  function extractEdStemMonacoLineText(line) {
    return Array.from(line.childNodes)
      .map((child) => extractCodeText(child))
      .join("")
      .replace(/\u00a0/g, " ");
  }

  function extractEdStemCodeText(contentRoot) {
    if (!(contentRoot instanceof Element)) {
      return "";
    }
    if (hasClass(contentRoot, "view-lines")) {
      return Array.from(contentRoot.querySelectorAll ? contentRoot.querySelectorAll(".view-line") : [])
        .map((line) => extractEdStemMonacoLineText(line))
        .join("\n");
    }
    return extractCodeText(contentRoot, true);
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

    const directAttributes = ["data-language", "data-lang", ...(isEdStemMarkdownMode() ? ["data-mode-id"] : [])];
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

    const labeledNode = node.querySelector(isEdStemMarkdownMode() ? "[data-language], [data-lang], [data-mode-id]" : "[data-language], [data-lang]");
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

    const labeledClassNode = node.querySelector("[class]");
    if (labeledClassNode instanceof Element) {
      const classValue = normalizeCodeLanguage(getLanguageFromClassName(labeledClassNode));
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
    const contentRoot = getEdStemCodeContentRoot(codeRoot) || getCodeContentRoot(codeRoot);
    const rawContent = isEdStemMarkdownMode() ? extractEdStemCodeText(contentRoot) : extractCodeText(contentRoot, true);
    const content = normalizeCodeBlockContent(rawContent);
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
    if (isMarkdownHiddenElement(node, context)) {
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
      return isEdStemMarkdownMode() ? formatInlineCodeSpan(content) : (content ? `\`${escapeMarkdownText(content)}\`` : "");
    }
    if (tag === "sup" || tag === "sub" || tag === "kbd") {
      const content = convertInlineChildren(node, context);
      return `<${tag}>${content}</${tag}>`;
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

    return blocks.join("\n\n");
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

  function getElementChildrenByTag(node, tags) {
    return Array.from(node.childNodes).filter((child) => {
      if (!(child instanceof Element)) {
        return false;
      }
      return tags.has(child.tagName.toLowerCase());
    });
  }

  function convertTableCell(node, context) {
    return convertInlineChildren(node, context)
      .replace(/\|/g, "\\|")
      .trim();
  }

  function isComplexTable(node) {
    const cells = node.querySelectorAll ? node.querySelectorAll("td, th") : [];
    return Array.from(cells).some((cell) => cell.getAttribute("rowspan") || cell.getAttribute("colspan"));
  }

  function formatTableAlignment(cell) {
    const align = (cell.getAttribute("align") || "").toLowerCase();
    if (align === "left") {
      return ":---";
    }
    if (align === "right") {
      return "---:";
    }
    if (align === "center") {
      return ":---:";
    }
    return "---";
  }

  function formatMarkdownTableRow(cells) {
    return `| ${cells.join(" | ")} |`;
  }

  function convertTable(node, context) {
    if (isComplexTable(node)) {
      return serializeHtmlNode(node);
    }

    const rows = getElementChildrenByTag(node, new Set(["thead", "tbody", "tfoot"]))
      .flatMap((section) => getElementChildrenByTag(section, new Set(["tr"])))
      .concat(getElementChildrenByTag(node, new Set(["tr"])));
    if (!rows.length) {
      return "";
    }

    const headerCells = getElementChildrenByTag(rows[0], new Set(["th", "td"]));
    if (!headerCells.length) {
      return "";
    }
    const header = headerCells.map((cell) => convertTableCell(cell, context));
    const separator = headerCells.map((cell) => formatTableAlignment(cell));
    const bodyRows = rows.slice(1).map((row) => {
      const cells = getElementChildrenByTag(row, new Set(["th", "td"]));
      return formatMarkdownTableRow(cells.map((cell) => convertTableCell(cell, context)));
    });
    return [formatMarkdownTableRow(header), formatMarkdownTableRow(separator), ...bodyRows].join("\n");
  }

  function convertDefinitionList(node, context) {
    const lines = [];
    node.childNodes.forEach((child) => {
      if (!(child instanceof Element)) {
        return;
      }
      const tag = child.tagName.toLowerCase();
      if (tag === "dt") {
        const term = convertInlineChildren(child, context).trim();
        if (term) {
          lines.push(term);
        }
        return;
      }
      if (tag === "dd") {
        const definition = convertInlineChildren(child, context).trim();
        if (definition) {
          lines.push(`: ${definition}`);
        }
      }
    });
    return lines.join("\n");
  }

  function convertDetails(node, context) {
    const blocks = [];
    node.childNodes.forEach((child) => {
      if (!(child instanceof Element)) {
        return;
      }
      if (child.tagName.toLowerCase() === "summary") {
        const summary = convertInlineChildren(child, context).trim();
        if (summary) {
          blocks.push(`**${summary}**`);
        }
        return;
      }
      const block = convertNode(child, context);
      if (block && block.trim()) {
        blocks.push(block.trim());
      }
    });
    return blocks.join("\n\n");
  }

  function convertNode(node, context) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = normalizeWhitespace(node.nodeValue || "");
      return escapeMarkdownText(text);
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return "";
    }
    if (isMarkdownHiddenElement(node, context)) {
      return "";
    }
    if (isCanvasQuestionElement(node)) {
      return convertCanvasQuestion(node, context);
    }
    if (isEdStemElement(node, ["ed-print-hidden"])) {
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
      const content = convertInlineChildren(node, context).trim();
      if (isEdStemElement(node, ["amber-callout", "amber-callout-info"])) {
        return formatBlockquoteMarkdown(content);
      }
      return content;
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
      return formatBlockquoteMarkdown(content);
    }
    if (tag === "ul" || tag === "ol") {
      return convertList(node, context);
    }
    if (tag === "table") {
      return convertTable(node, context);
    }
    if (tag === "dl") {
      return convertDefinitionList(node, context);
    }
    if (tag === "details") {
      return convertDetails(node, context);
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
    const content = convertNode(root, { listDepth: 0, cache: createNodeMeasureCache() });
    return normalizeMarkdown(content);
  }

  function formatBlockquoteMarkdown(content) {
    if (!content) {
      return "";
    }
    return content
      .split("\n")
      .map((line) => (line ? `> ${line}` : ">"))
      .join("\n");
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

  function truncateString(value, maxLength) {
    const text = String(value || "");
    const limit = Math.max(0, Number(maxLength) || 0);
    if (!limit || text.length <= limit) {
      return text;
    }
    return text.slice(0, limit) + "…";
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getAttributeEntries(node) {
    if (!node || !node.attributes) {
      return [];
    }
    if (typeof node.attributes[Symbol.iterator] === "function") {
      return Array.from(node.attributes).map((attribute) => [attribute.name, attribute.value]);
    }
    return Object.entries(node.attributes);
  }

  function serializeNodeForDebug(node, maxLength = 12000) {
    if (!node) {
      return "";
    }

    if (typeof node.outerHTML === "string") {
      return truncateString(node.outerHTML, maxLength);
    }

    if (node.nodeType === Node.TEXT_NODE) {
      return escapeHtml(node.nodeValue || "");
    }

    if (!isElementNode(node)) {
      return truncateString(String(node.textContent || ""), maxLength);
    }

    const tagName = getElementTagName(node);
    const attributes = getAttributeEntries(node)
      .map(([name, value]) => `${name}="${escapeHtml(value)}"`)
      .join(" ");
    const openingTag = attributes ? `<${tagName} ${attributes}>` : `<${tagName}>`;
    const closingTag = ["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"].includes(tagName)
      ? ""
      : `</${tagName}>`;
    const children = Array.from(node.childNodes || [])
      .map((child) => serializeNodeForDebug(child, maxLength))
      .join("");
    return truncateString(`${openingTag}${children}${closingTag}`, maxLength);
  }

  function getDebugNodePath(node) {
    if (!isElementNode(node)) {
      return "";
    }

    const segments = [];
    let current = node;
    while (isElementNode(current)) {
      let segment = getElementTagName(current);
      const id = getAttributeValue(current, "id");
      if (id) {
        segment += `#${id}`;
      }
      const className = getAttributeValue(current, "class");
      if (className) {
        segment += `.${className.trim().split(/\s+/).filter(Boolean).join(".")}`;
      }
      segments.unshift(segment);
      current = current.parentNode;
    }

    return segments.join(" > ");
  }

  function summarizeNodeForDebug(node, cache) {
    if (!isElementNode(node)) {
      return {
        tagName: "",
        path: "",
        text: ""
      };
    }

    const computed = getCachedComputedStyle(node, cache);
    return {
      tagName: getElementTagName(node),
      path: getDebugNodePath(node),
      id: getAttributeValue(node, "id") || "",
      className: getAttributeValue(node, "class") || "",
      text: truncateString((node.textContent || "").replace(/\s+/g, " ").trim(), 240),
      display: computed && typeof computed.display === "string" ? computed.display : "",
      visibility: computed && typeof computed.visibility === "string" ? computed.visibility : "",
      opacity: computed && computed.opacity != null ? String(computed.opacity) : "",
      whiteSpace: computed && typeof computed.whiteSpace === "string" ? computed.whiteSpace : "",
      overflow: computed && typeof computed.overflow === "string" ? computed.overflow : "",
      overflowY: computed && typeof computed.overflowY === "string" ? computed.overflowY : "",
      width: computed && typeof computed.width === "string" ? computed.width : "",
      height: computed && typeof computed.height === "string" ? computed.height : "",
      scrollHeight: Number(node.scrollHeight) || 0,
      clientHeight: Number(node.clientHeight) || 0,
      offsetHeight: Number(node.offsetHeight) || 0
    };
  }

  function buildDebugReport(kind, target, preparedRoot, extras = {}) {
    const cache = createNodeMeasureCache();
    return {
      kind,
      title: document.title,
      url: typeof location !== "undefined" ? location.href : "",
      timestamp: new Date().toISOString(),
      target: summarizeNodeForDebug(target, cache),
      prepared: summarizeNodeForDebug(preparedRoot, cache),
      targetHtml: serializeNodeForDebug(target),
      preparedHtml: serializeNodeForDebug(preparedRoot),
      ...extras
    };
  }

  function emitDebugReport(kind, target, preparedRoot, extras = {}) {
    const report = buildDebugReport(kind, target, preparedRoot, extras);
    const filename = `${sanitizeFilename(document.title)}-${kind}-debug-${Date.now()}.json`;
    console.groupCollapsed(`[web_exporter] ${kind} debug`);
    console.info(report);
    console.groupEnd();
    downloadBlob(new Blob([JSON.stringify(report, null, 2)], { type: "application/json;charset=utf-8" }), filename);
    return report;
  }

  function getDebugBrowserInfo() {
    const manifest = api && api.runtime && typeof api.runtime.getManifest === "function"
      ? api.runtime.getManifest()
      : null;
    return {
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
      language: typeof navigator !== "undefined" ? navigator.language : "",
      extensionVersion: manifest && manifest.version ? manifest.version : "",
      manifestVersion: manifest && manifest.manifest_version ? manifest.manifest_version : ""
    };
  }

  function getDebugExportConfig() {
    return {
      exportFormat,
      preserveStyles,
      enhancedImageLoading,
      imagePackaging,
      pdfEngine
    };
  }

  async function exportDebugPackage(target) {
    const clone = target.cloneNode(true);
    prepareClone(target, clone, {
      inlineStyles: true,
      stripStyles: false,
      syncImages: true,
      enhancedImages: true
    });

    await prepareMountedPrintRoot(target, clone).catch(() => undefined);
    emitDebugReport("debug-package", target, clone, {
      browser: getDebugBrowserInfo(),
      config: getDebugExportConfig()
    });
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
      inlineStyleSubset(sourceCanvas, img);
    }

    targetCanvas.replaceWith(img);
  }

  function prepareClone(sourceRoot, cloneRoot, options) {
    removeScriptTags(cloneRoot);

    const context = collectPrintPreparationContext(sourceRoot, cloneRoot);
    const { sourceNodes, cloneNodes } = context;
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
        if (isCodeFidelityNode(sourceNode)) {
          inlineStyleSubset(sourceNode, cloneNode, context.cache, CODE_FIDELITY_STYLE_PROPERTIES);
        } else if (shouldInlineComputedStyles(sourceNode)) {
          inlineStyleSubset(sourceNode, cloneNode, context.cache);
        } else if (isElementNode(sourceNode)) {
          inlineStyleSubset(sourceNode, cloneNode, context.cache, [
            "display", "visibility", "color", "font-family", "font-size",
            "font-style", "font-weight", "line-height", "text-align",
            "background-color", "margin", "padding"
          ]);
        }
      }

      applyClonePreparationStep(sourceNode, cloneNode, context);
    }

    return context;
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

  function isNodeVisibleOnScreen(node, cache) {
    if (!isElementNode(node)) {
      return false;
    }

    const computed = getCachedComputedStyle(node, cache);
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

  function getPreparationContext(sourceRoot, cloneRoot, context) {
    return context || collectPrintPreparationContext(sourceRoot, cloneRoot);
  }

  function applyPrintVisibilityOverrides(sourceRoot, cloneRoot, context) {
    const preparation = getPreparationContext(sourceRoot, cloneRoot, context);
    const { sourceNodes, cloneNodes } = preparation;
    let applied = 0;

    for (let i = 0; i < sourceNodes.length; i += 1) {
      const sourceNode = sourceNodes[i];
      const cloneNode = cloneNodes[i];

      if (!isElementNode(sourceNode) || !isElementNode(cloneNode)) {
        continue;
      }
      if (!hasPrintHiddenClass(sourceNode) || !isNodeVisibleOnScreen(sourceNode, preparation.cache)) {
        continue;
      }

      syncVisiblePrintStyles(sourceNode, cloneNode, preparation.cache);
      applied += 1;
    }

    return applied;
  }

  function syncVisiblePrintStyles(sourceNode, cloneNode, cache) {
    if (!isElementNode(sourceNode) || !isElementNode(cloneNode)) {
      return false;
    }

    const computed = getCachedComputedStyle(sourceNode, cache);
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

  function applyEdPrintPairOverrides(sourceRoot, cloneRoot, context) {
    const preparation = getPreparationContext(sourceRoot, cloneRoot, context);
    const { sourceNodes, cloneNodes, sourceIndexMap } = preparation;
    let applied = 0;

    for (let i = 0; i < sourceNodes.length; i += 1) {
      const sourceNode = sourceNodes[i];
      const cloneNode = cloneNodes[i];

      if (!isElementNode(sourceNode) || !isElementNode(cloneNode) || !isEdAmberScreenCodeBlock(sourceNode) || !isNodeVisibleOnScreen(sourceNode, preparation.cache)) {
        continue;
      }

      const siblingPrintNodes = findSiblingEdPrintVisibleNodes(sourceNode);
      if (!siblingPrintNodes.length) {
        continue;
      }

      syncVisiblePrintStyles(sourceNode, cloneNode, preparation.cache);
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
    const preparation = collectPrintPreparationContext(sourceRoot, cloneRoot);
    return applyGenericCodeBlockFormattingWithContext(preparation);
  }

  function applyGenericCodeBlockFormattingWithContext(preparation) {
    const { sourceNodes, cloneNodes } = preparation;
    let applied = 0;

    for (let i = 0; i < sourceNodes.length; i += 1) {
      const sourceNode = sourceNodes[i];
      const cloneNode = cloneNodes[i];

      if (!isElementNode(sourceNode) || !isElementNode(cloneNode) || !isGenericTextCodeBlock(sourceNode)) {
        continue;
      }

      const computed = getCachedComputedStyle(sourceNode, preparation.cache);
      const display = computed && typeof computed.display === "string" ? computed.display.trim() : "";

      forceStyleProperty(cloneNode, "white-space", "pre-wrap");
      forceStyleProperty(cloneNode, "overflow-wrap", "anywhere");
      if (display && display !== "none") {
        forceStyleProperty(cloneNode, "display", display);
      }

      const fontFamily = computed && typeof computed.fontFamily === "string" ? computed.fontFamily.trim() : "";
      forceStyleProperty(cloneNode, "font-family", fontFamily || GENERIC_CODE_FONT_STACK);

      const sourceHeight = getNodeMeasuredHeight(sourceNode, preparation.cache);
      const cloneHeight = Math.max(getNodeMeasuredHeight(cloneNode, preparation.cache), Number(cloneNode.scrollHeight) || 0, sourceHeight);
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
    const preparation = collectPrintPreparationContext(sourceRoot, cloneRoot);
    return applyEdAmberCodeBlockFormattingWithContext(preparation);
  }

  function applyEdAmberCodeBlockFormattingWithContext(preparation) {
    const { sourceNodes, cloneNodes } = preparation;
    let applied = 0;

    for (let i = 0; i < sourceNodes.length; i += 1) {
      const sourceNode = sourceNodes[i];
      const cloneNode = cloneNodes[i];

      if (!isElementNode(sourceNode) || !isElementNode(cloneNode) || !isEdAmberCodeBlockNode(sourceNode)) {
        continue;
      }

      const computed = getCachedComputedStyle(sourceNode, preparation.cache);
      const fontFamily = computed && typeof computed.fontFamily === "string" ? computed.fontFamily.trim() : "";
      const display = computed && typeof computed.display === "string" ? computed.display.trim() : "";
      const height = Math.max(getNodeMeasuredHeight(sourceNode, preparation.cache), getNodeMeasuredHeight(cloneNode, preparation.cache), Number(cloneNode.scrollHeight) || 0);

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

  function getComputedOverflowY(node, cache) {
    const computed = getCachedComputedStyle(node, cache);
    const overflowY = computed && typeof computed.overflowY === "string" ? computed.overflowY : "";
    const overflow = computed && typeof computed.overflow === "string" ? computed.overflow : "";
    return (overflowY || overflow || "").trim().toLowerCase();
  }

  function isExpandableScrollableElement(node, cache) {
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

    return SCROLLABLE_OVERFLOW_VALUES.has(getComputedOverflowY(node, cache));
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

  function expandScrollableElements(root, cache) {
    const nodes = getElementTree(root).reverse();
    let expanded = 0;

    nodes.forEach((node) => {
      if (!isExpandableScrollableElement(node, cache)) {
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

  function getNodeMeasuredHeight(node, cache) {
    if (!isElementNode(node)) {
      return 0;
    }

    const heightCache = cache && cache.measuredHeights;
    if (heightCache && heightCache.has(node)) {
      return heightCache.get(node);
    }

    const styleHeight = node.style && typeof node.style.height === "string" ? parsePixelValue(node.style.height) : 0;
    const attributeHeight = parsePixelValue((getAttributeValue(node, "style").match(/(?:^|;)\s*height\s*:\s*([^;]+)/i) || [])[1] || "");
    const scrollHeight = Number(node.scrollHeight) || 0;
    const clientHeight = Number(node.clientHeight) || 0;
    const offsetHeight = Number(node.offsetHeight) || 0;
    const computed = getCachedComputedStyle(node, cache);
    const computedHeight = computed && typeof computed.height === "string" ? parsePixelValue(computed.height) : 0;
    const measuredHeight = Math.max(styleHeight, attributeHeight, scrollHeight, clientHeight, offsetHeight, computedHeight);
    if (heightCache) {
      heightCache.set(node, measuredHeight);
    }
    return measuredHeight;
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

  function getMonacoContentHeight(root, cache) {
    let maxHeight = 0;
    const heightCarrierClasses = ["view-lines", "lines-content", "margin-view-overlays", "margin", "monaco-scrollable-element", "overflow-guard", "monaco-editor"];

    getElementTree(root).forEach((node) => {
      if (!isElementNode(node)) {
        return;
      }

      if (!hasAnyClass(node, heightCarrierClasses) && node !== root) {
        return;
      }

      maxHeight = Math.max(maxHeight, getNodeMeasuredHeight(node, cache));
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

  function expandMonacoEditors(root, cache) {
    const editors = getMonacoEditorContainers(root);
    let expanded = 0;

    editors.forEach((editorRoot) => {
      const height = getMonacoContentHeight(editorRoot, cache);
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
      const iframeCache = createNodeMeasureCache();
      expandMonacoEditors(root, iframeCache);
      expandScrollableElements(root, iframeCache);
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

  async function prepareMountedPrintRoot(sourceRoot, cloneRoot, options = {}) {
    const mountedRoot = cloneRoot || sourceRoot;
    if (!isElementNode(mountedRoot)) {
      return;
    }

    if (options.snapshotIframes && isElementNode(sourceRoot) && isElementNode(cloneRoot)) {
      await snapshotSameOriginIframes(sourceRoot, cloneRoot);
    }

    if (isElementNode(sourceRoot) && isElementNode(cloneRoot)) {
      const preparation = collectPrintPreparationContext(sourceRoot, cloneRoot);
      for (let i = 0; i < preparation.sourceNodes.length; i += 1) {
        applyClonePreparationStep(preparation.sourceNodes[i], preparation.cloneNodes[i], preparation);
      }
    }

    const cache = createNodeMeasureCache();
    expandMonacoEditors(mountedRoot, cache);
    expandScrollableElements(mountedRoot, cache);
    if (!options.snapshotIframes) {
      await expandSameOriginIframes(mountedRoot);
    }
    normalizePrintRootLayout(mountedRoot);
  }

  function applyClonePreparationStep(sourceNode, cloneNode, preparation) {
    if (!isElementNode(sourceNode) || !isElementNode(cloneNode)) {
      return;
    }

    if (hasPrintHiddenClass(sourceNode) && isNodeVisibleOnScreen(sourceNode, preparation.cache)) {
      syncVisiblePrintStyles(sourceNode, cloneNode, preparation.cache);
    }

    if (isEdAmberScreenCodeBlock(sourceNode) && isNodeVisibleOnScreen(sourceNode, preparation.cache)) {
      const siblingPrintNodes = findSiblingEdPrintVisibleNodes(sourceNode);
      syncVisiblePrintStyles(sourceNode, cloneNode, preparation.cache);
      siblingPrintNodes.forEach((siblingNode) => {
        const siblingIndex = preparation.sourceIndexMap.get(siblingNode);
        const cloneSibling = typeof siblingIndex === "number" ? preparation.cloneNodes[siblingIndex] : null;
        if (!isElementNode(cloneSibling)) {
          return;
        }
        forceStyleProperty(cloneSibling, "display", "none");
        forceStyleProperty(cloneSibling, "visibility", "hidden");
        forceStyleProperty(cloneSibling, "opacity", "0");
      });
    }

    if (isGenericTextCodeBlock(sourceNode)) {
      applyGenericCodeBlockFormattingWithContext({
        ...preparation,
        sourceNodes: [sourceNode],
        cloneNodes: [cloneNode]
      });
    }

    if (isEdAmberCodeBlockNode(sourceNode)) {
      applyEdAmberCodeBlockFormattingWithContext({
        ...preparation,
        sourceNodes: [sourceNode],
        cloneNodes: [cloneNode]
      });
    }
  }

  function normalizePrintRootLayout(root) {
    if (!isElementNode(root)) {
      return;
    }
    root.style.marginLeft = "0";
    root.style.marginRight = "0";
    root.style.marginInlineStart = "0";
    root.style.marginInlineEnd = "0";
  }

  const CSS_PIXELS_PER_INCH = 96;
  const PDF_POINTS_PER_INCH = 72;
  const DEFAULT_PDF_PAGE_WIDTH_PX = 794;
  const DEFAULT_PDF_PAGE_HEIGHT_PX = 1123;

  function normalizePdfPageDimensionPx(value, fallbackPx) {
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue) || numberValue <= 0) {
      return fallbackPx;
    }
    return Math.ceil(numberValue);
  }

  function formatPdfLengthInches(px, fallbackPx) {
    return Number((normalizePdfPageDimensionPx(px, fallbackPx) / CSS_PIXELS_PER_INCH).toFixed(4));
  }

  function buildPdfPageRule(widthPx = DEFAULT_PDF_PAGE_WIDTH_PX, heightPx = DEFAULT_PDF_PAGE_HEIGHT_PX) {
    const widthIn = formatPdfLengthInches(widthPx, DEFAULT_PDF_PAGE_WIDTH_PX);
    const heightIn = formatPdfLengthInches(heightPx, DEFAULT_PDF_PAGE_HEIGHT_PX);
    return `@page { size: ${widthIn}in ${heightIn}in; margin: 0; }`;
  }

  function getElementRectSize(node) {
    if (!isElementNode(node) || typeof node.getBoundingClientRect !== "function") {
      return { width: 0, height: 0 };
    }

    const rect = node.getBoundingClientRect();
    return {
      width: rect && Number.isFinite(Number(rect.width)) ? Number(rect.width) : 0,
      height: rect && Number.isFinite(Number(rect.height)) ? Number(rect.height) : 0
    };
  }

  function measurePdfPageSize(root) {
    const rect = getElementRectSize(root);
    const widthPx = normalizePdfPageDimensionPx(
      Math.max(Number(root && root.scrollWidth) || 0, Number(root && root.offsetWidth) || 0, Number(root && root.clientWidth) || 0, rect.width),
      DEFAULT_PDF_PAGE_WIDTH_PX
    );
    const heightPx = normalizePdfPageDimensionPx(
      Math.max(Number(root && root.scrollHeight) || 0, Number(root && root.offsetHeight) || 0, Number(root && root.clientHeight) || 0, rect.height),
      DEFAULT_PDF_PAGE_HEIGHT_PX
    );

    return {
      widthPx,
      heightPx,
      paperWidth: widthPx / CSS_PIXELS_PER_INCH,
      paperHeight: heightPx / CSS_PIXELS_PER_INCH,
      widthPt: widthPx * PDF_POINTS_PER_INCH / CSS_PIXELS_PER_INCH,
      heightPt: heightPx * PDF_POINTS_PER_INCH / CSS_PIXELS_PER_INCH
    };
  }

  function getStandardPdfPageSize() {
    return measurePdfPageSize(null);
  }

  function applyPdfPageWidth(node, pageSize) {
    if (!isElementNode(node) || !node.style || !pageSize) {
      return;
    }

    node.style.width = `${pageSize.widthPx}px`;
    node.style.minWidth = `${pageSize.widthPx}px`;
    node.style.maxWidth = "none";
  }

  function collectPageStyles() {
    const inlineStyles = [];
    const externalLinks = [];

    try {
      for (const sheet of document.styleSheets) {
        if (!sheet) {
          continue;
        }

        let rulesText = "";
        let accessible = true;
        try {
          if (sheet.cssRules) {
            for (const rule of sheet.cssRules) {
              rulesText += rule.cssText + "\n";
            }
          }
        } catch (e) {
          accessible = false;
          if (sheet.href) {
            externalLinks.push({
              href: sheet.href,
              media: sheet.media && sheet.media.mediaText ? sheet.media.mediaText : ""
            });
          }
        }

        if (accessible && rulesText.trim()) {
          inlineStyles.push(rulesText.trim());
        }
      }
    } catch (e) {
      // Ignore failures to access document.styleSheets.
    }

    try {
      if (document.adoptedStyleSheets && document.adoptedStyleSheets.length) {
        for (const sheet of document.adoptedStyleSheets) {
          let rulesText = "";
          try {
            if (sheet.cssRules) {
              for (const rule of sheet.cssRules) {
                rulesText += rule.cssText + "\n";
              }
            }
          } catch (e) {
            // Ignore unreadable adopted sheets.
          }
          if (rulesText.trim()) {
            inlineStyles.push(rulesText.trim());
          }
        }
      }
    } catch (e) {
      // Ignore adoptedStyleSheets access failures.
    }

    return { inlineStyles, externalLinks };
  }

  function buildPrintDocumentStyle(bodyStyle, pageSize) {
    return `
      ${buildPdfPageRule(pageSize.widthPx, pageSize.heightPx)}
      html, body { margin: 0 !important; padding: 0 !important; }
      body {
        ${bodyStyle}
        display: block !important;
        width: ${pageSize.widthPx}px !important;
        min-width: ${pageSize.widthPx}px !important;
        max-width: none !important;
      }
      * { box-sizing: border-box; }
    `;
  }

  function buildInPagePrintStyle(resetRules, pageSize) {
    return `
      ${resetRules}
      ${buildPdfPageRule(pageSize.widthPx, pageSize.heightPx)}
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
          width: ${pageSize.widthPx}px !important;
          min-width: ${pageSize.widthPx}px !important;
          max-width: none !important;
        }
      }
    `;
  }

  function buildPrintPayload(target, keepStyles, enhancedImages, singlePage = true) {
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

    return { clone, baseHref, bodyStyle, sourceRoot: target, pageSize: singlePage ? measurePdfPageSize(target) : getStandardPdfPageSize(), singlePage, pageStyles: collectPageStyles() };
  }

  function populatePrintDocument(doc, payload) {
    const { clone, baseHref, bodyStyle, pageSize, pageStyles } = payload;

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

    if (pageStyles) {
      for (const link of pageStyles.externalLinks) {
        const linkEl = doc.createElement("link");
        linkEl.setAttribute("rel", "stylesheet");
        linkEl.setAttribute("href", link.href);
        if (link.media) {
          linkEl.setAttribute("media", link.media);
        }
        doc.head.appendChild(linkEl);
      }
      for (const cssText of pageStyles.inlineStyles) {
        const styleEl = doc.createElement("style");
        styleEl.textContent = cssText;
        doc.head.appendChild(styleEl);
      }
    }

    const style = doc.createElement("style");
    style.textContent = buildPrintDocumentStyle(bodyStyle, pageSize);
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
      waitForPrintAssets(printableRoot, doc, payload.sourceRoot, enhancedImages)
        .then(() => {
          const pageSize = payload.singlePage === false ? getStandardPdfPageSize() : measurePdfPageSize(printableRoot);
          applyPdfPageWidth(doc.body, pageSize);
          styleEl.textContent = buildPrintDocumentStyle(payload.bodyStyle, pageSize);
          triggerPrint();
        }, triggerPrint);
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
    ]).then(() => prepareMountedPrintRoot(sourceRoot || container, container, { snapshotIframes: Boolean(sourceRoot) }).catch(() => undefined));
  }

  async function printInPage(target, keepStyles, enhancedImages, singlePage = true) {
    cleanupPrintArtifacts();

    const clone = target.cloneNode(true);
    prepareClone(target, clone, {
      inlineStyles: keepStyles,
      stripStyles: !keepStyles,
      syncImages: true,
      enhancedImages
    });

    const container = document.createElement("div");
    const initialPageSize = singlePage ? measurePdfPageSize(target) : getStandardPdfPageSize();
    container.id = PRINT_CONTAINER_ID;
    container.style.position = "fixed";
    container.style.inset = "0";
    container.style.overflow = "auto";
    container.style.background = "#ffffff";
    container.style.padding = "16px";
    container.style.zIndex = "2147483647";
    applyPdfPageWidth(container, initialPageSize);
    container.appendChild(clone);

    const style = document.createElement("style");
    style.id = PRINT_STYLE_ID;
    const resetRules = keepStyles
      ? ""
      : `
        #${PRINT_CONTAINER_ID},
        #${PRINT_CONTAINER_ID} * {
          margin: 0;
          padding: 0;
          border: 0;
          font-size: 100%;
          font: inherit;
          vertical-align: baseline;
          background: transparent;
          color: #111111;
        }
        #${PRINT_CONTAINER_ID} {
          font-family: Arial, sans-serif;
          font-size: 14px;
        }
      `;

    style.textContent = buildInPagePrintStyle(resetRules, initialPageSize);

    (document.head || document.documentElement).appendChild(style);
    document.body.appendChild(container);

    const cleanup = () => {
      cleanupPrintArtifacts();
    };

    window.addEventListener("afterprint", cleanup, { once: true });
    await waitForPrintAssets(clone, document, target, enhancedImages);
    const pageSize = singlePage ? measurePdfPageSize(clone) : getStandardPdfPageSize();
    applyPdfPageWidth(container, pageSize);
    style.textContent = buildInPagePrintStyle(resetRules, pageSize);
    window.print();
  }

  async function exportElementToNativePdf(target, singlePage = true) {
    try {
      await printInPage(target, preserveStyles, enhancedImageLoading, singlePage);
    } catch (error) {
      const payload = buildPrintPayload(target, preserveStyles, enhancedImageLoading, singlePage);
      const opened = openPrintWindow(payload, enhancedImageLoading);
      if (!opened) {
        alert(i18n.t("alert.print_blocked"));
      }
    }
  }

  async function exportElementToPdfViaCdp(target) {
    cleanupPrintArtifacts();

    const clone = target.cloneNode(true);
    prepareClone(target, clone, {
      inlineStyles: preserveStyles,
      stripStyles: !preserveStyles,
      syncImages: true,
      enhancedImages: enhancedImageLoading
    });

    const container = document.createElement("div");
    const initialPageSize = measurePdfPageSize(target);
    container.id = PRINT_CONTAINER_ID;
    container.style.position = "fixed";
    container.style.inset = "0";
    container.style.overflow = "auto";
    container.style.background = "#ffffff";
    container.style.padding = "16px";
    container.style.zIndex = "2147483647";
    applyPdfPageWidth(container, initialPageSize);
    container.appendChild(clone);

    const style = document.createElement("style");
    style.id = PRINT_STYLE_ID;
    const resetRules = preserveStyles
      ? ""
      : `
        #${PRINT_CONTAINER_ID},
        #${PRINT_CONTAINER_ID} * {
          margin: 0;
          padding: 0;
          border: 0;
          font-size: 100%;
          font: inherit;
          vertical-align: baseline;
          background: transparent;
          color: #111111;
        }
        #${PRINT_CONTAINER_ID} {
          font-family: Arial, sans-serif;
          font-size: 14px;
        }
      `;

    style.textContent = buildInPagePrintStyle(resetRules, initialPageSize);

    (document.head || document.documentElement).appendChild(style);
    document.body.appendChild(container);

    await waitForPrintAssets(clone, document, target, enhancedImageLoading);
    const pageSize = measurePdfPageSize(clone);
    applyPdfPageWidth(container, pageSize);
    style.textContent = buildInPagePrintStyle(resetRules, pageSize);

    let response;
    try {
      response = await sendRuntimeMessage({
        type: "PRINT_TO_PDF_CDP",
        paperWidth: pageSize.paperWidth,
        paperHeight: pageSize.paperHeight
      });
    } finally {
      cleanupPrintArtifacts();
    }

    if (!response || !response.ok || !response.base64) {
      throw new Error((response && response.error) || "CDP print failed");
    }

    const binaryString = atob(response.base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i += 1) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    downloadBlob(new Blob([bytes], { type: "application/pdf" }), sanitizeFilename(document.title) + ".pdf");
  }

  async function exportElementToPdfViaHtml2Canvas(target) {
    const libUrl = (name) => {
      if (!api || !api.runtime || typeof api.runtime.getURL !== "function") {
        throw new Error("runtime.getURL unavailable");
      }
      return api.runtime.getURL(`lib/${name}`);
    };

    const injectScript = async (name) => {
      const url = libUrl(name);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to load ${name}`);
      }
      const code = await response.text();
      const blob = new Blob([code], { type: "application/javascript" });
      const blobUrl = URL.createObjectURL(blob);
      return new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = blobUrl;
        script.onload = () => {
          URL.revokeObjectURL(blobUrl);
          resolve();
        };
        script.onerror = () => {
          URL.revokeObjectURL(blobUrl);
          reject(new Error(`Failed to inject ${name}`));
        };
        (document.head || document.documentElement).appendChild(script);
      });
    };

    await injectScript("html2canvas.min.js");
    await injectScript("pdf-lib.min.js");

    const clone = target.cloneNode(true);
    prepareClone(target, clone, {
      inlineStyles: true,
      stripStyles: false,
      syncImages: true,
      enhancedImages: enhancedImageLoading
    });

    const wrapper = document.createElement("div");
    const initialPageSize = measurePdfPageSize(target);
    wrapper.style.cssText = `position:absolute;left:-99999px;top:0;width:${initialPageSize.widthPx}px;z-index:-1;overflow:visible;background:#ffffff;`;
    wrapper.appendChild(clone);
    document.body.appendChild(wrapper);
    await prepareMountedPrintRoot(target, clone, { snapshotIframes: true });
    const pageSize = measurePdfPageSize(clone);
    applyPdfPageWidth(wrapper, pageSize);

    try {
      const eventId = `__web_exporter_pdf_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;

      const result = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("html2canvas PDF generation timeout"));
        }, 60000);

        window.addEventListener(eventId, (e) => {
          clearTimeout(timeout);
          if (e.detail && e.detail.error) {
            reject(new Error(e.detail.error));
          } else {
            resolve(e.detail);
          }
        }, { once: true });

        const script = document.createElement("script");
        script.textContent = `
          (async () => {
            const wrapper = document.querySelector('[data-web-exporter-pdf-id="${eventId}"]');
            if (!wrapper || typeof html2canvas !== "function" || typeof PDFLib === "undefined") {
              window.dispatchEvent(new CustomEvent("${eventId}", { detail: { error: "Libraries not loaded" } }));
              return;
            }
            try {
              const renderScale = 2;
              const pointsPerCssPixel = ${PDF_POINTS_PER_INCH / CSS_PIXELS_PER_INCH};
              const canvas = await html2canvas(wrapper, {
                scale: renderScale,
                useCORS: true,
                backgroundColor: "#ffffff",
                logging: false,
                windowWidth: ${pageSize.widthPx},
                windowHeight: ${pageSize.heightPx}
              });
              const pdfDoc = await PDFLib.PDFDocument.create();
              const dataUrl = canvas.toDataURL("image/png");
              const base64Data = dataUrl.split(",")[1];
              const pngBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
              const img = await pdfDoc.embedPng(pngBytes);
              const pageWidth = (canvas.width / renderScale) * pointsPerCssPixel;
              const pageHeight = (canvas.height / renderScale) * pointsPerCssPixel;
              const page = pdfDoc.addPage([pageWidth, pageHeight]);
              page.drawImage(img, { x: 0, y: 0, width: pageWidth, height: pageHeight });

              const pdfBytes = await pdfDoc.save();
              const base64 = btoa(String.fromCharCode(...pdfBytes));
              window.dispatchEvent(new CustomEvent("${eventId}", { detail: { base64 } }));
            } catch (err) {
              window.dispatchEvent(new CustomEvent("${eventId}", { detail: { error: err && err.message ? err.message : String(err) } }));
            }
          })();
        `;
        wrapper.setAttribute("data-web-exporter-pdf-id", eventId);
        document.documentElement.appendChild(script);
        script.remove();
      });

      wrapper.remove();

      if (result.base64) {
        const binaryString = atob(result.base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i += 1) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        downloadBlob(new Blob([bytes], { type: "application/pdf" }), sanitizeFilename(document.title) + ".pdf");
      }
    } catch (error) {
      wrapper.remove();
      throw error;
    }
  }

  async function exportElementToPdf(target) {
    if (pdfEngine === "cdp") {
      try {
        await exportElementToPdfViaCdp(target);
        return;
      } catch (error) {
        console.warn("CDP PDF export failed, falling back to native:", error);
        alert(i18n.t("error.cdp_unavailable"));
        await exportElementToNativePdf(target, false);
        return;
      }
    }
    if (pdfEngine === "html2canvas") {
      try {
        await exportElementToPdfViaHtml2Canvas(target);
        return;
      } catch (error) {
        console.warn("html2canvas PDF export failed, falling back to native:", error);
        alert(i18n.t("error.html2canvas_unavailable"));
        await exportElementToNativePdf(target, false);
        return;
      }
    }
    await exportElementToNativePdf(target, true);
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
      buildDebugReport,
      applyEdAmberCodeBlockFormatting,
      applyEdPrintPairOverrides,
      applyGenericCodeBlockFormatting,
      applyMarkdownAssetUrls,
      applyPrintVisibilityOverrides,
      collectMarkdownExport,
      convertMathNode,
      createNodeMeasureCache,
      createZipBlob,
      formatCodeBlock,
      detectMathDisplayMode,
      elementToMarkdown,
      expandIframeElementToContent,
      expandMonacoEditors,
      expandScrollableElements,
      getCodeBlockRoot,
      getCodeContentRoot,
      getCachedComputedStyle,
      getDocumentContentHeight,
      getEdStemCodeBlockRoot,
      getEdStemCodeContentRoot,
      getGenericCodeBlockRoot,
      getMathRoot,
      getNodeMeasuredHeight,
      getVisualExportRoot,
      inlineStyleSubset,
      isGenericTextCodeBlock,
      isExpandableScrollableElement,
      isMathRoot,
      isCodeBlockRoot,
      buildPdfPageRule,
      measurePdfPageSize,
      normalizePrintRootLayout,
      prepareClone,
      prepareMountedPrintRoot,
      resolveMarkdownPackagingAssets,
      resolveSelectableTarget,
      serializeNodeForDebug,
      summarizeNodeForDebug,
      exportDebugPackage,
      isEdStemHostname,
      isEdStemMarkdownMode,
      normalizeExportFormat
    };
  }

  function startSelectionFromPopup(payload = {}) {
    startSelection(
      payload.preserveStyles,
      payload.exportFormat,
      payload.enhancedImageLoading,
      payload.imagePackaging,
      payload.pdfEngine
    );
    return {
      ok: true,
      version: CONTENT_API_VERSION,
      exportFormat
    };
  }

  const runtimeMessageListener = (message, sender, sendResponse) => {
    if (!message || !message.type) {
      if (typeof sendResponse === "function") {
        sendResponse({ ok: false, error: "Missing message type" });
      }
      return;
    }

    if (message.type === "START_SELECTION") {
      const response = startSelectionFromPopup(message);
      if (typeof sendResponse === "function") {
        sendResponse(response);
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
  };

  globalThis.__WEB_EXPORTER_CONTENT_API__ = {
    version: CONTENT_API_VERSION,
    startSelectionFromPopup,
    dispose() {
      stopSelection();
      if (api && api.runtime && api.runtime.onMessage && typeof api.runtime.onMessage.removeListener === "function") {
        api.runtime.onMessage.removeListener(runtimeMessageListener);
      }
    }
  };

  if (api && api.runtime && api.runtime.onMessage) {
    api.runtime.onMessage.addListener(runtimeMessageListener);
  }
})();
