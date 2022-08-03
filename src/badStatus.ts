import { Page } from 'puppeteer';

export const isPageBad = async (page: Page) => {
  const isBad = await page.evaluate(() => {
    const pageText = document.querySelector('body')?.innerText;
    if (!pageText) { return true; }
    if (pageText.includes('The requested URL was rejected. Your support ID is:')) { return true; }
    return false;
  });
  return isBad;
};
