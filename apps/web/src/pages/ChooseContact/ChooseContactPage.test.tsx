import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ChooseContactPage from './ChooseContactPage'
import { useContacts, useChooseContact } from '@/api/hooks/useContacts'
import type { ContactsResponse } from '@/api/types'

vi.mock('@/api/hooks/useContacts', () => ({ useContacts: vi.fn(), useChooseContact: vi.fn() }))
vi.mock('@/components/shell/useMentor', () => ({ useMentor: vi.fn() }))
vi.mock('@/components/shared/LoadingState', () => ({ default: () => <div>Loading...</div> }))
vi.mock('@/components/shared/ErrorState', () => ({ default: () => <div>Error...</div> }))

const chooseMutate = vi.fn()
const contacts = [
  { id: 'p-1', name: 'John Doe', jobTitle: 'CEO', organisation: 'Company Test', visibleConcerns: 'Protecting reliability', current: false, usedUp: false, emailsSent: 0, emailsLeft: 3 },
  { id: 'p-2', name: 'Jane Roe', jobTitle: 'CFO', organisation: 'Company Test', visibleConcerns: 'Reducing commercial risk', current: false, usedUp: false, emailsSent: 0, emailsLeft: 3 },
]

function setup(overrides: Partial<ContactsResponse> = {}) {
  vi.mocked(useContacts).mockReturnValue({
    data: { contacts, canChangeContact: true, outreachRound: 1, currentContactId: null, ...overrides } satisfies ContactsResponse, isLoading: false, isError: false,
  } as unknown as ReturnType<typeof useContacts>)
  vi.mocked(useChooseContact).mockReturnValue({ mutate: chooseMutate, isPending: false, isError: false } as unknown as ReturnType<typeof useChooseContact>)
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/dashboard/engagements/eng-1/contact']}>
      <Routes>
        <Route path="/dashboard/engagements/:engagementId/contact" element={<ChooseContactPage />} />
        <Route path="/dashboard/engagements/:engagementId/outreach" element={<div>Outreach workspace</div>} />
        <Route path="/dashboard/engagements/:engagementId/intelligence" element={<div>Research desk</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  setup()
})

describe('ChooseContactPage states', () => {
  it('waits for the contacts before showing a choice', () => {
    vi.mocked(useContacts).mockReturnValue({ isLoading: true } as unknown as ReturnType<typeof useContacts>)
    renderPage()

    expect(screen.getByText('Loading...')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Choose John' })).not.toBeInTheDocument()
  })

  it('shows an error when the contacts cannot be loaded', () => {
    vi.mocked(useContacts).mockReturnValue({ isError: true } as unknown as ReturnType<typeof useContacts>)
    renderPage()

    expect(screen.getByText('Error...')).toBeInTheDocument()
  })

  it('keeps the contact list available when saving a choice fails', () => {
    vi.mocked(useChooseContact).mockReturnValue({ mutate: chooseMutate, isError: true } as unknown as ReturnType<typeof useChooseContact>)
    renderPage()

    expect(screen.getByText('Could not choose this contact')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Choose Jane' })).toBeEnabled()
  })
})

describe('ChooseContactPage choosing who to email', () => {
  it('shows the contacts and saves the person the learner chooses', async () => {
    const user = userEvent.setup()
    renderPage()

    expect(screen.getByRole('heading', { name: 'Who at Company Test will you write to?' })).toBeInTheDocument()
    expect(screen.getByText('Reducing commercial risk')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Choose Jane' }))

    expect(chooseMutate).toHaveBeenCalledWith('p-2')
  })

  it('prevents another choice while the contact is being saved', () => {
    vi.mocked(useChooseContact).mockReturnValue({ mutate: chooseMutate, isPending: true } as unknown as ReturnType<typeof useChooseContact>)
    renderPage()

    expect(screen.getByRole('button', { name: 'Choose John' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Choose Jane' })).toBeDisabled()
  })

  it('allows changing a contact before the first email and continues to outreach', async () => {
    const user = userEvent.setup()
    setup({ contacts: contacts.map((contact) => ({ ...contact, current: contact.id === 'p-1' })) })
    renderPage()

    expect(screen.getByText('You chose John Doe')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Choose Jane instead' }))
    expect(chooseMutate).toHaveBeenCalledWith('p-2')
    await user.click(screen.getByRole('button', { name: 'Write to John' }))
    expect(screen.getByText('Outreach workspace')).toBeInTheDocument()
  })

  it('locks other contacts while the current conversation is in progress', () => {
    setup({ canChangeContact: false, contacts: contacts.map((contact) => ({ ...contact, current: contact.id === 'p-1' })) })
    renderPage()

    expect(screen.getByText('You are emailing John Doe')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Choose Jane/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Write to John' })).toBeEnabled()
  })

  it('offers another contact after three emails and keeps research reachable', async () => {
    const user = userEvent.setup()
    setup({ contacts: contacts.map((contact) => ({ ...contact, current: contact.id === 'p-1', usedUp: contact.id === 'p-1' })) })
    renderPage()

    expect(screen.getByText('Choose someone else at the company. Your research is kept.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Write to John' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Choose Jane' }))
    expect(chooseMutate).toHaveBeenCalledWith('p-2')
    await user.click(screen.getByRole('button', { name: 'Back to your research' }))
    expect(screen.getByText('Research desk')).toBeInTheDocument()
  })

  it('does not offer a contact who has used all their emails this round', () => {
    setup({ contacts: contacts.map((contact) => ({ ...contact, usedUp: contact.id === 'p-2' })) })
    renderPage()

    const jane = screen.getByRole('heading', { name: 'Jane Roe' }).closest('article')!
    expect(within(jane).getByText('Emails used this round')).toBeInTheDocument()
    expect(within(jane).queryByRole('button')).not.toBeInTheDocument()
  })
})
