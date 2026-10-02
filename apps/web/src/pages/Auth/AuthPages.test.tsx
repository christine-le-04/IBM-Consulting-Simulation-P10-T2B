import { StrictMode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { AxiosError } from 'axios'
import LoginPage from './LoginPage'
import RegisterPage from './RegisterPage'
import ForgotPasswordPage from './ForgotPasswordPage'
import ResetPasswordPage from './ResetPasswordPage'
import VerifyEmailPage from './VerifyEmailPage'
import {
  useLogin, useRegister, useRequestPasswordReset, useConfirmPasswordReset,
  useConfirmVerification, useResendVerification,
} from '@/api/hooks/useAuth'

vi.mock('@/api/hooks/useAuth', () => ({
  useLogin: vi.fn(), useRegister: vi.fn(), useRequestPasswordReset: vi.fn(),
  useConfirmPasswordReset: vi.fn(), useConfirmVerification: vi.fn(), useResendVerification: vi.fn(),
}))
vi.mock('@/components/layout/PublicHeader', () => ({ default: () => <header>Public header</header> }))

const loginMutate = vi.fn()
const registerMutate = vi.fn()
const requestMutate = vi.fn()
const resetMutate = vi.fn()
const confirmMutate = vi.fn()
const resendMutate = vi.fn()

function Destination() {
  const location = useLocation()
  return <div>{location.pathname}<span>{JSON.stringify(location.state)}</span></div>
}

function renderPage(path: string, state?: Record<string, unknown>) {
  return render(
    <StrictMode>
      <MemoryRouter initialEntries={[{ pathname: path.split('?')[0], search: path.includes('?') ? `?${path.split('?')[1]}` : '', state }]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/dashboard" element={<Destination />} />
        </Routes>
      </MemoryRouter>
    </StrictMode>,
  )
}

beforeEach(() => {
  vi.resetAllMocks()
  sessionStorage.clear()
  vi.mocked(useLogin).mockReturnValue({ mutate: loginMutate, isPending: false, isError: false } as unknown as ReturnType<typeof useLogin>)
  vi.mocked(useRegister).mockReturnValue({ mutate: registerMutate, isPending: false, isError: false } as unknown as ReturnType<typeof useRegister>)
  vi.mocked(useRequestPasswordReset).mockReturnValue({ mutate: requestMutate, isPending: false, isError: false, isSuccess: false } as unknown as ReturnType<typeof useRequestPasswordReset>)
  vi.mocked(useConfirmPasswordReset).mockReturnValue({ mutate: resetMutate, isPending: false, isError: false } as unknown as ReturnType<typeof useConfirmPasswordReset>)
  vi.mocked(useConfirmVerification).mockReturnValue({ mutate: confirmMutate, isPending: false, isError: false } as unknown as ReturnType<typeof useConfirmVerification>)
  vi.mocked(useResendVerification).mockReturnValue({ mutate: resendMutate, isPending: false, isError: false, isSuccess: false } as unknown as ReturnType<typeof useResendVerification>)
})

describe('LoginPage sign in', () => {
  it('asks for credentials before sending a login request', async () => {
    const user = userEvent.setup()
    renderPage('/login')

    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText('Enter a valid email')).toBeInTheDocument()
    expect(screen.getByText('Password is required')).toBeInTheDocument()
    expect(loginMutate).not.toHaveBeenCalled()
  })

  it('sends the credentials and opens the dashboard after a successful login', async () => {
    const user = userEvent.setup()
    loginMutate.mockImplementation((_values, options) => options.onSuccess())
    renderPage('/login')

    await user.type(screen.getByLabelText('Email'), 'mia@example.com')
    await user.type(screen.getByLabelText('Password'), 'consulting-password')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(loginMutate).toHaveBeenCalledWith({ email: 'mia@example.com', password: 'consulting-password' }, expect.anything())
    expect(await screen.findByText('/dashboard')).toBeInTheDocument()
  })

  it('offers another confirmation link when the email is not verified', () => {
    const error = new AxiosError('Unverified account')
    error.response = { status: 403 } as NonNullable<AxiosError['response']>
    vi.mocked(useLogin).mockReturnValue({ mutate: loginMutate, isError: true, error } as unknown as ReturnType<typeof useLogin>)
    renderPage('/login')

    expect(screen.getByText('Confirm your email first')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Resend confirmation' })).toHaveAttribute('href', '/verify-email')
  })

  it('keeps the entered credentials when login fails', async () => {
    const user = userEvent.setup()
    vi.mocked(useLogin).mockReturnValue({ mutate: loginMutate, isError: true, error: new Error('Unavailable') } as unknown as ReturnType<typeof useLogin>)
    renderPage('/login')
    await user.type(screen.getByLabelText('Email'), 'mia@example.com')

    expect(screen.getByText('Login failed')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveValue('mia@example.com')
  })

  it('prevents another login request while signing in', () => {
    vi.mocked(useLogin).mockReturnValue({ mutate: loginMutate, isPending: true } as unknown as ReturnType<typeof useLogin>)
    renderPage('/login')

    expect(screen.getByRole('button', { name: /Signing in/ })).toBeDisabled()
  })
})

describe('RegisterPage account creation', () => {
  it('asks for a name and a strong enough password before creating an account', async () => {
    const user = userEvent.setup()
    renderPage('/register')
    await user.type(screen.getByLabelText('Email'), 'mia@example.com')
    await user.click(screen.getByRole('button', { name: 'Create Account' }))

    expect(await screen.findByText('Name must be at least 2 characters')).toBeInTheDocument()
    expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument()
    expect(registerMutate).not.toHaveBeenCalled()
  })

  it('keeps the new account email for confirmation and opens the confirmation page', async () => {
    const user = userEvent.setup()
    registerMutate.mockImplementation((_values, options) => options.onSuccess({ email: 'mia@example.com' }))
    renderPage('/register')
    await user.type(screen.getByLabelText('Display Name'), 'Mia')
    await user.type(screen.getByLabelText('Email'), 'mia@example.com')
    await user.type(screen.getByLabelText('Password'), 'consulting-password')
    await user.click(screen.getByRole('button', { name: 'Create Account' }))

    expect(registerMutate).toHaveBeenCalledWith({ displayName: 'Mia', email: 'mia@example.com', password: 'consulting-password' }, expect.anything())
    expect(await screen.findByText('Account created')).toBeInTheDocument()
    expect(screen.getByLabelText('Email address')).toHaveValue('mia@example.com')
    expect(sessionStorage.getItem('pendingVerificationEmail')).toBe('mia@example.com')
  })

  it('shows a safe error when account creation fails', () => {
    vi.mocked(useRegister).mockReturnValue({ mutate: registerMutate, isError: true } as unknown as ReturnType<typeof useRegister>)
    renderPage('/register')

    expect(screen.getByText('Registration failed')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create Account' })).toBeEnabled()
  })

  it('prevents another registration while the account is being created', () => {
    vi.mocked(useRegister).mockReturnValue({ mutate: registerMutate, isPending: true } as unknown as ReturnType<typeof useRegister>)
    renderPage('/register')

    expect(screen.getByRole('button', { name: /Creating account/ })).toBeDisabled()
  })
})

describe('ForgotPasswordPage recovery request', () => {
  it('checks the email before requesting a reset link', async () => {
    const user = userEvent.setup()
    renderPage('/forgot-password')
    await user.click(screen.getByRole('button', { name: 'Send reset link' }))

    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument()
    expect(requestMutate).not.toHaveBeenCalled()
    await user.type(screen.getByLabelText('Email address'), 'mia@example.com')
    await user.click(screen.getByRole('button', { name: 'Send reset link' }))
    await waitFor(() => expect(requestMutate).toHaveBeenCalledWith('mia@example.com'))
  })

  it('acknowledges the request without revealing whether an account exists', () => {
    vi.mocked(useRequestPasswordReset).mockReturnValue({ mutate: requestMutate, isSuccess: true } as unknown as ReturnType<typeof useRequestPasswordReset>)
    renderPage('/forgot-password')

    expect(screen.getByText('Request received')).toBeInTheDocument()
    expect(screen.getByText(/if an eligible account exists/)).toBeInTheDocument()
  })

  it('offers a retry after delivery fails', () => {
    vi.mocked(useRequestPasswordReset).mockReturnValue({ mutate: requestMutate, isError: true } as unknown as ReturnType<typeof useRequestPasswordReset>)
    renderPage('/forgot-password')

    expect(screen.getByText('Email could not be sent')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send reset link' })).toBeEnabled()
  })
})

describe('ResetPasswordPage new password', () => {
  it('asks for a new link when the token is missing', () => {
    renderPage('/reset-password')

    expect(screen.getByText('Reset link missing')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Request reset link' })).toHaveAttribute('href', '/forgot-password')
    expect(screen.queryByLabelText('New password')).not.toBeInTheDocument()
    expect(resetMutate).not.toHaveBeenCalled()
  })

  it('rejects short and mismatched passwords without consuming the token', async () => {
    const user = userEvent.setup()
    renderPage('/reset-password?token=reset-token')
    await user.type(screen.getByLabelText('New password'), 'short')
    await user.type(screen.getByLabelText('Confirm new password'), 'different')
    await user.click(screen.getByRole('button', { name: 'Reset password' }))

    expect(await screen.findByText('Password must be at least 8 characters')).toBeInTheDocument()
    expect(screen.getByText('Passwords do not match')).toBeInTheDocument()
    expect(resetMutate).not.toHaveBeenCalled()
  })

  it('sends the token and matching password, then returns to sign in', async () => {
    const user = userEvent.setup()
    resetMutate.mockImplementation((_values, options) => options.onSuccess())
    renderPage('/reset-password?token=reset-token')
    await user.type(screen.getByLabelText('New password'), 'consulting-password')
    await user.type(screen.getByLabelText('Confirm new password'), 'consulting-password')
    await user.click(screen.getByRole('button', { name: 'Reset password' }))

    expect(resetMutate).toHaveBeenCalledWith({ token: 'reset-token', password: 'consulting-password' }, expect.anything())
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
  })

  it('offers another link when the reset token is unavailable', () => {
    vi.mocked(useConfirmPasswordReset).mockReturnValue({ mutate: resetMutate, isError: true } as unknown as ReturnType<typeof useConfirmPasswordReset>)
    renderPage('/reset-password?token=expired-token')

    expect(screen.getByText('Reset link is unavailable')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Request another reset link' })).toHaveAttribute('href', '/forgot-password')
  })

  it('prevents another reset while the new password is being saved', () => {
    vi.mocked(useConfirmPasswordReset).mockReturnValue({ mutate: resetMutate, isPending: true } as unknown as ReturnType<typeof useConfirmPasswordReset>)
    renderPage('/reset-password?token=reset-token')

    expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled()
  })
})

describe('VerifyEmailPage confirmation links', () => {
  it('uses the saved registration email when requesting another confirmation', async () => {
    const user = userEvent.setup()
    sessionStorage.setItem('pendingVerificationEmail', 'mia@example.com')
    renderPage('/verify-email')

    expect(screen.getByLabelText('Email address')).toHaveValue('mia@example.com')
    await user.click(screen.getByRole('button', { name: 'Send a new confirmation link' }))
    await waitFor(() => expect(resendMutate).toHaveBeenCalledWith('mia@example.com'))
    expect(confirmMutate).not.toHaveBeenCalled()
  })

  it('validates the email before resending a confirmation', async () => {
    const user = userEvent.setup()
    renderPage('/verify-email')
    await user.click(screen.getByRole('button', { name: 'Send a new confirmation link' }))

    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument()
    expect(resendMutate).not.toHaveBeenCalled()
  })

  it('confirms a token once even when React repeats the effect', async () => {
    sessionStorage.setItem('pendingVerificationEmail', 'mia@example.com')
    renderPage('/verify-email?token=verification-token')

    await waitFor(() => expect(confirmMutate).toHaveBeenCalledTimes(1))
    expect(confirmMutate).toHaveBeenCalledWith('verification-token')
  })

  it('offers sign in when an already-confirmed link is opened again', () => {
    renderPage('/verify-email?confirmed=1')

    expect(screen.getByText('Email confirmed')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Continue to sign in' })).toHaveAttribute('href', '/login')
    expect(screen.queryByLabelText('Email address')).not.toBeInTheDocument()
    expect(confirmMutate).not.toHaveBeenCalled()
  })

  it('acknowledges a resend without revealing account eligibility', () => {
    vi.mocked(useResendVerification).mockReturnValue({ mutate: resendMutate, isSuccess: true } as unknown as ReturnType<typeof useResendVerification>)
    renderPage('/verify-email')

    expect(screen.getByText('Request received')).toBeInTheDocument()
    expect(screen.getByText(/If the address is eligible/)).toBeInTheDocument()
  })
})
