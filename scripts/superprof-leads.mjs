#!/usr/bin/env node
/**
 * Export publicly displayed Superprof search results to CSV.
 *
 * This is deliberately limited to directory information visible in search
 * results (name, subject, location, listed price, and profile URL). It does
 * not log in, contact tutors, solve CAPTCHAs, or collect phone/email details.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const usage = `Usage: node scripts/superprof-leads.mjs --url <search-results-url> [options]

Options:
  --out <file>       CSV destination (default: ./exports/superprof-leads.csv)
  --pages <number>   Maximum result pages to visit (default: 1; max: 10)
  --delay <ms>       Pause between pages (default: 2500; minimum: 1500)
  --headed           Show the browser for troubleshooting
  --help             Show this help
`;

function parseArgs(argv) {
  const options = { out: 'exports/superprof-leads.csv', pages: 1, delay: 2500, headed: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help') return { help: true };
    if (arg === '--headed') { options.headed = true; continue; }
    if (!['--url', '--out', '--pages', '--delay'].includes(arg)) throw new Error(`Unknown option: ${arg}`);
    const value = argv[++index];
    if (!value) throw new Error(`Missing value for ${arg}`);
    options[arg.slice(2)] = value;
  }
  if (!options.url) throw new Error('--url is required');
  options.pages = Math.min(10, Math.max(1, Number.parseInt(options.pages, 10) || 1));
  options.delay = Math.max(1500, Number.parseInt(options.delay, 10) || 2500);
  return options;
}

function csv(value) {
  return `"${String(value ?? '').replaceAll('"', '""').replaceAll(/\s+/g, ' ').trim()}"`;
}

function isDisallowed(robots) {
  const lines = robots.split(/\r?\n/).map((line) => line.replace(/#.*/, '').trim());
  let applies = false;
  for (const line of lines) {
    const [rawKey, ...rest] = line.split(':');
    const key = rawKey?.toLowerCase();
    const value = rest.join(':').trim();
    if (key === 'user-agent') applies = value === '*';
    if (applies && key === 'disallow' && value === '/') return true;
  }
  return false;
}

async function checkRobots(context, url) {
  const origin = new URL(url).origin;
  const response = await context.request.get(`${origin}/robots.txt`);
  if (response.ok() && isDisallowed(await response.text())) {
    throw new Error('robots.txt disallows crawling for generic user agents. Stopping.');
  }
}

async function extractListings(page) {
  return page.locator('article, [data-testid*="teacher" i], [data-testid*="profile" i], .teacher-card, .profile-card')
    .evaluateAll((cards) => cards.map((card) => {
      const text = (card.innerText || '').replace(/\s+/g, ' ').trim();
      const link = [...card.querySelectorAll('a[href]')]
        .map((a) => a.href)
        .find((href) => /\/lessons?\b|\/profile\b|\/tutor\b/i.test(href));
      const heading = card.querySelector('h1, h2, h3, h4, [class*="name" i]')?.textContent?.trim() || '';
      const price = text.match(/(?:₦|\$|€|£)\s?[\d,.]+(?:\s*\/\s*(?:hr|hour))?/i)?.[0] || '';
      return { name: heading, price, profile_url: link || '', raw_summary: text.slice(0, 500) };
    }).filter((row) => row.profile_url));
}

function nextPageUrl(current, pageNumber) {
  const url = new URL(current);
  url.searchParams.set('page', String(pageNumber));
  return url.href;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) return console.log(usage);
  const startUrl = new URL(options.url);
  if (!/superprof\./i.test(startUrl.hostname)) throw new Error('For safety, --url must be a Superprof search-results URL.');

  const browser = await chromium.launch({ headless: !options.headed });
  const context = await browser.newContext({
    userAgent: 'KanviseDirectoryResearch/1.0 (public-directory export; contact your site administrator)',
  });
  try {
    await checkRobots(context, startUrl.href);
    const page = await context.newPage();
    const seen = new Map();
    for (let number = 1; number <= options.pages; number += 1) {
      const url = number === 1 ? startUrl.href : nextPageUrl(startUrl.href, number);
      console.log(`Visiting result page ${number}/${options.pages}: ${url}`);
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      if (!response?.ok()) throw new Error(`Search page returned HTTP ${response?.status() ?? 'unknown'}`);
      await page.waitForTimeout(750);
      if (/captcha|verify you are human|unusual traffic/i.test(await page.locator('body').innerText())) {
        throw new Error('Bot challenge detected. This script will not bypass it; use an authorised data source instead.');
      }
      const rows = await extractListings(page);
      rows.forEach((row) => seen.set(row.profile_url, { ...row, source_page: url }));
      if (number < options.pages) await page.waitForTimeout(options.delay);
    }
    const output = resolve(options.out);
    await mkdir(dirname(output), { recursive: true });
    const header = ['name', 'price', 'profile_url', 'source_page', 'raw_summary'];
    const body = [...seen.values()].map((row) => header.map((key) => csv(row[key])).join(','));
    await writeFile(output, `${header.join(',')}\n${body.join('\n')}\n`, 'utf8');
    console.log(`Wrote ${body.length} public listings to ${output}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => { console.error(`Error: ${error.message}`); process.exitCode = 1; });
