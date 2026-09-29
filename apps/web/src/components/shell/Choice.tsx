/**
 * Every pick-one field in the mockups uses Carbon's Dropdown — the same control
 * as the scenario catalogue filters — instead of the browser's native <select>,
 * whose menu is drawn by the operating system and ignores the design system.
 */
import { Dropdown } from '@carbon/react'

export interface ChoiceOption<T extends string> {
  value: T
  label: string
}

export default function Choice<T extends string>({ id, label, value, options, onChange, hideLabel = false, size = 'md', disabled = false }: {
  id: string
  label: string
  value: T
  options: ChoiceOption<T>[]
  onChange: (value: T) => void
  hideLabel?: boolean
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
}) {
  return (
    <Dropdown
      id={id}
      titleText={label}
      hideLabel={hideLabel}
      label={label}
      size={size}
      disabled={disabled}
      items={options}
      itemToString={(item) => (item ? item.label : '')}
      selectedItem={options.find((option) => option.value === value) ?? null}
      onChange={({ selectedItem }) => selectedItem && onChange(selectedItem.value)}
    />
  )
}
