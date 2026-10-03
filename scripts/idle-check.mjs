import { chromium, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

// Count application callbacks after playback and finite presentation effects settle.
const output = 'docs/validation-images/observatory';
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium' });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const requests = [], errors = [];
  await page.addInitScript(() => {
    let callbacks = 0;
    const frame = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = callback => frame(time => { callbacks++; callback(time); });
    window.observatoryCallbackCount = () => callbacks;
  });
  page.on('request', request => requests.push(request.url()));
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:4173');
  await expect(page.getByRole('button', { name: '开始播放', exact: true })).toBeEnabled({ timeout: 30000 });
  await page.getByRole('button', { name: '两天对比', exact: true }).click();
  await expect(page.getByRole('button', { name: '开始播放', exact: true })).toBeEnabled({ timeout: 30000 });
  await page.getByRole('button', { name: '开始播放', exact: true }).click();
  await page.waitForTimeout(2000);
  await page.getByRole('button', { name: '暂停播放', exact: true }).click();
  await page.waitForTimeout(1000);
  const before = await page.evaluate(() => window.observatoryCallbackCount());
  const beforeRequests = requests.length;
  await page.waitForTimeout(3000);
  const state = await page.evaluate(() => ({
    callbacks: window.observatoryCallbackCount(),
    activeCssAnimations: document.getAnimations().filter(animation => animation.playState === 'running').length,
    time: document.querySelector('[data-testid="clock"]').textContent,
  }));
  const result = { checkedAt: new Date().toISOString(), seconds: 3, idleAnimationFrameCallbacks: state.callbacks - before,
    activeCssAnimations: state.activeCssAnimations, newRequests: requests.length - beforeRequests, time: state.time, errors };
  writeFileSync(`${output}/idle-check.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
  if (result.idleAnimationFrameCallbacks || result.activeCssAnimations || result.newRequests || errors.length)
    throw new Error('Paused scene did not settle');
} finally { await browser.close(); }
