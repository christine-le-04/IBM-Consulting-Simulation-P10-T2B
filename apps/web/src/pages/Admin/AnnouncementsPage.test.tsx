import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { useAnnouncements, usePublishAnnouncement } from '@/api/hooks/useAnnouncements'
import AnnouncementsPage from './AnnouncementsPage'
import { useAdminAnnouncements, useWithdrawAnnouncement } from '@/api/hooks/useAdminAnnouncements'
vi.mock('@/api/hooks/useAdminAnnouncements', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/api/hooks/useAdminAnnouncements')>(),
  useAdminAnnouncements: vi.fn(), useWithdrawAnnouncement: vi.fn(),
}))

vi.mock('@/api/hooks/useAnnouncements', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/api/hooks/useAnnouncements')>(),
  useAnnouncements: vi.fn(), usePublishAnnouncement: vi.fn(),
}))
const mutate = vi.fn()
const withdraw = vi.fn()
function setup(overrides = {}) {
  vi.mocked(usePublishAnnouncement).mockReturnValue({ mutate, isPending: false, isError: false, ...overrides } as unknown as ReturnType<typeof usePublishAnnouncement>)
  vi.mocked(useAnnouncements).mockReturnValue({ data: { items: [] }, isLoading: false, isError: false } as unknown as ReturnType<typeof useAnnouncements>)
  vi.mocked(useAdminAnnouncements).mockReturnValue({ data: { items: [], totalElements: 0 }, isLoading: false, isError: false } as unknown as ReturnType<typeof useAdminAnnouncements>)
  vi.mocked(useWithdrawAnnouncement).mockReturnValue({ mutate: withdraw, isPending: false, isError: false } as unknown as ReturnType<typeof useWithdrawAnnouncement>)
}
function fill() {
  fireEvent.change(screen.getByLabelText('Title'), { target: { value: ' Maintenance ' } })
  fireEvent.change(screen.getByLabelText('Message'), { target: { value: ' Restart tonight. ' } })
}

describe('AnnouncementsPage', () => {
  beforeEach(() => { vi.resetAllMocks(); setup() })

  it('previews escaped content and recipients without sending, and keeps edits', () => {
    render(<AnnouncementsPage />)
    fill()
    fireEvent.change(screen.getByLabelText('Recipients'), { target: { value: 'ROLES' } })
    fireEvent.click(screen.getByLabelText('Learners'))
    fireEvent.click(screen.getByRole('button', { name: 'Preview announcement' }))
    expect(mutate).not.toHaveBeenCalled()
    expect(screen.getByText('Sent to: Learners')).toBeInTheDocument()
    expect(screen.getByText('Publication: Immediately')).toBeInTheDocument()
    expect(screen.getByText('Expiry: No expiry')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }))
    expect(screen.getByLabelText('Title')).toHaveValue(' Maintenance ')
    expect(mutate).not.toHaveBeenCalled()
  })

  it('sends scheduled times as UTC and rejects expiry before publication', () => {
    render(<AnnouncementsPage />)
    fill()
    fireEvent.change(screen.getByLabelText('Publish at (optional)'), { target: { value: '2099-10-16T09:00' } })
    fireEvent.change(screen.getByLabelText('Expires at (optional)'), { target: { value: '2099-10-16T08:00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Preview announcement' }))
    if (screen.queryByRole('button', { name: /Confirm publication|Confirm schedule/ })) fireEvent.click(screen.getByRole('button', { name: /Confirm publication|Confirm schedule/ }))
    expect(mutate).not.toHaveBeenCalled()
    expect(screen.getByText('Check announcement dates')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Expires at (optional)'), { target: { value: '2099-10-17T09:00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Preview announcement' }))
    if (screen.queryByRole('button', { name: /Confirm publication|Confirm schedule/ })) fireEvent.click(screen.getByRole('button', { name: /Confirm publication|Confirm schedule/ }))
    expect(mutate).toHaveBeenCalledWith(expect.objectContaining({ publishAt: new Date('2099-10-16T09:00').toISOString(),
      expiresAt: new Date('2099-10-17T09:00').toISOString() }), expect.any(Object))
  })

  it('publishes trimmed content to everyone and clears the form only on success', () => {
    render(<AnnouncementsPage />)
    expect(screen.getByRole('button', { name: 'Preview announcement' })).toBeDisabled()
    fill()
    fireEvent.click(screen.getByRole('button', { name: 'Preview announcement' }))
    if (screen.queryByRole('button', { name: /Confirm publication|Confirm schedule/ })) fireEvent.click(screen.getByRole('button', { name: /Confirm publication|Confirm schedule/ }))
    expect(mutate).toHaveBeenCalledWith({ title: 'Maintenance', message: 'Restart tonight.' }, expect.objectContaining({ onSuccess: expect.any(Function) }))
    expect(screen.getByLabelText('Title')).toHaveValue(' Maintenance ')
  })

  it('shows confirmation after publishing and resets the form', () => {
    mutate.mockImplementation((_input, callbacks) => callbacks.onSuccess())
    render(<AnnouncementsPage />)
    fill()
    fireEvent.click(screen.getByRole('button', { name: 'Preview announcement' }))
    if (screen.queryByRole('button', { name: /Confirm publication|Confirm schedule/ })) fireEvent.click(screen.getByRole('button', { name: /Confirm publication|Confirm schedule/ }))
    expect(screen.getByText('Announcement published')).toBeInTheDocument()
    expect(screen.getByLabelText('Title')).toHaveValue('')
    expect(screen.getByLabelText('Message')).toHaveValue('')
  })

  it('requires a role selection and sends only the selected roles', () => {
    render(<AnnouncementsPage />)
    fill()
    fireEvent.change(screen.getByLabelText('Recipients'), { target: { value: 'ROLES' } })
    expect(screen.getByRole('button', { name: 'Preview announcement' })).toBeDisabled()
    fireEvent.click(screen.getByLabelText('Learners'))
    fireEvent.click(screen.getByLabelText('Reviewers'))
    fireEvent.click(screen.getByRole('button', { name: 'Preview announcement' }))
    if (screen.queryByRole('button', { name: /Confirm publication|Confirm schedule/ })) fireEvent.click(screen.getByRole('button', { name: /Confirm publication|Confirm schedule/ }))
    expect(mutate).toHaveBeenLastCalledWith({ title: 'Maintenance', message: 'Restart tonight.', targetRoles: ['LEARNER', 'REVIEWER'] }, expect.any(Object))
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }))
    fireEvent.change(screen.getByLabelText('Recipients'), { target: { value: 'ALL' } })
    fireEvent.click(screen.getByRole('button', { name: 'Preview announcement' }))
    if (screen.queryByRole('button', { name: /Confirm publication|Confirm schedule/ })) fireEvent.click(screen.getByRole('button', { name: /Confirm publication|Confirm schedule/ }))
    expect(mutate).toHaveBeenLastCalledWith({ title: 'Maintenance', message: 'Restart tonight.' }, expect.any(Object))
  })

  it('confirms the selected audience without resetting it to everyone', () => {
    mutate.mockImplementation((_input, callbacks) => callbacks.onSuccess())
    render(<AnnouncementsPage />)
    fill()
    fireEvent.change(screen.getByLabelText('Recipients'), { target: { value: 'ROLES' } })
    fireEvent.click(screen.getByLabelText('Learners'))
    fireEvent.click(screen.getByRole('button', { name: 'Preview announcement' }))
    if (screen.queryByRole('button', { name: /Confirm publication|Confirm schedule/ })) fireEvent.click(screen.getByRole('button', { name: /Confirm publication|Confirm schedule/ }))
    expect(screen.getByText('Your update is available to learners in their announcement bell.')).toBeInTheDocument()
    expect(screen.getByLabelText('Recipients')).toHaveValue('ROLES')
    expect(screen.getByLabelText('Learners')).toBeChecked()
  })

  it('preserves failed submissions and allows retrying', () => {
    const view = render(<AnnouncementsPage />)
    fill()
    setup({ isError: true, error: new Error('network unavailable') })
    view.rerender(<AnnouncementsPage />)
    expect(screen.getByText('Announcement could not be published')).toBeInTheDocument()
    expect(screen.getByLabelText('Title')).toHaveValue(' Maintenance ')
    expect(screen.getByLabelText('Message')).toHaveValue(' Restart tonight. ')
    expect(screen.getByRole('button', { name: 'Preview announcement' })).toBeEnabled()
  })

  it('shows sent history for other roles and confirms withdrawal', () => {
    vi.mocked(useAdminAnnouncements).mockReturnValue({ data: { items: [{ id: 'notice', title: 'Learner update', message: 'Hello learners',
      audience: 'ROLES', targetRoles: ['LEARNER'], createdAt: '2026-10-16T00:00:00Z', withdrawnAt: null, status: 'PUBLISHED' }], totalElements: 1 },
      isLoading: false, isError: false } as unknown as ReturnType<typeof useAdminAnnouncements>)
    render(<AnnouncementsPage />)
    expect(screen.getByText('Learner update')).toBeInTheDocument()
    expect(screen.getByText('Sent to: Learners')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw' }))
    expect(withdraw).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw announcement' }))
    expect(withdraw).toHaveBeenCalledWith('notice', expect.any(Object))
  })

  it('blocks blank text and repeat submissions while publishing', () => {
    const view = render(<AnnouncementsPage />)
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: ' ' } })
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Message' } })
    expect(screen.getByRole('button', { name: 'Preview announcement' })).toBeDisabled()
    fill()
    setup({ isPending: true })
    view.rerender(<AnnouncementsPage />)
    expect(screen.getByRole('button', { name: 'Publishing…' })).toBeDisabled()
    expect(screen.getByLabelText('Title')).toBeDisabled()
    expect(screen.getByLabelText('Message')).toBeDisabled()
    expect(screen.getByLabelText('Title')).toHaveAttribute('maxlength', '120')
    expect(screen.getByLabelText('Message')).toHaveAttribute('maxlength', '4000')
  })
})
