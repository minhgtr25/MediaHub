import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  outputDir: "../.qa/browser-results",
  timeout: 30000,
  expect: { timeout: 8000 },
  fullyParallel: true,
  workers: 2,
  reporter: [["list"], ["json", { outputFile: "../.qa/browser-results.json" }]],
  use: {
    baseURL: "http://127.0.0.1:5178",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 1000 } } },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 5178 --strictPort",
    url: "http://127.0.0.1:5178",
    reuseExistingServer: false,
    env: {
      VITE_SUPABASE_URL: "http://127.0.0.1:54321",
      VITE_SUPABASE_ANON_KEY: "local-browser-test-only",
      VITE_SUPABASE_PUBLISHABLE_KEY: "local-browser-test-only",
      VITE_API_BASE_URL: "/api",
    },
  },
});
