import { expect, type Page } from '@playwright/test';

export async function chooseDate(page: Page, index: number, value: string) {
  const trigger = page.getByRole('button', { name: `日期 ${index+1}`, exact: true });
  const current = (await trigger.getAttribute('data-date'))!;
  const [year,month] = current.split('-').map(Number), [targetYear,targetMonth] = value.split('-').map(Number);
  await trigger.click();
  const distance = (targetYear-year)*12+targetMonth-month;
  for(let i=0;i<Math.abs(distance);i++) await page.getByRole('button',{name:distance>0?'下个月':'上个月',exact:true}).click();
  await page.getByRole('gridcell',{name:value,exact:true}).click();
  await expect(trigger).toHaveAttribute('data-date',value);
  await expect(page.getByRole('dialog',{name:'选择观测日期',exact:true})).toHaveCount(0);
}
