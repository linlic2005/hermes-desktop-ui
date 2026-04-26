import { Page } from "@playwright/test";

export async function seedConnection(page: Page, token = "test-token") {
  await page.addInitScript(({ seededToken }) => {
    window.localStorage.setItem(
      "hermes-connections",
      JSON.stringify({
        state: {
          connections: [
            {
              id: "e2e-local",
              name: "E2E Local Hermes",
              mode: "local",
              apiBaseUrl: "http://127.0.0.1:9788",
              wsBaseUrl: "ws://127.0.0.1:9788",
              dashboardUrl: "http://127.0.0.1:9119",
              token: seededToken,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
          activeConnectionId: "e2e-local",
        },
        version: 0,
      }),
    );
  }, { seededToken: token });
}
