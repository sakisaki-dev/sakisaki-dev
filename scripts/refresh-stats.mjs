// Recomputes the work stats in data/stats.json from a local clone. Prints counts only, never code or commit text.
// Usage: node scripts/refresh-stats.mjs <path-to-repo> <author-pattern> [branch]
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const [repo, author, branch = 'origin/master'] = process.argv.slice(2);
if (!repo || !author) {
  console.error('usage: node scripts/refresh-stats.mjs <path-to-repo> <author-pattern> [branch]');
  process.exit(1);
}

const git = (...args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', maxBuffer: 1 << 28 });
const base = ['log', branch, `--author=${author}`, '-i'];

const dates = git(...base, '--format=%aI').trim().split('\n').filter(Boolean).map((d) => new Date(d));
const monthAgo = Date.now() - 30 * 24 * 3600 * 1000;

let added = 0, deleted = 0;
for (const line of git(...base, '--shortstat', '--format=').split('\n')) {
  const a = line.match(/(\d+) insertion/); const r = line.match(/(\d+) deletion/);
  if (a) added += Number(a[1]);
  if (r) deleted += Number(r[1]);
}

let goLines = 0, allLines = 0;
for (const line of git(...base, '--numstat', '--format=').split('\n')) {
  const [add, , path] = line.split('\t');
  if (!path || add === '-') continue;
  allLines += Number(add);
  if (path.endsWith('.go')) goLines += Number(add);
}

const commits = git(...base, '--format=%H').trim().split('\n').filter(Boolean);
const withTests = commits.filter((c) => /(_test\.go|\.test\.tsx?)$/m.test(git('show', '--format=', '--name-only', c))).length;

let testLines = 0, codeLines = 0;
const goDirs = new Set();
for (const line of git(...base, '--numstat', '--format=').split('\n')) {
  const [add, , path] = line.split('\t');
  if (!path || add === '-' || !path.endsWith('.go') || path.endsWith('.pb.go')) continue;
  if (path.endsWith('_test.go')) testLines += Number(add);
  else codeLines += Number(add);
  goDirs.add(path.slice(0, path.lastIndexOf('/')));
}

const sizes = git(...base, '--shortstat', '--format=').split('\n').filter((l) => l.includes('changed')).map((l) => {
  const a = l.match(/(\d+) insertion/); const r = l.match(/(\d+) deletion/);
  return (a ? Number(a[1]) : 0) + (r ? Number(r[1]) : 0);
}).sort((x, y) => x - y);
const medianSize = sizes[Math.floor((sizes.length - 1) / 2)];

const reverts = git(...base, '--format=%s').split('\n').filter((s) => /^revert/i.test(s)).length;
const schemaChanges = git(...base, '--format=%H', '--', '*.proto').trim().split('\n').filter(Boolean).length;

const num = (n) => n.toLocaleString('en-US');
const stats = JSON.parse(readFileSync('data/stats.json', 'utf8'));
const set = (sym, val, chg) => {
  const it = stats.ticker.find((i) => i.sym === sym);
  if (it) { it.val = val; if (chg !== undefined) it.chg = chg; }
};
set('PRS MERGED', num(dates.length), `▲ ${dates.filter((d) => d >= monthAgo).length} this month`);
set('LINES DELETED', `−${num(deleted)}`);
set('GO SHARE', `${Math.round((100 * goLines) / allLines)}%`);
set('PRS WITH TESTS', `${Math.round((100 * withTests) / commits.length)}%`);
set('TEST:CODE', (testLines / codeLines).toFixed(2), testLines > codeLines ? 'more tests than code' : 'Go lines');
set('REVERTS', num(reverts), reverts === 0 ? 'clean' : 'rolled back');
set('MEDIAN PR', `${num(medianSize)} lines`);
set('GO PACKAGES', num(goDirs.size), 'touched');
set('SCHEMA CHANGES', num(schemaChanges), 'protobuf');
stats.tickerLabel = `SAKI · as of ${new Date().toISOString().slice(0, 10)}`;
writeFileSync('data/stats.json', JSON.stringify(stats, null, 2) + '\n');
console.log(`refreshed: ${dates.length} merged, test:code ${(testLines / codeLines).toFixed(2)}, ${reverts} reverts`);
