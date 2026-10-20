import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests",
  testMatch: "**/*.spec.ts",
  timeout: 20_000,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://127.0.0.1:8080",
    trace: "retain-on-failure",
    // PW_CHROMIUM: usar un Chromium ya instalado (entornos sin descarga de navegadores). En CI no se usa.
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
  webServer: {
    command: "npx http-server site -p 8080 -c-1 -s",
    url: "http://127.0.0.1:8080",
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    { name: "mobile-small", use: { ...devices["iPhone SE"], defaultBrowserType: "chromium" } },
  ],
});
