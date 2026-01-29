(() => {
  const HIGHLIGHT_CLASS = "__web_exporter_highlight__";
  const SELECTED_CLASS = "__web_exporter_selected__";
  const OVERLAY_ID = "__web_exporter_overlay__";
  const STYLE_ID = "__web_exporter_style__";
  const PRINT_CONTAINER_ID = "__web_exporter_print_container__";
  const PRINT_STYLE_ID = "__web_exporter_print_style__";
  const IMAGE_LOAD_TIMEOUT_MS = 2000;
  const ENHANCED_IMAGE_LOAD_TIMEOUT_MS = 8000;
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
  let lastHighlighted = null;
  let selectedTargets = [];
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
      .${SELECTED_CLASS} {
        box-shadow: 0 0 0 2px #1f8fff inset, 0 0 0 2px #1f8fff;
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
    document.body.appendChild(overlay);
    updateOverlay();
  }

  function removeOverlay() {
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
    overlay = null;
  }

  function updateOverlay() {
    if (!overlay) {
      return;
    }
    const prompt = i18n.t("overlay.select_prompt");
    const count = selectedTargets.length;
    if (count > 0) {
      const selectedText = i18n.t("overlay.selected_count", { count });
      overlay.textContent = `${prompt} | ${selectedText}`;
      return;
    }
    overlay.textContent = prompt;
  }

  function clearHighlight() {
    if (lastHighlighted) {
      lastHighlighted.classList.remove(HIGHLIGHT_CLASS);
      lastHighlighted = null;
    }
  }

  function clearSelectedTargets() {
    selectedTargets.forEach((target) => {
      target.classList.remove(SELECTED_CLASS);
    });
    selectedTargets = [];
    updateOverlay();
  }

  function toggleSelectedTarget(target) {
    if (!target) {
      return;
    }
    const index = selectedTargets.indexOf(target);
    if (index === -1) {
      selectedTargets.push(target);
      target.classList.add(SELECTED_CLASS);
    } else {
      selectedTargets.splice(index, 1);
      target.classList.remove(SELECTED_CLASS);
    }
    updateOverlay();
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

  function startSelection(keepStyles, format, enhancedImages) {
    if (selecting) {
      return;
    }
    preserveStyles = Boolean(keepStyles);
    exportFormat = format === "markdown" ? "markdown" : format === "png" ? "png" : "pdf";
    enhancedImageLoading = Boolean(enhancedImages);
    selecting = true;
    selectedTargets = [];
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
    clearSelectedTargets();
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
    if (event.ctrlKey || event.metaKey) {
      toggleSelectedTarget(target);
      return;
    }

    stopSelection();
    exportTargets([target]);
  }

  function onKeyDown(event) {
    if (!selecting) {
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      stopSelection();
      return;
    }
    if (event.key === "Enter" && selectedTargets.length > 0) {
      event.preventDefault();
      event.stopPropagation();
      const targets = selectedTargets.slice();
      stopSelection();
      exportTargets(targets);
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

  function exportTargets(targets) {
    if (!targets || targets.length === 0) {
      return;
    }
    if (exportFormat === "markdown") {
      exportElementsToMarkdown(targets);
    } else if (exportFormat === "png") {
      exportElementsToPng(targets);
    } else {
      exportElementsToPdf(targets);
    }
  }

  function buildPngFilename(index, total) {
    const base = sanitizeFilename(document.title);
    if (total > 1) {
      return `${base}-${index + 1}.png`;
    }
    return `${base}.png`;
  }

  async function exportElementsToPng(targets) {
    for (let i = 0; i < targets.length; i += 1) {
      const filename = buildPngFilename(i, targets.length);
      await exportElementToPng(targets[i], filename);
    }
  }

  async function exportElementToPng(target, filename) {
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

    const resolvedFilename = filename || `${sanitizeFilename(document.title)}.png`;
    downloadBlob(blob, resolvedFilename);
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

  function createTargetsWrapper(targets, keepStyles, enhancedImages) {
    const wrapper = document.createElement("div");
    wrapper.style.display = "flex";
    wrapper.style.flexDirection = "column";
    wrapper.style.gap = "16px";
    wrapper.style.alignItems = "stretch";

    targets.forEach((target) => {
      const clone = target.cloneNode(true);
      prepareClone(target, clone, {
        inlineStyles: keepStyles,
        stripStyles: !keepStyles,
        syncImages: true,
        enhancedImages
      });
      wrapper.appendChild(clone);
    });

    return wrapper;
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
      ? "margin:0;padding:16px;background:#ffffff;"
      : "margin:0;padding:16px;font-family:Arial, sans-serif;background:#ffffff;";

    return { clone, baseHref, bodyStyle };
  }

  function buildPrintPayloadForTargets(targets, keepStyles, enhancedImages) {
    const clone = createTargetsWrapper(targets, keepStyles, enhancedImages);
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
    doc.title = i18n.t("print.window_title");

    const imported = doc.importNode(clone, true);
    doc.body.appendChild(imported);
  }

  function openPrintWindow(payload, enhancedImages) {
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
        waitForImages(doc.body, getImageLoadTimeout(enhancedImages), enhancedImages)
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

  function waitForPrintAssets(container, enhancedImages) {
    return Promise.all([
      waitForFonts().catch(() => undefined),
      waitForImages(container, getImageLoadTimeout(enhancedImages), enhancedImages)
    ]);
  }

  async function printTargetsInPage(targets, keepStyles, enhancedImages) {
    cleanupPrintArtifacts();

    const wrapper = createTargetsWrapper(targets, keepStyles, enhancedImages);

    const container = document.createElement("div");
    container.id = PRINT_CONTAINER_ID;
    container.style.position = "fixed";
    container.style.inset = "0";
    container.style.overflow = "auto";
    container.style.background = "#ffffff";
    container.style.padding = "16px";
    container.style.zIndex = "2147483647";
    container.appendChild(wrapper);

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
    await waitForPrintAssets(container, enhancedImages);
    window.print();
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
    await waitForPrintAssets(container, enhancedImages);
    window.print();
  }

  async function exportElementsToPdf(targets) {
    if (!targets || targets.length === 0) {
      return;
    }
    if (targets.length === 1) {
      await exportElementToPdf(targets[0]);
      return;
    }

    try {
      await printTargetsInPage(targets, preserveStyles, enhancedImageLoading);
    } catch (error) {
      const payload = buildPrintPayloadForTargets(targets, preserveStyles, enhancedImageLoading);
      const opened = openPrintWindow(payload, enhancedImageLoading);
      if (!opened) {
        alert(i18n.t("alert.print_blocked"));
      }
    }
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

  function exportElementsToMarkdown(targets) {
    if (!targets || targets.length === 0) {
      return;
    }
    if (targets.length === 1) {
      exportElementToMarkdown(targets[0]);
      return;
    }

    const sections = targets
      .map((target) => elementToMarkdown(target))
      .map((content) => content.trim())
      .filter(Boolean);
    const markdown = sections.join("\n\n---\n\n");
    const filename = `${sanitizeFilename(document.title)}.md`;
    downloadMarkdown(markdown, filename);
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
        startSelection(message.preserveStyles, message.exportFormat, message.enhancedImageLoading);
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
