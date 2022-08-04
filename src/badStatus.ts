import { Page } from 'puppeteer';
import { checkIsSprawdzwegielBad } from './sites/sprawdzwegiel';

export const isPageBad = async (page: Page, url: string) => {
  if (url.includes('sprawdzwegiel.pl')) {
    return checkIsSprawdzwegielBad(page);
  }

  const isBad = await page.evaluate(async () => {
    const pageText = document.querySelector('body')?.innerText;
    if (!pageText) { return true; }
    if (pageText.includes('The requested URL was rejected. Your support ID is:')) { return true; }
  });
  return isBad;
};
