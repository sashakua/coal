import * as path from 'path';
import puppeteer from 'puppeteer-extra'; // use puppeter-extra instead of puppeteer to support stealth mode
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { log } from './utils';
const UserDataDirPlugin = require('puppeteer-extra-plugin-user-data-dir'); // important to re-use data folder

puppeteer.use(StealthPlugin()); // important to avoid detection that browser is automated
puppeteer.use(UserDataDirPlugin()); // important to re-use data folder

log('start');

(async () => {
  const browser = await puppeteer.launch({
    devtools: false, // you still can open devtools manually in browser
    headless: false,
    userDataDir: path.resolve(__dirname, '..', 'data'), // important to re-use data folder
  });

  const page = await browser.newPage();
  log('open');
  await page.goto('https://example.com');
  log('done');

  // await browser.close(); // do not close broswer after script execution; so you can continue using it
})();
