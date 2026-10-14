import { useMutation } from '@tanstack/react-query'
import apiClient from '@/api/client'
import type { RegistrationResponse, TokenResponse } from '@/api/types'
import { useAuthStore } from '@/store/authStore'
import { ensureFreshAccessToken, sessionHeaders, withSessionLock } from '@/api/refreshSession'

export function useLogout() {
  return useMutation({
    mutationFn: async () => {
      await ensureFreshAccessToken()
      return withSessionLock(async () => {
        const token = useAuthStore.getState().token
        await apiClient.post('/api/v1/auth/logout', undefined, { withCredentials: true, headers: sessionHeaders })
        return token
      })
    },
    onSuccess: (revokedToken) => {
      // A delayed logout must never erase a newer login.
      if (useAuthStore.getState().token === revokedToken) useAuthStore.getState().logout()
    },
  })
}

export function useLogin() {
  const login = useAuthStore((s) => s.login)
  return useMutation({
    mutationFn: (data: { email: string; password: string }) => withSessionLock(async () => {
      const res = await apiClient.post<TokenResponse>('/api/v1/auth/login', data, { withCredentials: true, headers: sessionHeaders })
      login(res.data)
      return res.data
    }),
  })
}

export function useRegister() {
  return useMutation({
    mutationFn: async (data: { email: string; password: string; displayName: string }) => {
      const res = await apiClient.post<RegistrationResponse>('/api/v1/auth/register', data)
      return res.data
    },
  })
}

export function useCompleteOnboarding() {
  const completeOnboarding = useAuthStore((s) => s.completeOnboarding)

  return useMutation({
    mutationFn: async () => {
      await apiClient.post('/api/v1/users/me/onboarding/complete', undefined, { timeout: 5_000 })
    },
    onSuccess: completeOnboarding,
  })
}

export function useResendVerification() {
  return useMutation({
    mutationFn: async (email: string) => {
      await apiClient.post('/api/v1/auth/email-verification/resend', { email })
    },
  })
}

export function useConfirmVerification() {
  return useMutation({
    mutationFn: async (token: string) => {
      await apiClient.post('/api/v1/auth/email-verification/confirm', { token }, { timeout: 15_000 })
    },
  })
}

export function useRequestPasswordReset() {
  return useMutation({
    mutationFn: async (email: string) => {
      await apiClient.post('/api/v1/auth/password-reset/request', { email })
    },
  })
}

export function useConfirmPasswordReset() {
  return useMutation({
    mutationFn: async (data: { token: string; password: string }) => {
      await apiClient.post('/api/v1/auth/password-reset/confirm', data)
    },
  })
}
