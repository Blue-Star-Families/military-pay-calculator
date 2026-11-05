#!/usr/bin/env node
/*
 * Is the calculator's data still for the current year?
 *
 *   node check-year.js            exit 1 once the calendar year is past the data year
 *   node check-year.js --upcoming exit 1 from December, when next year's rates publish
 *
 * The data year is read from the page's own badge ("2026 Rates · Effective
 * Jan 1, 2026"), so there is nothing extra to keep in step. The checklist is
 * read from NOTES.md ("Updating for a new year"), so it is never a second copy.
 * Run by .github/workflows/yearly-update.yml, which opens an issue.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const m = html.match(/class="badge">(\d{4}) Rates · Effective Jan 1, (\d{4})</);
if (!m || m[1] !== m[2]) {
  console.error('Could not read a consistent data year from the badge in index.html.');
  process.exit(2);
}
const dataYear = Number(m[1]);

// TODAY=YYYY-MM-DD overrides the clock, for testing this script.
const today = process.env.TODAY ? new Date(process.env.TODAY + 'T12:00:00Z') : new Date();
const year = today.getUTCFullYear(), month = today.getUTCMonth() + 1;
const upcoming = process.argv.includes('--upcoming');

const stale = year > dataYear;
const due = stale || (upcoming && year === dataYear && month === 12);

const notes = fs.readFileSync(path.join(__dirname, 'NOTES.md'), 'utf8');
const start = notes.indexOf('## Updating for a new year');
const end = notes.indexOf('\n## ', start + 1);
const checklist = start < 0 ? '(section "Updating for a new year" not found in NOTES.md)'
                            : notes.slice(start, end < 0 ? undefined : end).trim();

console.log('Data year: ' + dataYear + '   Today: ' + today.toISOString().slice(0, 10));
if (!due) { console.log('Up to date. Nothing to do.'); process.exit(0); }

console.log(stale
  ? '\nSTALE: the page still shows ' + dataYear + ' rates in ' + year + '. Every figure below must be replaced.\n'
  : '\nDUE: ' + (dataYear + 1) + ' rates publish this month (DFAS pay table, BAH, BAS, IRS, states).\n');
console.log(checklist);
process.exit(1);
