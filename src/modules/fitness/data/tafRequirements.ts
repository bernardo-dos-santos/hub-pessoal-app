import { type TafRequirement } from '../types/taf-requirement';

// Requisitos mínimos TAF — Corpo de Bombeiros SC (masculino, 18-30 anos)
// Atualize conforme o edital oficial quando publicado.
//
// ATENÇÃO: existe uma cópia destes números em `server/jarvis.js`
// (const TAF_REQUIREMENTS) — o servidor é JS puro e não importa TS daqui.
// Mudou aqui, mude lá: senão o Jarvis cobra uma meta e o app mostra outra.
export const tafRequirements: TafRequirement[] = [
  {
    id: 'cooper',
    testName: 'Cooper 12min',
    workoutType: 'running',
    minimumValue: 2400,
    unit: 'metros',
    higherIsBetter: true,
    gender: 'male',
  },
  {
    id: 'sit-up',
    testName: 'Abdominal 1min',
    workoutType: 'sit_up',
    minimumValue: 40,
    unit: 'repetições',
    higherIsBetter: true,
  },
  {
    id: 'push-up',
    testName: 'Flexão de braço',
    workoutType: 'push_up',
    minimumValue: 30,
    unit: 'repetições',
    higherIsBetter: true,
  },
  {
    id: 'pull-up',
    testName: 'Barra fixa',
    workoutType: 'pull_up',
    minimumValue: 6,
    unit: 'repetições',
    higherIsBetter: true,
  },
];
