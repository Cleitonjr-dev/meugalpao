import { useState, type FormEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import { TITULO_SECAO } from '@/components/ui/estilos'
import { useToast } from '@/components/ui/Toast'
import { ItensEditor } from './ItensEditor'
import {
  RASCUNHO_VAZIO,
  ajustarQuantidadeNovo,
  ajustarQuantidadeSalvo,
  incluirItem,
  novaChave,
  rascunhoPreenchido,
  resumoAlteracoes,
  validarRascunho,
  type ItemNovo,
  type RascunhoItem,
} from './itens'
import { DIAS_PAGAMENTO, DIAS_PAGAMENTO_LABEL } from '@/config/constants'
import { normalizarWhatsapp } from '@/utils/cobranca'
import type { Cliente, DiaPagamento, ItemGuardado, PrecoGalpao, TipoItem } from '@/types'

const FORM_ID = 'cliente-form'

interface ClienteModalProps {
  open: boolean
  cliente: Cliente | null
  galpaoId: string
  tipos: TipoItem[]
  precos: PrecoGalpao[]
  itens: ItemGuardado[]
  onClose: () => void
  onSaved: () => void
}

type ConteudoProps = Omit<ClienteModalProps, 'open'>

/** Montado só enquanto o modal está aberto: cada abertura começa com o estado do cliente escolhido. */
function ClienteModalAberto({
  cliente,
  galpaoId,
  tipos,
  precos,
  itens,
  onClose,
  onSaved,
}: ConteudoProps) {
  const { user } = useAuth()
  const toast = useToast()
  const [clienteAtual, setClienteAtual] = useState<Cliente | null>(cliente)
  const [nome, setNome] = useState(cliente?.nome ?? '')
  const [telefone, setTelefone] = useState(cliente?.telefone ?? '')
  const [whatsapp, setWhatsapp] = useState(cliente?.whatsapp ?? '')
  const [diaPagamento, setDiaPagamento] = useState<DiaPagamento>(cliente?.dia_pagamento ?? 'quarta')
  const [observacoes, setObservacoes] = useState(cliente?.observacoes ?? '')
  const [ativo, setAtivo] = useState(cliente?.ativo ?? true)
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // Itens: ficam só na tela até clicar em Salvar.
  const [novos, setNovos] = useState<ItemNovo[]>([])
  const [ajustes, setAjustes] = useState<Record<string, number>>({})
  const [removidos, setRemovidos] = useState<string[]>([])
  const [rascunho, setRascunho] = useState<RascunhoItem>(RASCUNHO_VAZIO)

  const salvos = clienteAtual
    ? itens.filter((i) => i.cliente_id === clienteAtual.id && i.ativo)
    : []

  const alterado =
    nome !== (cliente?.nome ?? '') ||
    telefone !== (cliente?.telefone ?? '') ||
    whatsapp !== (cliente?.whatsapp ?? '') ||
    diaPagamento !== (cliente?.dia_pagamento ?? 'quarta') ||
    observacoes !== (cliente?.observacoes ?? '') ||
    ativo !== (cliente?.ativo ?? true) ||
    novos.length > 0 ||
    Object.keys(ajustes).length > 0 ||
    removidos.length > 0 ||
    rascunhoPreenchido(rascunho)

  // Fechar (Cancelar, X ou Esc) descarta o que não foi salvo: pede confirmação se houver algo.
  const tentarFechar = () => {
    if (saving) return
    if (alterado && !window.confirm('Descartar as alterações que ainda não foram salvas?')) return
    onClose()
  }

  const alternarRemocao = (id: string) => {
    const marcando = !removidos.includes(id)
    setRemovidos((atual) => (marcando ? [...atual, id] : atual.filter((x) => x !== id)))
    // quem vai ser removido não precisa mais do ajuste de quantidade
    if (marcando) desfazerAjuste(id)
  }

  const desfazerAjuste = (id: string) =>
    setAjustes((atual) => Object.fromEntries(Object.entries(atual).filter(([k]) => k !== id)))

  // − / + em item já gravado: chegando a zero o item vai para "será removido".
  const alterarQuantidade = (item: ItemGuardado, passo: number) => {
    const r = ajustarQuantidadeSalvo(ajustes, removidos, item, passo)
    setAjustes(r.ajustes)
    setRemovidos(r.removidos)
  }

  const alterarQuantidadeNovo = (chave: string, passo: number) =>
    setNovos((atual) => ajustarQuantidadeNovo(atual, chave, passo))

  // Item igual a outro já na lista (gravado ou novo) só soma a quantidade, sem repetir a linha.
  const adicionarItem = (item: ItemNovo) => {
    const resultado = incluirItem({ novos, ajustes }, item, salvos, removidos)
    setNovos(resultado.novos)
    setAjustes(resultado.ajustes)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (saving) return
    setErro(null)
    if (!nome.trim()) {
      setErro('Informe o nome do cliente.')
      return
    }
    if (whatsapp.trim() && !normalizarWhatsapp(whatsapp)) {
      setErro('WhatsApp inválido. Informe DDD + número, ex.: (85) 99999-9999.')
      return
    }

    // Item preenchido no formulário e ainda não incluído na lista: entra junto no Salvar.
    let estado = { novos, ajustes }
    if (rascunhoPreenchido(rascunho)) {
      const resultado = validarRascunho(rascunho)
      if (!resultado.ok) {
        setErro(`Item em preenchimento: ${resultado.erro} Ou limpe os campos do item.`)
        return
      }
      estado = incluirItem(estado, { chave: novaChave(), ...resultado.item }, salvos, removidos)
    }
    const paraAdicionar = estado.novos
    const idsAjuste = Object.keys(estado.ajustes).filter((id) => !removidos.includes(id))
    const aumentou = idsAjuste.reduce((soma, id) => soma + Math.max(0, estado.ajustes[id]), 0)
    const diminuiu = idsAjuste.reduce((soma, id) => soma + Math.max(0, -estado.ajustes[id]), 0)
    const unidadesAdicionadas = paraAdicionar.reduce((soma, i) => soma + i.quantidade, 0) + aumentou
    const unidadesRemovidas =
      salvos.filter((i) => removidos.includes(i.id)).reduce((soma, i) => soma + i.quantidade, 0) +
      diminuiu

    setSaving(true)
    const dados = {
      nome: nome.trim(),
      telefone: telefone.trim() || null,
      whatsapp: whatsapp.trim() || null,
      dia_pagamento: diaPagamento,
      observacoes: observacoes.trim() || null,
      ativo,
    }

    // Se algo falhar no meio, o que já foi gravado fica fora das listas pendentes
    // (assim tentar de novo não duplica nem repete nada).
    const falhar = (inline: string, aviso: string, algoGravado: boolean) => {
      setSaving(false)
      setErro(inline)
      toast.error(aviso)
      if (algoGravado) onSaved()
    }

    // 1) cliente
    let alvo = clienteAtual
    let criou = false
    if (alvo) {
      const { error } = await supabase.from('clientes').update(dados).eq('id', alvo.id)
      if (error) return falhar('Erro ao salvar cliente.', 'Não foi possível salvar o cliente.', false)
    } else {
      const { data, error } = await supabase
        .from('clientes')
        .insert({ ...dados, galpao_id: galpaoId, criado_por: user?.id ?? null })
        .select()
        .single()
      if (error || !data) {
        return falhar('Erro ao criar cliente.', 'Não foi possível criar o cliente.', false)
      }
      alvo = data as Cliente
      criou = true
      setClienteAtual(alvo)
    }

    // 2) itens removidos
    if (removidos.length > 0) {
      const { error } = await supabase.from('itens_guardados').delete().in('id', removidos)
      if (error) {
        return falhar(
          'O cliente foi salvo, mas não foi possível remover os itens. Tente salvar de novo.',
          'Não foi possível remover os itens.',
          true,
        )
      }
      setRemovidos([])
    }

    // 3) quantidade alterada em itens que já existiam
    if (idsAjuste.length > 0) {
      const resultados = await Promise.all(
        idsAjuste.map((id) => {
          const base = salvos.find((i) => i.id === id)?.quantidade ?? 0
          return supabase
            .from('itens_guardados')
            .update({ quantidade: base + estado.ajustes[id] })
            .eq('id', id)
        }),
      )
      if (resultados.some((r) => r.error)) {
        return falhar(
          'O cliente foi salvo, mas não foi possível atualizar as quantidades. Tente salvar de novo.',
          'Não foi possível atualizar as quantidades.',
          true,
        )
      }
      setAjustes({})
    }

    // 4) itens novos
    if (paraAdicionar.length > 0) {
      const { error } = await supabase.from('itens_guardados').insert(
        paraAdicionar.map((item) => ({
          cliente_id: alvo.id,
          galpao_id: alvo.galpao_id,
          tipo_item_id: item.tipo_item_id,
          identificacao: item.identificacao,
          quantidade: item.quantidade,
        })),
      )
      if (error) {
        return falhar(
          'O cliente foi salvo, mas não foi possível gravar os itens. Tente salvar de novo.',
          'Não foi possível gravar os itens.',
          true,
        )
      }
      setNovos([])
      setRascunho(RASCUNHO_VAZIO)
    }

    const resumo = resumoAlteracoes(unidadesAdicionadas, unidadesRemovidas)
    toast.success(
      `${criou ? 'Cliente criado.' : 'Cliente salvo.'}${
        resumo ? ` ${resumo.charAt(0).toUpperCase()}${resumo.slice(1)}.` : ''
      }`,
    )
    setSaving(false)
    onSaved()
    onClose()
  }

  const rodape = (
    <div className="flex justify-end gap-2">
      <Button type="button" variant="text" onClick={tentarFechar} disabled={saving}>
        Cancelar
      </Button>
      <Button type="submit" form={FORM_ID} loading={saving}>
        {clienteAtual ? 'Salvar' : 'Criar cliente'}
      </Button>
    </div>
  )

  return (
    <Modal
      open
      size="xl"
      title={cliente ? 'Editar cliente' : 'Novo cliente'}
      onClose={tentarFechar}
      closeOnBackdrop={false}
      footer={rodape}
    >
      <div className="grid gap-6 pb-6 md:grid-cols-2 md:gap-0">
        {/* Esquerda: dados do cliente */}
        <form id={FORM_ID} onSubmit={handleSubmit} className="flex flex-col gap-4 md:pr-6">
          <h3 className={TITULO_SECAO}>Dados do cliente</h3>

          <Input
            label="Nome"
            name="nome"
            required
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Nome do cliente"
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Telefone"
              name="telefone"
              inputMode="tel"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              placeholder="(85) 99999-9999"
            />
            <Input
              label="WhatsApp"
              name="whatsapp"
              inputMode="tel"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="(85) 99999-9999"
            />
          </div>
          <Select
            label="Dia de pagamento"
            value={diaPagamento}
            onChange={(value) => setDiaPagamento(value as DiaPagamento)}
            options={DIAS_PAGAMENTO.map((dia) => ({ value: dia, label: DIAS_PAGAMENTO_LABEL[dia] }))}
          />
          <Input
            label="Observações"
            name="observacoes"
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Opcional"
          />
          <Checkbox
            label="Cliente ativo (inativos não aparecem nas cobranças)"
            checked={ativo}
            onChange={setAtivo}
          />

          {erro && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {erro}
            </p>
          )}
        </form>

        {/* Direita: itens guardados (fora do <form>: Enter aqui só inclui o item na lista) */}
        <section className="flex flex-col gap-3 border-t border-slate-200 pt-6 dark:border-slate-700 md:border-l md:border-t-0 md:pl-6 md:pt-0">
          <ItensEditor
            tipos={tipos}
            precos={precos}
            salvos={salvos}
            removidos={removidos}
            novos={novos}
            ajustes={ajustes}
            rascunho={rascunho}
            desabilitado={saving}
            onRascunhoChange={setRascunho}
            onAdicionar={adicionarItem}
            onAlternarRemocao={alternarRemocao}
            onAlterarQuantidade={alterarQuantidade}
            onDesfazerAjuste={desfazerAjuste}
            onAlterarQuantidadeNovo={alterarQuantidadeNovo}
            onRemoverNovo={(chave) => setNovos((atual) => atual.filter((i) => i.chave !== chave))}
          />
        </section>
      </div>
    </Modal>
  )
}

export function ClienteModal({ open, ...props }: ClienteModalProps) {
  if (!open) return null
  return <ClienteModalAberto {...props} />
}
