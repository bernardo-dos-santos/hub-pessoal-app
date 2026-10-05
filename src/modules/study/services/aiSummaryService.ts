import { aiClient } from '../../../core/ai/aiClient';
import { MATH_TEXT_RULES } from '../../../core/ai/formatInstructions';

export type SummaryFormat = 'resumo' | 'topicos' | 'prova';

const FORMAT_INSTRUCTION: Record<SummaryFormat, string> = {
  resumo: [
    'Escreva um resumo completo e coeso em parágrafos. Regras:',
    '- Mínimo de 4 parágrafos; use quantos forem necessários para cobrir o material inteiro.',
    '- Cada parágrafo deve abordar um tema ou grupo de conceitos relacionados.',
    '- Inclua definições, explicações e relações entre conceitos — não apenas mencione os nomes.',
    '- Termine com um parágrafo de síntese conectando os temas principais.',
    '- Não seja superficial: se o material é denso, o resumo também deve ser.',
  ].join('\n'),

  topicos: [
    'Organize em tópicos e subtópicos hierárquicos (use ## para seções e - para itens). Regras:',
    '- Crie uma seção (##) para cada tema principal encontrado no material.',
    '- Dentro de cada seção, liste subtópicos com definições concisas — não apenas rótulos.',
    '- Inclua exemplos, fórmulas ou valores numéricos quando presentes no material.',
    '- Destaque diferenças entre conceitos parecidos (ex: "X vs Y:") onde relevante.',
    '- O resultado deve funcionar como guia de revisão completo — cubra TODO o material.',
  ].join('\n'),

  prova: [
    'Crie um guia de prova completo e estratégico. Regras:',
    '- Para cada tópico: definição precisa + o que mais cai em prova + armadilhas comuns.',
    '- Liste fórmulas, siglas e valores numéricos em destaque (use **negrito** ou listas).',
    '- Inclua seção "Diferenças importantes" para pares de conceitos frequentemente confundidos.',
    '- Inclua seção "Dicas de prova" com atalhos mnemônicos ou padrões de questão.',
    '- Não omita nenhum tópico do material — mesmo os menores podem cair em questão.',
    '- Ao final, inclua uma lista rápida "Revisar antes da prova" com os pontos mais críticos.',
  ].join('\n'),
};

export type SummarizeInput = {
  sourceText: string;
  format: SummaryFormat;
  subjectTag?: string;
};

export const aiSummaryService = {
  async summarize(input: SummarizeInput): Promise<string> {
    const subject = input.subjectTag ? ` de "${input.subjectTag}"` : '';
    const prompt = [
      `Você é um tutor de estudos em português do Brasil.`,
      `Sua tarefa é criar um MATERIAL DE ESTUDO${subject} baseado no conteúdo abaixo.`,
      ``,
      `REGRAS OBRIGATÓRIAS:`,
      `- O conteúdo pode ter múltiplos documentos separados por === título ===. Cubra o conteúdo de TODOS os documentos, distribuindo atenção entre eles.`,
      `- NÃO responda perguntas nem resolva exercícios presentes no conteúdo.`,
      `- NÃO liste perguntas e respostas — isso não é um gabarito.`,
      `- Se o conteúdo contiver listas de exercícios, use-as APENAS para identificar quais tópicos são importantes, mas não as responda.`,
      `- Foque nos CONCEITOS, DEFINIÇÕES, TEORIAS e TÉCNICAS encontrados no material.`,
      `- Não invente informação que não esteja no conteúdo.`,
      ``,
      `FORMATO SOLICITADO:`,
      FORMAT_INSTRUCTION[input.format],
      ``,
      MATH_TEXT_RULES,
      ``,
      `CONTEÚDO:`,
      input.sourceText,
    ].join('\n');

    return aiClient.complete(prompt, { temperature: 0.4 });
  },
};
