import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {createGame,mulligan} from '../public/game/engine.js';
const base='http://127.0.0.1:4321';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
await mkdir('.local/screenshots',{recursive:true});
const context=await browser.newContext({viewport:{width:1440,height:1100}}),page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
page.on('response',r=>{if(r.status()>=400)console.log('HTTP failure',r.status(),r.url());});
try{
  await page.goto(base);await page.getByRole('heading',{name:/An index of/}).waitFor();await page.locator('.hero-art img').evaluate(img=>img.decode());
  await page.screenshot({path:'.local/screenshots/home-desktop.png',fullPage:true});
  await page.getByRole('button',{name:'Open the Guide'}).click();await page.getByPlaceholder('A word, a subject, a small experiment…').fill('strata');await page.locator('.guide-result').click();await page.getByRole('heading',{name:'Choose your expedition.'}).waitFor();
  await page.screenshot({path:'.local/screenshots/strata-setup.png',fullPage:true});
  await page.getByRole('button',{name:'Inspect your cards'}).click();await page.getByRole('heading',{name:'Your expedition.',exact:true}).waitFor();await page.getByRole('button',{name:'Close',exact:true}).click();
  await page.getByRole('button',{name:'Begin expedition',exact:true}).click();await page.getByRole('button',{name:'Keep hand & begin'}).click();await page.waitForFunction(()=>{const s=JSON.parse(localStorage.getItem('oblique-strata-v1'));return s.stage==='playing'&&s.active===0&&!s.pending;},{},{timeout:20000});
  await page.screenshot({path:'.local/screenshots/strata-board.png',fullPage:true});
  const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('oblique-strata-v1')));
  if(await page.locator('[data-field]').count()){await page.locator('[data-field]').first().click();const pick=page.getByRole('button',{name:/Pickaxe ·/});if(await pick.count())await pick.click();}
  await page.getByRole('button',{name:'End turn',exact:true}).click();
  // The actual UI must finish the AI turn, including any human block decisions.
  for(let i=0;i<40;i++){
    const s=await page.evaluate(()=>JSON.parse(localStorage.getItem('oblique-strata-v1')));
    if(s.stage==='over'||s.active===0&&!s.pending)break;
    const hit=page.getByRole('button',{name:'Take the hit',exact:true});if(await hit.count())await hit.click();
    await page.waitForTimeout(350);
  }
  const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('oblique-strata-v1')));assert.ok(after.turn>before.turn);assert.equal(after.active,0);
  await page.reload();await page.locator('.board').waitFor();assert.equal((await page.evaluate(()=>JSON.parse(localStorage.getItem('oblique-strata-v1')))).turn,after.turn);
  await page.getByRole('button',{name:'Field manual'}).click();await page.getByRole('heading',{name:'Crew & combat'}).waitFor();await page.getByRole('button',{name:'Close',exact:true}).click();
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'.local/screenshots/strata-mobile.png',fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'game overflows mobile width');
  await page.goto(base);await page.getByRole('heading',{name:/An index of/}).waitFor();await page.screenshot({path:'.local/screenshots/home-mobile.png',fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'home overflows mobile width');
  await page.goto(base+'/dev/login');await page.getByRole('button',{name:'Enter local workspace'}).click();await page.getByText('LOCAL PREVIEW · Entries are saved on this computer, not on your live website.').waitFor();
  await page.getByLabel('Title',{exact:true}).fill('Browser verification note');await page.getByLabel('URL slug').fill('browser-check-'+Date.now());await page.getByLabel('Short introduction').fill('A local test of the publication workflow.');await page.getByLabel('Article body in Markdown').fill('# Verified\n\nThis local preview can **publish** an article.');await page.getByRole('button',{name:'Save draft',exact:true}).click();await page.getByText('Draft saved privately.').waitFor();
  const privateSlug=await page.getByLabel('URL slug').inputValue();const privateContent=await (await page.request.get(base+'/api/content')).json();assert.ok(!privateContent.entries.some(e=>e.slug===privateSlug));
  await page.getByRole('button',{name:'Show preview'}).click();await page.locator('#body-preview strong').getByText('publish').waitFor();await page.getByRole('button',{name:'Publish',exact:true}).click();await page.getByText('Published successfully.').waitFor();
  const publicContent=await (await page.request.get(base+'/api/content')).json();assert.ok(publicContent.entries.some(e=>e.slug===privateSlug));
  await page.setViewportSize({width:1440,height:1100});await page.screenshot({path:'.local/screenshots/admin.png',fullPage:true});
  const reader=await context.newPage();await reader.goto(base+'/entry/'+privateSlug);await reader.getByRole('heading',{name:'Browser verification note'}).waitFor();await reader.locator('.prose strong').getByText('publish').waitFor();await reader.close();
  await page.getByRole('button',{name:'Unpublish to draft'}).click();await page.getByText('Draft saved privately.').waitFor();
  // A fresh, unauthenticated visitor cannot fetch drafts or load the admin HTML.
  const publicContext=await browser.newContext();assert.equal((await publicContext.request.get(base+'/api/admin/entries')).status(),401);assert.equal((await publicContext.request.get(base+'/admin.html')).status(),401);await publicContext.close();
  assert.deepEqual(errors,[]);console.log('Browser checks passed: desktop/mobile layout, Guide, real AI turn, save/reload, rules, draft, preview, publish, read, unpublish, and private admin.');
}finally{await browser.close();}
