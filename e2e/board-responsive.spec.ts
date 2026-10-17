import { expect, test } from '@playwright/test'
import {
  createRuntimeProject,
  createRuntimeTask,
  openProjectBacklog,
  openProjectBoard,
  openProjectWorkspace,
  registerRuntimeUser,
  watchBrowserErrors,
} from './support'

test('a Kanban task moves through the real Board drag/drop transition path', async ({ page }) => {
  const assertNoBrowserErrors = watchBrowserErrors(page)
  await registerRuntimeUser(page)
  await createRuntimeProject(page, 'kanban')
  await openProjectWorkspace(page)
  await openProjectBacklog(page)
  await createRuntimeTask(page)
  await openProjectBoard(page)

  await expect(page.getByRole('heading', { name: 'برد کانبان', exact: true })).toBeVisible()
    const task = page.getByRole('article').filter({
      has: page.getByRole('heading', { name: /وظیفه انتقال E/ }),
    })
  const sourceColumn = page.locator('section').filter({ has: page.getByRole('heading', { name: 'برای انجام', exact: true }) })
  const destinationColumn = page.locator('section').filter({ has: page.getByRole('heading', { name: 'در حال انجام', exact: true }) })

  await expect(task).toBeVisible()
  await expect(sourceColumn).toContainText(/وظیفه انتقال E/)

  // Chromium's pointer-level dragTo does not retain HTML5 DataTransfer here.
  // Dispatch the same browser drag event sequence with one native DataTransfer,
  // so the Board's actual onDragStart/onDrop handlers and transition authority run.
  const dataTransfer = await page.evaluateHandle(() => new DataTransfer())
  await task.dispatchEvent('dragstart', { dataTransfer })
  await destinationColumn.dispatchEvent('dragover', { dataTransfer })
  await destinationColumn.dispatchEvent('drop', { dataTransfer })
  await task.dispatchEvent('dragend', { dataTransfer })

  await expect(destinationColumn).toContainText(/وظیفه انتقال E/)
  await expect(sourceColumn).not.toContainText(/وظیفه انتقال E/)
  assertNoBrowserErrors()
})

test('authenticated RTL workspace remains usable at representative viewports', async ({ page }) => {
  const assertNoBrowserErrors = watchBrowserErrors(page)
  await registerRuntimeUser(page)
  await createRuntimeProject(page)
  await openProjectWorkspace(page)

  for (const width of [390, 768, 1280, 1920]) {
    await page.setViewportSize({ width, height: 900 })
    await expect(page.getByRole('main')).toBeVisible()
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  }

  await page.setViewportSize({ width: 390, height: 900 })
  await page.getByRole('button', { name: 'باز کردن منوی کناری' }).click()
    await expect(
      page.locator('aside').getByRole('button', { name: 'پروژه‌ها', exact: true }),
    ).toBeVisible()
  await page.keyboard.press('Escape')
  assertNoBrowserErrors()
})
