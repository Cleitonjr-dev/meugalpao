import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'

export interface FilterOption {
  value: string
  label: string
}

export interface FilterGroup {
  key: string
  label: string
  options: FilterOption[]
}

export type FilterValues = Record<string, string[]>

interface FilterModalProps {
  open: boolean
  onClose: () => void
  groups: FilterGroup[]
  values: FilterValues
  onApply: (values: FilterValues) => void
}

type ConteudoProps = Omit<FilterModalProps, 'open'>

/** Montado só enquanto o modal está aberto: o rascunho nasce dos filtros atuais. */
function FilterConteudo({ onClose, groups, values, onApply }: ConteudoProps) {
  const [draft, setDraft] = useState<FilterValues>(values)

  const toggle = (key: string, value: string) => {
    setDraft((prev) => {
      const atual = prev[key] ?? []
      const proximo = atual.includes(value)
        ? atual.filter((v) => v !== value)
        : [...atual, value]
      return { ...prev, [key]: proximo }
    })
  }

  const aplicar = () => {
    onApply(draft)
    onClose()
  }

  return (
    <div className="flex flex-col gap-5">
      {groups.map((group) => (
        <div key={group.key}>
          <p className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            {group.label}
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {group.options.map((opt) => {
              const checked = (draft[group.key] ?? []).includes(opt.value)
              return (
                <label
                  key={opt.value}
                  className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-200"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary-600"
                    checked={checked}
                    onChange={() => toggle(group.key, opt.value)}
                  />
                  {opt.label}
                </label>
              )
            })}
          </div>
        </div>
      ))}

      <div className="flex items-center justify-between border-t border-slate-200 pt-4 dark:border-slate-700">
        <Button variant="text" onClick={() => setDraft({})}>
          Limpar
        </Button>
        <div className="flex gap-2">
          <Button variant="text" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={aplicar}>Aplicar</Button>
        </div>
      </div>
    </div>
  )
}

export function FilterModal({ open, ...props }: FilterModalProps) {
  return (
    <Modal open={open} title="Filtros" onClose={props.onClose}>
      <FilterConteudo {...props} />
    </Modal>
  )
}
