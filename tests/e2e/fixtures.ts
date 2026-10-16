import { test as base } from '@playwright/test';
export { expect, type Page, type Locator } from '@playwright/test';
// Most flow tests model a returning user whose browser permissions are already granted.
// Permission-specific cases override this before navigation to exercise real setup states.
export const test=base.extend({page:async({page},use)=>{
  await page.addInitScript(()=>{
    Object.defineProperty(navigator,'permissions',{configurable:true,value:{query:async()=>({state:'granted',addEventListener(){},removeEventListener(){}})}});
    if(window.DeviceOrientationEvent)Object.defineProperty(window.DeviceOrientationEvent,'requestPermission',{configurable:true,value:undefined});
  });
  await use(page);
}});
