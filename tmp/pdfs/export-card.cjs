const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('C:/Users/Matteo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = 'C:/Users/Matteo/website';
const source = 'C:/Users/Matteo/.codex/visualizations/2026/10/19/01a153ad-b240-7b73-82f6-df6733f19576/pattern-payoff-ufficiale.html';
(async () => {
  const fragment = fs.readFileSync(source,'utf8');
  const styles = fragment.match(/<style>([\s\S]*?)<\/style>/)[1].replace(/@import[^;]+;/g,'');
  const front = fragment.match(/<div class="ps-card ps-front"[\s\S]*?<\/div>/)[0];
  const back = fragment.match(/<div class="ps-card ps-back"[\s\S]*?<\/figure>/)[0].replace(/\s*<\/figure>$/,'');
  const html = `<!doctype html>
<html lang="it"><head><meta charset="utf-8"><title>Pattern - Matteo Lauriola</title>
<style>${styles}
@page { size:91mm 61mm; margin:0; }
html,body { margin:0; padding:0; }
body { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
#pattern-payoff-ufficiale { font-family:Arial,sans-serif; }
.print-page { position:relative; width:91mm; height:61mm; break-after:page; page-break-after:always; overflow:hidden; }
.print-page:last-child { break-after:auto; page-break-after:auto; }
.print-front { background:#242723; }
.print-back { background:#f3f2ee; }
.print-trim { position:absolute; left:3mm; top:3mm; width:85mm; height:55mm; container-type:inline-size; }
#pattern-payoff-ufficiale .ps-card { width:85mm; height:55mm; aspect-ratio:auto; box-shadow:none; }
#pattern-payoff-ufficiale .ps-front-logo { width:71%; left:14.5%; }
</style></head><body>
<div id="pattern-payoff-ufficiale">
<section class="print-page print-front"><div class="print-trim">${front}</div></section>
<section class="print-page print-back"><div class="print-trim">${back}</div></section>
</div></body></html>`;
  const htmlPath = path.join(root,'tmp/pdfs/card-print.html');
  fs.writeFileSync(htmlPath,html);
  const browser = await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const page = await browser.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('file:///'+htmlPath.replaceAll('\\','/'));
  await page.evaluate(()=>document.fonts.ready);
  const checks=await page.evaluate(()=>({
    pages:document.querySelectorAll('.print-page').length,
    images:[...document.images].every(im=>im.complete && im.naturalWidth>0),
    name:document.querySelector('.ps-name').innerText,
    role:document.querySelector('.ps-role').textContent,
    logoSize:parseFloat(getComputedStyle(document.querySelector('.ps-front-logo')).width)/parseFloat(getComputedStyle(document.querySelector('.ps-card')).width)
  }));
  if(checks.pages!==2 || !checks.images || errors.length) throw Error(JSON.stringify({checks,errors}));
  await page.pdf({path:path.join(root,'tmp/pdfs/card-rgb.pdf'),printBackground:true,preferCSSPageSize:true,tagged:false,displayHeaderFooter:false});
  console.log(JSON.stringify({checks,errors}));
  await browser.close();
})().catch(error=>{console.error(error);process.exitCode=1});
