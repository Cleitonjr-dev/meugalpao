# Arquitetura e qualidade

Análise de 17/10/2026.

## Visão geral

SPA em React sobre Supabase, sem servidor próprio. A "API" é o Postgres: tabelas com RLS e funções SQL.

```
Navegador (React 19, Vite, Tailwind v4)
  ├─ Contextos: Tema · Avisos · Query (cache) · Auth · Galpões · Dados do galpão
  ├─ Rotas (react-router, páginas carregadas sob demanda)
  ├─ Features: clientes · pagamentos · configurações · verificação · auth
  └─ utils/: regras puras (cobrança, valores, recibo, período, CSV)
        │  supabase-js (anon key + JWT do usuário)
        ▼
Supabase: Auth · Postgres (RLS + funções) · Storage (avatars)
```

## O que está bem desenhado

- **Regras puras testáveis** em `src/utils`: situação de cobrança, valores, código, CSV, período. 100% de cobertura de linhas.
- **Estado do servidor só no TanStack Query**: cache por galpão, invalidação por prefixo, `keepPreviousData` nas listas paginadas,
  limpeza ao trocar de usuário. Conferido com a documentação (Context7, TanStack Query v5): uso atual, sem APIs antigas.
- **Banco como fonte da verdade**: operações financeiras atômicas no servidor; front não monta números de recibo.
- **Paginação, somas e fechamento no banco**: o navegador não baixa o histórico inteiro.
- **Componentes de interface próprios e coerentes** (tabela, modal, seletor, calendário, avisos), com tema claro/escuro e
  acessibilidade básica (rótulos, foco preso no modal, Esc).
- **Carregamento sob demanda** das páginas e do jsPDF.
- **Tratamento de erro consistente**: telas de erro com "Tentar novamente", `ErrorBoundary`, mensagens em português.
- **Código sem sinais de abandono**: sem `TODO`, `any`, `@ts-ignore`, `console.log`; lint zerado; 0 imports sem uso (o lint pega).

## Problemas e oportunidades

| Tema | Observação | Achado |
|---|---|---|
| Regra de tempo | O "agora" depende do aparelho; o banco usa Fortaleza | AUD-013 |
| Janela de dívida | Corte de 8 semanas escondendo atrasos | AUD-014 |
| Transações | Salvar cliente/tipo em várias chamadas | AUD-016 |
| Duplicação | `parseISO` repetido; nome do app como texto | AUD-033, AUD-023 |
| Acoplamento da tabela | Busca com estado local não segue a URL | AUD-018 |
| Rotas | Pacote de transição `react-router-dom` | AUD-022 |
| Tamanho | `DatePicker`, `Dashboard`, `ClienteModal`, `Table` entre 360 e 435 linhas | AUD-034 |
| Operação | Migrações manuais, sem ledger; sem CI/Git | AUD-024, AUD-025 |

## Separação de responsabilidades

- **Apresentação** (`components/`, `pages/`) não acessa o Supabase diretamente, exceto nos *managers* de Configurações e nos modais de
  cliente/tipo, que fazem `supabase.from(...)` dentro do componente. É coerente com o tamanho do projeto, mas mistura
  interface e acesso a dados nessas telas; criar `*.service.ts` por feature (como já existe em `pagamentos`) seria o
  próximo passo natural **se** essas telas continuarem crescendo.
- **Domínio** (`utils/`) é independente de React e do Supabase: bom.
- **Dados** (`context/`, `features/*/queries`) concentram buscas; `GalpaoDadosContext` mistura leitura de cinco tabelas e a janela
  de pagamentos, o que é aceitável (um único `useQuery` por galpão).
- **Dependência circular:** nenhuma encontrada (o `tsc -b` com imports `@/` e a leitura dos módulos não mostram ciclos).

## Padrões e legibilidade

- Nomes em português consistentes; funções curtas na maior parte; comentários explicam o *porquê*.
- Tipagem: casts `as X[]` nas respostas do Supabase (ex.: `pagamentos.queries.ts`) por falta de tipos gerados do banco.
  Melhoria possível: gerar tipos com a CLI do Supabase e eliminar os casts.
- `useEffect` usados com critério (sem busca de dados em efeitos).
- Acessibilidade: bom nos modais e formulários; ponto fraco no `Toast` (AUD-021).

## Oportunidades de refatoração (sem urgência)

1. `src/utils/data.ts` único para datas em Fortaleza (resolve AUD-013 e AUD-033).
2. Camada de serviços para Configurações (`galpoes.service.ts`, `usuarios.service.ts`, `tipos.service.ts`).
3. Funções SQL transacionais para salvar cliente e tipo (AUD-016).
4. Tipos gerados do banco.
5. Migração para `react-router` (AUD-022).

Nenhuma delas justifica reescrever a arquitetura. Recomendação: fazer 1, 4 e 5 junto das correções; 2 e 3 só se
essas telas voltarem a mudar.
