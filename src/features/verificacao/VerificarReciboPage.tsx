import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Card } from '@/components/ui/Card'
import { Logo } from '@/components/shared/Logo'
import { ThemeToggle } from '@/components/shared/ThemeToggle'
import { APP_NAME } from '@/config/constants'
import { limparCodigo, normalizarCodigo, resultadoAtual } from '@/utils/codigo'
import { CampoCodigo } from './CampoCodigo'
import { ResultadoVerificacao } from './ResultadoVerificacao'

/** Página pública (sem login): confere se um recibo é verdadeiro a partir do código de autenticação. */
export function VerificarReciboPage({ embutido = false }: { embutido?: boolean }) {
  const [params, setParams] = useSearchParams()
  const [digitado, setDigitado] = useState(params.get('c') ?? '')

  // O código consultado vem da URL; assim o resultado sobrevive ao F5 e pode ser compartilhado.
  const codigo = normalizarCodigo(params.get('c') ?? '')

  const verificar = () => {
    const limpo = limparCodigo(digitado)
    setParams(limpo ? { c: limpo } : {}, { replace: true })
  }

  const nova = () => {
    setDigitado('')
    setParams({}, { replace: true })
  }

  // Editar o código depois de um resultado esconde o resultado antigo.
  const codigoNaTela = resultadoAtual(digitado, codigo)
  const codigoIncompleto = Boolean(params.get('c')) && codigo === null

  return (
    <div
      className={
        embutido
          ? 'flex flex-col items-center'
          : 'relative flex min-h-full flex-col items-center justify-center bg-slate-50 px-4 py-10 dark:bg-slate-950'
      }
    >
      {!embutido && (
        <div className="absolute right-4 top-4">
          <ThemeToggle />
        </div>
      )}

      <Card className="w-full max-w-md p-6">
        <div className="mb-5 flex flex-col items-center gap-2 text-center">
          {embutido ? (
            <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
              Verificar recibo
            </h1>
          ) : (
            <>
              <Logo className="h-20 w-auto" />
              <h1 className="text-xl font-semibold text-slate-900 dark:text-white">{APP_NAME}</h1>
            </>
          )}
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Digite o código de autenticação impresso no recibo para confirmar se ele é verdadeiro.
          </p>
        </div>

        <CampoCodigo
          valor={digitado}
          onChange={setDigitado}
          consultado={codigo}
          onVerificar={verificar}
          onNova={nova}
        />

        {!embutido && (
          <Link
            to="/login"
            className="mt-3 block text-center text-sm font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          >
            Voltar ao login
          </Link>
        )}

        <div className="mt-5">
          <ResultadoVerificacao codigo={codigoNaTela} incompleto={codigoIncompleto} />
        </div>
      </Card>
    </div>
  )
}
