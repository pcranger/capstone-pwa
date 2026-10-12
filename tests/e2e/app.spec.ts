import { test, expect, type Page } from "@playwright/test";
test.beforeEach(async ({ page }, info) => {
  if (!info.title.startsWith("live "))
    await page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = async () => {
        throw new DOMException("Denied", "NotAllowedError");
      };
    });
  await page.goto("/");
});
async function settings(page: Page) {
  await page.getByRole("button", { name: "Settings", exact: true }).click();
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}
test("phone home has only the original collapsed camera controls", async ({
  page,
}) => {
  await expect(
    page.getByRole("heading", { name: "CrossWise", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "More controls", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Show map", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Close full-screen map", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Start camera assistance", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText("Try practice", { exact: true })).toHaveCount(0);
  await noOverflow(page);
});
test("camera controls expand and collapse without changing screens", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "More controls", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Start camera assistance", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Hide controls", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "More controls", exact: true }),
  ).toBeVisible();
});
test("settings preserves the original sections and collapsed disclosures", async ({
  page,
}) => {
  await settings(page);
  await expect(
    page.getByRole("heading", { name: "Settings", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Settings", exact: true }),
  ).toHaveCount(0);
  const manual = page.getByRole("button", {
    name: "Voice manual",
    exact: true,
  });
  await expect(manual).toHaveAttribute("aria-expanded", "false");
  await manual.click();
  await expect(manual).toHaveAttribute("aria-expanded", "true");
  await manual.click();
  const precautions = page.getByRole("button", {
    name: "Precautions",
    exact: true,
  });
  await precautions.click();
  await expect(precautions).toHaveAttribute("aria-expanded", "true");
  await precautions.click();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Settings", exact: true }),
  ).toBeVisible();
});
test("guide and practice return to Settings and keep home controls intact", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "More controls", exact: true })
    .click();
  await settings(page);
  await page
    .getByRole("button", { name: "How to use CrossWise", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Map and saved places", exact: false }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Back to Settings", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Practice the cues", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Test microphone", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Back to Settings", exact: true })
    .click();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Hide controls", exact: true }),
  ).toBeVisible();
});
test("phone Back follows the screen hierarchy", async ({ page }) => {
  await settings(page);
  await page
    .getByRole("button", { name: "Practice the cues", exact: true })
    .click();
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Settings", exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole("button", { name: "Settings", exact: true }),
  ).toBeVisible();
});
test("map drawer expands, searches truthfully, and returns to camera", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Show map", exact: true }).click();
  await expect(
    page.getByText(
      "Map unavailable in this build. Camera assistance remains available.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Settings", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Expand destination panel", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Collapse destination panel",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Destination name and suburb", exact: true })
    .fill("Library Sydney");
  await page
    .getByRole("button", { name: "Search places", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Walking routes are not configured",
  );
  await page
    .getByRole("button", { name: "Close full-screen map", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Show map", exact: true }),
  ).toBeVisible();
  await noOverflow(page);
});
test("preferences persist and developer mode exposes original tools", async ({
  page,
}) => {
  await settings(page);
  await page.getByRole("switch", { name: "Speech", exact: true }).click();
  await page.getByRole("tab", { name: "Developer mode", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "VEHICLE BOXES", exact: true }),
  ).toBeVisible();
  await page.reload();
  await settings(page);
  await expect(
    page.getByRole("switch", { name: "Speech", exact: true }),
  ).not.toBeChecked();
  await expect(
    page.getByRole("tab", { name: "Developer mode", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "User mode", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "VEHICLE BOXES", exact: true }),
  ).toHaveCount(0);
});
test("voice failure offers the same recovery and help navigation", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "SpeechRecognition", {
      value: undefined,
      configurable: true,
    });
  });
  await page.reload();
  await page.getByRole("button", { name: "Voice", exact: true }).click();
  await expect(
    page
      .getByText(
        "Offline English recognition is unavailable in this browser.",
        { exact: true },
      )
      .first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Voice help", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Settings", exact: true }),
  ).toBeVisible();
});
test("denied camera remains retryable and cannot start blind assistance", async ({
  page,
}) => {
  await expect(
    page.getByRole("button", { name: "Allow camera", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Allow camera", exact: true }).click();
  await page
    .getByRole("button", { name: "More controls", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Start camera assistance", exact: true })
    .click();
  await expect(
    page.getByText("Detection unavailable.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "I’m crossing", exact: true }),
  ).toHaveCount(0);
});
test("offline reload includes original phone screens and all model shards", async ({
  page,
  context,
}) => {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((r) =>
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          () => r(),
          { once: true },
        ),
      );
  });
  await context.setOffline(true);
  await page.reload();
  await settings(page);
  await page
    .getByRole("button", { name: "Practice the cues", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Test microphone", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(async () => {
      const model = await (await fetch("/models/model.json")).json();
      const paths = model.weightsManifest.flatMap(
        (g: { paths: string[] }) => g.paths,
      );
      return (
        await Promise.all(
          paths.map(async (p: string) => (await fetch("/models/" + p)).ok),
        )
      ).every(Boolean);
    }),
  ).toBe(true);
});
test("phone screens fit small widths without horizontal scrolling", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await noOverflow(page);
  await settings(page);
  await noOverflow(page);
  await page.screenshot({
    path: `artifacts/settings-${info.project.name}.png`,
  });
  await page
    .getByRole("button", { name: "Practice the cues", exact: true })
    .click();
  await noOverflow(page);
});
test("live camera runs local detection and preserves crossing through overlays", async ({
  page,
  browserName,
}) => {
  test.skip(
    browserName === "webkit",
    "WebKit test runner has no fake camera; real-device camera validation remains required.",
  );
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page
    .getByRole("button", { name: "More controls", exact: true })
    .click();
  await expect
    .poll(
      async () => {
        await page
          .getByRole("button", { name: "Start camera assistance", exact: true })
          .click();
        return page
          .getByRole("button", { name: "I’m crossing", exact: true })
          .count();
      },
      { timeout: 45000, intervals: [1000] },
    )
    .toBe(1);
  const rendered = page.locator('canvas[data-camera-renderer]');
  await expect(rendered).toBeVisible();
  await expect.poll(async () => Number(await rendered.getAttribute('data-rendered-frames'))).toBeGreaterThan(0);
  await expect(rendered).toHaveAttribute('data-camera-renderer', /three-(webgpu|webgl)/);
  await page.getByRole("button", { name: "I’m crossing", exact: true }).click();
  await page
    .getByRole("button", { name: "Hide controls", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "I’m on the footpath", exact: true }),
  ).toBeVisible();
  const video = await page.locator("video").evaluateHandle((v) => v);
  await settings(page);
  await page.getByRole("button", { name: "Back", exact: true }).click();
  expect(
    await page
      .locator("video")
      .evaluate((v, original) => v === original, video),
  ).toBe(true);
  await expect(
    page.getByRole("button", { name: "I’m on the footpath", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "I’m on the footpath", exact: true })
    .click();
  await page
    .getByRole("button", { name: "More controls", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Stop assistance", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Start camera assistance", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("live offline camera inference reloads from the PWA cache", async ({
  page,
  context,
  browserName,
}) => {
  test.skip(browserName === "webkit", "No WebKit fake camera.");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((r) =>
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          () => r(),
          { once: true },
        ),
      );
  });
  await context.setOffline(true);
  await page.reload();
  await page
    .getByRole("button", { name: "More controls", exact: true })
    .click();
  await expect
    .poll(
      async () => {
        await page
          .getByRole("button", { name: "Start camera assistance", exact: true })
          .click();
        return page
          .getByRole("button", { name: "I’m crossing", exact: true })
          .count();
      },
      { timeout: 45000, intervals: [1000] },
    )
    .toBe(1);
});
test("live backgrounding releases the camera and retains explicit footpath completion", async ({
  page,
  browserName,
}) => {
  test.skip(browserName === "webkit", "No WebKit fake camera.");
  await page
    .getByRole("button", { name: "More controls", exact: true })
    .click();
  await expect
    .poll(
      async () => {
        await page
          .getByRole("button", { name: "Start camera assistance", exact: true })
          .click();
        return page
          .getByRole("button", { name: "I’m crossing", exact: true })
          .count();
      },
      { timeout: 45000, intervals: [1000] },
    )
    .toBe(1);
  await page.getByRole("button", { name: "I’m crossing", exact: true }).click();
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(
    await page.locator("video").evaluate((v: HTMLVideoElement) => v.srcObject),
  ).toBeNull();
  await expect(
    page.getByRole("button", { name: "I’m on the footpath", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "I’m on the footpath", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "I’m on the footpath", exact: true }),
  ).toHaveCount(0);
});
test.describe("model download recovery", () => {
  test.use({ serviceWorkers: "block" });
  test("live failed model releases camera and retry restores inference", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName === "webkit", "No WebKit fake camera.");
    await page.route("**/models/model.json", (r) =>
      r.fulfill({ status: 503, body: "Unavailable" }),
    );
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Retry camera", exact: true }),
    ).toBeVisible({ timeout: 30000 });
    expect(
      await page
        .locator("video")
        .evaluate((v: HTMLVideoElement) => v.srcObject),
    ).toBeNull();
    await page.unroute("**/models/model.json");
    await page
      .getByRole("button", { name: "Retry camera", exact: true })
      .click();
    await page
      .getByRole("button", { name: "More controls", exact: true })
      .click();
    await expect
      .poll(
        async () => {
          await page
            .getByRole("button", {
              name: "Start camera assistance",
              exact: true,
            })
            .click();
          return page
            .getByRole("button", { name: "I’m crossing", exact: true })
            .count();
        },
        { timeout: 45000, intervals: [1000] },
      )
      .toBe(1);
  });
});

test.describe('configured route integration',()=>{
 test.use({serviceWorkers:'block'});
 test('configured route starts without drawer close cancelling it, then pauses and resumes',async({page})=>{
 await page.route('**/api/config',r=>r.fulfill({json:{mapsProxyEnabled:true,mapsBrowserKey:''}}));
 await page.route('**/api/maps/search',r=>r.fulfill({json:{places:[{id:'test-library',displayName:{text:'Test Library'},formattedAddress:'Sydney',location:{latitude:-33.873,longitude:151.207}}]}}));
 const points=[{latitude:-33.8731,longitude:151.2065},{latitude:-33.873,longitude:151.207}];
 function encode(values:typeof points){let lat=0,lng=0,out='';for(const p of values){const a=Math.round(p.latitude*1e5),b=Math.round(p.longitude*1e5);for(const delta of [a-lat,b-lng]){let v=delta<0?~(delta<<1):delta<<1;while(v>=32){out+=String.fromCharCode((32|(v&31))+63);v>>=5;}out+=String.fromCharCode(v+63);}lat=a;lng=b;}return out;}
 const polyline={encodedPolyline:encode(points)};
 await page.route('**/api/maps/route',r=>r.fulfill({json:{routes:[{polyline,distanceMeters:50,duration:'60s',legs:[{steps:[{polyline,distanceMeters:50,navigationInstruction:{instructions:'Head east to Test Library',maneuver:'DEPART'}}]}]}]}}));
 await page.addInitScript(()=>{navigator.geolocation.getCurrentPosition=success=>success({coords:{latitude:-33.8731,longitude:151.2065,accuracy:5},timestamp:Date.now()} as GeolocationPosition);navigator.geolocation.watchPosition=()=>1;navigator.geolocation.clearWatch=()=>{};});
 await page.reload();await page.getByRole('button',{name:'More controls',exact:true}).click();await page.getByRole('button',{name:'Show map',exact:true}).click();await page.getByRole('textbox',{name:'Destination name and suburb',exact:true}).fill('Test Library Sydney');await page.getByRole('button',{name:'Search places',exact:true}).click();await page.getByRole('button',{name:/^1\. Test Library/}).click();await page.getByRole('button',{name:'Confirm place',exact:true}).click();await page.getByRole('button',{name:'Start journey',exact:true}).click();
 await expect(page.getByRole('button',{name:'Pause',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Close full-screen map',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Pause',exact:true}).click();await expect(page.getByRole('button',{name:'Resume',exact:true})).toBeVisible();await page.getByRole('button',{name:'Resume',exact:true}).click();await expect(page.getByRole('button',{name:'Pause',exact:true})).toBeVisible();await page.getByRole('button',{name:'Pause',exact:true}).click();await page.getByRole('button',{name:'End journey',exact:true}).click();await expect(page.getByRole('button',{name:'Start camera assistance',exact:true})).toBeVisible();
});

});

for(const cpu of [false,true]) test(`live ${cpu?'CPU option':'WebGPU unavailable fallback'} retains camera assistance`,async({page,browserName})=>{
 test.skip(browserName==='webkit','WebKit runner has no synthetic camera.');
 await page.addInitScript(({cpu})=>{
  if(cpu)localStorage.setItem('crosswise_settings',JSON.stringify({useGpu:false}));
  else Object.defineProperty(navigator,'gpu',{value:undefined,configurable:true});
 },{cpu});
 await page.reload();
 await page.getByRole('button',{name:'More controls',exact:true}).click();
 await expect.poll(async()=>{await page.getByRole('button',{name:'Start camera assistance',exact:true}).click();return page.getByRole('button',{name:'I’m crossing',exact:true}).count();},{timeout:45000,intervals:[1000]}).toBe(1);
 const rendered=page.locator('canvas[data-camera-renderer]');await expect.poll(async()=>Number(await rendered.getAttribute('data-rendered-frames'))).toBeGreaterThan(0);
 if(!cpu)await expect(rendered).toHaveAttribute('data-camera-renderer','three-webgl');
});

test('live iPhone texture workaround preserves portrait and landscape frame orientation',async({page,browserName})=>{
 test.skip(browserName==='webkit','Synthetic captureStream is unavailable in the WebKit runner; physical iPhone confirmation is required.');
 await page.setViewportSize({width:390,height:844});
 await page.addInitScript(()=>{
  Object.defineProperty(navigator,'userAgent',{value:'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X)',configurable:true});
  navigator.mediaDevices.getUserMedia=async()=>{
   const source=document.createElement('canvas');source.width=240;source.height=400;
   const context=source.getContext('2d')!;
   const draw=()=>{const w=source.width/2,h=source.height/2;for(const [x,y,color] of [[0,0,'#ff0000'],[1,0,'#00ff00'],[0,1,'#0000ff'],[1,1,'#ffff00']] as const){context.fillStyle=color;context.fillRect(x*w,y*h,w,h);}requestAnimationFrame(draw);};draw();
   (window as unknown as {orientationFixture:HTMLCanvasElement}).orientationFixture=source;
   return source.captureStream(30);
  };
 });
 await page.reload();
 const canvas=page.locator('canvas[data-camera-renderer]');
 await expect(canvas).toHaveAttribute('data-camera-source','oriented-canvas');
 await expect.poll(async()=>Number(await canvas.getAttribute('data-rendered-frames'))).toBeGreaterThan(3);
 const colors=async()=>{
  const png=await canvas.screenshot();
  return page.evaluate(async base64=>{
   const binary=atob(base64),bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));const bitmap=await createImageBitmap(new Blob([bytes],{type:'image/png'}));
   const sample=document.createElement('canvas');sample.width=bitmap.width;sample.height=bitmap.height;const ctx=sample.getContext('2d')!;ctx.drawImage(bitmap,0,0);
   return [[.08,.40],[.92,.40],[.08,.70],[.92,.70]].map(([x,y])=>Array.from(ctx.getImageData(Math.floor(bitmap.width*x),Math.floor(bitmap.height*y),1,1).data).slice(0,3));
  },png.toString('base64'));
 };
 await expect.poll(colors).toEqual([[255,0,0],[0,255,0],[0,0,255],[255,255,0]]);
 await page.evaluate(()=>{const source=(window as unknown as {orientationFixture:HTMLCanvasElement}).orientationFixture;source.width=400;source.height=240;});
 await expect.poll(colors).toEqual([[255,0,0],[0,255,0],[0,0,255],[255,255,0]]);
});
