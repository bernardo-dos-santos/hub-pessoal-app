import { type RpgInventoryPreset } from '../types/rpg';

export const rpgInventoryPresets: RpgInventoryPreset[] = [
  { id: 'kit-medico', name: 'Kit médico', quantity: 1, notes: 'Estabiliza ferimentos leves em campo.' },
  { id: 'lanterna-tatica', name: 'Lanterna tática', quantity: 1 },
  { id: 'municao-extra', name: 'Munição extra', quantity: 30 },
  { id: 'corda-escalada', name: 'Corda de escalada (15m)', quantity: 1 },
  { id: 'kit-arrombamento', name: 'Kit de arrombamento', quantity: 1 },
  { id: 'racao-sobrevivencia', name: 'Ração de sobrevivência', quantity: 3 },
  { id: 'colete-tatico', name: 'Colete tático', quantity: 1 },
  { id: 'comunicador-radio', name: 'Comunicador rádio', quantity: 1 },
  { id: 'amuleto-ritualistico', name: 'Amuleto ritualístico', quantity: 1, notes: 'Item de investigação paranormal — origem a confirmar.' },
  { id: 'kit-forense', name: 'Kit forense', quantity: 1 },
];
