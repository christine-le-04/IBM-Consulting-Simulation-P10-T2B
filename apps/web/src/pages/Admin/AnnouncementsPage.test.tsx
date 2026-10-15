import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { useAnnouncements, usePublishAnnouncement } from '@/api/hooks/useAnnouncements'
import AnnouncementsPage from './AnnouncementsPage'

vi.mock('@/api/hooks/useAnnouncements', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/api/hooks/useAnnouncements')>(),
  useAnnouncements: vi.fn(), usePublishAnnouncement: vi.fn(),
}))
const mutate = vi.fn()
function setup(overrides = {}) {
  vi.mocked(usePublishAnnouncement).mockReturnValue({ mutate, isPending: false, isError: false, ...overrides } as unknown as ReturnType<typeof usePublishAnnouncement>)
  vi.mocked(useAnnouncements).mockReturnValue({ data: { items: [] }, isLoading: false, isError: false } as unknown as ReturnType<typeof useAnnouncements>)
}
function fill() {
  fireEvent.change(screen.getByLabelText('Title'), { target: { value: ' Maintenance ' } })
  fireEvent.change(screen.getByLabelText('Message'), { target: { value: ' Restart tonight. ' } })
}

describe('AnnouncementsPage', () => {
  beforeEach(() => { vi.resetAllMocks(); setup() })

  it('publishes trimmed content to everyone and clears the form only on success', () => {
    render(<AnnouncementsPage />)
    expect(screen.getByRole('button', { name: 'Publish to all users' })).toBeDisabled()
    fill()
    fireEvent.click(screen.getByRole('button', { name: 'Publish to all users' }))
    expect(mutate).toHaveBeenCalledWith({ title: 'Maintenance', message: 'Restart tonight.' }, expect.objectContaining({ onSuccess: expect.any(Function) }))
    expect(screen.getByLabelText('Title')).toHaveValue(' Maintenance ')
  })

  it('shows confirmation after publishing and resets the form', () => {
    mutate.mockImplementation((_input, callbacks) => callbacks.onSuccess())
    render(<AnnouncementsPage />)
    fill()
    fireEvent.click(screen.getByRole('button', { name: 'Publish to all users' }))
    expect(screen.getByText('Announcement published')).toBeInTheDocument()
    expect(screen.getByLabelText('Title')).toHaveValue('')
    expect(screen.getByLabelText('Message')).toHaveValue('')
  })

  it('requires a role selection and sends only the selected roles', () => {
    render(<AnnouncementsPage />)
    fill()
    fireEvent.change(screen.getByLabelText('Recipients'), { target: { value: 'ROLES' } })
    expect(screen.getByRole('button', { name: 'Publish to selected roles' })).toBeDisabled()
    fireEvent.click(screen.getByLabelText('Learners'))
    fireEvent.click(screen.getByLabelText('Reviewers'))
    fireEvent.click(screen.getByRole('button', { name: 'Publish to selected roles' }))
    expect(mutate).toHaveBeenLastCalledWith({ title: 'Maintenance', message: 'Restart tonight.', targetRoles: ['LEARNER', 'REVIEWER'] }, expect.any(Object))
    fireEvent.change(screen.getByLabelText('Recipients'), { target: { value: 'ALL' } })
    fireEvent.click(screen.getByRole('button', { name: 'Publish to all users' }))
    expect(mutate).toHaveBeenLastCalledWith({ title: 'Maintenance', message: 'Restart tonight.' }, expect.any(Object))
  })

  it('confirms the selected audience without resetting it to everyone', () => {
    mutate.mockImplementation((_input, callbacks) => callbacks.onSuccess())
    render(<AnnouncementsPage />)
    fill()
    fireEvent.change(screen.getByLabelText('Recipients'), { target: { value: 'ROLES' } })
    fireEvent.click(screen.getByLabelText('Learners'))
    fireEvent.click(screen.getByRole('button', { name: 'Publish to selected roles' }))
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
    expect(screen.getByRole('button', { name: 'Publish to all users' })).toBeEnabled()
  })

  it('blocks blank text and repeat submissions while publishing', () => {
    const view = render(<AnnouncementsPage />)
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: ' ' } })
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Message' } })
    expect(screen.getByRole('button', { name: 'Publish to all users' })).toBeDisabled()
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
