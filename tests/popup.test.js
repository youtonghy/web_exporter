"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("popup exposes debug package as a standalone export format", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "popup.html"), "utf8");
  const script = fs.readFileSync(path.join(__dirname, "..", "popup.js"), "utf8");

  assert.match(html, /<option value="debug"[^>]+data-i18n="option\.debug_package"/);
  assert.doesNotMatch(html, /id="debugMode"/);
  assert.doesNotMatch(script, /debugMode/);
  assert.match(script, /const isDebug = formatSelect\.value === "debug";/);
  assert.match(script, /const isPdf = !isMarkdown && !isPng && !isDebug;/);
});

test("popup defaults export format to markdown", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "popup.html"), "utf8");
  const selectMatch = html.match(/<select id="exportFormat">([\s\S]*?)<\/select>/);

  assert.ok(selectMatch);
  assert.match(selectMatch[1].trim(), /^<option value="markdown" selected data-i18n="option\.markdown">/);
  assert.doesNotMatch(selectMatch[1], /<option value="pdf" selected/);
});

test("popup starts selection through the content API instead of the legacy listener", () => {
  const script = fs.readFileSync(path.join(__dirname, "..", "popup.js"), "utf8");

  assert.match(script, /__WEB_EXPORTER_CONTENT_API__/);
  assert.match(script, /startSelectionInTab\(tab\.id, payload\)/);
  assert.doesNotMatch(script, /await sendMessage\(tab\.id, payload\)/);
});

test("popup prefers high fidelity PDF engines per browser", () => {
  const script = fs.readFileSync(path.join(__dirname, "..", "popup.js"), "utf8");

  assert.match(script, /pdfEngineSelect\.value === "native"[\s\S]*pdfEngineSelect\.value = "cdp";/);
  assert.match(script, /pdfEngineSelect\.value === "native"[\s\S]*pdfEngineSelect\.value = "html2canvas";/);
});
