/**
 * jarvis/tools/machine.js — open_app, open_url, media_control, run_on_machine.
 */

import { callAgent } from '../../agentBridge.js';
import { requestCommand } from '../commands.js';
import { getJarvisConfig } from '../config.js';

export const machineTools = [
  {
    name: 'open_app',
    description: 'Abre um aplicativo no notebook do Bernardo (via agente local). Use quando ele pedir para abrir um programa.',
    input_schema: {
      type: 'object',
      properties: {
        app: { type: 'string', enum: ['navegador', 'chrome', 'vscode', 'steam', 'discord', 'explorer', 'calculadora', 'spotify'], description: 'Aplicativo da allowlist do agente' },
      },
      required: ['app'],
    },
  },
  {
    name: 'open_url',
    description: 'Abre uma URL no navegador do notebook do Bernardo (YouTube, site, música no YouTube etc.). Para "tocar tal música", abrir a busca da música no YouTube é um bom caminho.',
    input_schema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL completa http(s)://' },
      },
      required: ['url'],
    },
  },
  {
    name: 'media_control',
    description: 'Controla mídia e volume no notebook do Bernardo: pausar/tocar, próxima/anterior faixa, volume, mudo.',
    input_schema: {
      type: 'object',
      properties: {
        control: { type: 'string', enum: ['playpause', 'next', 'prev', 'volume_up', 'volume_down', 'mute'], description: 'Ação de mídia' },
      },
      required: ['control'],
    },
  },
  {
    name: 'run_on_machine',
    description: 'Roda um comando no terminal do notebook do Bernardo. Comandos de leitura conhecidos (git status, ls, npm test...) rodam direto; qualquer outro vira um pedido que ELE precisa aprovar no painel, vendo o texto exato. Quando cair na fila de aprovação, diga que pediu e siga — não fique esperando nem repita o pedido.',
    input_schema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'O comando exato a executar' },
        why: { type: 'string', description: 'Por que este comando — aparece para o Bernardo na hora de aprovar' },
      },
      required: ['command', 'why'],
    },
  },
];

export async function executeMachineTool(name, args) {
  switch (name) {
    case 'open_app':
      return await callAgent({ action: 'open_app', app: args.app });

    case 'open_url':
      return await callAgent({ action: 'open_url', url: args.url });

    case 'media_control':
      return await callAgent({ action: 'media', control: args.control });

    case 'run_on_machine': {
      // O nível vem da config em runtime: subir ou descer o acesso na tela vale
      // no próximo comando, sem reiniciar nada.
      const level = getJarvisConfig().capabilities.machine.level;
      return await requestCommand({ command: args.command, why: args.why, level });
    }

    default:
      return undefined;
  }
}
