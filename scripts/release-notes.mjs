import { readFileSync, writeFileSync } from 'node:fs';

const tag = process.argv[2];
const destination = process.argv[3];
const { version } = JSON.parse(readFileSync('packages/meniscus/package.json', 'utf8'));
if (tag !== `v${version}`) throw new Error(`Tag ${tag ?? '(missing)'} must match package version v${version}`);
if (!destination) throw new Error('Provide a release-notes output path');

const lines = readFileSync('CHANGELOG.md', 'utf8').split(/\r?\n/);
const heading = `## [${version}]`;
const start = lines.findIndex((line) => line === heading || line.startsWith(`${heading} - `));
if (start < 0) throw new Error(`Missing ${heading} section in CHANGELOG.md`);
const next = lines.findIndex((line, index) => index > start && line.startsWith('## ['));
const notes = lines.slice(start + 1, next < 0 ? undefined : next).join('\n').trim();
if (!notes) throw new Error(`${heading} has no release notes`);
writeFileSync(destination, `${notes}\n`);
