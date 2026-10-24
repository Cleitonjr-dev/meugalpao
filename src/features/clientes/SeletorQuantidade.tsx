import { Minus, Plus } from 'lucide-react'
import { Tooltip } from '@/components/ui/Tooltip'

interface SeletorQuantidadeProps {
  valor: number
  onMenos: () => void
  onMais: () => void
  desabilitado?: boolean
  /** Desativa o "−" (ex.: item novo não pode ficar abaixo de 1) */
  semMenos?: boolean
  textoMenos?: string
  textoMais?: string
}

const BOTAO =
  'inline-flex h-7 w-7 items-center justify-center text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white'

/** Controle − / + para ajustar a quantidade de um item. */
export function SeletorQuantidade({
  valor,
  onMenos,
  onMais,
  desabilitado = false,
  semMenos = false,
  textoMenos = 'Diminuir quantidade',
  textoMais = 'Aumentar quantidade',
}: SeletorQuantidadeProps) {
  return (
    <div className="inline-flex shrink-0 items-center overflow-hidden rounded-md border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950">
      <Tooltip texto={textoMenos}>
        <button
          type="button"
          onClick={onMenos}
          disabled={desabilitado || semMenos}
          aria-label={textoMenos}
          className={BOTAO}
        >
          <Minus size={14} />
        </button>
      </Tooltip>
      <span
        className="min-w-7 px-1 text-center text-sm font-medium tabular-nums text-slate-900 dark:text-slate-100"
        aria-live="polite"
      >
        {valor}
      </span>
      <Tooltip texto={textoMais}>
        <button
          type="button"
          onClick={onMais}
          disabled={desabilitado}
          aria-label={textoMais}
          className={BOTAO}
        >
          <Plus size={14} />
        </button>
      </Tooltip>
    </div>
  )
}
