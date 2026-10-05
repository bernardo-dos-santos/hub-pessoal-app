/**
 * jarvis/agent.js — laço de tool calling do Claude.
 *
 * É o ÚNICO lugar que contabiliza gasto: budget.js é chamado aqui depois de
 * cada chamada ao modelo, com o `usage` da resposta. Instrumentar em outro
 * lugar significaria lembrar de instrumentar em todo lugar novo.
 */

import Anthropic from '@anthropic-ai/sdk';
import { executeToolAudited, newTurnState } from './tools/index.js';
import { recordSpend } from './budget.js';

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

/**
 * Quantas vezes aceitamos retomar um turno pausado. Tools server-side (web
 * search/fetch) rodam na infra da Anthropic e devolvem `pause_turn` quando o
 * laço interno delas atinge o limite — retomar é só reenviar a conversa com o
 * turno do assistente anexado, SEM mensagem de usuário nova.
 */
const MAX_PAUSE_TURNS = 5;

let client = null;
function getClient() {
  if (!ANTHROPIC_KEY) throw new Error('ANTHROPIC_API_KEY não configurada.');
  client ??= new Anthropic({ apiKey: ANTHROPIC_KEY });
  return client;
}

/**
 * Erros de tool server-side NÃO viram exceção: voltam HTTP 200 com o `content`
 * do bloco de resultado sendo um objeto de erro. O modelo lê e se adapta
 * sozinho, então aqui só registramos — silenciar por completo esconderia, por
 * exemplo, um `max_uses_exceeded` que explica uma resposta pela metade.
 */
function logServerToolErrors(content) {
  for (const block of content ?? []) {
    const inner = block?.content;
    const code = Array.isArray(inner) ? undefined : inner?.error_code;
    if (code) console.warn(`[jarvis] tool server-side "${block.type}" falhou: ${code}`);
  }
}

/**
 * Junta TODOS os blocos de texto da resposta, não só o primeiro.
 *
 * Com tool server-side (web search/fetch) o conteúdo volta intercalado:
 *
 *   text("Achei, Senhor: ") → server_tool_use → web_search_tool_result → text("Tem o Festival…")
 *
 * O `find` de antes devolvia só o primeiro bloco — ou seja, exatamente o
 * pedacinho que o modelo escreve ANTES de buscar, jogando fora a resposta de
 * verdade. É por isso que toda pesquisa por voz voltava cortada no meio da
 * frase ("Achei, Senhor:" e nada mais).
 *
 * Só o caminho SEM streaming passava por aqui — e é justo o que o modo voz usa.
 * No chat de texto o streaming soma os deltas e sempre trouxe tudo, o que
 * explica o bug aparecer só falando.
 */
function textOf(content) {
  return (content ?? [])
    .filter((b) => b.type === 'text' && b.text)
    .map((b) => b.text)
    .join('')
    .trim();
}

/**
 * Blocos de resultado de tool SERVER-SIDE que trazem conteúdo de fora.
 *
 * Eles nunca passam por executeToolAudited: rodam na infra da Anthropic e
 * voltam já resolvidos dentro do `content` da resposta. Sem esta varredura, o
 * modo cauteloso da Fase 8 ficaria inerte exatamente para as ferramentas que
 * ele existe para vigiar — a busca na web é a porta de entrada mais óbvia para
 * uma injeção de prompt, e é justamente a que não passa pelo executor.
 */
const EXTERNAL_RESULT_BLOCKS = {
  web_search_tool_result: 'web_search',
  web_fetch_tool_result: 'web_fetch',
};

export function markExternalContent(content, turn) {
  if (!turn) return;
  for (const block of content ?? []) {
    const origem = EXTERNAL_RESULT_BLOCKS[block?.type];
    if (!origem) continue;
    turn.tainted = true;
    if (!turn.taintedBy.includes(origem)) turn.taintedBy.push(origem);
  }
}

/**
 * Roda o laço de tool calling até o modelo encerrar o turno ou estourar os
 * limites.
 *
 * @param {object} opts
 * @param {string} opts.model
 * @param {Array}  opts.systemBlocks
 * @param {Array}  opts.messages
 * @param {Array}  opts.tools
 * @param {number} opts.maxIters   iterações de tool use (não conta pausas)
 * @param {number} opts.maxTokens
 * @param {{type: 'adaptive'}} [opts.thinking] raciocínio estendido — só as
 *   tarefas em background usam. Modelos da geração Claude 5 usam o formato
 *   "adaptive" (profundidade controlada por outputConfig.effort), não o
 *   "enabled"/budget_tokens dos modelos anteriores.
 * @param {{effort: 'low'|'medium'|'high'|'xhigh'|'max'}} [opts.outputConfig]
 * @param {(delta: string) => void} [opts.onTextDelta] recebe o texto conforme
 *   ele é gerado. Passar isto liga o modo streaming.
 * @returns {Promise<{text: string, affectedKeys: string[]}>}
 */
export async function runAgent({ model, systemBlocks, messages, tools, maxIters, maxTokens, thinking, outputConfig, onTextDelta }) {
  const anthropic = getClient();
  const conversation = [...messages];
  const affectedKeys = new Set();
  /**
   * Tudo que foi transmitido, somado. Num turno com tool o modelo costuma
   * falar antes ("deixa eu ver...") e depois da ferramenta — o cliente vê as
   * duas partes, então o texto final precisa ser a soma, não só o último
   * trecho. Sem isso o histórico e o TTS ficariam com menos texto do que a
   * tela mostrou.
   */
  let streamedText = '';
  /**
   * Estado do turno, criado aqui e não no módulo das tools de propósito: o
   * servidor atende requisições concorrentes, e uma marca global de "leu
   * conteúdo externo" vazaria de uma conversa para outra — travando ação numa
   * conversa por causa do que aconteceu em outra.
   */
  const turn = newTurnState();
  // Fallback caso o modelo encerre o turno sem texto depois de executar tools
  // (acontece: ele considera a ação "resposta suficiente") — melhor confirmar
  // com a mensagem da própria tool do que estourar erro na cara do usuário.
  let lastToolMessage = null;
  let pauseTurns = 0;

  // Pausa não consome orçamento de tool use: são coisas diferentes, e deixar
  // uma busca demorada comer o limite de ferramentas truncaria a resposta.
  for (let i = 0; i < maxIters + MAX_PAUSE_TURNS; i++) {
    const params = {
      model,
      max_tokens: maxTokens,
      system: systemBlocks,
      tools,
      messages: conversation,
      ...(thinking ? { thinking } : {}),
      ...(outputConfig ? { output_config: outputConfig } : {}),
    };
    const options = { timeout: thinking ? 120_000 : 60_000 };

    let response;
    try {
      if (onTextDelta) {
        const stream = anthropic.messages.stream(params, options);
        stream.on('text', (delta) => {
          streamedText += delta;
          onTextDelta(delta);
        });
        response = await stream.finalMessage();
      } else {
        response = await anthropic.messages.create(params, options);
      }
    } catch (err) {
      // Camada 3 da trava de gasto: a API recusando por saldo. É a única que
      // não depende de nenhuma estimativa nossa estar certa.
      if (err instanceof Anthropic.APIError && err.status === 402) {
        throw new Error('Sem saldo na conta da Anthropic. Recarregue os créditos e atualize o saldo nas configurações do Jarvis.');
      }
      throw err;
    }

    // Telemetria de custo: fica nos logs do PM2 (pm2 logs hub-server).
    if (response.usage) {
      console.log('[jarvis] usage', JSON.stringify(response.usage));
      recordSpend({ model, usage: response.usage });
    }
    logServerToolErrors(response.content);
    // Antes de qualquer tool deste turno rodar: se a resposta trouxe conteúdo
    // externo, o turno já está contaminado daqui em diante.
    markExternalContent(response.content, turn);

    if (response.stop_reason === 'pause_turn') {
      pauseTurns += 1;
      if (pauseTurns > MAX_PAUSE_TURNS) {
        const partial = streamedText || textOf(response.content);
        if (partial) return { text: partial, affectedKeys: [...affectedKeys] };
        throw new Error('A pesquisa ficou longa demais e foi interrompida.');
      }
      // Retomar é reenviar com o turno do assistente anexado e NENHUMA
      // mensagem de usuário nova — a API detecta o bloco pendente e continua.
      conversation.push({ role: 'assistant', content: response.content });
      continue;
    }

    if (response.stop_reason === 'refusal') {
      throw new Error('O modelo recusou esse pedido por política de segurança.');
    }

    if (response.stop_reason === 'tool_use') {
      // Só blocos `tool_use` são nossos. Tools server-side vêm como
      // `server_tool_use` e já chegam com o resultado embutido — tentar
      // executá-las aqui daria "tool desconhecida".
      const toolBlocks = response.content.filter((b) => b.type === 'tool_use');
      conversation.push({ role: 'assistant', content: response.content });

      const toolResults = [];
      for (const block of toolBlocks) {
        const result = await executeToolAudited(block.name, block.input, turn);
        if (result.affectedKey) affectedKeys.add(result.affectedKey);
        for (const k of result.extraAffectedKeys ?? []) affectedKeys.add(k);
        if (result.ok && result.message) lastToolMessage = result.message;
        // Tools definidas pela Anthropic (memory_20250818) esperam TEXTO no
        // tool_result, com os erros marcados em `is_error` — não um JSON de
        // status. `_text` é a convenção que o executor usa para dizer "mande
        // esta string crua"; sem ela o modelo receberia
        // {"ok":false,"_text":"Error: ..."} e teria que adivinhar que o objeto
        // inteiro é o erro. As tools do Hub continuam em JSON.
        const content = typeof result._text === 'string' ? result._text : JSON.stringify(result);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content,
          ...(typeof result._text === 'string' && result.ok === false ? { is_error: true } : {}),
        });
      }
      conversation.push({ role: 'user', content: toolResults });
      continue;
    }

    // Em streaming, o que vale é a soma do que o cliente já viu na tela.
    const text = streamedText || textOf(response.content);
    if (text) {
      // Resposta cortada no teto de tokens não pode voltar como se estivesse
      // completa. Acontece de verdade em pesquisa pesada: uma busca de oito
      // itens consumiu 23 chamadas server-side e parou aqui. Sem o aviso, o
      // Senhor lê meia resposta achando que é a resposta.
      const truncada = response.stop_reason === 'max_tokens';
      return {
        text: truncada ? `${text}\n\n(Resposta cortada no limite de tamanho, Senhor — peça a continuação se faltou algo.)` : text,
        affectedKeys: [...affectedKeys],
      };
    }
    if (lastToolMessage) return { text: lastToolMessage, affectedKeys: [...affectedKeys] };
    throw new Error(`Claude encerrou sem texto (stop_reason: ${response.stop_reason}).`);
  }

  throw new Error('Limite de iterações de tool calling atingido.');
}
