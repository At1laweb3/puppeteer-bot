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
    dob_day
  } = req.body;

  // Generišemo lozinku iz imena
  const password = `${first_name}123#`;

  let browser, page;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      executablePath: puppeteer.executablePath()
    });
    page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/114.0 Safari/537.36'
    );

    console.log('🌐 Otvaranje stranice...');
    await page.goto('https://www.t4trade.com/en/register', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    console.log('⌛ Čekam da se učita forma...');
    await page.waitForSelector('input[name="first_name"]', { timeout: 40000 });

    console.log('✍️ Popunjavam formu...');
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

    console.log('🏳️ Biram account type i ostalo...');
    await page.select('#account_type', 'live_fixed');
    await page.select('select[name="bonus_scheme"]', '031617');
    await page.select('select[name="currency"]', 'EUR');
    await page.select('select[name="leverage"]', '1000');

    console.log('✔️ Potvrđujem sve checkbox-ove...');
    await page.evaluate(() => {
      document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        if (!cb.checked) {
          cb.checked = true;
          cb.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
    });

    console.log('📤 Klik na “Open your Trading Account” dugme...');
    await page.waitForSelector('button.register_live_btn', { visible: true });
    await page.click('button.register_live_btn');

    // **DEBUG DUMP**: odmah nakon što smo kliknuli
    const dumpHtml = await page.content();
    fs.writeFileSync(path.join(__dirname, 'public', 'after_click.html'), dumpHtml);
    await page.screenshot({ path: path.join(__dirname, 'public', 'after_click.png'), fullPage: true });
    console.log('🔍 Debug dump posle klika je snimljen.');

    console.log('⌛ Čekam da se pojavi “Congratulations” strana...');
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
  }
  catch (err) {
    console.error('❌ Greška tokom registracije:', err);
    try {
      // fiksirano: koristimo baš ovu `page` instancu
      const html = page ? await page.content() : '';
      fs.writeFileSync(path.join(__dirname, 'public', 'loaded_page.html'), html);
      if (page) {
        await page.screenshot({ path: path.join(__dirname, 'public', 'loaded_page.png'), fullPage: true });
      }
      console.log('🛠️ Dump za debug je snimljen.');
    } catch (_) { /* ignore */ }

    if (browser) await browser.close();
    return res.status(500).json({
      error: err.message,
      debug: {
        afterClickHtml: '/debug/after_click.html',
        afterClickPng: '/debug/after_click.png',
        loadedHtml: '/debug/loaded_page.html',
        loadedPng: '/debug/loaded_page.png'
      }
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));