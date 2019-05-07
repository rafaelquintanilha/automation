const puppeteer = require('puppeteer');
const readlineSync = require('readline-sync');

// Define sleep function
const sleep = ms => { return new Promise(resolve => setTimeout(resolve, ms)); }

const DELAY = 4000;
const TARGET_MEDIUM = "Twitter for iPhone";

// Wait for user's response.
const username = readlineSync.question('Your twitter username: ');
const pwd = readlineSync.question('Password: ', {
  hideEchoBack: true
});
const target = readlineSync.question('User you want to analyze: ');

(async () => {
  // Setup puppeteer
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  page.on('console', consoleObj => console.log(consoleObj.text()));
  await page.setViewport({ width: 1280, height: 800 });

  // Login
  await page.goto('https://twitter.com/');
  await page.waitForSelector('.StaticLoggedOutHomePage-cell > .StaticLoggedOutHomePage-login > .LoginForm > .LoginForm-username > .text-input');
  await page.type('.StaticLoggedOutHomePage-cell > .StaticLoggedOutHomePage-login > .LoginForm > .LoginForm-username > .text-input', username);
  await page.type('.StaticLoggedOutHomePage-cell > .StaticLoggedOutHomePage-login > .LoginForm > .LoginForm-password > .text-input', pwd);
  await page.click('.StaticLoggedOutHomePage-content > .StaticLoggedOutHomePage-cell > .StaticLoggedOutHomePage-login > .LoginForm > .EdgeButton');
  await page.waitForNavigation();

  // Open new Twitter
  await page.waitForSelector('#timeline');
  await page.click('#user-dropdown-toggle');
  await page.waitForSelector('.enable-rweb-link');
  await page.click('.enable-rweb-link');

  // Go to target profile
  await page.waitForNavigation({ waitUntil: 'networkidle2' });
  await page.goto(
    `https://twitter.com/${target}/with_replies`, 
    { waitUntil: 'networkidle2' }
  );

  // Variables
  const total = [];
  const urls = [];
  await page.evaluate(() => {
    window.i = 0;
  });

  while ( true ) {
    
	  await page.evaluate(async (DELAY) => {
      console.log("Total visible tweets", document.querySelectorAll("div[data-testid=tweet]").length);
      console.log("Current index", window.i);
      const element = document.querySelectorAll("div[data-testid=tweet]")[window.i];
      if ( typeof element === "undefined" ) {
        console.log("Fetching more tweets");
        window.i = 0;
        window.scrollBy(0, 1500);
        const sleep = ms => { return new Promise(resolve => setTimeout(resolve, ms)); }
        await sleep(DELAY);
        document.querySelectorAll("div[data-testid=tweet]")[0].click();
      } else {
        element.click();
      }
      window.i++;
    }, DELAY);
    
    const url = page.url();

    if ( urls.indexOf(url) > -1 ) {
      console.log("Ooops, repeated URL", url);
    } else if ( url.indexOf(`https://twitter.com/${target}/`) === -1 ) {
      console.log("Ooops, this does not belong to the target", url);
    } else {
      urls.push(url);
      console.log("New tweet found on", url);
      const selector = "a[href='https://help.twitter.com/using-twitter/how-to-tweet#source-labels'] > span";
      await page.waitForSelector(selector);
      const medium = await page.$eval(
        selector, 
        node => `${node.textContent}`
      );
      console.log("Tweeted via", medium);
      total.push(medium);
      console.log("Evaluated", total.length, "tweets");
    }

    // Count how many were with the target medium
    const count = total.filter(medium => medium === TARGET_MEDIUM).length;
    const percentage = ((count / total.length) * 100).toFixed(2);
    console.log(`Total tweets with ${TARGET_MEDIUM}: ${percentage}%`);
  
    // Wait to prevent API throttle
    await sleep(DELAY);
    await page.goBack();
  }
})();