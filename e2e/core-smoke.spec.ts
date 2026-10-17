import { expect, test } from '@playwright/test'
import { createRuntimeProject, openProjectBacklog, openProjectWorkspace, registerRuntimeUser, watchBrowserErrors } from './support'

test('unauthenticated visitors cannot open protected routes', async ({ page }) => {
  const assertNoBrowserErrors = watchBrowserErrors(page)

  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('heading', { name: 'ورود به کارنکس' })).toBeVisible()

  await page.goto('/projects/private-project/board')
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByText('دسترسی به این پروژه مجاز نیست.')).not.toBeVisible()
  assertNoBrowserErrors()
})

test('registered runtime user reaches lazy pages and can cancel the project dialog', async ({ page }) => {
  const assertNoBrowserErrors = watchBrowserErrors(page)
  await registerRuntimeUser(page)

  await page.getByRole('button', { name: 'تقویم', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'تقویم', exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'پروژه‌ها', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'پروژه‌ها', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'پروژه جدید', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'پروژه جدید', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'انصراف', exact: true }).last().click()
  await expect(page.getByRole('heading', { name: 'پروژه جدید', exact: true })).not.toBeVisible()
  assertNoBrowserErrors()
})

test('authenticated navigation reaches a project backlog and task dialog', async ({ page }) => {
  const assertNoBrowserErrors = watchBrowserErrors(page)
  await registerRuntimeUser(page)
  await createRuntimeProject(page)
  await openProjectWorkspace(page)
  await openProjectBacklog(page)
  await page.getByRole('button', { name: 'وظیفه جدید', exact: true }).first().click()
  await expect(page.getByRole('heading', { name: 'وظیفه جدید', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'انصراف', exact: true }).last().click()
  await expect(page.getByRole('heading', { name: 'وظیفه جدید', exact: true })).not.toBeVisible()
  assertNoBrowserErrors()
})
