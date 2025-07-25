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
    // Updated to use id selectors from the form
    await page.select('#dob_yy', dob_year);
    await page.select('#dob_mm', dob_month);
    await page.select('#dob_dd', dob_day);

    // Ostala podešavanja
    // Prvo izaberemo zemlju (npr. Srbija = RS) da bismo omogućili Trading Account
    console.log('🏳️ Selecting country...');
    await page.select('select[name="country"]', 'RS');
    await page.waitForTimeout(1000);

    // Sada možemo izabrati tip računa
    await page.select('select[id="account_type"]', 'live_fixed');
    // Select bonus scheme (Standard No Bonus = '031617')
    await page.select('select[name="bonus_scheme"]', '031617');
    await page.select('select[name="currency"]', 'EUR');
    await page.select('select[name="leverage"]', '1000');

    // Ensure all checkboxes are checked (terms acceptance)
    console.log('✔️ Checking all terms checkboxes');
    await page.evaluate(() => {
      document.querySelectorAll('input[type="checkbox"]')
        .forEach(cb => {
          if (!cb.checked) {
            cb.checked = true;
            cb.dispatchEvent(new Event('change', { bubbles: true }));
          }
        });
    });

    // Scroll to bottom to reveal submit button and enable it
    await page.evaluate(() => {
      const btn = document.querySelector('button.register_live_btn');
      if (btn) btn.disabled = false;
      window.scrollTo(0, document.body.scrollHeight);
    });

    console.log('Šaljem formu...');
    await page.waitForSelector('button.register_live_btn', { visible: true });
    // Click the styled submit button
    // Use JS click to bypass element visibility issues
    await page.evaluate(() => document.querySelector('button.register_live_btn').click());
    // Wait for navigation or success response
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 });(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForSelector('button.register_live_btn', { visible: true });
    // Click the styled submit button
    await page.click('button.register_live_btn');
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