import { describe, expect, it } from 'vitest'
import { formatClientEmail } from './clientEmail'

describe('client email formatting', () => {
  it('adds a named greeting and signature around the saved reply body', () => {
    const body = 'I am happy to arrange an introductory meeting.\nPlease send a couple of times.'
    expect(formatClientEmail(body, 'Alex Taylor', 'John Doe'))
      .toBe(`Hi Alex Taylor,\n\n${body}\n\nKind regards,\nJohn Doe`)
  })

  it.each(['Hi Alex,', 'Dear Alex,', 'Hello Alex,', 'Good morning Alex,'])(
    'preserves an existing %s greeting and sign-off without duplication', (greeting) => {
      const reply = `${greeting}\n\nPlease send more information.\n\nCheers,\nJohn`
      expect(formatClientEmail(reply, 'Alex Taylor', 'John Doe')).toBe(reply)
    },
  )

  it('adds only the missing sign-off and separates an existing greeting from the body', () => {
    expect(formatClientEmail('Dear Alex,\nWe cannot proceed.', 'Alex Taylor', 'John Doe'))
      .toBe('Dear Alex,\n\nWe cannot proceed.\n\nKind regards,\nJohn Doe')
  })

  it('adds only the missing greeting when a reply already has a signature', () => {
    expect(formatClientEmail('Please send a capability brief.\n\nSincerely,\nJohn Doe', 'Alex', 'John Doe'))
      .toBe('Hi Alex,\n\nPlease send a capability brief.\n\nSincerely,\nJohn Doe')
  })

  it('uses a neutral greeting when the learner name is unavailable', () => {
    expect(formatClientEmail('We are not considering this work.', null, 'John Doe'))
      .toBe('Hello,\n\nWe are not considering this work.\n\nKind regards,\nJohn Doe')
  })
})
