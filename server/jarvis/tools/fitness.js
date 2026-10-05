/**
 * jarvis/tools/fitness.js — add_workout, get_fitness_log, get_taf_status.
 */

import { kvStore } from '../../db.js';
import { kv } from '../context.js';
import { TAF_REQUIREMENTS } from './index.js';

export const fitnessTools = [
  {
    name: 'add_workout',
    description: 'Registra um treino de Bernardo. Use quando ele mencionar que treinou, foi à academia, fez corrida, natação ou qualquer atividade física.',
    input_schema: {
      type: 'object',
      properties: {
        date:             { type: 'string',  description: 'Data no formato YYYY-MM-DD (use hoje se não especificado)' },
        type:             { type: 'string',  description: 'Tipo de treino (ex: corrida, natação, musculação, funcional, ciclismo)' },
        durationMinutes:  { type: 'integer', description: 'Duração em minutos' },
        notes:            { type: 'string',  description: 'Observações opcionais (distância, peso, séries, etc.)' },
      },
      required: ['date', 'type', 'durationMinutes'],
    },
  },
  {
    name: 'get_fitness_log',
    description: 'Retorna os últimos treinos registrados (data, tipo, duração, observações). Use para histórico além do "último treino há X dias" do contexto.',
    input_schema: {
      type: 'object',
      properties: {
        limit: { type: 'integer', description: 'Quantos treinos retornar (padrão 10)' },
      },
    },
  },
  {
    name: 'get_taf_status',
    description: 'Situação do TAF do CBMSC: melhor marca em cada prova, se já passa do mínimo e quanto falta. Use quando Bernardo perguntar do TAF, se está pronto, ou o que precisa treinar — o TAF é eliminatório.',
    input_schema: { type: 'object', properties: {} },
  },
];

export async function executeFitnessTool(name, args) {
  switch (name) {
    case 'add_workout': {
      const workouts = kv('fitness.workouts') ?? [];
      const newWorkout = {
        id: Math.random().toString(36).slice(2, 10),
        date: args.date,
        type: args.type,
        durationMinutes: args.durationMinutes,
        notes: args.notes ?? '',
        source: 'jarvis',
        createdAt: new Date().toISOString(),
      };
      workouts.unshift(newWorkout);
      kvStore.set('fitness.workouts', JSON.stringify(workouts));
      return { ok: true, message: `Treino de ${args.type} (${args.durationMinutes}min) registrado para ${args.date}.`, affectedKey: 'fitness.workouts' };
    }

    case 'get_fitness_log': {
      const workouts = (kv('fitness.workouts') ?? []).slice(0, args.limit ?? 10)
        .map((w) => ({ date: w.date, type: w.type, durationMinutes: w.durationMinutes, notes: w.notes }));
      return { ok: true, workouts };
    }

    case 'get_taf_status': {
      const workouts = kv('fitness.workouts') ?? [];
      const results = TAF_REQUIREMENTS.map((req) => {
        const own = workouts.filter((w) => w.type === req.workoutType);
        // Melhor marca histórica: no TAF vale o que ele já provou conseguir.
        const values = own
          .map((w) => (req.workoutType === 'running' ? w.distanceMeters : w.reps))
          .filter((v) => typeof v === 'number' && v > 0);
        const best = values.length > 0 ? Math.max(...values) : null;
        const last = own.map((w) => w.date).sort().pop() ?? null;
        return {
          prova: req.testName,
          minimo: `${req.minimumValue} ${req.unit}`,
          melhorMarca: best !== null ? `${best} ${req.unit}` : null,
          passa: best !== null ? best >= req.minimumValue : null,
          faltam: best !== null && best < req.minimumValue ? `${req.minimumValue - best} ${req.unit}` : null,
          ultimoTreino: last,
        };
      });
      const semRegistro = results.filter((r) => r.melhorMarca === null).map((r) => r.prova);
      return {
        ok: true,
        provas: results,
        // Sem isto o modelo diz "está tudo certo" quando na verdade nunca foi medido.
        semRegistro,
        reprovando: results.filter((r) => r.passa === false).map((r) => r.prova),
      };
    }

    default:
      return undefined;
  }
}
