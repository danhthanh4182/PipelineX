// Failure mode: WeChat's in-app browser cannot save downloads, so the article offers "Copy Markdown" there
// instead; it copied with the async clipboard, which that browser does not have, and always failed.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { chromium, expect, webkit } from "@playwright/test";
import { fakeApi, itemDetail, startWebServer, visit, type WebServer } from "./web-server.ts";

const markdown = "# Copy Check\n\nFixed body";

test("article actions support keyboard navigation and return focus on Escape", async () => {
  const api = fakeApi((url, res) => {
    if (url.pathname === "/api/site/items/keyboard-menu") return itemDetail({ id: "keyboard-menu", title: "Keyboard Menu Check" });
    if (url.pathname === "/items/keyboard-menu/markdown") {
      res.setHeader("Content-Type", "text/markdown; charset=utf-8");
      return res.end(markdown);
    }
  });
  const browser = await chromium.launch({ channel: "chromium" });
  let web: WebServer | undefined;
  try {
    web = await startWebServer(api);
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    await visit(page, web.origin + "/items/keyboard-menu");
    const trigger = page.getByRole("button", { name: "More Actions", exact: true }).filter({ visible: true });
    const first = page.getByRole("menuitem", { name: "Share Link", exact: true });
    const second = page.getByRole("menuitem", { name: "Generate Share Card", exact: true });
    const last = page.getByRole("menuitem", { name: "Export Markdown", exact: true });
    await trigger.press("Enter");
    await expect(first).toBeFocused();
    await first.press("ArrowDown");
    await expect(second).toBeFocused();
    await second.press("End");
    await expect(last).toBeFocused();
    await last.press("ArrowDown");
    await expect(first).toBeFocused();
    await first.press("ArrowUp");
    await expect(last).toBeFocused();
    await last.press("Home");
    await expect(first).toBeFocused();
    await first.press("Escape");
    await expect(page.getByRole("menu")).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await trigger.press("ArrowUp");
    await expect(last).toBeFocused();
    await last.press("Shift+Tab");
    await expect(page.getByRole("menu")).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await trigger.press("Space");
    await expect(first).toBeFocused();
    await first.press("Tab");
    await expect(page.getByRole("menu")).toHaveCount(0);
    await expect(trigger).not.toBeFocused();
    await trigger.click();
    await expect(first).toBeFocused();
    await page.getByRole("heading", { name: "Keyboard Menu Check", exact: true }).click();
    await expect(page.getByRole("menu")).toHaveCount(0);
    await trigger.press("ArrowDown");
    await expect(first).toBeFocused();
    await first.press("ArrowUp");
    await expect(last).toBeFocused();
    const download = page.waitForEvent("download");
    await last.press("Enter");
    assert.equal(await readFile((await (await download).path())!, "utf8"), markdown);
    await expect(trigger).toBeFocused();
    await trigger.press("Enter");
    await first.press("ArrowDown");
    await second.press("Enter");
    const poster = page.getByRole("dialog", { name: "Share Card", exact: true });
    await expect(poster).toBeVisible();
    await poster.getByRole("button", { name: "Close", exact: true }).click();
    await expect(poster).toHaveCount(0);
    await expect(trigger).toBeFocused();
  } finally {
    await browser.close();
    await web?.stop();
  }
});

// Safari does not focus a button when it is pressed, so pressing the open menu's trigger takes focus to nothing.
test("in Safari, pressing the trigger of an open menu closes it", async () => {
  const api = fakeApi((url) => {
    if (url.pathname === "/api/site/items/safari-menu") return itemDetail({ id: "safari-menu", title: "Menu Check" });
  });
  const browser = await webkit.launch();
  let web: WebServer | undefined;
  try {
    web = await startWebServer(api);
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    await visit(page, web.origin + "/items/safari-menu");
    const trigger = page.getByRole("button", { name: "More Actions", exact: true }).filter({ visible: true });
    await trigger.click();
    await expect(page.getByRole("menuitem", { name: "Share Link", exact: true })).toBeFocused();
    await trigger.click();
    await expect(page.getByRole("menu")).toHaveCount(0);
  } finally {
    await browser.close();
    await web?.stop();
  }
});

test("in WeChat, Copy Markdown copies the article without the async clipboard", async () => {
  const api = fakeApi((url, res) => {
    if (url.pathname === "/api/site/items/wechat-copy") return itemDetail({ id: "wechat-copy", title: "Copy Check" });
    if (url.pathname === "/items/wechat-copy/markdown") {
      res.setHeader("Content-Type", "text/markdown; charset=utf-8");
      return res.end(markdown);
    }
  });
  const browser = await chromium.launch({ channel: "chromium" });
  let web: WebServer | undefined;
  try {
    web = await startWebServer(api);
    const context = await browser.newContext({
      viewport: { width: 1366, height: 900 },
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.50",
    });
    // As in WeChat: no async clipboard; a selection copy works, and what it copied is kept for the test.
    await context.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, "clipboard", { get: () => undefined });
      document.execCommand = (command: string) => {
        if (command !== "copy") return false;
        (window as { copied?: string }).copied = (document.activeElement as HTMLTextAreaElement | null)?.value;
        return true;
      };
    });
    const page = await context.newPage();
    await visit(page, web.origin + "/items/wechat-copy");
    await page.getByRole("button", { name: "More Actions" }).filter({ visible: true }).click();
    await page.getByRole("menuitem", { name: "Copy Markdown" }).click();
    await expect(page.getByRole("status")).toHaveText("Markdown Copied");
    assert.equal(await page.evaluate(() => (window as { copied?: string }).copied), markdown);
  } finally {
    await browser.close();
    await web?.stop();
  }
});
