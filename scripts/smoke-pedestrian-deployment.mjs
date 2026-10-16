import {chromium,webkit,expect} from '@playwright/test';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const base=process.argv[2]??'https://capstone-pwa-dev.fly.dev';
const local=['localhost','127.0.0.1','[::1]'].includes(new URL(base).hostname);
const artifactPrefix=local?'production-local':'deployed';
if(!local)expect(new URL(base).protocol).toBe('https:');
await mkdir('artifacts/pedestrian',{recursive:true});
for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await engine.launch({headless:true,...(name==='chromium'?{channel:'chrome'}:{})});
 try{
  const context=await browser.newContext({viewport:{width:1000,height:900}});
  const errors=[];
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  const health=await context.request.get(`${base}/healthz`);expect(health.ok()).toBe(true);
  expect((await health.json()).ready).toBe(true);
  expect(await(await context.request.get(`${base}/sw.js`)).text()).toBe(await readFile('dist/sw.js','utf8'));
  await page.goto(base);expect(await page.evaluate(()=>isSecureContext)).toBe(true);
  await page.getByRole('button',{name:'Agree and continue',exact:true}).click();
  const setup=page.getByRole('button',{name:'Continue to CrossWise',exact:true});if(await setup.count())await setup.click();
  await page.getByRole('button',{name:'Help',exact:true}).click();
  await page.getByText('Check a reference image',{exact:true}).click();
  const results=[];
  for(const fixture of ['street-green','countdown','button']){
   await page.getByLabel('Pedestrian reference image',{exact:true}).setInputFiles(resolve(`tests/fixtures/pedestrian/${fixture}.png`));
   await expect(page.getByRole('status')).toHaveText('Image check complete.',{timeout:120000});
   const result=page.getByTestId('pedestrian-image-result');
   if(fixture==='street-green')await expect(result).toContainText('Green pedestrian');
   if(fixture==='countdown'){await expect(result).toContainText('Countdown · 21s');await expect(result).toContainText('Red pedestrian');}
   if(fixture==='button')await expect(result).toContainText('Possible press surface');
   await result.screenshot({path:`artifacts/pedestrian/${artifactPrefix}-${fixture}-${name}.png`});
   results.push({fixture,observations:await result.innerText()});
   console.log(`PASS: ${name}, ${base}, ${fixture} actual worker inference and boxes.`);
  }
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));});
  await context.setOffline(true);
  await page.getByLabel('Pedestrian reference image',{exact:true}).setInputFiles(resolve('tests/fixtures/pedestrian/countdown.png'));
  await expect(page.getByRole('status')).toHaveText('Image check complete.',{timeout:90000});
  await expect(page.getByTestId('pedestrian-image-result')).toContainText('Countdown · 21s');
  expect(errors).toEqual([]);
  await writeFile(`artifacts/pedestrian/${artifactPrefix}-${name}.json`,JSON.stringify({base,results,offline:true,errors},null,2));
  console.log(`PASS: ${name}, exact build, secure context, health, offline countdown and no uncaught errors.`);
 }finally{await browser.close();}
}
