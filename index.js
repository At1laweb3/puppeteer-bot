
3. **Ceo novi `index.js`** (paste-o u root projekta, zamenjujući postojeći):

```js
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

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox','--disable-setuid-sandbox'],
      executablePath: puppeteer.executablePath()
    });
    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/114.0 Safari/537.36'
    );

    console.log('🌐 Otvaranje stranice...');
    await page.goto('https://www.t4trade.com/en/register', { waitUntil: 'domcontentloaded', timeout: 60000 });

    console.log('⌛ Čekam formu...');
    await page.waitForSelector('input[name="first_name"]', { timeout: 40000 });

    console.log('✍️ Popunjavam osnovne podatke...');
    await page.type('input[name="first_name"]', first_name);
    await page.type('input[name="last_name"]', last_name);
    await page.type('input[name="email"]', email);
    await page.type('input[name="phone_mobile"]', phone);
    await page.type('input[name="password"]', password);
    await page.type('input[name="confirm_password"]', password);

    console.log('🎂 Biram datum...');
    await page.select('#dob_yy', dob_year);
    await page.select('#dob_mm', dob_month);
    await page.select('#dob_dd', dob_day);

    console.log('🏳️ Biram zemlju...');
    await page.select('select[name="country"]', 'RS');
    await page.waitForTimeout(1000);

    console.log('🔧 Popunjavam trading-account polja...');
    await page.select('#account_type', 'live_fixed');
    await page.select('select[name="bonus_scheme"]', '031617');
    await page.select('select[name="currency"]', 'EUR');
    await page.select('select[name="leverage"]', '1000');

    console.log('✔️ Checkbox...');
    await page.evaluate(() => {
      document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        if (!cb.checked) {
          cb.checked = true;
          cb.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
    });

    console.log('📤 Klik submit...');
    await page.waitForSelector('button.register_live_btn', { visible: true });
    await page.click('button.register_live_btn');

    // --- **OVDE** snimamo debug snapshot tačno posle klika: ---
    console.log('🔍 Snimam finalni debug snapshot...');
    const debugPage = (await browser.pages())[0];
    // screenshot
    await debugPage.screenshot({
      path: path.join(__dirname, 'public', 'loaded_page.png'),
      fullPage: true
    });
    // html dump
    const html = await debugPage.content();
    fs.writeFileSync(path.join(__dirname, 'public', 'error_dump.html'), html);

    console.log('🛠️ Debug dump spremljen.');
    await browser.close();

    return res.status(200).json({
      message: '✅ Registrovan — pogledaj /debug/loaded_page.png za snapshot',
      email,
      password
    });
  } catch (err) {
    console.error('❌ Greška:', err);
    if (browser) {
      try {
        const debugPage = (await browser.pages())[0];
        await debugPage.screenshot({
          path: path.join(__dirname, 'public', 'loaded_page.png'),
          fullPage: true
        });
      } catch (_) {}
      await browser.close();
    }
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