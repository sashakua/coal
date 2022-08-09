import { Page } from 'puppeteer';
import { checkIsSprawdzwegielBad } from './sites/sprawdzwegiel';

export const PAGE_VARIATIONS = {
  BOT_DETECTED: 'BOT_DETECTED',
  RELOAD_REQUIRED: 'RELOAD_REQUIRED',
  NORMAL: 'NORMAL',
  UNDETECTED_CONTINUE_ANALYZE: 'UNDETECTED_CONTINUE_ANALYZE',
};

export const analyzePage = async (page: Page, url: string) => {
  if (url.includes('sprawdzwegiel.pl')) {
    const result = await checkIsSprawdzwegielBad(page);
    if (result) {
      return PAGE_VARIATIONS.RELOAD_REQUIRED;
    } else {
      return PAGE_VARIATIONS.NORMAL;
    }
  }

  return await page.evaluate(async (PAGE_VARIATIONS) => {
    const pageText = document.querySelector('body')?.innerText;
    if (!pageText) { return PAGE_VARIATIONS.UNDETECTED_CONTINUE_ANALYZE; } // no text - continue waiting, as they loading dynamically
    if (pageText.includes('The requested URL was rejected. Your support ID is:')) { return PAGE_VARIATIONS.BOT_DETECTED; }
    if (pageText.includes('SPRÓBUJ\nPONOWNIE\nPÓŹNIEJ')) { return PAGE_VARIATIONS.RELOAD_REQUIRED; }
    return PAGE_VARIATIONS.NORMAL;
  }, PAGE_VARIATIONS);
};
