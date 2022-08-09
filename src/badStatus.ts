import { Page } from 'puppeteer';
import { checkIsSprawdzwegielBad } from './sites/sprawdzwegiel';
import { log } from './utils';

export const isPageBad = async (page: Page, url: string) => {
  if (url.includes('sprawdzwegiel.pl')) {
    return checkIsSprawdzwegielBad(page);
  }

  const result = await page.evaluate(async () => {
    const pageText = document.querySelector('body')?.innerText;
    if (!pageText) { return false; } // no text - continue waiting, as they loading dynamically
    if (pageText.includes('The requested URL was rejected. Your support ID is:')) { return 'RESET'; }
    if (pageText.includes('SPRÓBUJ\nPONOWNIE\nPÓŹNIEJ')) { return true; }
  });
  if (result === 'RESET') {
    log('Bot detected, clear cookies at', new Date());
    const client = await page.target().createCDPSession();
    await client.send('Network.clearBrowserCookies');
    return true;
  }
  if (result === false) {
    log('No text, wait more', new Date());
    // wait more
    await page.waitForNetworkIdle();
    const result2 = await isPageBad(page, url) as any;
    return result2;
  }
  return result;
};
