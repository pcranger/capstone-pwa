import { test, expect, type Page, type Locator } from './fixtures';

test.use({ serviceWorkers: 'block' });

async function setup(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'SpeechRecognition', { value: undefined, configurable: true });
    localStorage.setItem('crosswise_product_preferences_v1', JSON.stringify({version:1, termsVersion:'2026-10-13'}));
    localStorage.setItem('crosswise_permission_setup_v1', 'done');
    Object.defineProperty(navigator, 'geolocation', { configurable:true, value:{
      getCurrentPosition:(ok:(p:unknown)=>void)=>ok({coords:{latitude:-33.87,longitude:151.2,accuracy:5},timestamp:Date.now()}),
      watchPosition:()=>1, clearWatch:()=>{},
    }});
    navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('Denied','NotAllowedError');};
  });
  await page.route('**/api/config', r=>r.fulfill({json:{mapsProxyEnabled:true,mapsBrowserKey:''}}));
  await page.goto('/');
  await expect(page.getByRole('heading', {name:'CrossWise',exact:true})).toBeFocused();
}

// Traverse the actual tab order; calling locator.focus() would conceal inaccessible controls.
async function reach(page: Page, target: Locator) {
  await expect(target).toBeVisible();
  for (let i=0;i<100;i++) {
    if (await target.evaluate(node=>node===document.activeElement)) return;
    await page.keyboard.press('Tab');
  }
  await expect(target).toBeFocused();
}
async function activate(page: Page, target: Locator) {
  await reach(page,target); await page.keyboard.press('Enter');
}
function button(page: Page, name: string | RegExp) { return page.getByRole('button',{name,exact:typeof name==='string'}); }
async function namedControls(page: Page) {
  const controls=page.getByRole('button').or(page.getByRole('textbox')).or(page.getByRole('switch')).or(page.getByRole('radio')).or(page.getByRole('slider')).or(page.getByRole('tab'));
  for (const control of await controls.all()) await expect(control).toHaveAccessibleName(/\S/);
}

test('keyboard walking controls, map focus, camera description and dialog return',async({page})=>{
  await setup(page);
  await activate(page,button(page,'Road crossing'));
  await expect(page.getByTestId('walking-heading')).toBeFocused();
  await namedControls(page);
  await activate(page,button(page,'Describe camera view'));
  await expect(page.getByText(/No current image observations/)).toBeVisible();
  await activate(page,button(page,'Show map'));
  await expect(page.getByTestId('walking-map-title')).toBeFocused();
  await expect(button(page,'Describe camera view')).toHaveCount(0);
  await activate(page,button(page,'Expand walking panel'));
  await expect(button(page,'Collapse walking panel')).toHaveAttribute('aria-expanded','true');
  await page.keyboard.press('Escape');
  await expect(button(page,'Expand walking panel')).toHaveAttribute('aria-expanded','false');
  await page.keyboard.press('Escape');
  await expect(button(page,'Show map')).toBeFocused();
  await expect(page.getByRole('navigation',{name:'Walking tools'})).toBeVisible();
  await activate(page,button(page,'End walk'));
  const dialog=page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  for(let i=0;i<6;i++) { await page.keyboard.press('Tab'); expect(await dialog.evaluate(node=>node.contains(document.activeElement))).toBe(true); }
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(button(page,'End walk')).toBeFocused();
  await reach(page,button(page,'Home'));
  await reach(page,button(page,'End walk'));
  await activate(page,button(page,'Home'));
  await expect(page.getByRole('heading',{name:'CrossWise',exact:true})).toBeFocused();
});

test('keyboard destination registration, textual route and arrival without opening map',async({page})=>{
  await setup(page);
  await page.route('**/api/maps/route',r=>r.fulfill({json:{routes:[{
    polyline:{encodedPolyline:'nfvmE_gzy[cB?'}, distanceMeters:60,duration:'60s',
    legs:[{steps:[{polyline:{encodedPolyline:'nfvmE_gzy[cB?'},distanceMeters:60,navigationInstruction:{instructions:'Head north along the footpath',maneuver:'DEPART'}}]}],
  }]}}));
  await activate(page,button(page,'Route guidance'));
  await activate(page,page.getByText('Advanced location editing',{exact:true}));
  await activate(page,button(page,'Enter destination coordinates'));
  for(const [label,value] of [['Destination name','Accessible entrance'],['Latitude','-33.8695'],['Longitude','151.2']]) {
    await reach(page,page.getByLabel(label,{exact:true})); await page.keyboard.press('ControlOrMeta+A'); await page.keyboard.type(value);
  }
  await namedControls(page);
  await activate(page,button(page,'Confirm location'));
  await activate(page,button(page,'OK'));
  await activate(page,button(page,/^Accessible entrance.*User/));
  await activate(page,button(page,'Edit location'));
  await activate(page,button(page,'Move North'));
  await expect(page.getByRole('status').filter({hasText:'Moved 5 metres north'})).toBeVisible();
  await activate(page,button(page,'Confirm location'));
  await activate(page,button(page,'OK'));
  await activate(page,button(page,/^Accessible entrance.*User/));
  await activate(page,button(page,'Confirm place and review route'));
  await expect(page.getByRole('status').filter({hasText:'Route ready'})).toBeVisible();
  await activate(page,page.getByText('Review all instructions',{exact:true}));
  await expect(page.getByText('Head north along the footpath',{exact:false}).first()).toBeVisible();
  await activate(page,button(page,'Start journey'));
  await expect(page.getByTestId('walking-heading')).toBeFocused();
  await namedControls(page);
  await activate(page,button(page,'I am at my destination'));
  await expect(page.getByRole('heading',{name:'Journey completed',exact:true})).toBeFocused();
});

test('search, nearby and help expose named controls and readable results',async({page})=>{
  await setup(page);
  await page.route('**/api/maps/search',r=>r.fulfill({json:{places:[{id:'library',displayName:{text:'Town Library'},formattedAddress:'Test Street',location:{latitude:-33.8695,longitude:151.2}}]}}));
  await activate(page,button(page,'Route guidance'));
  await activate(page,button(page,'Search destination'));
  await reach(page,page.getByLabel('Place name or address')); await page.keyboard.type('Town Library');
  await activate(page,button(page,'Search'));
  await expect(page.getByRole('status').filter({hasText:'1 destination'})).toBeVisible();
  await namedControls(page);
  await activate(page,button(page,/^1\. Town Library/));
  await expect(page.getByRole('heading',{name:'Confirm place',exact:true})).toBeFocused();
  await page.reload();
  await expect(page.getByRole('heading',{name:'CrossWise',exact:true})).toBeFocused();
  await activate(page,button(page,'Settings'));
  await activate(page,button(page,/^Nearby facilities.*Radius/));
  await namedControls(page);
  await reach(page,page.getByRole('radio',{checked:true})); await page.keyboard.press('Home');
  for(let i=0;i<4&&!await page.getByRole('radio',{name:'50 metres',exact:true}).isChecked();i++) await page.keyboard.press('ArrowUp');
  await expect(page.getByRole('radio',{name:'50 metres',exact:true})).toBeChecked();
  await page.route('**/api/maps/nearby',r=>r.fulfill({json:{places:[{id:'cafe',displayName:{text:'Corner Cafe'},location:{latitude:-33.8698,longitude:151.2},types:['restaurant']}]}}));
  await activate(page,button(page,'View nearby places'));
  await activate(page,button(page,'Refresh nearby places'));
  await expect(page.getByRole('status').filter({hasText:'1 nearby places'})).toBeVisible();
  await namedControls(page);
  await activate(page,button(page,/^1\. Corner Cafe/));
  await expect(button(page,'Save destination')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading',{name:'CrossWise',exact:true})).toBeFocused();
  await activate(page,button(page,'Help'));
  await expect(page.getByRole('heading',{name:'Using a screen reader'})).toBeVisible();
  await namedControls(page);
});

test('presenter switches and radios accept Space; assistive slider changes persist',async({page})=>{
  test.skip(!process.env.PRESENTER_TESTS,'Presenter build only');
  await setup(page);
  await activate(page,button(page,'Presenter setup'));
  await activate(page,button(page,/Advanced/));
  await namedControls(page);
  await reach(page,page.getByRole('tab',{name:'Developer mode',exact:true})); await page.keyboard.press('Space');
  await expect(page.getByRole('tab',{name:'Developer mode',exact:true})).toHaveAttribute('aria-selected','true');
  const speech=page.getByRole('switch',{name:'Speech',exact:true});
  await reach(page,speech); const before=await speech.getAttribute('aria-checked'); await page.keyboard.press('Space');
  await expect(speech).toHaveAttribute('aria-checked',before==='true'?'false':'true');
  await reach(page,page.getByRole('radio',{name:'Detailed',exact:true})); await page.keyboard.press('Space');
  await expect(page.getByRole('radio',{name:'Detailed',exact:true})).toBeChecked();
  const slider=page.getByRole('slider',{name:'Speech rate',exact:true});
  await slider.evaluate(node=>{
    const input=node as HTMLInputElement;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,'1.2');
    input.dispatchEvent(new Event('input',{bubbles:true}));
  });
  await expect(slider).toHaveAttribute('aria-valuetext','1.2×');
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('crosswise_settings')??'{}').speechRate)).toBe(1.2);
});
