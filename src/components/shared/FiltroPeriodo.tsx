import { DatePicker } from '@/components/ui/DatePicker'
import { useLimitesPeriodo } from '@/hooks/useLimitesPeriodo'
import { cn } from '@/lib/utils'
import {
  PRESETS_PERIODO,
  periodoDoPreset,
  presetDoPeriodo,
  type PresetPeriodo,
} from '@/utils/periodo'

interface FiltroPeriodoProps {
  de: string | null
  ate: string | null
  onChange: (periodo: { de: string | null; ate: string | null }) => void
  hoje: Date
  /** Quando informado, aparece "Limpar período" enquanto houver datas escolhidas */
  onLimpar?: () => void
}

const CHIP_ATIVO = 'bg-primary-600 text-white'
const CHIP_INATIVO =
  'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'

/** Atalhos de período + datas De/Até no mesmo estilo dos demais campos do sistema. */
export function FiltroPeriodo({ de, ate, onChange, hoje, onLimpar }: FiltroPeriodoProps) {
  const limites = useLimitesPeriodo()
  const presetAtual = de && ate ? presetDoPeriodo({ de, ate }, hoje) : null

  const escolherPreset = (preset: PresetPeriodo) => onChange(periodoDoPreset(preset, hoje))

  const mudarDe = (valor: string) => {
    const novo = valor || null
    // início depois do fim: leva o fim junto, em vez de mostrar uma lista vazia sem explicação
    onChange({ de: novo, ate: novo && ate && novo > ate ? novo : ate })
  }

  const mudarAte = (valor: string) => {
    const novo = valor || null
    onChange({ de: novo && de && novo < de ? novo : de, ate: novo })
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 lg:flex-row lg:items-end lg:justify-between">
      <div className="flex flex-col gap-[5px]">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-slate-900 dark:text-slate-100">Período</span>
          {onLimpar && (de || ate) && (
            <button
              type="button"
              onClick={onLimpar}
              className="rounded text-sm font-medium text-primary-600 hover:underline dark:text-primary-400"
            >
              Limpar período
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {PRESETS_PERIODO.map((p) => (
            <button
              key={p.valor}
              type="button"
              onClick={() => escolherPreset(p.valor)}
              aria-pressed={presetAtual === p.valor}
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                presetAtual === p.valor ? CHIP_ATIVO : CHIP_INATIVO,
              )}
            >
              {p.rotulo}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:w-[22rem]">
        <DatePicker
          label="De"
          value={de ?? ''}
          min={limites.min}
          max={ate && ate < limites.max ? ate : limites.max}
          placeholder="dd/mm/aaaa"
          onChange={mudarDe}
        />
        <DatePicker
          label="Até"
          value={ate ?? ''}
          min={de && de > limites.min ? de : limites.min}
          max={limites.max}
          placeholder="dd/mm/aaaa"
          onChange={mudarAte}
        />
      </div>
    </div>
  )
}
