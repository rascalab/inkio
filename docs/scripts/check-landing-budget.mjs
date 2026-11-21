import { readFileSync } from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const MAX_GZIP_BYTES = 300_000;
const pages = process.env.GITHUB_PAGES === 'true';
const output = pages ? '.next-pages' : '.next';
const html = readFileSync(path.join(output, pages ? 'index.html' : 'server/app/index.html'), 'utf8');
// Include the unique Next scripts and script preloads named by the initial HTML,
// not chunks loaded by the live-editor button or other user interactions.
const assets = new Set(Array.from(
  html.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)="[^" ]*?\/_next\/(static\/[^"?]+\.js)(?:\?[^" ]*)?"/g),
  ([, asset]) => decodeURIComponent(asset),
));
if (assets.size === 0) throw new Error('[landing budget] no initial Next JavaScript assets found');

let bytes = 0;
const assetRoot = pages ? path.join(output, '_next') : output;
for (const asset of assets) bytes += gzipSync(readFileSync(path.join(assetRoot, asset))).byteLength;
console.log(`[landing budget] ${bytes} / ${MAX_GZIP_BYTES} initial gzip bytes (${assets.size} scripts)`);
if (bytes > MAX_GZIP_BYTES) process.exitCode = 1;
