import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const output = 'docs/validation-images/map-labels-terms';
async function ready(page: Page) {
  await expect(page.getByRole('button', { name: '开始播放', exact: true })).toBeEnabled({ timeout: 30000 });
}
async function checkClockPosition(page: Page) {
  await expect.poll(() => page.locator('.map-pane').evaluateAll(panes => panes.map(pane =>
    new Set((pane as any).__vueParentComponent.exposed.getProvinceLabels()).size))).toEqual(
      Array(await page.locator('.map-pane').count()).fill(34));
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  for (const pane of await page.locator('.map-pane').all()) {
    const layout = await pane.evaluate(element => {
      const canvas = element.querySelector('.map-canvas')!.getBoundingClientRect();
      const card = element.querySelector('.map-time')!.getBoundingClientRect();
      const group = element.querySelector('.map-info')!.getBoundingClientRect();
      const date = element.querySelector('.map-day')!.getBoundingClientRect();
      const zone = element.querySelector('.map-time-value > span')!.getBoundingClientRect();
      const clock = element.querySelector('.map-time strong')!.getBoundingClientRect();
      const outlineTop = (element as any).__vueParentComponent.exposed.getOutlineTop();
      const compact = document.querySelector('.atlas-app')!.classList.contains('mobile-presentation') || canvas.width < 600;
      const controls = document.querySelector('.map-view-controls')!.getBoundingClientRect();
      return { width: canvas.width, height: canvas.height, x: card.x + card.width / 2 - canvas.x,
        outlineTop, groupBottom: group.bottom-canvas.top, groupTop:group.top-canvas.top, compact,
        stacked: date.bottom <= zone.top + 1 && zone.bottom <= clock.top + 1,
        overlapsControls: card.left < controls.right && card.right > controls.left && card.top < controls.bottom && card.bottom > controls.top };
    });
    expect(layout.stacked).toBe(true);
    expect(layout.overlapsControls).toBe(false);
    expect(layout.x).toBeCloseTo(layout.width/2, 0);
    expect(layout.groupTop).toBeGreaterThanOrEqual(0);
    expect(layout.outlineTop-layout.groupBottom).toBeCloseTo(layout.compact?12:16, 0);
  }
}
async function screenshot(page: Page, name: string) {
  mkdirSync(output, { recursive: true });
  await page.screenshot({ path: `${output}/${name}.png` });
}

test('全屏单图沿用普通地图上方的日期时间位置和三行样式', async ({ page }, info) => {
  await page.goto('/'); await ready(page); await checkClockPosition(page);
  const original = await page.locator('.map-canvas canvas').elementHandle();
  await page.getByRole('button', { name: '全屏查看地图', exact: true }).click();
  await expect(page.getByRole('button', { name: '退出全屏', exact: true })).toBeVisible();
  await checkClockPosition(page); await screenshot(page, `${info.project.name}-single`);
  expect(await original!.evaluate(element => element === document.querySelector('.map-canvas canvas'))).toBe(true);
  await page.getByRole('button', { name: '退出全屏', exact: true }).click();
  await checkClockPosition(page); await expect(page.getByTestId('clock')).toHaveText('00:00');
});

test('备用全屏双图旋转后各自保留地图上方日期时间且不遮挡操作', async ({ page }, info) => {
  await page.addInitScript(() => Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', { configurable: true, value: undefined }));
  await page.goto('/'); await ready(page);
  const opener = page.getByRole('button', { name: '日期与节气', exact: true });
  if (await opener.isVisible()) await opener.click();
  await page.getByRole('button', { name: '两天对比', exact: true }).click();
  const close = page.getByRole('button', { name: '关闭面板', exact: true });
  if (await close.isVisible()) await close.click();
  await ready(page); await page.getByRole('slider', { name: '北京时间时间轴' }).fill('720');
  await page.getByRole('button', { name: '全屏查看地图', exact: true }).click();
  await expect(page.locator('.map-workspace')).toHaveAttribute('data-fullscreen', 'viewport');
  await checkClockPosition(page); await screenshot(page, `${info.project.name}-compare`);
  for (const size of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(size); await checkClockPosition(page);
    await screenshot(page, `${info.project.name}-compare-${size.width}`);
  }
  await expect(page.getByTestId('map-clock')).toHaveText(['12:00', '12:00']);
});
