/**
 * jarvis/tools/fitness.js — add_workout, get_fitness_log.
 */

import { kvStore } from '../../db.js';
import { kv } from '../context.js';

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

    default:
      return undefined;
  }
}
