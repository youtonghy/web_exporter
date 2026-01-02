(() => {
  const HIGHLIGHT_CLASS = "__web_exporter_highlight__";
  const OVERLAY_ID = "__web_exporter_overlay__";
  const STYLE_ID = "__web_exporter_style__";
  const PRINT_CONTAINER_ID = "__web_exporter_print_container__";
  const PRINT_STYLE_ID = "__web_exporter_print_style__";
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
  let lastHighlighted = null;
  let overlay = null;

  const api = typeof browser !== "undefined" ? browser : chrome;

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
    overlay.textContent = "点击选择元素，Esc 取消";
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

  function startSelection(keepStyles, format) {
    if (selecting) {
      return;
    }
    preserveStyles = Boolean(keepStyles);
    exportFormat = format === "markdown" ? "markdown" : "pdf";
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
    const target = event.target;
    if (!target || isOverlayTarget(target)) {
      return;
    }
    highlightElement(target);
  }

  function onClick(event) {
    if (!selecting) {
      return;
    }
    const target = event.target;
    if (!target || isOverlayTarget(target)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    stopSelection();
    if (exportFormat === "markdown") {
      exportElementToMarkdown(target);
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

  function convertInlineNode(node, context) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = normalizeWhitespace(node.nodeValue || "");
      return escapeMarkdownText(text);
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

    const tag = node.tagName.toLowerCase();
    if (isIgnorableTag(tag)) {
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
    if (BLOCK_TAGS.has(tag)) {
      return convertBlockChildren(node, context);
    }
    return convertInlineChildren(node, context).trim();
  }

  function elementToMarkdown(root) {
    const content = convertBlockChildren(root, { listDepth: 0 });
    return normalizeMarkdown(content);
  }

  function sanitizeFilename(name) {
    const trimmed = (name || "").trim();
    const base = trimmed || "exported-selection";
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

  function buildPrintPayload(target, keepStyles) {
    const clone = target.cloneNode(true);
    prepareClone(target, clone, {
      inlineStyles: keepStyles,
      stripStyles: !keepStyles,
      syncImages: true
    });

    const baseHref = document.baseURI || location.href;
    const bodyStyle = keepStyles
      ? "margin:0;padding:16px;background:#ffffff;"
      : "margin:0;padding:16px;font-family:Arial, sans-serif;background:#ffffff;";

    return { clone, baseHref, bodyStyle };
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
      @page { margin: 12mm; }
      body { ${bodyStyle} }
      * { box-sizing: border-box; }
    `;
    doc.head.appendChild(style);
    doc.title = "Exported Selection";

    const imported = doc.importNode(clone, true);
    doc.body.appendChild(imported);
  }

  function openPrintWindow(payload) {
    const printWindow = window.open("", "_blank", "noopener,noreferrer");
    if (!printWindow) {
      return false;
    }

    const doc = printWindow.document;
    populatePrintDocument(doc, payload);

    const triggerPrint = () => {
      try {
        printWindow.focus();
        printWindow.print();
      } catch (error) {
        // Ignore print errors caused by user settings.
      }
    };

    const waitForFontsInDocument = () => {
      if (doc.fonts && doc.fonts.ready) {
        return doc.fonts.ready;
      }
      return Promise.resolve();
    };

    const schedulePrint = () => {
      Promise.all([
        waitForFontsInDocument().catch(() => undefined),
        waitForImages(doc.body, 2000)
      ]).finally(() => {
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
    if (document.fonts && document.fonts.ready) {
      return document.fonts.ready;
    }
    return Promise.resolve();
  }

  function waitForImages(root, timeoutMs) {
    const images = Array.from(root.querySelectorAll("img"));
    if (!images.length) {
      return Promise.resolve();
    }

    const loaders = images.map((img) => {
      if (img.complete && img.naturalWidth > 0) {
        return Promise.resolve();
      }
      return new Promise((resolve) => {
        const done = () => resolve();
        img.addEventListener("load", done, { once: true });
        img.addEventListener("error", done, { once: true });
      });
    });

    return Promise.race([
      Promise.all(loaders),
      new Promise((resolve) => setTimeout(resolve, timeoutMs))
    ]);
  }

  function waitForPrintAssets(container) {
    return Promise.all([
      waitForFonts().catch(() => undefined),
      waitForImages(container, 2000)
    ]);
  }

  async function printInPage(target, keepStyles) {
    cleanupPrintArtifacts();

    const clone = target.cloneNode(true);
    prepareClone(target, clone, {
      inlineStyles: keepStyles,
      stripStyles: !keepStyles,
      syncImages: true
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
      @media print {
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
    await waitForPrintAssets(container);
    window.print();
  }

  async function exportElementToPdf(target) {
    try {
      await printInPage(target, preserveStyles);
    } catch (error) {
      const payload = buildPrintPayload(target, preserveStyles);
      const opened = openPrintWindow(payload);
      if (!opened) {
        alert("无法打开打印窗口，请检查浏览器弹窗设置。");
      }
    }
  }

  function exportElementToMarkdown(target) {
    const markdown = elementToMarkdown(target);
    const filename = `${sanitizeFilename(document.title)}.md`;
    downloadMarkdown(markdown, filename);
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
        startSelection(message.preserveStyles, message.exportFormat);
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
