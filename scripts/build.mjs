// Renders the profile SVGs from data/stats.json and the GitHub contribution calendar.
// Usage: GITHUB_TOKEN=... node scripts/build.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const LOGIN = 'sakisaki-dev';
const MONO = "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace";
const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif";
const W = 880;

const THEMES = {
  dark: {
    bg: '#0d1117', panel: '#161b22', border: '#30363d', text: '#e6edf3', soft: '#c9d1d9', muted: '#8b949e',
    up: '#3fb950', down: '#f85149', pillBg: 'rgba(63,185,80,0.12)', pillBorder: 'rgba(63,185,80,0.4)',
    levels: ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'],
  },
  light: {
    bg: '#ffffff', panel: '#f6f8fa', border: '#d0d7de', text: '#1f2328', soft: '#31363c', muted: '#59636e',
    up: '#1a7f37', down: '#cf222e', pillBg: 'rgba(26,127,55,0.08)', pillBorder: 'rgba(26,127,55,0.35)',
    levels: ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'],
  },
};

const LEVEL = { NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4 };

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#39;');
const num = (n) => n.toLocaleString('en-US');

async function contributions() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return JSON.parse(readFileSync('data/contributions.json', 'utf8'));
  const query = `{ user(login: "${LOGIN}") { contributionsCollection { contributionCalendar {
    totalContributions weeks { contributionDays { date contributionLevel } } } } } }`;
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`GitHub GraphQL ${res.status}`);
  const cal = (await res.json()).data.user.contributionsCollection.contributionCalendar;
  const days = cal.weeks.flatMap((w) => w.contributionDays).map((d) => ({ date: d.date, level: LEVEL[d.contributionLevel] }));
  const data = { total: cal.totalContributions, days };
  writeFileSync('data/contributions.json', JSON.stringify(data) + '\n');
  return data;
}

function header(t, stats) {
  const h = 176;
  const pill = 'Currently shipping';
  const pillW = 46 + pill.length * 7.4;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${h}" viewBox="0 0 ${W} ${h}" role="img" aria-label="${esc(stats.name)}: ${esc(stats.headline)}">
<rect x="0.5" y="0.5" width="${W - 1}" height="${h - 1}" rx="10" fill="${t.panel}" stroke="${t.border}"/>
<text x="28" y="56" font-family="${SANS}" font-size="30" font-weight="700" fill="${t.text}">${esc(stats.name)}</text>
<rect x="${W - 28 - pillW}" y="30" width="${pillW}" height="30" rx="15" fill="${t.pillBg}" stroke="${t.pillBorder}"/>
<circle cx="${W - 28 - pillW + 20}" cy="45" r="5" fill="${t.up}"/>
<text x="${W - 28 - pillW + 33}" y="50" font-family="${SANS}" font-size="13" font-weight="600" fill="${t.up}">${pill}</text>
<text x="28" y="96" font-family="${SANS}" font-size="15" fill="${t.soft}">${esc(stats.headline)}</text>
<text x="28" y="120" font-family="${SANS}" font-size="15" fill="${t.soft}">${esc(stats.subline)}</text>
<text x="28" y="152" font-family="${MONO}" font-size="12" fill="${t.muted}">${esc(stats.meta[0])}</text>
<text x="${W - 28}" y="152" text-anchor="end" font-family="${MONO}" font-size="12" fill="${t.muted}">${esc(stats.meta[1])}</text>
</svg>
`;
}

function ticker(t, stats) {
  const h = 64, top = 16;
  const items = stats.ticker;
  const cw = (size) => size * 0.6;
  let x = 0;
  const parts = items.map((it) => {
    const sym = x + 22;
    const val = sym + it.sym.length * cw(12) + 8;
    const chg = val + it.val.length * cw(14) + 8;
    const end = chg + it.chg.length * cw(12) + 22;
    const color = it.tone === 'up' ? t.up : it.tone === 'down' ? t.down : t.muted;
    const g = `<text x="${sym}" y="48" font-family="${MONO}" font-size="12" font-weight="700" fill="${t.muted}">${esc(it.sym)}</text>`
      + `<text x="${val}" y="48" font-family="${MONO}" font-size="14" fill="${t.text}">${esc(it.val)}</text>`
      + `<text x="${chg}" y="48" font-family="${MONO}" font-size="12" fill="${color}">${esc(it.chg)}</text>`
      + `<line x1="${end}" y1="28" x2="${end}" y2="60" stroke="${t.border}"/>`;
    x = end;
    return g;
  }).join('');
  const span = x;
  const secs = Math.round(span / 22);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${h + top}" viewBox="0 0 ${W} ${h + top}" role="img" aria-label="${esc(items.map((i) => `${i.sym} ${i.val} ${i.chg}`).join('; '))}">
<style>.tape{animation:tape ${secs}s linear infinite}@keyframes tape{from{transform:translateX(0)}to{transform:translateX(-${span}px)}}@media (prefers-reduced-motion: reduce){.tape{animation:none}}</style>
<g transform="translate(0 ${top})">
<text x="0" y="12" font-family="${MONO}" font-size="12" fill="${t.muted}">${esc(stats.tickerLabel)}</text>
<text x="${W}" y="12" text-anchor="end" font-family="${MONO}" font-size="12" fill="${t.muted}">${esc(stats.tickerNote)}</text>
<rect x="0" y="24" width="${W}" height="40" fill="${t.bg}"/>
<line x1="0" y1="24.5" x2="${W}" y2="24.5" stroke="${t.border}"/><line x1="0" y1="63.5" x2="${W}" y2="63.5" stroke="${t.border}"/>
<svg x="0" y="0" width="${W}" height="${h}"><g class="tape">${parts}<g transform="translate(${span} 0)">${parts}</g></g></svg>
</g>
</svg>
`;
}

function activity(t, cal) {
  const days = cal.days.slice(-90);
  const h = 104, pad = 18, gap = 3;
  const bw = (W - pad * 2 - gap * (days.length - 1)) / days.length;
  const bars = days.map((d, i) => `<rect x="${(pad + i * (bw + gap)).toFixed(2)}" y="44" width="${bw.toFixed(2)}" height="34" rx="2" fill="${t.levels[d.level]}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${h}" viewBox="0 0 ${W} ${h}" role="img" aria-label="Contribution activity, last 90 days; ${cal.total} contributions in the past year">
<rect x="0.5" y="0.5" width="${W - 1}" height="${h - 1}" rx="8" fill="${t.bg}" stroke="${t.border}"/>
<text x="${pad}" y="28" font-family="${SANS}" font-size="13" font-weight="600" fill="${t.text}">Contributions · last 90 days</text>
<text x="${W - pad}" y="28" text-anchor="end" font-family="${SANS}" font-size="13" fill="${t.muted}">${num(cal.total)} in the past year</text>
${bars}
<text x="${pad}" y="94" font-family="${SANS}" font-size="12" fill="${t.muted}">${esc(days[0].date)}</text>
<text x="${W - pad}" y="94" text-anchor="end" font-family="${SANS}" font-size="12" fill="${t.muted}">${esc(days[days.length - 1].date)}</text>
</svg>
`;
}

const TAGS = { infra: '#0969da', systems: '#9a6700', data: '#1a7f37', research: '#8250df', ai: '#bf3989', ml: '#bc4c00' };

const STACK = [
  ['Go', '#00add8'], ['Python', '#3572a5'], ['TypeScript', '#3178c6'], ['React', '#61dafb'],
  ['Temporal', '#7d8cf5'], ['Postgres', '#336791'], ['Protobuf', '#4285f4'], ['AWS', '#ff9900'],
  ['Terraform', '#7b42bc'], ['Datadog', '#632ca6'], ['R', '#198ce7'],
];

function stack(t) {
  const h = 34;
  let x = 0;
  const chips = STACK.map(([name, color]) => {
    const w = Math.round(name.length * 7.6 + 34);
    const s = `<rect x="${x + 0.5}" y="0.5" width="${w - 1}" height="${h - 1}" rx="${h / 2}" fill="${t.panel}" stroke="${t.border}"/>`
      + `<circle cx="${x + 15}" cy="${h / 2}" r="5" fill="${color}"/>`
      + `<text x="${x + 26}" y="${h / 2 + 4.5}" font-family="${MONO}" font-size="13" fill="${t.text}">${esc(name)}</text>`;
    x += w + 8;
    return s;
  });
  const width = x - 8;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${h}" viewBox="0 0 ${width} ${h}" role="img" aria-label="Stack: ${STACK.map(([n]) => n).join(', ')}">
${chips.join('\n')}
</svg>
`;
}

function card(t, p) {
  const cw = 432, h = 168, color = TAGS[p.tag];
  const tagW = Math.round(p.tag.length * 7.2 + 20);
  let x = 20;
  const chips = p.chips.map((c) => {
    const w = Math.round(c.length * 7 + 20);
    if (x + w > cw - 20) return '';
    const s = `<rect x="${x + 0.5}" y="128.5" width="${w - 1}" height="23" rx="11.5" fill="${t.bg}" stroke="${t.border}"/>`
      + `<text x="${x + w / 2}" y="144" text-anchor="middle" font-family="${MONO}" font-size="11" fill="${t.soft}">${esc(c)}</text>`;
    x += w + 6;
    return s;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${cw}" height="${h}" viewBox="0 0 ${cw} ${h}" role="img" aria-label="${esc(`${p.title}: ${p.lines.join(' ')} ${p.chips.join(', ')}`)}">
<rect x="0.5" y="0.5" width="${cw - 1}" height="${h - 1}" rx="10" fill="${t.panel}" stroke="${t.border}"/>
<rect x="20" y="20" width="${tagW}" height="20" rx="10" fill="${color}"/>
<text x="${20 + tagW / 2}" y="34" text-anchor="middle" font-family="${MONO}" font-size="11" font-weight="700" fill="#ffffff">${esc(p.tag)}</text>
<text x="${cw - 20}" y="35" text-anchor="end" font-family="${SANS}" font-size="15" fill="${t.muted}">↗</text>
<text x="20" y="70" font-family="${SANS}" font-size="17" font-weight="700" fill="${t.text}">${esc(p.title)}</text>
<text x="20" y="94" font-family="${SANS}" font-size="13" fill="${t.soft}">${esc(p.lines[0])}</text>
<text x="20" y="112" font-family="${SANS}" font-size="13" fill="${t.soft}">${esc(p.lines[1])}</text>
${chips}
</svg>
`;
}

const stats = JSON.parse(readFileSync('data/stats.json', 'utf8'));
const projects = JSON.parse(readFileSync('data/projects.json', 'utf8'));
const cal = await contributions();
const contribution = stats.ticker.find((i) => i.sym === 'CONTRIBUTIONS');
if (contribution) contribution.val = num(cal.total);

mkdirSync('assets', { recursive: true });
for (const [name, t] of Object.entries(THEMES)) {
  writeFileSync(`assets/header-${name}.svg`, header(t, stats));
  writeFileSync(`assets/ticker-${name}.svg`, ticker(t, stats));
  writeFileSync(`assets/activity-${name}.svg`, activity(t, cal));
  writeFileSync(`assets/stack-${name}.svg`, stack(t));
  for (const p of projects) writeFileSync(`assets/card-${p.id}-${name}.svg`, card(t, p));
}
console.log(`built assets: ${cal.total} contributions, ${stats.ticker.length} ticker items`);
