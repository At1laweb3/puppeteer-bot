// index.js
const express = require('express');
const app = express();
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Parsiranje JSON tijela
app.use(express.json());
// Serviranje debug fajlova iz public foldera
app.use('/debug', express.static(path.join(__dirname, 'public')));

app.post('/register', async (req, res) => {
  const { first_name, last_name, email, phone, dob_year, dob_month, dob_day } = req.body;
  const password = `${first_name}123#`;
  let browser, page;

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      executablePath: puppeteer.executablePath(),
    });
    page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/114.0 Safari/537.36'
    );

    console.log('🌐 Otvaranje stranice...');
    await page.goto('https://www.t4trade.com/en/register', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    console.log('⌛ Čekam da se učita forma...');
    await page.waitForSelector('input[name="first_name"]', { timeout: 40000 });

    console.log('✍️ Popunjavam osnovne podatke...');
    await page.type('input[name="first_name"]', first_name);
    await page.type('input[name="last_name"]', last_name);
    await page.type('input[name="email"]', email);
    await page.type('input[name="phone_mobile"]', phone);
    await page.type('input[name="password"]', password);
    await page.type('input[name="confirm_password"]', password);

    console.log('🎂 Biram datum rođenja...');
    await page.select('#dob_yy', dob_year);
    await page.select('#dob_mm', dob_month);
    await page.select('#dob_dd', dob_day);

    console.log('🏳️ Biram zemlju...');
    await page.select('select[name="country"]', 'RS');

    console.log('⌛ Čekam da “Account Type” postane aktivan...');
    await page.waitForFunction(
      () => !document.querySelector('#account_type').disabled,
      { timeout: 30000 }
    );

    console.log('🏳️ Biram Trading Account...');
    // izaberemo Live Fixed Spread (value="5")
    await page.select('#account_type', '5');

    // čekamo da se popuni bonus_scheme
    await page.waitForFunction(
      () => document.querySelectorAll('#bonus_scheme option').length > 1,
      { timeout: 20000 }
    );
    // biramo prvu stvarnu opciju (indeks 1)
    {
      const bonusValue = await page.$eval(
        '#bonus_scheme option:nth-child(2)',
        o => o.value
      );
      await page.select('#bonus_scheme', bonusValue);
    }

    // čekamo currency
    await page.waitForFunction(
      () => document.querySelectorAll('#currency option').length > 1,
      { timeout: 20000 }
    );
    {
      const curVal = await page.$eval(
        '#currency option:nth-child(2)',
        o => o.value
      );
      await page.select('#currency', curVal);
    }

    // čekamo leverage
    await page.waitForFunction(
      () => document.querySelectorAll('#leverage option').length > 1,
      { timeout: 20000 }
    );
    {
      const levVal = await page.$eval(
        '#leverage option:nth-child(2)',
        o => o.value
      );
      await page.select('#leverage', levVal);
    }

    console.log('✔️ Klik na checkbox-ove...');
    // iCheck helper zahteva pravi click na <ins>
    await page.$$eval('ins.iCheck-helper', els => els.forEach(e => e.click()));

    console.log('📤 Klik na “Open your Trading Account”...');
    await page.waitForSelector('button.register_live_btn', { visible: true });
    await page.click('button.register_live_btn');

    console.log('⌛ Čekam “Congratulations” poruku...');
    await page.waitForXPath(
      "//*[contains(normalize-space(.), 'Congratulations')]",
      { timeout: 40000 }
    );

    console.log('✅ Registrovan uspešno.');
    await browser.close();
    return res.status(200).json({
      message: '✅ Registrovan uspešno — čekajte email sa daljim instrukcijama',
      email,
      password
    });

  } catch (err) {
    console.error('❌ Greška tokom registracije:', err);
    if (page) {
      // dump za debug
      const screenshotPath = path.join(__dirname, 'public', 'loaded_page.png');
      const htmlPath = path.join(__dirname, 'public', 'error_dump.html');
      try {
        await page.screenshot({ path: screenshotPath, fullPage: true });
        const html = await page.content();
        fs.writeFileSync(htmlPath, html);
        console.log('🛠️ Debug dump spremljen.');
      } catch (e2) {
        console.warn('⚠️ Debug dump nije uspio:', e2);
      }
    }
    if (browser) await browser.close();
    return res.status(500).json({
      error: err.message,
      debug: {
        screenshot: '/debug/loaded_page.png',
        html: '/debug/error_dump.html'
      }
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));