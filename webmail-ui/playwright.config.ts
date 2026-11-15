import { defineConfig } from "@playwright/test";
import path from "node:path";
const output = process.env.MAILBOX_BROWSER_OUTPUT;
if (!output || !path.resolve(output).startsWith(path.resolve("..") + path.sep))
  throw Error("Set MAILBOX_BROWSER_OUTPUT inside the checkout");
export default defineConfig({
  timeout:60000,
  testDir: "tests/frontend",
  outputDir: output,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: process.env.MAILBOX_BROWSER_URL,
    ignoreHTTPSErrors: true,
    launchOptions: {
      executablePath:
        process.env.MAILBOX_CHROME ||
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      args: ["--disable-dev-shm-usage"],
    },
    screenshot: "only-on-failure",
    trace: "off",
  },
});
