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
  const {
    first_name,
    last_name,
    email,
    phone,
    dob_year,
    dob_month,
    dob_day,
    password
  } = req.body;

  let browser;
  try {
    // Pokrećemo Puppeteer sa ugrađenim Chromiumom iz node_modules
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      executablePath: puppeteer.executablePath()
    });

    const page = await browser.newPage();
    // Setovanje User-Agent da izbjegnemo bot detekciju
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/114.0 Safari/537.36'
    );

    console.log('NOVI KOD JE UČITAN');
    console.log('Otvaranje stranice...');
    await page.goto('https://www.t4trade.com/en/register', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    await page.waitForTimeout(5000);

    console.log('Čekam da se učita forma...');
    const formReady = await page.waitForSelector('input[name="first_name"]', { timeout: 40000 }).catch(() => null);
    if (!formReady) {
      throw new Error("Input 'first_name' nije pronađen ni nakon 40 sekundi.");
    }

    console.log('Popunjavam formu...');
    await page.type('input[name="first_name"]', first_name);
    await page.type('input[name="last_name"]', last_name);
    await page.type('input[name="email"]', email);
    // Polje za telefon se zove 'phone_mobile'
    await page.type('input[name="phone_mobile"]', phone);
    await page.type('input[name="password"]', password);
    // Polje za potvrdu šifre se zove 'confirm_password'
    await page.type('input[name="confirm_password"]', password);

    // Birthdate selects
    await page.select('select[name="birthDateYear"]', dob_year);
    await page.select('select[name="birthDateMonth"]', dob_month);
    await page.select('select[name="birthDateDay"]', dob_day);

    // Ostala podešavanja
    await page.select('select[name="accountType"]', 'live_fixed');
    await page.select('select[name="bonusType"]', 'no_bonus');
    await page.select('select[name="currency"]', 'EUR');
    await page.select('select[name="leverage"]', '1000');

    // Check all checkboxes
    const checkboxes = await page.$$('input[type="checkbox"]');
    for (const cb of checkboxes) {
      const checked = await (await cb.getProperty('checked')).jsonValue();
      if (!checked) await cb.click();
    }

    console.log('Šaljem formu...');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(8000);

    console.log('Registracija završena.');
    return res.status(200).json({ message: 'Registrovan uspešno' });

  } catch (err) {
    console.error('Greška tokom registracije:', err);

    // Attempt debug dump
    try {
      const debugPage = (await browser.pages())[0];
      const html = await debugPage.content();
      const screenshotPath = path.join(__dirname, 'public', 'loaded_page.png');
      const htmlPath = path.join(__dirname, 'public', 'error_dump.html');

      fs.writeFileSync(htmlPath, html);
      await debugPage.screenshot({ path: screenshotPath, fullPage: true });
    } catch (innerErr) {
      console.error('Nije uspelo snimanje za debug:', innerErr);
    }

    return res.status(500).json({
      error: err.message,
      debug: {
        screenshot: '/debug/loaded_page.png',
        html: '/debug/error_dump.html'
      }
    });

  } finally {
    if (browser) await browser.close();
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server running on port ' + PORT));