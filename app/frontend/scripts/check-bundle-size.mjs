#!/usr/bin/env node
// Fail the build if any emitted asset exceeds the per-chunk gzip budget.
// Mirrors Vite's `build.chunkSizeWarningLimit` (500 KB) but enforces it
// instead of only warning. Used by the CI budget gate (Fase 4.3).

import { readdirSync, readFileSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join, resolve } from "node:path";

const ASSETS_DIR = resolve(process.cwd(), "dist/assets");
const THRESHOLD_BYTES = 500 * 1024; // 500 KB gzip

const formatKb = (bytes) => `${(bytes / 1024).toFixed(2)} kB`;

function main() {
  if (!statSync(ASSETS_DIR, { optional: true })?.isDirectory()) {
    console.error(`[check-bundle-size] assets dir not found: ${ASSETS_DIR}`);
    console.error("[check-bundle-size] run `npm run build` before this check.");
    process.exit(1);
  }

  const files = readdirSync(ASSETS_DIR).filter(
    (f) => f.endsWith(".js") || f.endsWith(".css"),
  );

  let failed = false;
  const rows = [];

  for (const file of files) {
    const buf = readFileSync(join(ASSETS_DIR, file));
    const gzipSize = gzipSync(buf).byteLength;
    const over = gzipSize > THRESHOLD_BYTES;
    if (over) failed = true;
    rows.push({ file, gzipSize, over });
  }

  rows.sort((a, b) => b.gzipSize - a.gzipSize);

  console.log(`\n[check-bundle-size] per-chunk gzip budget: ${formatKb(THRESHOLD_BYTES)}\n`);
  for (const { file, gzipSize, over } of rows) {
    console.log(`  ${over ? "FAIL" : " ok "}  ${formatKb(gzipSize).padStart(10)}  ${file}`);
  }

  const worst = rows[0];
  if (!worst) {
    console.error("[check-bundle-size] no assets emitted.");
    process.exit(1);
  }

  if (failed) {
    console.error(
      `\n[check-bundle-size] FAILED: at least one chunk exceeds ${formatKb(THRESHOLD_BYTES)} gzip.`,
    );
    process.exit(1);
  }

  console.log(
    `\n[check-bundle-size] PASSED: largest chunk ${worst.file} at ${formatKb(worst.gzipSize)} gzip.\n`,
  );
  process.exit(0);
}

main();
