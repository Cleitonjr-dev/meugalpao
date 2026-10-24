import { expect, type Page } from '@playwright/test'

export function nomeUnico(prefixo: string): string {
  const agora = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${prefixo} ${agora.getFullYear()}-${p(agora.getMonth() + 1)}-${p(agora.getDate())} ${p(agora.getHours())}:${p(agora.getMinutes())}:${p(agora.getSeconds())}`
}

export async function entrar(page: Page, email: string, senha: string): Promise<void> {
  await page.goto('/login')
  await page.getByLabel('E-mail', { exact: true }).fill(email)
  await page.getByLabel('Senha', { exact: true }).fill(senha)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Cobranças' })).toBeVisible()
}

export async function sair(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Menu do perfil/ }).click()
  await page.getByRole('menuitem', { name: /Sair/ }).click()
  await expect(page).toHaveURL(/\/login/)
}

/** Escolhe uma opção de um campo de seleção do sistema (botão que abre uma lista). */
export async function escolherOpcao(page: Page, rotulo: string, opcao: string | RegExp): Promise<void> {
  await page.getByLabel(rotulo, { exact: true }).click()
  await page.getByRole('option', { name: opcao }).first().click()
}

/** Troca o galpão em uso, pelo menu do perfil (só aparece quando há mais de um). */
export async function selecionarGalpao(page: Page, nome: string): Promise<void> {
  const noTopo = page.locator('header').getByText(nome, { exact: true })
  if (await noTopo.isVisible().catch(() => false)) return
  await page.getByRole('button', { name: /Menu do perfil/ }).click()
  await page.getByRole('menuitem', { name: nome }).click()
  await expect(noTopo).toBeVisible()
}

export async function criarGalpao(page: Page, nome: string): Promise<void> {
  await page.goto('/configuracoes')
  await page.getByRole('button', { name: 'Novo galpão' }).click()
  await page.getByLabel('Nome', { exact: true }).fill(nome)
  await page.getByLabel('Endereço').fill('Rua de Teste, 100 - Centro')
  await page.getByRole('button', { name: 'Salvar' }).click()
  await expect(page.getByText(nome, { exact: true }).first()).toBeVisible()
}

/**
 * Tenta apagar o galpão de teste (pede a senha e o nome). Desde a migração 0014 o banco recusa galpões
 * que já tenham pagamentos (o histórico financeiro é preservado): nesse caso nada é apagado e o galpão
 * "E2E ..." fica no projeto de teste até rodar `tests/e2e/limpar-dados-de-teste.sql` no SQL Editor.
 * Devolve true se o galpão foi excluído.
 */
export async function excluirGalpao(page: Page, nome: string, senha: string): Promise<boolean> {
  await page.goto('/configuracoes')
  await page
    .locator('li')
    .filter({ has: page.getByRole('heading', { name: nome, exact: true }) })
    .getByRole('button', { name: 'Excluir galpão' })
    .click()
  const janela = page.getByRole('dialog', { name: 'Excluir galpão' })
  await janela.getByLabel('Digite o nome do galpão para confirmar').fill(nome)
  await janela.getByLabel('Senha', { exact: true }).fill(senha)
  await janela.getByRole('button', { name: 'Excluir galpão' }).click()
  const excluido = page.getByText('Galpão excluído.')
  const recusado = janela.getByText(/não pode ser excluído/)
  await expect(excluido.or(recusado)).toBeVisible()
  return excluido.isVisible()
}

export type DiaCobranca = 'Quarta-feira' | 'Sábado'

/** Cadastra um cliente com um item "Carrinho de roupa". */
export async function criarCliente(
  page: Page,
  nome: string,
  opcoes: { dia?: DiaCobranca | RegExp; whatsapp?: string } = {},
): Promise<void> {
  await page.goto('/clientes')
  await page.getByRole('button', { name: 'Novo cliente' }).click()
  const modal = page.getByRole('dialog')
  await modal.getByLabel('Nome', { exact: true }).fill(nome)
  await modal.getByLabel('WhatsApp').fill(opcoes.whatsapp ?? '(85) 99999-1234')
  if (opcoes.dia) await escolherOpcao(page, 'Dia de pagamento', opcoes.dia)
  await escolherOpcao(page, 'Tipo do item', /Carrinho de roupa/)
  await modal.getByRole('button', { name: 'Adicionar à lista' }).click()
  await modal.getByRole('button', { name: 'Criar cliente' }).click()
  await expect(page.getByText(nome, { exact: true }).first()).toBeVisible()
}

/** Registra um pagamento pelo botão "Registrar pagamento" das Cobranças. Devolve o código de autenticação (16 caracteres). */
export async function registrarPagamento(page: Page, nomeCliente: string): Promise<string> {
  await page.goto('/')
  await page.getByRole('button', { name: 'Registrar pagamento' }).click()
  await escolherOpcao(page, 'Cliente', new RegExp(nomeCliente))
  await page.getByRole('button', { name: 'Confirmar pagamento' }).click()
  // o recibo abre com o código de autenticação
  const recibo = page.getByRole('dialog', { name: 'Recibo' })
  await expect(recibo.getByText('Autenticação:')).toBeVisible()
  const texto = (await recibo.innerText()).replace(/\s+/g, '')
  const m = /Autenticação:([0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4})/.exec(texto)
  expect(m, 'o recibo deve mostrar o código de autenticação').not.toBeNull()
  return (m as RegExpExecArray)[1].replace(/-/g, '')
}
