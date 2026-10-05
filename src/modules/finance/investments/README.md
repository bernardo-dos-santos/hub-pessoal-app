# Investimentos

Investimentos é uma subárea local dentro de `src/modules/finance`.

Ela permite cadastro manual de ativos, valores atuais, total investido, notas e meta mensal de aporte. Investimentos não é um módulo global separado do Hub. Os dados ficam no storage local do Hub via `storageAdapter`.

## Escopo atual

- Carteira manual em `/financeiro/investimentos`.
- Cadastro, edição e remoção local de investimentos.
- Resumo simples de patrimônio, total investido, rendimento e rentabilidade.
- Meta mensal de aporte.
- Histórico de movimentos, buckets, moeda e alocação alvo (ver abaixo).

## Base da carteira (Fase 1)

Quatro decisões estruturais que sustentam todo o resto. Não desfazer sem
entender o porquê:

**A carteira é um filme, não uma foto** (`types/movement.ts`,
`services/investmentMovementService.ts`). Antes o ativo guardava só o valor de
agora, e cada atualização apagava o anterior — impossível saber quanto foi
aportado de fato ou o que rendeu. Agora todo movimento (`contribution`,
`withdrawal`, `valuation`) fica registrado e a posição é calculada a partir
deles. `currentValue`/`totalInvested` no `Investment` viraram **cache de
leitura**; a fonte da verdade é o histórico (`recalculateFromMovements`).

**Reserva e carteira são separadas** (`Investment.bucket`). Misturar faz a
alocação alvo mentir e o cálculo de meses cobertos contar dinheiro que não está
disponível pra emergência. Só o bucket `carteira` entra na alocação.

**Moeda e câmbio ficam separados** (`Investment.currency`,
`InvestmentMovement.exchangeRate`). O câmbio mora no movimento, não no ativo,
porque é a cotação *daquele dia* que define quanto de real entrou. Sem isso não
dá pra saber se o ganho veio do ativo ou do dólar — e o histórico nasce torto se
essa decisão for tomada depois do primeiro aporte.

**Fatias alvo por classe, não por tipo de ativo** (`AllocationSleeve`,
`services/allocationService.ts`). "Exterior" é recorte geográfico, não classe de
ativo: uma ação americana e uma brasileira têm o mesmo `InvestmentAssetType` e
alvos diferentes. Alvo padrão é a alocação Hydra achatada (35/21/14/30).

**Um destino por mês** (`suggestNextContribution`). O aporte inteiro vai pra
fatia mais atrasada em vez de ser dividido — fatiar R$500 em quatro paga taxa
quatro vezes e não compra nada relevante. O atraso é medido contra a carteira
*depois* do aporte; senão, com a carteira vazia todos os alvos valem zero e não
haveria como escolher o primeiro destino.

Remover um investimento apaga os movimentos dele junto — sem a cascata, o
histórico órfão continuaria somando em relatório por período apontando pra um
ativo que não existe mais.

## Tesouro com dois números (`treasuryProjectionService.ts`)

Um título prefixado/IPCA+ (ex.: Tesouro IPCA+ 2045) oscila de preço no mercado
secundário conforme a taxa de juros do momento — quem segura até o vencimento
recebe a taxa contratada, não essa marcação do dia. Mostrar só o valor de
mercado pode fazer o ativo parecer no prejuízo quando, pra quem não vai
vender agora, não está.

Investimento `type: 'treasury'` ganhou dois campos opcionais, só exibidos no
formulário quando esse tipo está selecionado: `maturityDate` (vencimento) e
`contractedRate` (taxa real contratada, IPCA + X% ao ano). Com os dois
preenchidos, a linha do ativo passa a mostrar **"Se vender hoje"**
(`currentValue`, a marcação a mercado normal) ao lado de **"Contratado até
{ano}"** (`treasuryProjectionService.calculateContractedProjection`, que
compõe o `totalInvested` pela taxa contratada desde o primeiro aporte até o
vencimento).

A projeção é em poder de compra de hoje, não em reais nominais de 2045 — a
taxa contratada já é acima do IPCA, então compor por ela não exige apostar em
inflação futura. Simplificação assumida: usa a data do primeiro aporte como
referência de compra e compõe todo o `totalInvested` a partir dela, em vez de
compor cada aporte separado pela sua própria data — evita depender de
histórico exato de compra na B3, que este módulo não tem.

## Divisão reserva × carteira por prazo (`contributionPlanService.ts`)

"70/30" não quer dizer nada por si só; "quero a reserva pronta em 2 anos" é uma
frase que dá pra sentir. `reserveService` ganhou um prazo opcional
(`getReserveDeadline`/`setReserveDeadline`, data-alvo) e `contributionPlanService`
usa esse prazo pra dividir o aporte mensal (`investmentService.getMonthlyGoal`)
entre reserva e carteira sozinho:

- **Sem prazo definido**, nada muda: o aporte inteiro segue pra carteira, igual
  antes dessa função existir. Dividir sem um prazo escolhido pelo usuário seria
  inventar uma meta que ele não pediu.
- **Com prazo**, `neededPerMonthForReserve = reserve.gap / mesesAtéOPrazo` decide
  quanto do aporte vai pra reserva (capado no valor do aporte); o resto vai pra
  carteira e alimenta `allocationService.suggestNextContribution` normalmente.
- **Reserva completa** (`gap <= 0`): 100% do aporte vai pra carteira.
- **Prazo inviável** (precisaria de mais por mês do que o aporte inteiro): o app
  avisa quanto falta por mês em vez de fingir que a divisão funciona — a mesma
  postura de "opina sobre o plano, nunca sobre o mercado": ele cobra os três
  números (meta, prazo, aporte) sem sugerir onde cortar.

Simplificação assumida: `neededPerMonthForReserve` usa meses de calendário
inteiros até a data-alvo (mínimo 1) — não desconta dia do mês, é estimativa de
planejamento, não contagem exata de dias.

## IA consultiva (Fase 6)

Duas peças, as mesmas do planejamento original — "resumo mensal escrito" e
responder/registrar por conversa (Jarvis):

**Resumo do mês** (`services/aiInvestmentAnalysisService.ts`, card "Resumo do
mês (IA)" na própria página) segue o mesmo molde de
`aiFinanceAnalysisService.ts`: monta um prompt com o estado atual (patrimônio,
reserva em meses, alocação atual × alvo, divisão do aporte do mês) e pede um
JSON `{ insight, suggestions, positives }` via `aiClient.completeJson`. Cache
por mês em `finance.investments.aiAnalysis`, últimos 3 meses.

**Regra reforçada no prompt, não só no código**: o texto do prompt proíbe
explicitamente opinar sobre mercado, ativo específico ou timing de
compra/venda — só pode falar do *plano* do usuário (fatias, prazo, ritmo). É a
mesma regra de `suggestNextContribution` ("opina sobre o plano, nunca sobre o
mercado"), só que aqui o risco é o modelo generativo inventar algo fora dessa
linha se não for lembrado explicitamente no prompt.

**Jarvis** (`server/jarvis.js`) ganhou:
- Contexto enriquecido: a linha `INVESTIMENTOS` do system prompt agora separa
  reserva de carteira e inclui a meta de aporte mensal — cobre "quanto tenho
  investido" sem precisar de tool call.
- Tool `add_investment_contribution` — "aportei 300 na XP hoje" vira um
  movimento `contribution` de verdade. Só aceita investimento **já
  cadastrado** (não cria um novo "às cegas" por voz); ativo em dólar é
  recusado com instrução pra registrar pelo app, porque aporte em moeda
  estrangeira precisa do câmbio do dia — sem isso o histórico nasce torto
  (mesma razão da Fase 1). A posição (`totalInvested`/`currentValue`) é
  recalculada no servidor com a mesma regra de `calculatePosition` — **duplicada
  em JS puro** porque o servidor não importa TS do frontend; se a regra de
  posição mudar em `investmentMovementService.ts`, replique aqui também.

## Fora desta etapa

- Cotações externas.
- Recomendação de investimentos.
- IA operacional.
- Execução automática de compra, venda ou aplicação.

Qualquer IA futura deve ser IA consultiva. Nenhuma ação financeira sensível deve ser executada automaticamente.

## Atualização — sync com Pluggy (Open Finance)

Investimentos ganhou um segundo modo, além do manual: sincronização **read-only**
de posições de corretora conectada via Pluggy (`services/pluggyInvestmentSyncService.ts`).
Não é execução nem integração ativa com corretora — é leitura de saldo/posição já
existente, mesmo padrão de leitura usado pra conta corrente/cartão. Continua sem
cotação externa, sem recomendação e sem qualquer ação automática de compra/venda.

- `Investment.source` diferencia `'manual'` (ausente = manual, por compatibilidade
  com investimentos criados antes desse campo existir) de `'pluggy'`.
- Sync é sempre por botão explícito na página — nunca automático ao abrir.
- Merge por `externalId`: posição já sincronizada é atualizada, nunca duplicada.
  Investimento manual nunca é tocado pelo sync.
- **Sem posição real pra validar o mapeamento de tipo** (a corretora testada não
  tinha posição aberta) — os campos e enums usados seguem a documentação oficial
  da Pluggy, não dado empírico. Revisar se o primeiro sync com posição real vier
  com tipo errado.
