# Notas de migração do Financeiro

O Financeiro antigo está preservado em `legacy/finance-mvp`.

Esse legado contém regras financeiras importantes sobre cartão, faturas, transferências internas, categorias a revisar, reclassificação automática e categorias manuais. Ele deve continuar separado da arquitetura React atual até que cada regra seja extraída, tipada e coberta por testes.

## Diretrizes

- A migração será gradual.
- O `core` não deve receber regras financeiras.
- Todas as regras financeiras devem ficar dentro de `src/modules/finance`.
- O app antigo não deve ser copiado inteiro para React.
- HTML, CSS e JS do legado não devem virar um componente React gigante.
- Conceitos do legado podem orientar tipos, services, cálculos puros e UI, desde que sejam adaptados para React + TypeScript + arquitetura modular.

## Caminho recomendado

1. Preservar legado e testes.
2. Criar tipos TypeScript.
3. Extrair constantes e categorias.
4. Extrair cálculos puros.
5. Criar services.
6. Criar UI React aos poucos.
7. Migrar importadores CSV só depois.
8. Remover dependência do legado apenas quando tudo estiver coberto por testes.

## Validação atual

O script `scripts/finance-rules-check.js` valida as regras financeiras críticas do legado em `legacy/finance-mvp/app.js`.

O script `scripts/finance-module-check.js` valida os cálculos puros já extraídos para o módulo React/TypeScript em `src/modules/finance/utils/financeCalculations.ts`.

A camada inicial de normalização e classificação também começou a ser extraída para:

- `src/modules/finance/data/specialCategories.ts`
- `src/modules/finance/data/categoryAliases.ts`
- `src/modules/finance/utils/financeText.ts`
- `src/modules/finance/services/categoryClassificationService.ts`

Essa classificação nova retorna sugestões com categoria, tipo de transação, confiança, motivo e indicação de revisão. Ela não deve ser tratada como verdade absoluta e não deve sobrescrever categorias manuais.

O pipeline inicial de dados financeiros também já existe no módulo novo:

1. `RawTransactionDraft` representa o dado bruto ainda sem parser real.
2. `transactionNormalizationService` transforma o draft em `NormalizedTransactionDraft`.
3. `importService` cria um preview de importação sem ler arquivo ou salvar dados.
4. As transações normalizadas podem ser usadas diretamente pelos cálculos puros em `financeCalculations.ts`.

Esse fluxo prepara o caminho bruto -> normalizado -> cálculo, mas ainda não substitui os importadores do legado.

A camada de parser para linhas já estruturadas também foi iniciada:

- `structuredTransactionParser` recebe objetos estruturados e gera `RawTransactionDraft`.
- `parserProfiles` contém perfis preparatórios para Nubank Conta, Nubank Fatura e C6 Empresa.
- `importService.previewStructuredImport` liga linhas estruturadas -> drafts -> normalização -> preview.

Também existe agora um parser CSV puro:

- `csvParser` recebe uma string CSV, detecta delimitador, trata aspas, BOM, quebras Windows/Unix e headers normalizados.
- `csvStructuredMapper` converte linhas CSV em `StructuredTransactionRow` usando aliases dos perfis.
- `importService.previewCsvImport` liga CSV string -> linhas estruturadas -> drafts -> normalização -> preview.
- O perfil Nubank Fatura aceita o CSV real simplificado `date,title,amount`, mantendo `title` como descrição.

O parser CSV deve continuar sem regra financeira; regras ficam na classificação, normalização e cálculos.

A deduplicação inicial para preview de importação também existe em `transactionDeduplicationService`:

- Ela marca transações como `unique`, `exact_duplicate` ou `possible_duplicate`.
- Ela é conservadora e compara data, valor, descrição normalizada e conta/origem compatível.
- Ela não salva, não apaga, não remove e não altera transações.
- A futura tela de importação deve mostrar esses status para decisão manual do usuário.

A rota `/financeiro/importar` já usa esse pipeline em React:

- Permite escolher Nubank Conta, Nubank Fatura ou C6 Empresa.
- Permite colar CSV em texto ou selecionar arquivo CSV local para gerar preview.
- Mostra totais, pendências, duplicatas, erros, avisos e transações normalizadas.
- Mostra diagnóstico do preview: regras ativas carregadas, classificação por regra manual, heurística de transferência, confiança, motivo e `manualCategory`.
- Permite salvar localmente apenas as transações selecionadas no preview.

O commit da importação continua controlado pelos services do módulo:

- `importCommitService` prepara a seleção e chama `transactionService` para salvar.
- Duplicatas exatas ficam desmarcadas e bloqueadas por padrão.
- Possíveis duplicatas ficam desmarcadas por padrão para decisão explícita.
- Pendências de revisão podem ser salvas sem perder `needsReview`, confiança ou motivo de classificação.
- O commit reaproveita as transações normalizadas do preview e preserva categoria, `kind`, confiança, motivo e proteção manual vistas pelo usuário.
- O salvamento ainda é local e simples, sem backend ou integração externa.
- O arquivo selecionado é lido no navegador com `FileReader`; não há upload externo.
- `transactionService` não mistura mais samples com transações reais: lista dados salvos ou `[]`.
- Samples, quando usados, ficam em funções explícitas do service e fora do fluxo real de importação.
- A seção de dados locais permite limpar apenas transações do Financeiro salvas no navegador durante testes.
- Limpar transações preserva regras manuais, categorias personalizadas e orçamentos.
- Essa limpeza não apaga CSVs, samples, código, legado ou dados globais do Hub.

As transações salvas pelo commit agora alimentam as telas principais:

- `/financeiro/transacoes` lista dados do `transactionService`, com filtros básicos e revisão manual inicial.
- A revisão permite ajustar categoria, `kind`, notas, `needsReview` e `manualCategory`.
- Quando a categoria é alterada manualmente, o service marca `manualCategory` para proteger a escolha.
- Categorias especiais mantêm categoria e `kind` coerentes na revisão: `Transferência interna` infere `transfer`, pagamentos de fatura ficam neutros e `Renda` infere `income`.
- Estornos e reembolsos positivos com descrição clara inferem `refund` ao serem revisados para uma categoria comum de gasto.
- `expense` e `card_purchase` positivos não contam como Despesas reais, protegendo dados antigos com tipo inconsistente.
- Os cálculos ignoram categorias neutras antigas com `kind` inconsistente para não inflar gasto enquanto a transação não for corrigida.
- `/financeiro` calcula resumo e gastos por categoria a partir das transações locais usando cálculos puros do módulo.
- Não há backend, persistência paralela ou pareamento real de transferências internas nessa etapa.

A rota `/financeiro/revisao` concentra a conferência rápida:

- Separa revisão necessária de conferência opcional.
- Revisão necessária inclui entradas/despesas a revisar, `needsReview`, `kind review` e baixa confiança.
- Transferências internas e pagamentos de fatura neutros com confiança alta ficam disponíveis para conferência opcional, sem virar pendência obrigatória.
- Revisões concluídas guardam `reviewedAt` e `reviewedBy`; neutros já conferidos e baixa confiança já resolvida saem das filas recorrentes.
- Dados antigos sem marcador de revisão continuam válidos e seguem aparecendo quando ainda precisarem de conferência.
- Mostra quando um movimento neutro não entra como receita ou despesa real.
- Permite corrigir categoria e `kind` por escolha explícita, mantendo categoria manual protegida.
- Transferências internas confirmadas continuam com `kind transfer` e categoria `Transferência interna`.
- `card_payment` e `card_payment_received` continuam fora do resultado real.
- Marcar uma entrada pendente como revisada não a transforma em renda sem o usuário escolher `Renda`.
- O pareamento automático entre contas continua fora da migração atual.

A gestão inicial de categorias e regras manuais também já começou:

- `/financeiro/categorias` lista categorias padrão, especiais, personalizadas e regras simples por palavra-chave.
- `categoryService` guarda categorias personalizadas pelo storage adapter do módulo.
- Categorias padrão e especiais ficam protegidas; personalizadas podem ser editadas, ativadas, desativadas e excluídas.
- Categorias personalizadas ativas alimentam revisão, filtros, regras manuais e orçamentos.
- Categorias desativadas deixam de ser opção principal em novas ações, mas transações antigas preservam o nome salvo.
- `categoryRuleService` guarda regras no storage adapter do módulo e mantém regras inativas fora da classificação.
- O texto das regras é normalizado por palavras para ignorar caixa, acentos, pontuação e hífens em descrições como Pix Santander/Bernardo.
- Regras manuais ativas têm prioridade sobre aliases automáticos em novas importações e previews.
- Regra manual com tipo sugerido explícito também ganha das heurísticas automáticas, inclusive da detecção de transferência interna por indício de conta própria.
- Para promover uma entrada a renda por regra, use tipo sugerido `Receita`; regra em `Manter classificador` deixa o tipo financeiro nas mãos do automático.
- A detecção automática de transferência interna só decide o tipo quando nenhuma regra manual explícita correspondente tomou essa decisão.
- A classificação registra o motivo quando uma regra manual é usada.
- `manualCategory` continua protegendo escolhas já feitas pelo usuário.
- A ReviewPage pode criar uma regra a partir de uma transação apenas após confirmação explícita.
- A ReviewPage deixa claro que regra nova afeta novas importações; o usuário pode escolher criar e aplicar a correção só na transação atual.
- Criar uma regra não reclassifica transações antigas automaticamente.
- A ReviewPage agora tem a ação explícita `Aplicar regras ativas`.
- Essa ação simula o lote antes do update, mostra matches e itens protegidos, e permite selecionar o que será aplicado.
- O lote olha revisão necessária e classificações automáticas que já batem com regra explícita ativa, incluindo transferências internas heurísticas.
- Uma transferência automática pode virar renda, despesa ou transferência confirmada quando o tipo explícito da regra mandar.
- `manualCategory` continua sendo a proteção principal de transações já corrigidas pelo usuário nesta etapa.
- Regras com tipo explícito podem corrigir pendências e classificações automáticas; `Manter classificador` fica fora do lote quando o tipo ainda estiver ambíguo ou sensível.

Os orçamentos mensais também passaram a ler dados reais:

- `/financeiro/orcamentos` cria, edita, ativa, desativa e exclui limites mensais salvos localmente.
- A tela permite selecionar o mês e abrir em cada orçamento as transações realmente consideradas no cálculo.
- `budgetService` não mistura `defaultBudgets` automaticamente com orçamentos reais; defaults são sugestões explícitas.
- O uso do orçamento considera o mês selecionado, escopo e categoria do limite; sem seleção explícita, mantém o mês atual.
- Despesas e `card_purchase` contam no gasto acompanhado.
- `card_payment`, `card_payment_received`, `transfer` e `income` não inflam orçamento.
- Transferências internas e pagamentos de fatura com categoria neutra continuam fora do orçamento mesmo quando algum dado antigo tiver `kind` inconsistente.
- Categorias personalizadas continuam funcionando no limite mensal e no drilldown.
- Refund avulso continua diferente de reembolso pareado e classificações frágeis de refund seguem como risco para revisão manual.
- `reimbursementService` detecta pares seguros apenas quando compra negativa e estorno positivo têm valor exato em centavos, descrição, categoria, conta/origem e data compatíveis dentro de janela curta.
- Pares matched ficam preservados no histórico `/financeiro/reembolsos`, listados pelo mês do estorno, e saem de receitas, despesas, categorias, orçamentos e comparação mensal.
- Estornos sem par exato ou com mais de uma compra forte possível ficam visíveis como candidatos não pareados ou ambíguos; não são escondidos automaticamente.
- O dashboard usa visão mensal com seletor local para receitas, despesas, resultado, compras no cartão, pendências, gastos por categoria e orçamentos.
- Gastos por categoria e resumo de orçamentos no dashboard usam o mesmo mês selecionado; entradas a revisar continuam fora da renda real.
- Dashboard e Orçamentos persistem o recorte com `?month=YYYY-MM`; os links mensais preservam esse período ao chegar em Orçamentos, Transações e Revisão.
- Refunds seguros da mesma categoria reduzem o gasto líquido mostrado por categoria no dashboard; categorias neutras e pendências de revisão continuam fora desse ajuste.
- O dashboard compara o mês selecionado ao mês anterior para receitas, despesas, resultado, compras no cartão e categorias de maior variação líquida.
- A comparação de categorias pode abrir um drilldown leve com as transações do mês selecionado e do mês anterior que formam o líquido exibido.
- Refunds seguros aparecem nesse detalhe como ajuste; transferências internas e pagamentos de fatura continuam fora, e os links de cada lado abrem Transações com `month` e `category` preservados na URL.
- O filtro de categoria da TransactionsPage continua local e simples, inclusive para categorias personalizadas ou nomes antigos que ainda existam nas transações.
- A TransactionsPage mostra chips dos recortes ativos de mês e categoria, permite remover cada filtro separadamente e mantém links contextuais de volta ao Dashboard e aos Orçamentos do mês.
- Transferências internas e pagamentos de fatura continuam fora da comparação de gasto. Quando o mês anterior não tem base, o percentual fica indisponível em vez de dividir por zero.
- Transações e Revisão têm filtro mensal simples. A revisão avisa quando ainda existem pendências obrigatórias fora do mês em foco para não esconder dívida de atenção antiga.
- O dashboard mostra um resumo leve de orçamentos e comparação inicial; gráficos avançados, análise automática e relatórios ficam para depois.
- Subcategorias, recorrência anual e cores/ícones obrigatórios de categoria continuam fora desta etapa.

Gráficos V1 agora reaproveitam os dados locais e os services existentes do Financeiro. O Dashboard foi reorganizado para ser uma home rápida com cards principais, alertas, gráficos compactos e acessos rápidos. A página `/financeiro/relatorios?month=YYYY-MM` concentra a análise detalhada: evolução mensal, comparação com mês anterior, categorias que mais mudaram, uso de orçamentos e resumo textual simples. As despesas exibidas são líquidas, pares de reembolso matched ficam fora dos gráficos, transferências internas e pagamentos de fatura continuam fora de gasto real, e os gráficos são somente estatísticos, sem IA, backend ou busca externa. Essa etapa foi apenas UX/layout e não alterou regras financeiras.

A rodada de polimento visual padronizou cabeçalhos, alertas, estados vazios, botões e textos em PT-BR nas principais páginas do Financeiro. O Dashboard segue como resumo rápido; Relatórios concentra análise detalhada; Importação deixa claro que o CSV é lido localmente; Revisão diferencia pendência obrigatória de conferência opcional; Reembolsos reforça que pares ficam fora dos cálculos e nada é apagado. Nenhuma regra financeira, parser, pareamento, orçamento, backend ou IA foi alterado nessa etapa.

A identidade visual do Financeiro agora é dark-first por padrão nas rotas `/financeiro`, usando a classe escopada `.finance-dark` e tokens centralizados em `src/styles/global.css`. As páginas continuam usando seus componentes e classes existentes, mas fundos, cards, bordas, inputs, selects, dropdowns, badges, alertas e hovers são adaptados pelo tema central para evitar telas brancas dentro do módulo. Essa mudança é apenas visual e não altera cálculos, importação, reembolsos, regras manuais ou orçamentos.

A subárea `/financeiro/investimentos` foi aberta dentro do próprio módulo Financeiro como carteira local manual, com cadastro de ativos, valores, rentabilidade simples e meta de aporte. Investimentos não é um módulo global separado, não busca cotações, não integra corretora e não recomenda investimentos automaticamente. Qualquer IA futura para Investimentos deve ser apenas consultiva, e nenhuma compra, venda, aplicação ou outra ação financeira sensível deve ser executada automaticamente.

Use:

- `npm run test:rules` para proteger o comportamento do legado.
- `npm run test:finance` para proteger os cálculos, classificação, normalização, parser CSV puro, deduplicação de preview e commit controlado do módulo Financeiro.
- `npm run test` para rodar as duas validações.

Os importadores CSV ainda não foram migrados por completo. A leitura local de arquivo já alimenta o pipeline novo, mas upload e integrações externas continuam fora do módulo. O legado segue como referência até que esses passos sejam extraídos e cobertos por testes próprios.

A detecção completa de transferências internas por pares entre contas ainda não foi migrada. Nesta fase existe apenas preparação para sugerir transferência quando há indício claro de conta própria.
