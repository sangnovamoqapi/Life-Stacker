import { test, expect, _electron as electron } from '@playwright/test'
import * as path from 'path'
import * as fs from 'fs'

test.describe('Life Stack 2.0 Electron QA & UI Sweep', () => {
  let app: any
  let page: any
  const consoleMessages: { type: string; text: string }[] = []
  const pageErrors: string[] = []

  test.beforeAll(async () => {
    // Launch Electron application
    app = await electron.launch({
      args: ['.'],
      cwd: path.resolve(__dirname, '..'),
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    })

    page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')

    // Attach listeners
    page.on('console', (msg: any) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() })
      if (msg.type() === 'error') {
        console.error(`[Browser Console Error]: ${msg.text()}`)
      }
    })

    page.on('pageerror', (err: any) => {
      pageErrors.push(err.message)
      console.error(`[Browser PageError]: ${err.message}`)
    })
  })

  test.afterAll(async () => {
    if (app) {
      await app.close()
    }
  })

  test('UI Sweep 1: Top navigation and view mode transitions', async () => {
    // Wait for Overview view to be visible
    await page.waitForSelector('text=Active Epics', { timeout: 10000 })
    expect(await page.isVisible('text=Active Epics')).toBe(true)

    // Click Lanes view
    await page.click('button:has-text("Lanes")')
    await page.waitForTimeout(600)
    expect(await page.isVisible('text=+ New Sector') || await page.isVisible('text=Parked')).toBe(true)

    // Click Chat view
    await page.click('button:has-text("Chat")')
    await page.waitForTimeout(600)
    expect(await page.isVisible('textarea') || await page.isVisible('input')).toBe(true)

    // Click Stats view
    await page.click('button:has-text("Stats")')
    await page.waitForTimeout(600)
    expect(await page.isVisible('text=Effort Statistics')).toBe(true)

    // Click Settings
    await page.click('button[title="Settings"]')
    await page.waitForTimeout(600)
    expect(await page.isVisible('text=General') || await page.isVisible('text=Active Epic Cap')).toBe(true)

    // Return to Life Stack (Overview)
    await page.click('button:has-text("Life Stack")')
    await page.waitForTimeout(600)
    expect(await page.isVisible('text=Active Epics')).toBe(true)
  })

  test('UI Sweep 2: Help & Workflow Guide modal interaction', async () => {
    // Click Help button
    const helpBtn = page.locator('button[title="Workflow & Guide"]')
    await helpBtn.click()
    await page.waitForTimeout(500)

    // Modal should be visible
    expect(await page.isVisible('text=Life Stack Workflow & Methodology')).toBe(true)

    // Test tab navigation inside modal
    await page.click('button:has-text("Core Principles")')
    await page.waitForTimeout(300)
    expect(await page.isVisible('text=5-Epic Cap & Park Swap')).toBe(true)

    await page.click('button:has-text("Keyboard & Tips")')
    await page.waitForTimeout(300)
    expect(await page.isVisible('text=Quick Navigation')).toBe(true)

    // Close modal via Close Guide button
    await page.click('button:has-text("Close Guide")')
    await page.waitForTimeout(400)
    expect(await page.isVisible('text=Life Stack Workflow & Methodology')).toBe(false)
  })

  test('UI Sweep 3: Add Item modal workflow', async () => {
    // Click Add item button
    await page.click('button:has-text("Add item")')
    await page.waitForTimeout(500)

    // Modal should be visible
    expect(await page.isVisible('input[placeholder="Epic title..."]')).toBe(true)

    // Enter test epic title
    await page.fill('input[placeholder="Epic title..."]', 'Playwright Automated Test Epic')

    // Close modal via cancel / ✕
    const closeBtn = page.locator('div.modal-glass button:has-text("✕")').first()
    if (await closeBtn.isVisible()) {
      await closeBtn.click()
    } else {
      await page.keyboard.press('Escape')
    }
    await page.waitForTimeout(400)
  })

  test('UI Sweep 4: Small and Cramped Window Layout Stress Test', async () => {
    // Resize to standard laptop
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.waitForTimeout(300)
    expect(await page.isVisible('text=Active Epics')).toBe(true)

    // Resize to compact tablet
    await page.setViewportSize({ width: 960, height: 600 })
    await page.waitForTimeout(300)
    expect(await page.isVisible('text=Active Epics')).toBe(true)

    // Resize to very small window
    await page.setViewportSize({ width: 800, height: 500 })
    await page.waitForTimeout(300)
    expect(await page.isVisible('text=Active Epics')).toBe(true)

    // Restore comfortable resolution
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.waitForTimeout(300)
  })

  test('UI Sweep 5: Error and Exception Audit', async () => {
    console.log(`\n── Total console messages captured: ${consoleMessages.length}`)
    console.log(`── Total uncaught page errors: ${pageErrors.length}`)

    // Assert zero fatal uncaught page errors
    expect(pageErrors.length).toBe(0)
  })
})
