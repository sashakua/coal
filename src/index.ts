import * as path from 'path';
import { Page } from 'puppeteer';
import puppeteer from 'puppeteer-extra'; // use puppeter-extra instead of puppeteer to support stealth mode
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { isPageBad } from './badStatus';
import { getStatus, setStatus } from './status';
import { log } from './utils';
const UserDataDirPlugin = require('puppeteer-extra-plugin-user-data-dir'); // important to re-use data folder

puppeteer.use(StealthPlugin()); // important to avoid detection that browser is automated
puppeteer.use(UserDataDirPlugin()); // important to re-use data folder

const MAX_PARALLEL_RETRY = 6; // what is limit of Chrom for maximum connections to one server?

log('start');

(async () => {
  const browser = await puppeteer.launch({
    devtools: false, // you still can open devtools manually in browser
    headless: false,
    userDataDir: path.resolve(__dirname, '..', 'data'), // important to re-use data folder
  });

  const pages = await browser.pages();
  const pageTab1 = pages[0];
  await pageTab1.goto('about:blank');

  const notifySuccess = () => {
    setStatus(false);
    pageTab1.click('#start');
  };

  const runRetry = async (url: string, maxAttempts: number, pause: number) => {
    setStatus(true);

    const retryPages = [];

    const retryForOnePage = async (page: Page, index: number) => {
      const prefix = `[page-${index}]`;
      do {
        if (!getStatus()) { return; } // stop work if already stopped
        try {
          log(prefix, 'Last attempt at:', new Date());
          await page.goto(url);
          log(prefix, 'Done attempt at:', new Date());
          if (!getStatus()) { return; } // stop work if already stopped
          const isBad = await isPageBad(page, url);
          log(prefix, 'isPageBad', isBad, new Date());
          if (!getStatus()) { return; } // stop work if already stopped
          if (!isBad) { notifySuccess(); }
          if (pause > 0) {
            await new Promise(resolve => setTimeout(resolve, pause * 1000));
            if (!getStatus()) { return; } // stop work if already stopped
          }
        } catch (e) {
          log(prefix, 'Catched some error at:', new Date(), e);
          // some error during loading page (network error?)
          // so continue attempts
        }
      } while (true);
    };

    for (let i = 0; i < MAX_PARALLEL_RETRY && i < maxAttempts; i++) {
      retryPages.push(await browser.newPage());
    }
    for (let i = 0; i < retryPages.length; i++) {
      retryForOnePage(retryPages[i], i);
    }

  };

  await pageTab1.exposeFunction('setStatus', setStatus);
  await pageTab1.exposeFunction('runRetry', runRetry);

  pageTab1.evaluate(() => {
    document.body.innerHTML = `
      0. Do not open anything on this first tab - this is your control panel<br/>
      1. Login to that site on any new tab in this window<br/>
      2. Open dev tools in this first tab and type:<br>retry('https://...')<br/>
      So you can copy-paste any problem URL and execute retry mechanism - it will open 6 tabs in which it will constantly retry loading, until one of them is loaded successfully<br/>
      3. "Stop sound" button also stops retry (in case you decide to stop it before success attempt)<br/>
      <br/>
      <audio id='audio' loop src='http://freesoundeffect.net/sites/default/files/multimedia-correct-04-sound-effect-94815064.mp3'></audio>
      <button id='start'>Play sound</button>
      <button id='stop'>Stop sound</button>
    `;
    (window as any).retry = (url: string, maxAttempts: number = 6, pause: number = 1) => {
      console.log(`Retrying [max attempts=${maxAttempts}, pause=${pause}]:`, url);
      (window as any).runRetry(url, maxAttempts, pause);
    };
    
    document.getElementById('start')?.addEventListener('click', () => {
      console.log('Last sound started at ', new Date());
      (document.getElementById('audio') as HTMLMediaElement)?.play?.();
    });

    document.getElementById('stop')?.addEventListener('click', () => {
      (window as any).setStatus(false);
      (document.getElementById('audio') as HTMLMediaElement)?.pause?.();
    });
  });
  
  log('ready');

  // await browser.close(); // do not close broswer after script execution; so you can continue using it
})();
