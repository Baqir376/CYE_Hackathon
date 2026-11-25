import { defineConfig, devices } from "@playwright/test";
import os from "node:os";
import path from "node:path";

const API = "http://127.0.0.1:18766";
const py = process.env.PYTHON || (process.platform === "win32" ? ".venv\\Scripts\\python.exe" : ".venv/bin/python");

/** Runs against a production build and a private backend with no AI key and a throwaway data folder. */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 15_000, toHaveScreenshot: { maxDiffPixelRatio: 0.02 } },
  workers: 3,
  retries: 0,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:3100", trace: "retain-on-failure" },
  webServer: [
    {
      command: `${py} -W ignore -m uvicorn app.main:app --host 127.0.0.1 --port 18766`,
      cwd: path.join(__dirname, "..", "backend"),
      url: `${API}/api/health`,
      env: { ...process.env, GROQ_API_KEY: "", LLM_API_KEY: "", SUPABASE_URL: "", SUPABASE_SERVICE_ROLE_KEY: "", CORS_ORIGINS: "http://localhost:3100",
        DATA_DIR: path.join(os.tmpdir(), `credence-e2e-${Date.now()}`) } as Record<string, string>,
    },
    {
      command: "npx next build && npx next start -p 3100",
      url: "http://localhost:3100",
      timeout: 240_000,
      env: { ...process.env, NEXT_DIST_DIR: ".next-e2e", NEXT_PUBLIC_API_URL: API } as Record<string, string>,
    },
  ],
  projects: [
    { name: "chrome", use: { ...devices["Desktop Chrome"], channel: "chrome", viewport: { width: 1440, height: 900 } } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] }, testMatch: /(journey|smoke)\.spec/ },
    { name: "safari-engine", use: { ...devices["Desktop Safari"] }, testMatch: /(journey|smoke)\.spec/ },
    { name: "phone", use: { ...devices["Pixel 7"], channel: "chrome" }, testMatch: /(journey|smoke|a11y)\.spec/ },
  ],
});
