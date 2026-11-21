import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const contentPath = 'docs/content/';
const outputDir = path.join(repoRoot, contentPath, 'versions');
const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-[\w.-]+)?(?:\+[\w.-]+)?$/;
const stableTagPattern = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const current = versionPattern.exec(version);
if (!current) throw new Error(`Invalid docs package version: ${version}`);

const markdownPattern = /\.mdx?$/;
const metaPattern = /(?:^|\/)_meta\.[jt]sx?$/;

function git(...args) {
  return execFileSync('git', args, { cwd: repoRoot });
}

function isEligibleTag(tag) {
  const release = stableTagPattern.exec(tag);
  if (!release) return false;
  for (let i = 1; i <= 3; i++) {
    if (release[i] !== current[i]) return BigInt(release[i]) < BigInt(current[i]);
  }
  return !current[4]; // A stable release sorts after its own prereleases.
}

function listDocs(tag) {
  const entries = git('ls-tree', '-rz', '--full-tree', `refs/tags/${tag}`, '--', contentPath);
  return entries.toString('utf8').split('\0').flatMap((entry) => {
    const tab = entry.indexOf('\t');
    if (tab < 0) return [];
    const [mode, type, oid] = entry.slice(0, tab).split(' ');
    const file = entry.slice(tab + 1 + contentPath.length);
    // Symlinks are also blobs: only extract regular files, never follow links.
    if (type !== 'blob' || (mode !== '100644' && mode !== '100755')) return [];
    if (path.posix.basename(file) === 'playground.mdx') return [];
    if (!markdownPattern.test(file) && !metaPattern.test(file)) return [];
    return [{ file, oid }];
  });
}

// Historical _meta files use a default-exported object literal. Parse the
// source without importing it; leave nested entries and other metadata intact.
function stripNavEntries(file, text) {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest);
  const assignment = source.statements.find(ts.isExportAssignment);
  if (!assignment || !ts.isObjectLiteralExpression(assignment.expression)) return text;
  const { properties } = assignment.expression;
  for (let i = properties.length - 1; i >= 0; i--) {
    const property = properties[i];
    if (!ts.isPropertyAssignment(property)) continue;
    const { name } = property;
    if (!ts.isIdentifier(name) && !ts.isStringLiteral(name)) continue;
    if (name.text !== 'playground' && name.text !== 'docs-link') continue;
    const end = property.getEnd();
    text = text.slice(0, property.getFullStart()) + text.slice(end).replace(/^\s*,/, '');
  }
  return text;
}

rmSync(outputDir, { recursive: true, force: true });
const archived = [];
for (const tag of git('tag', '--list', 'v*', '--sort=-version:refname').toString('utf8').split('\n')) {
  if (!isEligibleTag(tag)) continue;
  const files = listDocs(tag);
  if (!files.some(({ file }) => markdownPattern.test(file))) continue;
  const releaseDir = path.join(outputDir, tag);
  for (const { file, oid } of files) {
    const destination = path.join(releaseDir, file);
    const blob = git('cat-file', 'blob', oid);
    mkdirSync(path.dirname(destination), { recursive: true });
    writeFileSync(destination, metaPattern.test(file) ? stripNavEntries(file, blob.toString('utf8')) : blob);
  }
  if (!files.some(({ file }) => /^index\.mdx?$/.test(file))) {
    const gettingStarted = files.some(({ file }) => /^getting-started\.mdx?$/.test(file))
      ? '\n[시작하기](/getting-started)\n'
      : '';
    writeFileSync(path.join(releaseDir, 'index.mdx'), `# Inkio ${tag}\n\nInkio ${tag} 릴리스의 문서입니다.\n${gettingStarted}`);
  }
  archived.push(tag);
}

console.log(archived.length
  ? `[docs archive] Generated ${archived.join(', ')}`
  : '[docs archive] No eligible release docs in local Git tags. If tags are missing, run git fetch --tags.');
