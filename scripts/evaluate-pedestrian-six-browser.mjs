import {chromium,expect} from '@playwright/test';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
const folder=process.argv[2]??'artifacts/pedestrian/six-image-evaluation';
const cases=JSON.parse(await readFile(process.argv[3]??`${folder}/summary.json`,'utf8'));
await mkdir(folder,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const context=await browser.newContext({viewport:{width:1000,height:900}});
 await context.addInitScript(()=>{
  window.__pedestrianResults=[];
  const OriginalWorker=window.Worker;
  window.Worker=class extends OriginalWorker{
   constructor(...args){super(...args);this.addEventListener('message',event=>{
    if(event.data?.type==='result')window.__pedestrianResults.push(event.data);
   });}
  };
 });
 const page=await context.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:8082');
 await page.getByRole('button',{name:'Agree and continue',exact:true}).click();
 const setup=page.getByRole('button',{name:'Continue to CrossWise',exact:true});if(await setup.count())await setup.click();
 await page.getByRole('button',{name:'Help',exact:true}).click();
 await page.getByText('Check a reference image',{exact:true}).click();
 const outputs=[];
 for(const sample of cases){
  await page.evaluate(()=>{window.__pedestrianResults=[];});
  await page.getByLabel('Pedestrian reference image',{exact:true}).setInputFiles(sample.input);
  await expect(page.getByRole('status')).toHaveText(/^(Image check complete\.|No supported pedestrian signal, countdown or button found\.)$/,{timeout:90000});
  const scene=await page.evaluate(()=>window.__pedestrianResults.at(-1));
  expect(scene).toBeTruthy();
  const details=page.locator('details[open]');
  const policy=await details.locator('p').last().innerText();
  const report={id:sample.id,input:sample.input,input_sha256:sample.input_sha256,observations:scene.observations,diagnostics:scene.diagnostics,policy,errors:[...errors]};
  await writeFile(`${folder}/${sample.id}-browser.json`,JSON.stringify(report,null,2));
  await page.getByTestId('pedestrian-image-result').screenshot({path:`${folder}/${sample.id}-browser.png`});
  outputs.push(report);console.log(JSON.stringify(report));
 }
 expect(errors).toEqual([]);
 await writeFile(`${folder}/browser-summary.json`,JSON.stringify(outputs,null,2));
}finally{await browser.close();}
