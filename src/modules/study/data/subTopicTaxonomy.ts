/**
 * Sub-tópicos canônicos por disciplina (CBMSC + ABIN).
 * A IA usa esta lista para classificar questões — garante consistência de tags.
 * Disciplinas de faculdade não estão aqui: usam tags livres geradas pela IA.
 */
export const SUB_TOPIC_TAXONOMY: Readonly<Record<string, readonly string[]>> = {
  // ── CBMSC & ABIN (compartilhados) ─────────────────────────────────────────

  'Língua Portuguesa': [
    'interpretação de texto',
    'ortografia e acentuação',
    'morfologia',
    'sintaxe',
    'semântica',
    'figuras de linguagem',
    'pontuação',
    'coesão e coerência',
    'variação linguística',
  ],

  // ── CBMSC ─────────────────────────────────────────────────────────────────

  'Matemática': [
    'aritmética',
    'álgebra',
    'funções',
    'geometria plana',
    'geometria espacial',
    'trigonometria',
    'progressões',
    'probabilidade',
    'estatística',
    'análise combinatória',
    'razão e proporção',
    'porcentagem e juros',
  ],

  'Raciocínio Lógico-Quantitativo': [
    'proposições e conectivos',
    'tabelas de verdade',
    'inferências e silogismos',
    'tabelas e gráficos',
    'sequências numéricas e padrões',
    'raciocínio espacial',
    'problemas de raciocínio',
    'conjuntos',
  ],

  'Informática': [
    'hardware e software',
    'sistemas operacionais',
    'internet e redes',
    'segurança da informação',
    'pacote Office (Word/Excel/PowerPoint)',
    'conceitos de TI e cloud',
    'banco de dados básico',
  ],

  'Atualidades': [
    'política nacional',
    'economia brasileira',
    'meio ambiente e sustentabilidade',
    'saúde pública',
    'tecnologia e inovação',
    'geopolítica e relações internacionais',
    'cultura e sociedade',
  ],

  'Noções de Direito Constitucional': [
    'princípios fundamentais',
    'direitos e garantias fundamentais',
    'direitos sociais',
    'organização do Estado',
    'poderes da República',
    'controle de constitucionalidade',
    'ordem econômica e social',
    'direitos políticos',
  ],

  'Noções de Direito Administrativo': [
    'princípios da administração pública',
    'atos administrativos',
    'poderes administrativos',
    'licitação e contratos',
    'agentes públicos e servidores',
    'responsabilidade civil do Estado',
    'controle da administração',
    'bens públicos',
  ],

  'Ética e Cidadania no Serviço Público': [
    'princípios éticos',
    'código de ética do servidor',
    'estatuto do servidor público',
    'moralidade e improbidade administrativa',
    'transparência e acesso à informação',
    'cidadania e democracia',
  ],

  'Física': [
    'cinemática',
    'dinâmica e leis de Newton',
    'trabalho, energia e potência',
    'hidrostática e hidrodinâmica',
    'termologia e termodinâmica',
    'óptica geométrica',
    'ondulatória e acústica',
    'eletrostática',
    'eletrodinâmica',
    'eletromagnetismo',
  ],

  'Química Geral': [
    'matéria e propriedades',
    'tabela periódica',
    'ligações químicas',
    'estequiometria',
    'soluções e concentrações',
    'reações químicas',
    'eletroquímica',
    'funções inorgânicas',
    'cinética e equilíbrio químico',
  ],

  'Biologia': [
    'citologia',
    'genética e hereditariedade',
    'ecologia e biomas',
    'evolução',
    'fisiologia animal',
    'botânica',
    'microbiologia e imunologia',
    'reprodução e embriologia',
  ],

  'Anatomia e Fisiologia Humana': [
    'sistema circulatório',
    'sistema respiratório',
    'sistema nervoso',
    'sistema digestório',
    'sistema musculoesquelético',
    'sistema endócrino',
    'sistema urinário',
    'sistema tegumentar',
  ],

  'Primeiros Socorros e APH': [
    'RCP e desfibrilação',
    'hemorragias e curativos',
    'queimaduras',
    'trauma e imobilização',
    'intoxicações e envenenamentos',
    'afogamento e asfixia',
    'obstrução de vias aéreas',
    'choque e colapso circulatório',
  ],

  'Combate a Incêndio e Pânico': [
    'química e física do fogo',
    'classes de incêndio',
    'agentes extintores',
    'sistemas de proteção contra incêndio',
    'prevenção e segurança contra pânico',
    'hidrantes e sprinklers',
  ],

  'Salvamento e Resgate': [
    'acesso vertical e rapel',
    'salvamento aquático',
    'salvamento veicular e ferramentas hidráulicas',
    'busca e resgate em estruturas colapsadas',
    'resgate em altura',
    'nós e amarrações',
  ],

  'Legislação CBMSC': [
    'estrutura organizacional CBMSC',
    'regulamento disciplinar',
    'legislação estadual de SC',
    'defesa civil',
    'missões e competências do CBMSC',
  ],

  'Educação Física e TAF': [
    'condicionamento aeróbico',
    'força e resistência muscular',
    'flexibilidade e mobilidade',
    'provas do TAF CBMSC',
    'princípios do treinamento físico',
    'nutrição esportiva básica',
  ],

  // ── ABIN (exclusivos) ──────────────────────────────────────────────────────

  'Raciocínio Lógico': [
    'proposições e conectivos',
    'tabelas de verdade',
    'inferências e silogismos',
    'lógica de predicados',
    'sequências e padrões',
    'raciocínio espacial',
    'conjuntos e diagramas',
  ],

  'Direito Constitucional': [
    'princípios fundamentais',
    'direitos e garantias fundamentais',
    'direitos sociais e políticos',
    'organização do Estado',
    'poderes da República',
    'controle de constitucionalidade',
    'ordem econômica e social',
    'segurança pública e forças armadas',
  ],

  'Direito Administrativo': [
    'princípios da administração pública',
    'atos administrativos',
    'licitação e contratos',
    'agentes públicos',
    'responsabilidade civil do Estado',
    'controle da administração',
    'serviços públicos',
  ],

  'Atividade de Inteligência': [
    'ciclo de inteligência',
    'contrainteligência',
    'inteligência humana (HUMINT)',
    'inteligência de sinais (SIGINT)',
    'análise estratégica de inteligência',
    'doutrina nacional de inteligência',
    'segurança da informação em inteligência',
  ],

  'Legislação ABIN (SISBIN)': [
    'lei da ABIN',
    'SISBIN e subsistemas',
    'competências e atribuições da ABIN',
    'controle externo da atividade de inteligência',
    'sigilo e proteção de dados',
  ],

  'Inglês': [
    'reading comprehension',
    'vocabulary in context',
    'grammar',
    'text structure and cohesion',
    'inference and main idea',
    'false cognates',
  ],

  'Espanhol': [
    'comprensión lectora',
    'vocabulario en contexto',
    'gramática española',
    'inferencias y idea principal',
    'falsos cognatos',
  ],

  'História do Brasil e Mundial': [
    'Brasil colonial',
    'período imperial',
    'república velha',
    'era Vargas e Estado Novo',
    'ditadura militar e redemocratização',
    'história contemporânea do Brasil',
    'segunda guerra mundial e pós-guerra',
    'guerra fria',
    'história da América Latina',
  ],

  'Geografia do Brasil e Contemporânea': [
    'geopolítica mundial',
    'clima e vegetação do Brasil',
    'regiões e biomas brasileiros',
    'urbanização e demografia',
    'recursos naturais e matriz energética',
    'globalização e blocos econômicos',
    'cartografia e geoprocessamento',
  ],

  'Política Internacional e Segurança': [
    'organizações internacionais (ONU, OTAN)',
    'conflitos armados contemporâneos',
    'terrorismo e crime transnacional',
    'segurança global e nuclear',
    'diplomacia e negociações',
    'direito internacional humanitário',
  ],

  'Relações Internacionais': [
    'teorias das relações internacionais',
    'política externa brasileira',
    'acordos e tratados internacionais',
    'integração regional (Mercosul, UNASUL)',
    'ONU e multilateralismo',
    'blocos econômicos',
  ],

  'Ciências Humanas': [
    'sociologia clássica',
    'sociologia contemporânea',
    'filosofia política',
    'epistemologia',
    'antropologia cultural',
    'psicologia social',
  ],

  'Atualidades e Geopolítica': [
    'política nacional',
    'economia global',
    'conflitos e crises internacionais',
    'meio ambiente e mudanças climáticas',
    'tecnologia e sociedade',
    'saúde global',
  ],

  'Redação Discursiva': [
    'estrutura argumentativa',
    'coesão e coerência textual',
    'argumentação e contra-argumentação',
    'dissertação expositiva',
    'norma culta e estilo',
    'leitura crítica de textos-base',
  ],
};

/** Retorna os sub-tópicos canônicos de uma disciplina, ou null se não houver taxonomia definida. */
export function getSubTopics(subjectTag: string): readonly string[] | null {
  return SUB_TOPIC_TAXONOMY[subjectTag] ?? null;
}
