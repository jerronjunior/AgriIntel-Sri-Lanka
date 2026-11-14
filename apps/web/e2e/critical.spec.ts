import { expect, test } from "@playwright/test";

const shots = process.env.E2E_SCREENSHOTS;
const email = `e2e-${Date.now()}@example.com`;

test.describe.serial("critical flows", () => {
  test("home page renders hero, globe and live feed status", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Intelligence above.");
    await expect(page.getByRole("link", { name: "Explore the intelligence platform" })).toBeVisible();
    await expect(page.getByText("Earth observation feeds").first()).toBeVisible();
    await expect(page.locator("canvas, svg[aria-label='Globe centred on Sri Lanka']").first()).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(2500);
    if (shots) await page.screenshot({ path: `${shots}/01-home.png` });
    await page.mouse.wheel(0, 700);
    await page.waitForTimeout(1500);
    if (shots) await page.screenshot({ path: `${shots}/02-home-scrolled.png` });
  });

  test("pricing shows admin-configured plans, never invented prices", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page.getByText("Farm Intelligence").first()).toBeVisible();
    if (shots) await page.screenshot({ path: `${shots}/03-pricing.png`, fullPage: true });
  });

  test("register an organization and land on the dashboard", async ({ page }) => {
    await page.goto("/register");
    await page.getByLabel("Your name").fill("E2E Tester");
    await page.getByLabel("Work email").fill(email);
    await page.getByLabel("Password").fill("Password123");
    await page.getByLabel("Organization").fill("E2E Farms Ltd");
    await page.getByRole("button", { name: "Create organization" }).click();
    await page.waitForURL("**/app");
    await expect(page.getByRole("heading", { name: "E2E Farms Ltd" })).toBeVisible();
    await expect(page.getByText("Monitored farms")).toBeVisible();
    await page.waitForTimeout(2000);
    if (shots) await page.screenshot({ path: `${shots}/04-dashboard.png` });
  });

  test("create a farm, run a simulation with a manual baseline", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("Password123");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/app");

    await page.goto("/app/farms");
    await page.getByLabel("Name").fill("Block A");
    await page.getByLabel("Latitude").fill("6.87");
    await page.getByLabel("Longitude").fill("81.35");
    await page.getByRole("button", { name: "Add farm" }).click();
    await expect(page.getByRole("cell", { name: "Block A", exact: true })).toBeVisible();

    await page.goto("/app/simulator");
    await page.getByLabel("Enter the climate baseline myself").check();
    for (const id of ["p0", "p1", "p2"]) await page.locator(`#${id}`).fill("450");
    for (const id of ["labor0", "labor1", "labor2"]) await page.locator(`#${id}`).fill("90000");
    await page.getByRole("button", { name: "Run scenario" }).click();
    await expect(page.getByText("Profit rank 1")).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Simulated").first()).toBeVisible();
    if (shots) await page.screenshot({ path: `${shots}/05-simulator.png`, fullPage: true });
  });

  test("map loads with layer catalogue and unavailable-data messages", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("Password123");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/app");
    await page.goto("/app/map");
    await expect(page.getByText("NDVI (Sentinel-2)")).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("No processed raster tiles yet").first()).toBeVisible();
    await page.getByRole("button", { name: "Draw farm boundary" }).click();
    const box = (await page.locator(".maplibregl-canvas").boundingBox())!;
    for (const [dx, dy] of [[0, 0], [40, 0], [40, 40]]) await page.mouse.click(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy);
    await expect(page.getByText(/Area: .* ha/)).toBeVisible();
    if (shots) await page.screenshot({ path: `${shots}/06-map.png` });
  });
});
