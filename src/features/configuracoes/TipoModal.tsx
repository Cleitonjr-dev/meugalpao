import { useState, type FormEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { TITULO_SECAO } from '@/components/ui/estilos'
import { useToast } from '@/components/ui/Toast'
import { formatarValorInput, parseValorBR } from '@/utils/valor'
import type { Galpao, PrecoGalpao, TipoItem } from '@/types'
import { planejarPrecos } from './precosPorGalpao'

const FORM_ID = 'tipo-form'

interface TipoModalProps {
  open: boolean
  /** Tipo a editar; null cria um tipo novo */
  tipo: TipoItem | null
  galpoes: Galpao[]
  /** Todos os preços próprios (o modal usa só os do tipo editado) */
  precos: PrecoGalpao[]
  onClose: () => void
  onSaved: () => Promise<void>
}

type ConteudoProps = Omit<TipoModalProps, 'open'>

/** Montado só enquanto o modal está aberto: cada abertura começa com os valores gravados. */
function TipoModalAberto({ tipo, galpoes, precos, onClose, onSaved }: ConteudoProps) {
  const toast = useToast()
  const proprios = tipo ? precos.filter((p) => p.tipo_item_id === tipo.id) : []

  const [nome, setNome] = useState(tipo?.nome ?? '')
  const [precoPadrao, setPrecoPadrao] = useState(
    tipo ? formatarValorInput(Number(tipo.preco_semanal)) : '',
  )
  const [porGalpao, setPorGalpao] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      galpoes.map((g) => {
        const proprio = proprios.find((p) => p.galpao_id === g.id)
        return [g.id, proprio ? formatarValorInput(Number(proprio.preco_semanal)) : '']
      }),
    ),
  )
  const [saving, setSaving] = useState(false)

  const padraoNumero = parseValorBR(precoPadrao)
  const dicaPadrao = padraoNumero !== null ? formatarValorInput(padraoNumero) : '0,00'

  const salvar = async (e: FormEvent) => {
    e.preventDefault()
    if (saving) return

    const nomeLimpo = nome.trim()
    if (!nomeLimpo) {
      toast.error('Informe o nome do tipo.')
      return
    }
    if (padraoNumero === null) {
      toast.error('Informe um preço padrão válido, como 25,00.')
      return
    }
    // Valida todos os galpões antes de gravar qualquer coisa.
    const plano = planejarPrecos(
      proprios,
      galpoes.map((g) => ({ galpaoId: g.id, galpaoNome: g.nome, texto: porGalpao[g.id] ?? '' })),
    )
    if (!plano.ok) {
      toast.error(plano.erro)
      return
    }

    setSaving(true)
    const dadosTipo = { nome: nomeLimpo, preco_semanal: padraoNumero }

    // 1) o tipo
    let tipoId = tipo?.id ?? ''
    if (tipo) {
      const { error } = await supabase.from('tipos_item').update(dadosTipo).eq('id', tipo.id)
      if (error) {
        setSaving(false)
        toast.error('Erro ao salvar o tipo.')
        return
      }
    } else {
      const { data, error } = await supabase
        .from('tipos_item')
        .insert({ ...dadosTipo, galpao_id: null })
        .select('id')
        .single()
      if (error || !data) {
        setSaving(false)
        toast.error('Erro ao criar o tipo.')
        return
      }
      tipoId = (data as { id: string }).id
    }

    // 2) os preços próprios dos galpões
    const resultados = await Promise.all([
      plano.apagar.length > 0
        ? supabase.from('precos_galpao').delete().in('id', plano.apagar)
        : Promise.resolve({ error: null }),
      ...plano.atualizar.map((p) =>
        supabase.from('precos_galpao').update({ preco_semanal: p.preco_semanal }).eq('id', p.id),
      ),
      plano.inserir.length > 0
        ? supabase
            .from('precos_galpao')
            .insert(plano.inserir.map((p) => ({ ...p, tipo_item_id: tipoId })))
        : Promise.resolve({ error: null }),
    ])
    setSaving(false)

    if (resultados.some((r) => r.error)) {
      toast.error(
        'O tipo foi salvo, mas não foi possível gravar todos os preços dos galpões. Abra o tipo e confira.',
      )
      await onSaved()
      onClose()
      return
    }

    toast.success(tipo ? 'Tipo atualizado.' : 'Tipo criado.')
    await onSaved()
    onClose()
  }

  const rodape = (
    <div className="flex justify-end gap-2">
      <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
        Cancelar
      </Button>
      <Button type="submit" form={FORM_ID} loading={saving}>
        Salvar
      </Button>
    </div>
  )

  return (
    <Modal
      open
      size="md"
      title={tipo ? 'Editar tipo' : 'Novo tipo'}
      onClose={() => !saving && onClose()}
      closeOnBackdrop={false}
      footer={rodape}
    >
      <form id={FORM_ID} onSubmit={salvar} className="flex flex-col gap-5 pb-6">
        <Input
          label="Nome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex.: Carrinho de pastel"
          autoFocus
        />

        <Input
          label="Preço padrão (semanal)"
          value={precoPadrao}
          onChange={(e) => setPrecoPadrao(e.target.value)}
          placeholder="0,00"
          inputMode="decimal"
          hint="Vale em todos os galpões que não têm preço próprio."
        />

        {galpoes.length > 0 && (
          <section className="flex flex-col gap-3 border-t border-slate-200 pt-5 dark:border-slate-700">
            <div>
              <h3 className={TITULO_SECAO}>Preços por galpão</h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Preencha só onde o preço for diferente. Deixe vazio para usar o padrão.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {galpoes.map((g) => {
                const texto = porGalpao[g.id] ?? ''
                const proprio = texto.trim() !== ''
                return (
                  <Input
                    key={g.id}
                    label={g.nome}
                    value={texto}
                    onChange={(e) => setPorGalpao((atual) => ({ ...atual, [g.id]: e.target.value }))}
                    placeholder={dicaPadrao}
                    inputMode="decimal"
                    hint={proprio ? 'Preço próprio neste galpão' : 'Usa o preço padrão'}
                  />
                )
              })}
            </div>
          </section>
        )}
      </form>
    </Modal>
  )
}

export function TipoModal({ open, ...props }: TipoModalProps) {
  if (!open) return null
  return <TipoModalAberto {...props} />
}
