import { expect, type Page } from '@playwright/test'

export function watchBrowserErrors(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    // The Vite dev server has no favicon asset; keep this intentional exception narrow.
    const missingFavicon = message.text() === 'Failed to load resource: the server responded with a status of 404 (Not Found)'
    if (message.type() === 'error' && !missingFavicon) errors.push(`console: ${message.text()}`)
  })
  return () => expect(errors, errors.join('\n')).toEqual([])
}

export async function registerRuntimeUser(page: Page) {
  await page.goto('/register')
  await expect(page.getByRole('heading', { name: 'ثبت‌نام در کارنکس' })).toBeVisible()

  await page.getByPlaceholder('علی').fill('کاربر')
  await page.getByPlaceholder('احمدی').fill('آزمایشی')
  await page.getByPlaceholder('ali_ahmadi').fill('e2e_admin')
  await page.getByPlaceholder('۰۹۱۲۳۴۵۶۷۸۹').fill('09120000000')
  await page.getByPlaceholder('ali@company.ir').fill('e2e@example.test')
  await page.locator('input[type="password"]').nth(0).fill('StrongPass1!')
  await page.locator('input[type="password"]').nth(1).fill('StrongPass1!')
  await page.getByRole('button', { name: 'ثبت‌نام', exact: true }).click()

  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByRole('heading', { name: /سلام/ })).toBeVisible()
}

export async function createRuntimeProject(page: Page, type: 'scrum' | 'kanban' = 'scrum') {
  await page.getByRole('button', { name: 'پروژه‌ها', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'پروژه‌ها', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'پروژه جدید', exact: true }).click()
  await page.getByLabel('نام پروژه').fill('پروژه E2E')
  await page.getByLabel('کلید پروژه').fill('E2E')
  if (type === 'kanban') await page.getByRole('button', { name: 'کانبان', exact: true }).click()
  await page.getByRole('button', { name: 'ساخت پروژه', exact: true }).click()
  await expect(page.getByRole('heading', { name: /پروژه E/ })).toBeVisible()
}

export async function openProjectWorkspace(page: Page) {
  await page.getByRole('heading', { name: /پروژه E/ }).click()
  await expect(page).toHaveURL(/\/projects\/[^/]+\/overview$/)
  await expect(page.getByRole('heading', { name: /پروژه E/ }).last()).toBeVisible()
}

export async function openProjectBacklog(page: Page) {
  await page.getByRole('button', { name: 'بک‌لاگ', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'بک‌لاگ', exact: true })).toBeVisible()
}

export async function openProjectBoard(page: Page) {
  await page.getByRole('button', { name: 'اسپرینت فعال', exact: true }).click()
  await expect(page).toHaveURL(/\/projects\/[^/]+\/board$/)
  await page.keyboard.press('Escape')
  await expect(page.locator('aside')).toHaveAttribute('data-sidebar-panel-open', 'false')
}

export async function createRuntimeTask(page: Page, title = 'وظیفه انتقال E2E') {
  await page.getByRole('button', { name: 'وظیفه جدید', exact: true }).first().click()
  await expect(page.getByRole('heading', { name: 'وظیفه جدید', exact: true })).toBeVisible()
  await page.getByPlaceholder('عنوان وظیفه').fill(title)
  await page.getByRole('button', { name: 'ایجاد وظیفه', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'وظیفه جدید', exact: true })).not.toBeVisible()
}
