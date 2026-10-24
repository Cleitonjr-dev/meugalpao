import { useMemo, useState, type FormEvent } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { registrarPagamento } from './pagamentos.service'
import { formatCurrency } from '@/lib/utils'
import { FORMAS_PAGAMENTO, FORMAS_PAGAMENTO_LABEL } from '@/config/constants'
import { formatarValorInput, parseValorBR } from '@/utils/valor'
import {
  clienteEmAtraso,
  formatarDataCurta,
  referenciasDisponiveis,
  situacaoCliente,
} from '@/utils/pagamentos'
import type { Cliente, FormaPagamento, Pagamento, Recibo } from '@/types'

interface RegistrarPagamentoModalProps {
  open: boolean
  onClose: () => void
  galpaoId: string
  clientes: Cliente[]
  /** Semanas já pagas (ver indexarPagos) */
  pagos: Set<string>
  hoje: Date
  clienteInicialId?: string | null
  getValorSemanal: (clienteId: string) => number
  onPago: (pagamento: Pagamento, recibo: Recibo) => void
}

type FormularioProps = Omit<RegistrarPagamentoModalProps, 'open'>

/** Montado só quando o modal abre: o estado inicial vem das props, sem efeitos de sincronização. */
function Formulario({
  onClose,
  galpaoId,
  clientes,
  pagos,
  hoje,
  clienteInicialId,
  getValorSemanal,
  onPago,
}: FormularioProps) {
  const ativos = useMemo(() => clientes.filter((c) => c.ativo), [clientes])
  const inicial = ativos.find((c) => c.id === clienteInicialId) ?? null

  const referenciasDe = (cliente: Cliente | null) =>
    cliente ? referenciasDisponiveis(cliente, pagos, hoje) : []

  const [clienteId, setClienteId] = useState(inicial?.id ?? '')
  const [referencia, setReferencia] = useState(referenciasDe(inicial)[0]?.iso ?? '')
  const [valor, setValor] = useState(inicial ? formatarValorInput(getValorSemanal(inicial.id)) : '')
  const [forma, setForma] = useState<FormaPagamento>('dinheiro')
  const [observacoes, setObservacoes] = useState('')
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const clienteSelecionado = ativos.find((c) => c.id === clienteId) ?? null
  const referencias = useMemo(
    () => (clienteSelecionado ? referenciasDisponiveis(clienteSelecionado, pagos, hoje) : []),
    [clienteSelecionado, pagos, hoje],
  )
  const situacao = clienteSelecionado ? situacaoCliente(clienteSelecionado, pagos, hoje) : null
  const semReferencias = clienteSelecionado !== null && referencias.length === 0

  const { clientesAtraso, clientesEmDia } = useMemo(() => {
    const atraso: Cliente[] = []
    const emDia: Cliente[] = []
    for (const c of ativos) (clienteEmAtraso(c, pagos, hoje) ? atraso : emDia).push(c)
    return { clientesAtraso: atraso, clientesEmDia: emDia }
  }, [ativos, pagos, hoje])

  // Trocar de cliente preenche valor e cobrança sugeridos; edições feitas depois são preservadas.
  const escolherCliente = (id: string) => {
    setClienteId(id)
    setErro(null)
    const cliente = ativos.find((c) => c.id === id) ?? null
    setReferencia(referenciasDe(cliente)[0]?.iso ?? '')
    setValor(cliente ? formatarValorInput(getValorSemanal(cliente.id)) : '')
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (saving) return
    setErro(null)
    if (!clienteId) {
      setErro('Selecione o cliente.')
      return
    }
    if (!referencia) {
      setErro('Selecione a cobrança (referente a).')
      return
    }
    const valorNum = parseValorBR(valor)
    if (valorNum === null || valorNum <= 0) {
      setErro('Informe um valor válido, maior que zero (ex.: 25,00).')
      return
    }
    setSaving(true)
    const resultado = await registrarPagamento({
      galpaoId,
      clienteId,
      valor: valorNum,
      forma,
      semanaReferencia: referencia,
      observacoes: observacoes.trim() || null,
    })
    setSaving(false)
    if ('error' in resultado) {
      setErro(resultado.error)
      return
    }
    onPago(resultado.pagamento, resultado.recibo)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Select
        label="Cliente"
        value={clienteId}
        onChange={escolherCliente}
        placeholder="Selecione..."
        searchable
        options={[
          ...clientesAtraso.map((c) => ({ value: c.id, label: c.nome })),
          ...clientesEmDia.map((c) => ({ value: c.id, label: `${c.nome} (em dia)` })),
        ]}
      />

      {clienteSelecionado &&
        (semReferencias ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {situacao?.pagoAte
              ? `Cliente em dia até ${formatarDataCurta(situacao.pagoAte)}.`
              : 'Sem cobranças pendentes.'}
          </p>
        ) : (
          <Select
            label="Referente a"
            value={referencia}
            onChange={setReferencia}
            options={referencias.map((r) => ({
              value: r.iso,
              label: `${r.label} — ${formatCurrency(getValorSemanal(clienteSelecionado.id))}`,
            }))}
          />
        ))}

      <Input
        label="Valor (R$)"
        name="valor"
        inputMode="decimal"
        required
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        placeholder="0,00"
      />

      <Select
        label="Forma de pagamento"
        value={forma}
        onChange={(value) => setForma(value as FormaPagamento)}
        options={FORMAS_PAGAMENTO.map((f) => ({ value: f, label: FORMAS_PAGAMENTO_LABEL[f] }))}
      />

      <Input
        label="Observações"
        name="observacoes"
        value={observacoes}
        onChange={(e) => setObservacoes(e.target.value)}
        maxLength={500}
        placeholder="Opcional"
      />

      {erro && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {erro}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" loading={saving} disabled={semReferencias} className="flex-1">
          {saving ? 'Salvando...' : 'Confirmar pagamento'}
        </Button>
        <Button type="button" variant="text" onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}

export function RegistrarPagamentoModal({ open, ...props }: RegistrarPagamentoModalProps) {
  return (
    <Modal open={open} title="Registrar pagamento" onClose={props.onClose} closeOnBackdrop={false}>
      <Formulario {...props} />
    </Modal>
  )
}
