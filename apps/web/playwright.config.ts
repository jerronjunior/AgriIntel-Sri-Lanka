import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    viewport: { width: 1440, height: 900 },
    // Use a system Chrome when PLAYWRIGHT_CHROME is set (CI images can use the bundled browser instead).
    ...(process.env.PLAYWRIGHT_CHROME ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROME, args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"] } } : {}),
  },
  reporter: [["list"]],
});
