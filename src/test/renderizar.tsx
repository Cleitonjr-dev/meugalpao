import type { ReactElement, ReactNode } from 'react'
import { vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { ThemeProvider } from '@/context/ThemeContext'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { GalpaoProvider } from '@/context/GalpaoContext'
import { GalpaoDadosProvider } from '@/context/GalpaoDadosContext'
import { ToastProvider } from '@/components/ui/Toast'
import { formatCurrency } from '@/lib/utils'
import { bancoFalso } from '@/test/bancoFalso'
import { IDS, popularCenarioPadrao } from '@/test/dados'

export type Usuario = 'super' | 'comum' | null

interface Opcoes {
  /** Endereço inicial (padrão "/"), com parâmetros se precisar: "/pagamentos?pagina=2" */
  rota?: string
  /** Quem está logado: super, comum ou ninguém (padrão: super) */
  usuario?: Usuario
  /** Galpão em uso (padrão: o primeiro por nome) */
  galpaoId?: string
  /** Se false, o banco começa vazio e o teste monta os próprios dados (padrão: true) */
  cenarioPadrao?: boolean
  /** Prepara o banco antes de a tela abrir (dados extras, falhas, atrasos) */
  preparar?: () => void
  /** Outras rotas para onde a tela pode levar (ex.: { '/': <div>Painel</div> }); o resto abre a tela testada */
  outrasRotas?: Record<string, ReactNode>
}

/** Como no sistema, a tela só aparece depois de a sessão inicial ser conhecida. */
function PortaDeAutenticacao({ children }: { children: ReactNode }) {
  const { loading } = useAuth()
  return loading ? null : <>{children}</>
}

function MostrarRota() {
  const local = useLocation()
  return (
    <div data-testid="rota-atual" hidden>
      {local.pathname}
      {local.search}
    </div>
  )
}

/** Abre a tela como no sistema: com tema, avisos, login, galpões, dados e rotas de verdade. */
export function renderizarTela(tela: ReactElement | ReactNode, opcoes: Opcoes = {}) {
  const { rota = '/', usuario = 'super', galpaoId, cenarioPadrao = true, preparar, outrasRotas = {} } = opcoes

  if (cenarioPadrao) popularCenarioPadrao(bancoFalso)
  preparar?.()
  if (galpaoId) window.localStorage.setItem('meugalpao.galpao_id', galpaoId)
  if (usuario) bancoFalso.entrarComo(usuario === 'super' ? IDS.usuarioSuper : IDS.usuarioComum)

  const cliente = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0, gcTime: Infinity, refetchOnWindowFocus: false } },
  })
  const usuarioDoTeste = userEvent.setup({ delay: null })

  const resultado = render(
    <ThemeProvider>
      <ToastProvider>
        <QueryClientProvider client={cliente}>
          <AuthProvider>
            <GalpaoProvider>
              <GalpaoDadosProvider>
                <PortaDeAutenticacao>
                <MemoryRouter initialEntries={[rota]}>
                  <Routes>
                    {Object.entries(outrasRotas).map(([caminho, elemento]) => (
                      <Route key={caminho} path={caminho} element={<>{elemento}</>} />
                    ))}
                    <Route path="*" element={<>{tela}</>} />
                  </Routes>
                  <MostrarRota />
                </MemoryRouter>
                </PortaDeAutenticacao>
              </GalpaoDadosProvider>
            </GalpaoProvider>
          </AuthProvider>
        </QueryClientProvider>
      </ToastProvider>
    </ThemeProvider>,
  )

  return {
    ...resultado,
    ui: usuarioDoTeste,
    banco: bancoFalso,
    cliente,
    /** Endereço atual (caminho + parâmetros) */
    rotaAtual: () => screen.getByTestId('rota-atual', { suggest: false }).textContent ?? '',
  }
}

/** Espera a tela sair do "Carregando..." (cabeçalho principal visível). */
export async function esperarTela(titulo: string | RegExp) {
  return screen.findByRole('heading', { level: 1, name: titulo })
}

export { screen, waitFor, within }

/** Valor em reais exatamente como a tela mostra (ex.: "R$ 110,00"). */
export const reais = (valor: number) => formatCurrency(valor).replace(/\s/g, ' ')

/** Texto com todos os espaços (inclusive o espaço sem quebra do real) trocados por espaço comum. */
export const semNbsp = (texto: string) => texto.replace(/\s/g, ' ')

/** Cartão de resumo (StatCard) pelo nome, para conferir só o que está dentro dele. */
export function cartao(rotulo: string) {
  const alvo = screen.getByText(rotulo).closest('div.rounded-xl')
  if (!alvo) throw new Error(`cartão "${rotulo}" não encontrado`)
  return within(alvo as HTMLElement)
}

/** Linha (li) de um cliente na lista de Cobranças. */
export function linhaDoCliente(nome: string) {
  const alvo = screen.getByText(nome, { selector: 'p' }).closest('li')
  if (!alvo) throw new Error(`linha de "${nome}" não encontrada`)
  return within(alvo as HTMLElement)
}

/** Abre um campo de seleção do sistema pelo rótulo e escolhe a opção pelo texto. */
export async function escolherOpcao(
  ui: ReturnType<typeof userEvent.setup>,
  rotulo: string,
  opcao: string | RegExp,
) {
  await ui.click(screen.getByLabelText(rotulo))
  const lista = await screen.findByRole('listbox')
  await ui.click(within(lista).getByRole('option', { name: opcao }))
}

/** Lê o conteúdo de um arquivo baixado (Blob), mantendo o BOM do início se houver. */
export function lerArquivo(blob: Blob): Promise<string> {
  return new Promise((resolver, rejeitar) => {
    const leitor = new FileReader()
    leitor.onload = () => resolver(new TextDecoder('utf-8', { ignoreBOM: true }).decode(leitor.result as ArrayBuffer))
    leitor.onerror = () => rejeitar(leitor.error)
    leitor.readAsArrayBuffer(blob)
  })
}

/** Acompanha os downloads feitos pela tela (nome do arquivo e conteúdo), sem baixar de verdade. */
export function espiarDownload() {
  const blobs: Blob[] = []
  const nomes: string[] = []
  vi.mocked(URL.createObjectURL).mockImplementation((b) => {
    blobs.push(b as Blob)
    return 'blob:falso'
  })
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    nomes.push(this.download)
  })
  return { blobs, nomes, conteudo: (i = 0) => lerArquivo(blobs[i]) }
}
