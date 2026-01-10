#!/usr/bin/env node
"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const buildRoot = path.join(repoRoot, "build");
const copyItems = [
  "content.js",
  "popup.html",
  "popup.js",
  "popup.css",
  "background.js",
  "icons",
  "src"
];
const manifestTemplates = {
  chrome: "manifests/manifest.chrome.v3.json",
  firefox: "manifests/manifest.firefox.v2.json"
};

function printUsage() {
  console.log("Usage: node scripts/build.js --target chrome|firefox|all");
}

function parseTarget(argv) {
  let target = "all";
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--target" || arg === "-t") {
      target = argv[i + 1] || "";
      i += 1;
      continue;
    }
    if (arg.startsWith("--target=")) {
      target = arg.slice("--target=".length);
    }
  }
  return target || "all";
}

async function copyRecursive(src, dest) {
  const stat = await fs.stat(src);
  if (stat.isDirectory()) {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });
    for (const entry of entries) {
      const entrySrc = path.join(src, entry.name);
      const entryDest = path.join(dest, entry.name);
      await copyRecursive(entrySrc, entryDest);
    }
    return;
  }

  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.copyFile(src, dest);
}

async function resetBuildRoot() {
  await fs.rm(buildRoot, { recursive: true, force: true });
  await fs.mkdir(buildRoot, { recursive: true });
}

async function copyExtensionFiles(outDir) {
  for (const item of copyItems) {
    const srcPath = path.join(repoRoot, item);
    const destPath = path.join(outDir, item);
    await copyRecursive(srcPath, destPath);
  }
}

async function buildTarget(name) {
  const outDir = path.join(buildRoot, name);
  await fs.mkdir(outDir, { recursive: true });
  await copyExtensionFiles(outDir);

  const manifestPath = path.join(repoRoot, manifestTemplates[name]);
  await fs.copyFile(manifestPath, path.join(outDir, "manifest.json"));
  console.log(`Built: ${outDir}`);
}

async function main() {
  const target = parseTarget(process.argv.slice(2));
  const validTargets = new Set(["chrome", "firefox", "all"]);

  if (!validTargets.has(target)) {
    console.error(`Unknown target: ${target}`);
    printUsage();
    process.exit(1);
  }

  await resetBuildRoot();

  if (target === "chrome" || target === "all") {
    await buildTarget("chrome");
  }
  if (target === "firefox" || target === "all") {
    await buildTarget("firefox");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
