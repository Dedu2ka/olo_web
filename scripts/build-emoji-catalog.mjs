import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const raw = readFileSync(join(root, 'emoji-test.txt'), 'utf8');
let category = '';
const all = [];
for (const line of raw.split('\n')) {
  if (line.startsWith('# group: ')) { category = line.slice(9).trim(); continue; }
  if (!/;\s*fully-qualified\s*#/.test(line)) continue;
  const match = line.match(/#\s*(\S+)\s+E[\d.]+\s+(.+)$/);
  if (match) all.push({ value: match[1], name: match[2], category });
}
const stripTone = value => value.replace(/[\u{1F3FB}-\u{1F3FF}]/gu, '');
const onlyLightTone = value => {
  const tones = [...value.matchAll(/[\u{1F3FB}-\u{1F3FF}]/gu)].map(match => match[0]);
  return tones.length > 0 && tones.every(tone => tone === '🏻');
};
const variants = new Map(), visible = [], orphan = new Map();
for (const entry of all) {
  const base = stripTone(entry.value);
  if (base !== entry.value) {
    if (!variants.has(base)) variants.set(base, []);
    variants.get(base).push(entry.value);
    if (!orphan.has(base)) orphan.set(base, entry);
  } else visible.push(entry);
}
const bases = new Set(visible.map(entry => entry.value));
for (const [base, entry] of orphan) if (!bases.has(base)) visible.push(entry);
const result = visible.map(entry => {
  const light = (variants.get(stripTone(entry.value)) || []).find(onlyLightTone);
  return light ? { ...entry, value: light } : stripTone(entry.value) === entry.value ? entry : null;
}).filter(Boolean);
result.push({ value: '🧑🏻‍❤️‍🧑🏻', name: 'couple with heart: person, person, light skin tone', category: 'People & Body' });
result.push({ value: '🧑🏻‍❤️‍💋‍🧑🏻', name: 'kiss: person, person, light skin tone', category: 'People & Body' });
writeFileSync(join(root, 'emoji-catalog.json'), JSON.stringify(result));
