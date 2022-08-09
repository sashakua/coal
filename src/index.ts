import * as path from 'path';
import { HTTPRequest, Page } from 'puppeteer';
import puppeteer from 'puppeteer-extra'; // use puppeter-extra instead of puppeteer to support stealth mode
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { analyzePage, PAGE_VARIATIONS } from './badStatus';
import { singeltonFactory } from './singeltonFactory';
import { log } from './utils';
//const UserDataDirPlugin = require('puppeteer-extra-plugin-user-data-dir'); // important to re-use data folder
const UserAgentOverride = require('puppeteer-extra-plugin-stealth/evasions/user-agent-override')

const stealth = StealthPlugin()
stealth.enabledEvasions.delete('user-agent-override')

const userAgent = UserAgentOverride({
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.0.0 Safari/537.36',
  locale: 'en-GB',
});

puppeteer.use(stealth); // important to avoid detection that browser is automated
//puppeteer.use(UserDataDirPlugin()); // important to re-use data folder
puppeteer.use(userAgent); // more control on user-agent

log('start');

const posts = new Map();
const statuses = new Map();
const statusesMajor = new Map();
const knownPages = new Set();

(async () => {
  const browser = await puppeteer.launch({
    devtools: false, // you still can open devtools manually in browser
    headless: false,
    //userDataDir: path.resolve(__dirname, '..', 'data'), // important to re-use data folder
  });

  const pageTab1 = await browser.newPage();
  await pageTab1.goto('about:blank');

  const pages = await browser.pages();
  await pages[0].close();

  async function fetchPages() {
    const pages = await browser.pages();
    let next = '';
    for (const page of pages) {
      next += '<br/>';
      const post = posts.get(page);
      const status = statuses.get(page);
      const statusTime = status ? new Date(status[1]).toTimeString().substring(0, 8) : '-';
      const url = await page.url();
      if (url === 'about:blank') { continue; }
      next += `${url}: [STATUS=${status?.[0] || '-'}:${statusTime}] [POST=${post || '-'}]`;
    }
    await pageTab1.evaluate((next) => {
      const container = document.getElementById('pages');
      if (!container) { return; }
      container.innerHTML = next;
    }, next);
  }

  async function detectNewTabs() {
    const pages = await browser.pages();
    for (const page of pages) {
      const url = await page.url();
      if (url === 'about:blank') { continue; }
      if (knownPages.has(page)) { continue; }
      knownPages.add(page);
      attachToNewTab(page);
    }
  }

  let autoId = 0;
  function attachToNewTab(page: Page | null) {
    const id = autoId++;
    log('new tab attach', id);
    if (!page) { return; }

    async function reloadPlanned() {
      statusesMajor.set(page, 'RELOAD-REQUIRED');
      const pauseSeconds = 2;
      statuses.set(page, [`RELOAD-PAUSE-${pauseSeconds}s`, Date.now()]);
      fetchPages();
      await new Promise(resolve => setTimeout(resolve, 2 * 1000));
      if (!page) { return; }
      statuses.set(page, ['RELOADING', Date.now()]);
      fetchPages();
      page.reload();
    }

    page.on('close', () => {
      statuses.delete(page);
      posts.delete(page);
      knownPages.delete(page);
      page = null;
    });
    page.on('request', (request: HTTPRequest) => {
      if (!page) { return; }
      if (!request.isNavigationRequest()) { return; }
      const post = request.postData();
      posts.set(page, post);
      fetchPages();
    });
    page.on('error', async () => {
      if (!page) { return; }
      log('error');
      reloadPlanned();
    });
    let autoId2 = 0;
    page.on('domcontentloaded', singeltonFactory(id, async () => {
      const id2 = autoId2++;
      if (!page) { return; }
      const url = await page.url();
      if (url === 'chrome-error://chromewebdata/') {
        reloadPlanned();
        return;
      }
      if (!url.startsWith('http')) {
        statusesMajor.set(page, 'GOOD');
        statuses.set(page, ['non-http-ignore', Date.now()]);
        return;
      }
      do {
        if (!page) { return; }
        statuses.set(page, ['ANALYZING', Date.now()]);
        const pageVariation = await analyzePage(page, url);
        if (!page) { return; }
        if (pageVariation === PAGE_VARIATIONS.NORMAL) {
          let suffix = '';
          const oldStatusMajor = statusesMajor.get(page);
          if (!!oldStatusMajor && oldStatusMajor !== 'GOOD') {
            notifySuccess();
            suffix = ' [was not good before - SOUND';
          }
          statusesMajor.set(page, 'GOOD');
          statuses.set(page, ['GOOD' + suffix, Date.now()]);
          fetchPages();
          return;
        }
        if (pageVariation === PAGE_VARIATIONS.UNDETECTED_CONTINUE_ANALYZE) {
          statuses.set(page, ['ANALYZING-WAIT', Date.now()]);
          fetchPages();
          await page.waitForNetworkIdle();
          continue;
        }
        if (pageVariation === PAGE_VARIATIONS.BOT_DETECTED) {
          statusesMajor.set(page, 'BOT DETECTED');
          statuses.set(page, ['BOT DETECTED - manual action required', Date.now()]);
          fetchPages();
          return;
        }
        if (pageVariation === PAGE_VARIATIONS.RELOAD_REQUIRED) {
          reloadPlanned();
          return;
        }
      } while (true);
    }));
  }

  browser.on('targetcreated', async () => {
    fetchPages();
    detectNewTabs();
  });

  browser.on('targetchanged', () => {
    fetchPages();
  });

  browser.on('targetdestroyed', () => {
    fetchPages();
  });

  const notifySuccess = () => {
    pageTab1.click('#start');
  };

  pageTab1.evaluate(() => {
    document.body.innerHTML = `
      0. Do not open anything on this first tab - this is your control panel<br/>
      1. Login to that site on any new tab in this window<br/>
      3. "Stop sound" button stops only sound (and doesn't affect anything else)<br/>
      4. Auto-retries on any tabs automatically with statuses on this first tab<br/>
      <br/>
      <audio id='audio' loop src='http://freesoundeffect.net/sites/default/files/multimedia-correct-04-sound-effect-94815064.mp3'></audio>
      <button id='start'>Play sound</button>
      <button id='stop'>Stop sound</button>
      <div id="pages"></div>
    `;
    
    document.getElementById('start')?.addEventListener('click', () => {
      console.log('Last sound started at ', new Date());
      (document.getElementById('audio') as HTMLMediaElement)?.play?.();
    });

    document.getElementById('stop')?.addEventListener('click', () => {
      (document.getElementById('audio') as HTMLMediaElement)?.pause?.();
    });

  });
  
  log('ready');

  // await browser.close(); // do not close broswer after script execution; so you can continue using it
})();
