import { test, expect } from '@playwright/test'

test.describe('帖好工作台（在线版）', () => {
  test('加载示例图并批量处理出 ZIP', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/帖好/)

    await page.getByRole('button', { name: '加载示例图' }).click()
    await expect(page.locator('#queueCount')).toHaveText('3')

    await page.getByRole('button', { name: /开始处理/ }).click()
    await expect(page.locator('#statusText')).toContainText('全部完成', { timeout: 60_000 })
    await expect(page.locator('#summaryText')).toContainText('已处理 3/3')

    const downloadPromise = page.waitForEvent('download')
    await page.locator('#downloadZip').click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/\.zip$/)
  })

  test('水印设置会实时反映到预览', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: '加载示例图' }).click()
    const after = page.locator('#imgAfter')
    const before = await after.getAttribute('src')
    await page.locator('#wmText').fill('帖好测试水印')
    await page.waitForTimeout(600)
    const afterChange = await after.getAttribute('src')
    expect(afterChange).not.toBe(before)
  })

  test('对比度滑块可以拖动', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: '加载示例图' }).click()
    await page.locator('.preview-tab', { hasText: '对比' }).click()
    const handle = page.locator('#compareHandle')
    const box = await handle.boundingBox()
    expect(box).toBeTruthy()
    await page.locator('#stage').hover({ position: { x: 20, y: 20 } })
    const clip = await page.locator('#imgAfterWrap').evaluate((el) => el.style.clipPath)
    expect(clip).toMatch(/inset/)
  })
})

test.describe('离线单文件版', () => {
  test('file:// 直接打开可用', async ({ page }) => {
    await page.goto('file://' + process.cwd() + '/product/TieHao-Offline.html')
    await expect(page.locator('#editionBadge')).toHaveText('离线批量版')
    await page.getByRole('button', { name: '加载示例图' }).click()
    await expect(page.locator('#queueCount')).toHaveText('3')
  })
})
