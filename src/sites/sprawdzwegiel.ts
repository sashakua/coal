import { Page } from 'puppeteer';

export const checkIsSprawdzwegielBad = async (page: Page) => {
  return await page.evaluate(() => {
    const interestingItems = [
      'Karolinka Ekogroszek\nPaleta 1000 kg (50 worków x 20 kg)',
      'Pieklorz Ekogroszek\nPaleta 1000 kg (50 worków x 20 kg)',
    ];
    const rows = document.querySelectorAll('li');
    let foundInterestingItemsRows = 0;
    for (const row of rows) {
      const text = row.innerText;
      for (const searchText of interestingItems) {
        if (!text.includes(searchText)) { continue; }
        foundInterestingItemsRows++;
        if (!text.includes('Niedostępny') && !text.includes('Brak danych')) {
          return false; // good news - report "not bad" status
        }
      }
      if (foundInterestingItemsRows === interestingItems.length) { break; }
    }
    return true; // if we are here, then didn't found interesting item
  });
};
