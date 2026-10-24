import { useQuery } from '@tanstack/react-query'
import { Badge } from '@/components/ui/Badge'
import { Loading } from '@/components/ui/Loading'
import { FORMAS_PAGAMENTO_LABEL } from '@/config/constants'
import { verificarRecibo } from '@/features/pagamentos/pagamentos.queries'
import { formatCurrency } from '@/lib/utils'
import { formatarCodigo } from '@/utils/codigo'
import { formatarDataBR } from '@/utils/data'
import { formatarNumeroRecibo } from '@/utils/recibo'

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-slate-100 py-2 text-sm last:border-0 dark:border-slate-800">
      <dt className="text-slate-500 dark:text-slate-400">{rotulo}</dt>
      <dd className="text-right font-medium text-slate-900 dark:text-white">{valor}</dd>
    </div>
  )
}

interface ResultadoVerificacaoProps {
  /** Código já normalizado (16 caracteres) ou null quando não há o que consultar */
  codigo: string | null
  /** O texto digitado não chegou a formar um código completo */
  incompleto?: boolean
}

/**
 * Consulta o código no servidor e mostra o resultado: válido, cancelado ou não encontrado.
 * Usado pela página /verificar e pelo modal das telas Recibos e Pagamentos.
 */
export function ResultadoVerificacao({ codigo, incompleto = false }: ResultadoVerificacaoProps) {
  const consulta = useQuery({
    queryKey: ['verificar-recibo', codigo],
    queryFn: () => verificarRecibo(codigo as string),
    enabled: codigo !== null,
    staleTime: 0,
    retry: false,
  })
  const resultado = consulta.data

  return (
    <div aria-live="polite">
      {incompleto && (
        <p className="text-sm text-amber-700 dark:text-amber-400">
          O código tem 16 letras e números (ex.: A3F9-27C1-5DE0-B481). Confira o que foi digitado.
        </p>
      )}

      {codigo && consulta.isPending && <Loading size={32} label="Carregando..." />}

      {codigo && consulta.isError && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          Não foi possível consultar agora. Tente novamente em instantes.
        </p>
      )}

      {codigo && !consulta.isPending && !consulta.isError && !resultado && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          <p className="font-semibold">Recibo não encontrado</p>
          <p className="mt-1">
            Nenhum recibo tem o código {formatarCodigo(codigo)}. Desconfie deste documento.
          </p>
        </div>
      )}

      {resultado && (
        <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="font-semibold text-slate-900 dark:text-white">
              Recibo Nº {formatarNumeroRecibo(resultado.numero)}
            </p>
            <Badge variant={resultado.situacao === 'valido' ? 'success' : 'danger'}>
              {resultado.situacao === 'valido' ? 'Válido' : 'Cancelado'}
            </Badge>
          </div>
          <dl>
            <Linha rotulo="Galpão" valor={resultado.galpao} />
            <Linha rotulo="Cliente" valor={resultado.cliente} />
            <Linha rotulo="Valor" valor={formatCurrency(Number(resultado.valor))} />
            <Linha rotulo="Data" valor={formatarDataBR(resultado.data)} />
            {resultado.referente && (
              <Linha rotulo="Cobrança de" valor={formatarDataBR(resultado.referente)} />
            )}
            <Linha rotulo="Forma" valor={FORMAS_PAGAMENTO_LABEL[resultado.forma]} />
            <Linha rotulo="Código" valor={formatarCodigo(resultado.codigo)} />
          </dl>
          {resultado.situacao === 'cancelado' && (
            <p className="mt-3 text-sm text-red-700 dark:text-red-400">
              Este recibo foi cancelado
              {resultado.cancelado_em ? ` em ${formatarDataBR(resultado.cancelado_em)}` : ''} e não
              tem validade.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
