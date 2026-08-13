import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const VITE_CLI = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url));
const PORT = 4173;
const URL = `http://127.0.0.1:${PORT}`;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function chromeExecutable() {
  const candidates = [
    process.env.CHROME_BIN,
    process.env.GOOGLE_CHROME_BIN,
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser'
  ].filter(Boolean);
  return candidates.find(path => existsSync(path)) || null;
}

async function waitForServer(url, timeoutMs = 30000) {
  const started = Date.now();
  let lastError = null;
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url, { redirect: 'manual' });
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error(`Vite preview did not become ready: ${lastError?.message || 'timeout'}`);
}

const server = spawn(process.execPath, [VITE_CLI, 'preview', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'], {
  cwd: ROOT,
  stdio: ['ignore', 'pipe', 'pipe']
});

let serverOutput = '';
server.stdout.on('data', chunk => { serverOutput += chunk.toString(); });
server.stderr.on('data', chunk => { serverOutput += chunk.toString(); });

let browser;
try {
  await waitForServer(URL);
  const executablePath = chromeExecutable();
  assert(executablePath, 'No system Chrome/Chromium executable found for observer browser smoke test.');

  browser = await chromium.launch({
    executablePath,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
      '--use-gl=swiftshader'
    ]
  });

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const runtimeErrors = [];
  page.on('pageerror', error => runtimeErrors.push(`pageerror: ${error.message}`));
  page.on('console', message => {
    if (message.type() === 'error') runtimeErrors.push(`console: ${message.text()}`);
  });

  await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForSelector('#world3d canvas', { timeout: 30000 });
  await page.waitForFunction(() => document.querySelector('#month')?.textContent?.includes('0개월'), null, { timeout: 30000 });

  const initial = await page.evaluate(() => {
    const canvas = document.querySelector('#world3d canvas');
    const labels = document.querySelectorAll('.world-country-label');
    const countryButtons = document.querySelectorAll('[data-country]');
    const rect = canvas?.getBoundingClientRect();
    return {
      canvasExists: Boolean(canvas),
      canvasWidth: rect?.width || 0,
      canvasHeight: rect?.height || 0,
      labelCount: labels.length,
      countryButtonCount: countryButtons.length,
      month: document.querySelector('#month')?.textContent,
      selectedCode: document.querySelector('#selectedCode')?.textContent,
      engineState: document.querySelector('#engineState')?.textContent
    };
  });

  assert(initial.canvasExists, '3D canvas was not created.');
  assert(initial.canvasWidth >= 300 && initial.canvasHeight >= 300, `3D canvas is too small: ${initial.canvasWidth}x${initial.canvasHeight}`);
  assert(initial.labelCount === 4, `Expected 4 3D country labels, got ${initial.labelCount}.`);
  assert(initial.countryButtonCount === 4, `Expected 4 country selector buttons, got ${initial.countryButtonCount}.`);
  assert(initial.month === '0개월', `Expected month 0 at startup, got ${initial.month}.`);
  assert(initial.selectedCode === 'AST', `Expected AST selected at startup, got ${initial.selectedCode}.`);
  assert(initial.engineState === 'READY', `Expected READY engine state, got ${initial.engineState}.`);

  await page.locator('[data-country="BRN"]').click();
  await page.waitForFunction(() => document.querySelector('#selectedCode')?.textContent === 'BRN');

  await page.locator('#step1').click();
  await page.waitForFunction(() => document.querySelector('#month')?.textContent?.includes('1개월'), null, { timeout: 30000 });

  await page.locator('#play').click();
  await page.waitForFunction(() => {
    const value = Number.parseInt(document.querySelector('#month')?.textContent || '0', 10);
    return value >= 2;
  }, null, { timeout: 30000 });
  await page.locator('#pause').click();
  await page.waitForFunction(() => document.querySelector('#engineState')?.textContent === 'READY');

  await page.locator('#reset').click();
  await page.waitForFunction(() => document.querySelector('#month')?.textContent?.includes('0개월'), null, { timeout: 30000 });
  await page.waitForFunction(() => document.querySelector('#selectedCode')?.textContent === 'AST');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(250);
  const mobile = await page.evaluate(() => {
    const shell = document.querySelector('.world-shell')?.getBoundingClientRect();
    const canvas = document.querySelector('#world3d canvas')?.getBoundingClientRect();
    return {
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      shellWidth: shell?.width || 0,
      shellHeight: shell?.height || 0,
      canvasWidth: canvas?.width || 0,
      canvasHeight: canvas?.height || 0,
      controlsVisible: ['reset', 'step1', 'step12', 'play', 'pause'].every(id => {
        const rect = document.getElementById(id)?.getBoundingClientRect();
        return Boolean(rect && rect.width > 0 && rect.height > 0);
      })
    };
  });

  assert(mobile.overflow <= 2, `Mobile viewport has horizontal overflow of ${mobile.overflow}px.`);
  assert(mobile.shellWidth > 300 && mobile.shellHeight >= 380, `Mobile 3D viewport is not usable: ${mobile.shellWidth}x${mobile.shellHeight}`);
  assert(mobile.canvasWidth > 300 && mobile.canvasHeight >= 380, `Mobile 3D canvas is not usable: ${mobile.canvasWidth}x${mobile.canvasHeight}`);
  assert(mobile.controlsVisible, 'One or more simulation controls are not visible in mobile viewport.');

  assert(runtimeErrors.length === 0, `Browser runtime errors detected:\n${runtimeErrors.join('\n')}`);

  console.log('3D observer browser smoke test passed.');
  console.log(JSON.stringify({ initial, mobile, chrome: executablePath }, null, 2));
} catch (error) {
  console.error(serverOutput);
  throw error;
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
}
