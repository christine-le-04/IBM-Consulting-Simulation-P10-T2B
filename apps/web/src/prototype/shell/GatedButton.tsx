/**
 * A way forward that is never locked. While its checklist is not met, the
 * first press opens the checklist (words only, FR-14) with "keep working" and
 * "continue anyway"; once met, it goes straight on.
 */
import { useState, type ReactNode } from 'react'
import { Button, Popover, PopoverContent } from '@carbon/react'
import type { CarbonIconType } from '@carbon/icons-react'
import ReadinessList from './ReadinessList'
import styles from './shell.module.scss'

export interface GatedButtonProps {
  ready: boolean
  checklist?: { label: string; done: boolean }[]
  title: string
  stayLabel: string
  onGo: () => void
  children: ReactNode
  size?: 'sm' | 'md' | 'lg'
  notReadyKind?: 'secondary' | 'tertiary'
  renderIcon?: CarbonIconType
  disabled?: boolean
  className?: string
}

export default function GatedButton({ ready, checklist, title, stayLabel, onGo, children, size, notReadyKind = 'tertiary', renderIcon, disabled, className }: GatedButtonProps) {
  const [open, setOpen] = useState(false)
  const warn = !ready && !!checklist
  const button = (
    <Button
      size={size}
      kind={ready ? 'primary' : notReadyKind}
      renderIcon={renderIcon}
      disabled={disabled}
      onClick={() => (warn ? setOpen(!open) : onGo())}
      aria-expanded={warn ? open : undefined}
    >
      {children}
    </Button>
  )
  if (!warn || !checklist) return <span className={className}>{button}</span>

  return (
    <Popover open={open} align="bottom-right" dropShadow onRequestClose={() => setOpen(false)} className={className}>
      {button}
      <PopoverContent>
        <div className={styles.readyPop}>
          <p className={styles.eyebrow}>{title}</p>
          <ReadinessList items={checklist} />
          <p className={styles.muted}>You can still go now. What is missing will show in how the client responds.</p>
          <div className={styles.readyActions}>
            <Button kind="secondary" size="sm" onClick={() => setOpen(false)}>{stayLabel}</Button>
            <Button kind="primary" size="sm" onClick={() => { setOpen(false); onGo() }}>Continue anyway</Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
