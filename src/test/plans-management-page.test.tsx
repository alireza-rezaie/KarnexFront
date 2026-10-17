import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import PlansManagementPage from '@/pages/PlansManagementPage'
import { PlansProvider, usePlans } from '@/contexts/PlansContext'
import { SubscriptionProvider } from '@/contexts/SubscriptionContext'

function PlanIds() {
  const { plans } = usePlans()

  return <output data-testid="plan-ids">{plans.map((plan) => plan.id).join(',')}</output>
}

function Page() {
  return <PlansProvider><SubscriptionProvider><PlansManagementPage /><PlanIds /></SubscriptionProvider></PlansProvider>
}

afterEach(cleanup)

describe('PlansManagementPage deletion', () => {
  it('requires confirmation before removing a plan and keeps the protected current plan intact', async () => {
    render(<Page />)

    const businessRow = screen.getByText('کسب‌وکار').closest('tr')
    const deleteButton = businessRow?.querySelector<HTMLButtonElement>('button[title="حذف پلن"]')
    expect(deleteButton).toBeTruthy()

    fireEvent.click(deleteButton!)
    expect(screen.getByRole('heading', { name: 'حذف پلن' })).toBeTruthy()
    expect(screen.getByTestId('plan-ids').textContent).toContain('business')

    fireEvent.click(screen.getByRole('button', { name: 'انصراف' }))
    expect(screen.queryByRole('heading', { name: 'حذف پلن' })).toBeNull()
    expect(screen.getByTestId('plan-ids').textContent).toContain('business')

    fireEvent.click(deleteButton!)
    fireEvent.click(screen.getByRole('button', { name: 'حذف پلن' }))
    await waitFor(() => expect(screen.getByTestId('plan-ids').textContent).not.toContain('business'))
  })
})
