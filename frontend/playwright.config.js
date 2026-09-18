export default {
  testDir: "./tests/e2e",
  use: {
    baseURL: "http://localhost:3000",
    headless: true,
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    trace: "retain-on-failure",
    actionTimeout: 5000,
    navigationTimeout: 10000,
  },
  projects: [
    {
      name: "Chromium",
      use: { browserName: "chromium", hasTouch: true },
    },
    {
      name: "Firefox",
      use: { browserName: "firefox", hasTouch: true },
    },
  ],
  // Serial: Die CatchUp-Tests legen Chores in der geteilten Test-DB an; parallele
  // Worker würden sich gegenseitig in den CatchUp-Stack einmischen (flaky).
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 30000,
  reporter: "list",
};
