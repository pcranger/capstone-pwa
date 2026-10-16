import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  outputDir: process.env.PRESENTER_TESTS ? "test-results-presenter" : "test-results-demo",
  fullyParallel: false,
  testMatch: process.env.PRESENTER_TESTS ? ["**/app.spec.ts","**/localTools.spec.ts","**/accessibility.spec.ts"] : ["**/productShell.spec.ts","**/places.spec.ts","**/demoCamera.spec.ts","**/pedestrian.spec.ts","**/pedestrianVehicleExclusion.spec.ts","**/accessibility.spec.ts"],
  timeout: 60000,
  expect: { timeout: 10000 },
  reporter: [["list"], ["html", { open: "never", outputFolder: process.env.PRESENTER_TESTS ? "playwright-report-presenter" : "playwright-report" }]],
  use: {
    baseURL: process.env.PRESENTER_TESTS ? "http://localhost:4174" : "http://localhost:4173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          channel: "chrome",
          args: [
            "--use-fake-device-for-media-stream",
            "--use-fake-ui-for-media-stream",
          ],
        },
      },
    },
    {
      name: "mobile-chromium",
      use: {
        ...devices["Pixel 7"],
        launchOptions: {
          channel: "chrome",
          args: [
            "--use-fake-device-for-media-stream",
            "--use-fake-ui-for-media-stream",
          ],
        },
      },
    },
    {
      name: "iphone-webkit",
      use: { ...devices["iPhone 13"], browserName: "webkit" },
    },
  ],
  webServer: {
    command: process.env.PRESENTER_TESTS ? "npm run preview -- --outDir dist-presenter --port 4174" : "npm run preview -- --port 4173",
    url: process.env.PRESENTER_TESTS ? "http://localhost:4174" : "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
  },
});
