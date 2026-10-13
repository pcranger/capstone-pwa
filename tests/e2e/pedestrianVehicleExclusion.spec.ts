import {test,expect} from '@playwright/test';
import {resolve} from 'node:path';
import {readFileSync} from 'node:fs';
const cases:{id:string;file:string;expected:'RED'|'GREEN'|null}[]=JSON.parse(readFileSync(new URL('../fixtures/pedestrian/vehicle-exclusion/cases.json',import.meta.url),'utf8'));

test.describe('pedestrian verification against real street and vehicle-light images',()=>{
  test.setTimeout(120000);
  for(const sample of cases)test(`${sample.id} retains only the expected pedestrian signal`,async({page})=>{
    const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto('/');await page.getByRole('button',{name:'Agree and continue',exact:true}).click();
    await page.getByRole('button',{name:'Help',exact:true}).click();await page.getByText('Check a reference image',{exact:true}).click();
    await page.getByLabel('Pedestrian reference image',{exact:true}).setInputFiles(resolve('tests/fixtures/pedestrian/vehicle-exclusion',sample.file));
    await expect(page.getByRole('status')).toHaveText(sample.expected?'Image check complete.':'No supported pedestrian signal, countdown or button found.',{timeout:90000});
    const result=page.getByTestId('pedestrian-image-result');
    await expect(result.getByTestId('pedestrian-box-signal')).toHaveCount(sample.expected?1:0);
    await expect(result.getByTestId('pedestrian-box-countdown')).toHaveCount(0);
    if(sample.expected){
      await expect(result).toContainText(sample.expected==='RED'?'Red pedestrian':'Green pedestrian');
      await expect(result).not.toContainText(sample.expected==='RED'?'Green pedestrian':'Red pedestrian');
    }
    expect(errors).toEqual([]);
  });
});
