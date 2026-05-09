#!/usr/bin/env node
"use strict";

const childProcess = require("node:child_process");
const fs = require("node:fs/promises");
const path = require("node:path");
const zlib = require("node:zlib");

const repoRoot = path.resolve(__dirname, "..");
const buildRoot = path.join(repoRoot, "build");
const releaseRoot = path.join(repoRoot, "dist", "release");
const targets = ["chrome", "firefox"];

function printUsage() {
  console.log("Usage: node scripts/package-release.js --tag v1.2.3");
}

function parseArgs(argv) {
  let tag = "";
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--tag" || arg === "-t") {
      tag = argv[i + 1] || "";
      i += 1;
      continue;
    }
    if (arg.startsWith("--tag=")) {
      tag = arg.slice("--tag=".length);
    }
  }
  return { tag };
}

function normalizeTag(tag) {
  const trimmed = String(tag || "").trim();
  const match = /^v?(\d+(?:\.\d+){2,3})$/.exec(trimmed);
  if (!match) {
    throw new Error("Release tag must look like v1.2.3, 1.2.3, v1.2.3.4, or 1.2.3.4");
  }

  const parts = match[1].split(".");
  for (const part of parts) {
    if (part.length > 1 && part.startsWith("0")) {
      throw new Error(`Version segment must not contain leading zeroes: ${part}`);
    }
    const value = Number(part);
    if (!Number.isInteger(value) || value < 0 || value > 65535) {
      throw new Error(`Version segment is outside the supported range 0-65535: ${part}`);
    }
  }

  const version = parts.join(".");
  return {
    releaseTag: trimmed.startsWith("v") ? `v${version}` : version,
    version,
    versionName: trimmed.startsWith("v") ? `v${version}` : version
  };
}

function run(command, args) {
  childProcess.execFileSync(command, args, {
    cwd: repoRoot,
    stdio: "inherit"
  });
}

async function patchManifest(target, versionInfo) {
  const manifestPath = path.join(buildRoot, target, "manifest.json");
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  manifest.version = versionInfo.version;
  manifest.version_name = versionInfo.versionName;
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

function makeCrcTable() {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let value = i;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
    }
    table[i] = value >>> 0;
  }
  return table;
}

const crcTable = makeCrcTable();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeUInt16LE(value) {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16LE(value);
  return buffer;
}

function writeUInt32LE(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value >>> 0);
  return buffer;
}

async function listFiles(root, current = "") {
  const dir = path.join(root, current);
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relativePath = current ? path.join(current, entry.name) : entry.name;
    const fullPath = path.join(root, relativePath);
    if (entry.isDirectory()) {
      files.push(...await listFiles(root, relativePath));
      continue;
    }
    if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

async function createZipFromDirectory(sourceDir, zipPath) {
  const sourceRoot = path.resolve(sourceDir);
  const files = (await listFiles(sourceRoot))
    .map((file) => path.resolve(file))
    .sort((a, b) => a.localeCompare(b));

  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const file of files) {
    const relativeName = path.relative(sourceRoot, file).split(path.sep).join("/");
    const nameBuffer = Buffer.from(relativeName, "utf8");
    const data = await fs.readFile(file);
    const compressed = zlib.deflateRawSync(data, { level: 9 });
    const checksum = crc32(data);

    const localHeader = Buffer.concat([
      writeUInt32LE(0x04034b50),
      writeUInt16LE(20),
      writeUInt16LE(0x0800),
      writeUInt16LE(8),
      writeUInt16LE(0),
      writeUInt16LE(0),
      writeUInt32LE(checksum),
      writeUInt32LE(compressed.length),
      writeUInt32LE(data.length),
      writeUInt16LE(nameBuffer.length),
      writeUInt16LE(0),
      nameBuffer
    ]);

    localParts.push(localHeader, compressed);

    const centralHeader = Buffer.concat([
      writeUInt32LE(0x02014b50),
      writeUInt16LE(20),
      writeUInt16LE(20),
      writeUInt16LE(0x0800),
      writeUInt16LE(8),
      writeUInt16LE(0),
      writeUInt16LE(0),
      writeUInt32LE(checksum),
      writeUInt32LE(compressed.length),
      writeUInt32LE(data.length),
      writeUInt16LE(nameBuffer.length),
      writeUInt16LE(0),
      writeUInt16LE(0),
      writeUInt16LE(0),
      writeUInt16LE(0),
      writeUInt32LE(0),
      writeUInt32LE(offset),
      nameBuffer
    ]);

    centralParts.push(centralHeader);
    offset += localHeader.length + compressed.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const endRecord = Buffer.concat([
    writeUInt32LE(0x06054b50),
    writeUInt16LE(0),
    writeUInt16LE(0),
    writeUInt16LE(files.length),
    writeUInt16LE(files.length),
    writeUInt32LE(centralDirectory.length),
    writeUInt32LE(offset),
    writeUInt16LE(0)
  ]);

  await fs.mkdir(path.dirname(zipPath), { recursive: true });
  await fs.writeFile(zipPath, Buffer.concat([...localParts, centralDirectory, endRecord]));
}

async function packageRelease(versionInfo) {
  await fs.rm(releaseRoot, { recursive: true, force: true });
  await fs.mkdir(releaseRoot, { recursive: true });

  run(process.execPath, [path.join("scripts", "build.js"), "--target", "all"]);

  for (const target of targets) {
    await patchManifest(target, versionInfo);
  }

  const chromeZip = path.join(releaseRoot, `web-exporter-chrome-${versionInfo.releaseTag}.zip`);
  const firefoxZip = path.join(releaseRoot, `web-exporter-firefox-${versionInfo.releaseTag}.zip`);
  const firefoxXpi = path.join(releaseRoot, `web-exporter-firefox-${versionInfo.releaseTag}.xpi`);

  await createZipFromDirectory(path.join(buildRoot, "chrome"), chromeZip);
  await createZipFromDirectory(path.join(buildRoot, "firefox"), firefoxZip);
  await fs.copyFile(firefoxZip, firefoxXpi);

  await fs.writeFile(
    path.join(releaseRoot, "release-metadata.json"),
    `${JSON.stringify(versionInfo, null, 2)}\n`
  );

  console.log(`Packaged release assets in: ${releaseRoot}`);
}

async function main() {
  const { tag } = parseArgs(process.argv.slice(2));
  if (!tag) {
    printUsage();
    process.exit(1);
  }

  await packageRelease(normalizeTag(tag));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
