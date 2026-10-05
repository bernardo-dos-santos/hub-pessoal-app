/**
 * Restauração de acentos — parte do histórico de commits deste repo foi
 * escrita sem acentuação (medido: nenhuma corrupção de encoding, palavras
 * genuinamente digitadas sem acento, provavelmente fricção de teclado/console
 * no Windows). Dicionário curado à mão a partir do próprio histórico: só
 * entram palavras multissilábicas cuja forma sem acento nunca é, sozinha,
 * uma palavra portuguesa válida — de propósito NÃO inclui palavras curtas ou
 * funcionais ("e", "a", "de", "as", "já", "até", "há"...) nem formas ambíguas
 * por gênero/tempo verbal ("esta"/"está", "contem"/"contém") ou que colidem
 * com termos técnicos em inglês ("media", "indigo" — cor do Tailwind).
 * Substituição por dicionário, sem IA — mesmo espírito do parser de commits
 * em `conventionalCommit.ts`.
 */
const ACCENT_DICTIONARY: Record<string, string> = {
  nao: 'não', sao: 'são', acao: 'ação', acoes: 'ações',
  modulo: 'módulo', modulos: 'módulos', correcao: 'correção', correcoes: 'correções',
  pagina: 'página', paginas: 'páginas', audio: 'áudio', historico: 'histórico',
  padrao: 'padrão', exclusao: 'exclusão', confirmacao: 'confirmação',
  sessao: 'sessão', sessoes: 'sessões', inicio: 'início', diagnostico: 'diagnóstico',
  codigo: 'código', geracao: 'geração', ultimo: 'último', saida: 'saída',
  navegacao: 'navegação', apos: 'após', confiavel: 'confiável', orfaos: 'órfãos',
  variavel: 'variável', proxima: 'próxima', proximo: 'próximo', proprio: 'próprio',
  propria: 'própria', seguranca: 'segurança', orcamentos: 'orçamentos', diario: 'diário',
  espacos: 'espaços', expoe: 'expõe', usuario: 'usuário', sincronizacao: 'sincronização',
  automatica: 'automática', automatico: 'automático', avaliacoes: 'avaliações',
  icone: 'ícone', explicito: 'explícito', minimo: 'mínimo', conexoes: 'conexões',
  execucao: 'execução', memoria: 'memória', revisao: 'revisão', indice: 'índice',
  invisiveis: 'invisíveis', visivel: 'visível', logica: 'lógica', titulo: 'título',
  silencio: 'silêncio', concluida: 'concluída', botao: 'botão', materia: 'matéria',
  materias: 'matérias', necessaria: 'necessária', disponivel: 'disponível', alem: 'além',
  persistencia: 'persistência', pratica: 'prática', duracao: 'duração', remocao: 'remoção',
  sensiveis: 'sensíveis', transacoes: 'transações', clicavel: 'clicável', edicao: 'edição',
  pendencias: 'pendências', obrigatorio: 'obrigatório', varios: 'vários',
  restricoes: 'restrições', deteccao: 'detecção', dialogo: 'diálogo', instrucao: 'instrução',
  posicao: 'posição', automacoes: 'automações', configuracoes: 'configurações',
  criacao: 'criação', horario: 'horário', dependencia: 'dependência', validacao: 'validação',
  bancario: 'bancário', descricao: 'descrição', amanha: 'amanhã',
};

function matchCase(source: string, target: string): string {
  if (source === source.toUpperCase() && source !== source.toLowerCase()) return target.toUpperCase();
  if (source[0] === source[0].toUpperCase() && source[0] !== source[0].toLowerCase()) {
    return target[0].toUpperCase() + target.slice(1);
  }
  return target;
}

/** Troca por dicionário, palavra a palavra, preservando maiúsculas — não usa IA. */
export function restoreAccents(text: string): string {
  return text.replace(/\p{L}+/gu, (word) => {
    const accented = ACCENT_DICTIONARY[word.toLowerCase()];
    return accented ? matchCase(word, accented) : word;
  });
}
