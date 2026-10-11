/** Adds the email envelope to client reply bodies without duplicating one already written. */
export function formatClientEmail(reply: string, recipient: string | null, sender: string) {
  const text = reply.replace(/\r\n?/g, '\n').trim()
  const greeting = /^(?:hi|hello|dear|good morning|good afternoon|good evening|morning)(?:[ \t]+[^,\n.!?]+)?[,!]?[ \t]*$/i
  const firstLine = text.split('\n')[0]
  const hasGreeting = greeting.test(firstLine)
  const signOff = /(?:^|\n)(?:kind regards|best regards|warm regards|regards|sincerely|cheers|best wishes|all the best|best|thanks|thank you)[,!]?[ \t]*(?:\n[^\n]+){0,3}$/i
  const hasSignOff = signOff.test(text)

  const opening = hasGreeting ? firstLine : recipient?.trim() ? `Hi ${recipient.trim()},` : 'Hello,'
  const body = hasGreeting ? text.slice(firstLine.length).trimStart() : text
  const closing = hasSignOff ? '' : `Kind regards,\n${sender}`

  return [opening, body, closing].filter(Boolean).join('\n\n')
}
