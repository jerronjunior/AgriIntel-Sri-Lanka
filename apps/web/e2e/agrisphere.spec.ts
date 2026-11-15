import { expect, test } from "@playwright/test";

test.describe("AgriSphere district intelligence", () => {
  test("drill down province → district → modules → copilot, and back with Escape", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/agrisphere");
    await page.getByRole("button", { name: /^Uva Province/ }).click();
    await expect(page.getByRole("heading", { name: "Uva Province" })).toBeVisible();
    await page.getByRole("button", { name: /^Monaragala District/ }).click();
    await expect(page.getByRole("heading", { name: "Monaragala" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Agricultural Opportunity Score" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Decision package" })).toBeVisible();
    for (const t of ["Water", "Soil", "Crops", "Yield & profit", "Market", "Export", "Insurance", "Lending"]) {
      await page.getByRole("tab", { name: t, exact: true }).click();
      await expect(page.getByRole("tabpanel")).toBeVisible();
    }
    await page.getByRole("tab", { name: "Copilot" }).click();
    await page.getByRole("button", { name: /What should I cultivate in Monaragala/ }).click();
    await expect(page.getByText(/Recommended for Monaragala/)).toBeVisible();
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("heading", { name: /season across Sri Lanka/ })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("works on a phone-sized screen", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/agrisphere");
    await page.getByRole("button", { name: /^North Central Province/ }).click();
    await page.getByRole("button", { name: /^Polonnaruwa District/ }).click();
    await expect(page.getByRole("heading", { name: "Polonnaruwa" })).toBeVisible();
  });
});
