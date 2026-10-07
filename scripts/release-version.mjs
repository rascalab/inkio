// Unified versioning: the root, every publishable package and docs share one
// version (see CHANGELOG.md).
//   set <version>          bump all manifests in lockstep
//   check <version|tag>    fail if any manifest differs; the publish workflow
//                          runs this against the pushed tag, because a tag
//                          whose packages were never bumped would "succeed"
//                          while publishing nothing.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const MANIFESTS = [
  'package.json',
  'packages/core/package.json',
  'packages/advanced/package.json',
  'packages/simple/package.json',
  'packages/editor/package.json',
  'packages/image-editor/package.json',
  'packages/collab/package.json',
  'docs/package.json',
];

const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
// The top-level "version" is the first one in every manifest above.
const VERSION_FIELD = /^(\s*"version"\s*:\s*")([^"]*)(")/m;

function fail(message) {
  console.error(`[release-version] ${message}`);
  process.exit(1);
}

function parseVersion(input) {
  const version = (input ?? '').replace(/^v/, '');
  if (!SEMVER.test(version)) {
    fail(`expected a version like 1.2.3 or v1.2.3, got "${input ?? ''}"`);
  }
  return version;
}

function readManifest(relPath) {
  const file = path.join(repoRoot, relPath);
  const text = readFileSync(file, 'utf8');
  return { file, text, version: JSON.parse(text).version };
}

function setVersion(version) {
  for (const relPath of MANIFESTS) {
    const { file, text, version: current } = readManifest(relPath);
    const next = text.replace(VERSION_FIELD, `$1${version}$3`);
    if (JSON.parse(next).version !== version) {
      fail(`${relPath}: could not rewrite the top-level "version" field`);
    }
    writeFileSync(file, next);
    console.log(`${relPath}: ${current} -> ${version}`);
  }
  console.log(`\nNext: add a "## [${version}]" entry to CHANGELOG.md, commit, push main, then`);
  console.log(`  git tag v${version} && git push origin v${version}`);
}

function checkVersion(version) {
  const mismatches = MANIFESTS.map((relPath) => ({ relPath, actual: readManifest(relPath).version }))
    .filter(({ actual }) => actual !== version);
  if (mismatches.length > 0) {
    for (const { relPath, actual } of mismatches) {
      console.error(`${relPath}: ${actual} (expected ${version})`);
    }
    fail(`${mismatches.length} manifest(s) are not at ${version}; run \`pnpm release:version ${version}\``);
  }
  console.log(`[release-version] all ${MANIFESTS.length} manifests are at ${version}`);
}

const [command, input] = process.argv.slice(2);
if (command === 'set') {
  setVersion(parseVersion(input));
} else if (command === 'check') {
  checkVersion(parseVersion(input));
} else {
  fail('usage: release-version.mjs <set|check> <version>');
}
