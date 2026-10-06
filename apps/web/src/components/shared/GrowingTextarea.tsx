/**
 * A one-value field that wraps and grows with its text. Single-line inputs cut
 * long questions, KPIs and milestones off mid-sentence. Enter is kept out
 * because the field holds one item, not paragraphs; a pasted line break turns
 * into a space.
 */
import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, type TextareaHTMLAttributes } from 'react'

type Props = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'value' | 'rows'> & {
  value: string
  onChange: (value: string) => void
}

const GrowingTextarea = forwardRef<HTMLTextAreaElement, Props>(function GrowingTextarea({ value, onChange, onKeyDown, ...props }, ref) {
  const node = useRef<HTMLTextAreaElement | null>(null)
  useImperativeHandle(ref, () => node.current as HTMLTextAreaElement)

  useLayoutEffect(() => {
    const field = node.current
    if (!field) return
    field.style.height = 'auto'
    field.style.height = `${field.scrollHeight}px`
  }, [value])

  return (
    <textarea
      {...props}
      ref={node}
      rows={1}
      value={value}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.preventDefault()
        onKeyDown?.(event)
      }}
      onChange={(event) => onChange(event.target.value.replace(/\r?\n/g, ' '))}
    />
  )
})

export default GrowingTextarea
