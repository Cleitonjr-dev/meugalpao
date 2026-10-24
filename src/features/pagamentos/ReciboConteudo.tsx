import { APP_NAME } from '@/config/constants'
import { formatarNumeroRecibo } from '@/utils/recibo'
import { formatarCodigo } from '@/utils/codigo'
import { cn } from '@/lib/utils'
import type { DadosRecibo } from './recibo'

interface ReciboConteudoProps {
  dados: DadosRecibo
  className?: string
}

export function ReciboConteudo({ dados, className }: ReciboConteudoProps) {
  return (
    <div
      id="recibo-print"
      className={cn(
        'mx-auto w-[80mm] rounded bg-white p-3 font-mono text-xs text-black',
        className,
      )}
    >
      <div className="text-center">
        <p className="text-sm font-bold">{APP_NAME}</p>
        <p>{dados.galpaoNome}</p>
        <p className="mt-2 font-bold">RECIBO Nº {formatarNumeroRecibo(dados.numero)}</p>
        {dados.cancelado && <p className="mt-1 font-bold">*** CANCELADO ***</p>}
      </div>
      <div className="my-2 border-t border-dashed border-black" />
      <p>Data: {dados.data}</p>
      <p>Cobrança de: {dados.referente}</p>
      <p className="break-words">Cliente: {dados.clienteNome}</p>
      <div className="my-2 border-t border-dashed border-black" />
      <p>Recebemos o valor de:</p>
      <p className="text-lg font-bold">{dados.valor}</p>
      {dados.itens && <p className="break-words">Referente a: {dados.itens}</p>}
      <p>Forma de pagamento: {dados.forma}</p>
      {dados.observacoes ? <p className="break-words">Obs: {dados.observacoes}</p> : null}
      <div className="my-2 border-t border-dashed border-black" />
      {dados.codigo ? (
        <div className="mt-2 text-center">
          <p>Autenticação:</p>
          <p className="break-all text-sm font-bold tracking-wider">
            {formatarCodigo(dados.codigo)}
          </p>
          <p className="mt-1 text-[10px] leading-tight">
            Confirme a validade deste recibo informando o código no sistema.
          </p>
        </div>
      ) : (
        <p className="mt-6 text-center">Assinatura: ____________________</p>
      )}
    </div>
  )
}
