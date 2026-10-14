import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useAdminAuditEvents, type AdminAuditPage } from '@/api/hooks/useAdminAuditEvents'
import AuditLogPage from './AuditLogPage'

vi.mock('@/api/hooks/useAdminAuditEvents', () => ({ useAdminAuditEvents: vi.fn() }))
const query = vi.mocked(useAdminAuditEvents)
const refresh = vi.fn()
const page: AdminAuditPage = {
  items: [{ id: 'event-1', occurredAt: '2026-10-14T00:00:00Z', actorId: 'admin-1', actorDisplayName: 'Alex Admin',
    actorEmail: 'alex@example.com', actorRole: 'ADMINISTRATOR', action: 'ADMIN_USER_DELETED', targetType: 'USER',
    targetId: 'deleted-user-id', details: '<script>alert("test")</script>' }],
  totalElements: 60, page: 0, size: 25, totalPages: 3, actions: ['ADMIN_USER_CREATED', 'ADMIN_USER_DELETED'],
}
function setup(data = page) {
  query.mockReturnValue({ data, isLoading: false, isFetching: false, isError: false, refetch: refresh } as unknown as ReturnType<typeof useAdminAuditEvents>)
}
const renderPage = () => render(<MemoryRouter><AuditLogPage /></MemoryRouter>)

describe('AuditLogPage', () => {
  beforeEach(() => { vi.clearAllMocks(); setup() })
  it('shows actor identity and historical target with safely rendered details', () => {
    renderPage()
    expect(screen.getByText('Alex Admin')).toBeInTheDocument()
    expect(screen.getByText('alex@example.com')).toBeInTheDocument()
    expect(screen.getByText('deleted-user-id')).toBeInTheDocument()
    expect(screen.getByText('<script>alert("test")</script>')).toBeInTheDocument()
    expect(document.querySelector('script')).toBeNull()
    expect(screen.getByText('60 recorded actions')).toBeInTheDocument()
  })
  it('paginates and resets to the first page when filters are applied', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /next page/i }))
    expect(query).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, size: 25 }))
    fireEvent.change(screen.getByLabelText('Search activity'), { target: { value: ' Alex ' } })
    fireEvent.change(screen.getByLabelText('Action'), { target: { value: 'ADMIN_USER_CREATED' } })
    fireEvent.change(screen.getByLabelText('Resource'), { target: { value: 'USER' } })
    fireEvent.change(screen.getByLabelText('From date (UTC)'), { target: { value: '2026-10-01' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }))
    expect(query).toHaveBeenLastCalledWith(expect.objectContaining({ page: 0, search: 'Alex', action: 'ADMIN_USER_CREATED', targetType: 'USER', from: '2026-10-01' }))
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
    expect(query).toHaveBeenLastCalledWith({ page: 0, size: 25 })
  })
  it('rejects a reversed date range without applying it', () => {
    renderPage()
    fireEvent.change(screen.getByLabelText('From date (UTC)'), { target: { value: '2026-10-10' } })
    fireEvent.change(screen.getByLabelText('To date (UTC)'), { target: { value: '2026-10-01' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }))
    expect(screen.getByText('Check the date range')).toBeInTheDocument()
    expect(query).toHaveBeenLastCalledWith({ page: 0, size: 25 })
  })
  it('refreshes and shows empty and error states', () => {
    setup({ ...page, items: [], totalElements: 0, totalPages: 0 })
    const view = renderPage()
    expect(screen.getByText('No matching activity')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    expect(refresh).toHaveBeenCalledOnce()
    query.mockReturnValue({ isError: true, refetch: refresh } as unknown as ReturnType<typeof useAdminAuditEvents>)
    view.rerender(<MemoryRouter><AuditLogPage /></MemoryRouter>)
    expect(screen.getByText('Audit history could not be loaded')).toBeInTheDocument()
  })
})
