import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const outDir = path.resolve(__dirname, '../client/public/guide_screenshots');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

async function run() {
  console.log('Launching browser to capture flow screenshots...');
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const executablePath = fs.existsSync(chromePath) ? chromePath : (fs.existsSync(edgePath) ? edgePath : undefined);
  
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

  // 1. Landing Page
  console.log('Capturing Landing Page...');
  await page.goto('http://localhost:5173/landing', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(outDir, '01_landing.png') });

  // 2. Register Page
  console.log('Capturing Register Page...');
  await page.goto('http://localhost:5173/register', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(outDir, '02_register.png') });

  // 3. Login Page
  console.log('Capturing Login Page...');
  await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(outDir, '03_login.png') });

  // Perform Login
  console.log('Logging in to capture authenticated pages...');
  await page.type('input[type="email"]', 'suleman111111111111111@gmail.com');
  await page.type('input[type="password"]', '8318683295');
  const submitBtn = await page.$('button[type="submit"]');
  if (submitBtn) {
    await submitBtn.click();
  } else {
    await page.keyboard.press('Enter');
  }
  await page.waitForNavigation({ waitUntil: 'networkidle0' }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));

  // 4. Dashboard
  console.log('Capturing Dashboard...');
  await page.goto('http://localhost:5173/dashboard', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(outDir, '04_dashboard.png') });

  // 5. Upload PDF
  console.log('Capturing Upload Ingestion...');
  await page.goto('http://localhost:5173/upload', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(outDir, '05_upload.png') });

  // 6. Templates
  console.log('Capturing Templates Hub...');
  await page.goto('http://localhost:5173/templates', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(outDir, '06_templates.png') });

  // 7. Bulk Send
  console.log('Capturing Bulk Send...');
  await page.goto('http://localhost:5173/templates/bulk', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(outDir, '07_bulk_send.png') });

  // 8. Signature Remover
  console.log('Capturing Signature Remover Studio...');
  await page.goto('http://localhost:5173/signature-remover', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(outDir, '08_signature_remover.png') });

  // 9. Account Settings
  console.log('Capturing Account Settings...');
  await page.goto('http://localhost:5173/settings', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(outDir, '09_settings.png') });

  // 10. Public Verify
  console.log('Capturing Public Verify...');
  await page.goto('http://localhost:5173/verify', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(outDir, '10_verify.png') });

  console.log('All screenshots captured successfully in:', outDir);
  await browser.close();
}

run().catch(err => {
  console.error('Screenshot capture error:', err);
  process.exit(1);
});
