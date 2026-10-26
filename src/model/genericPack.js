import { UNIT_PACK_FORMAT, parseUnitPack } from './unitPacks';

/**
 * The library that ships with the app: common base setups with no game's names in
 * them. Heights are typical for 28–32 mm scale and meant to be adjusted.
 */
const round = (size, count, heightMm, name = '') => ({ name, shape: 'round', sizeX: size, count, heightMm });
const oval = (sizeX, sizeY, count, heightMm, name = '') => ({ name, shape: 'oval', sizeX, sizeY, count, heightMm });

export const GENERIC_PACK = parseUnitPack({
  format: UNIT_PACK_FORMAT,
  version: 1,
  name: 'Generic bases',
  description: 'Common base sizes and squad setups, without any game\'s unit names. Adjust counts and heights to your models.',
  author: 'ministoregen',
  licence: 'MIT',
  units: [
    { category: 'Infantry', name: '5 on 25 mm', models: [round(25, 5, 30)] },
    { category: 'Infantry', name: '10 on 25 mm', models: [round(25, 10, 30)] },
    { category: 'Infantry', name: '5 on 28.5 mm', models: [round(28.5, 5, 32)] },
    { category: 'Infantry', name: '5 on 32 mm', models: [round(32, 5, 35)] },
    { category: 'Infantry', name: '10 on 32 mm', models: [round(32, 10, 35)] },
    { category: 'Infantry', name: '10 on 32 mm with a leader on 40 mm', models: [round(32, 9, 35, 'Trooper'), round(40, 1, 45, 'Leader')] },
    { category: 'Infantry', name: '3 on 40 mm', models: [round(40, 3, 45)] },
    { category: 'Infantry', name: '5 on 40 mm', models: [round(40, 5, 45)] },
    { category: 'Infantry', name: '3 on 50 mm', models: [round(50, 3, 55)] },
    { category: 'Characters', name: 'Hero on 32 mm', models: [round(32, 1, 40)] },
    { category: 'Characters', name: 'Hero on 40 mm', models: [round(40, 1, 50)] },
    { category: 'Characters', name: 'Hero on 50 mm', models: [round(50, 1, 60)] },
    { category: 'Characters', name: 'Hero with a big cloak or wings on 40 mm', models: [{ ...round(40, 1, 55), overhang: { front: 5, right: 15, back: 10, left: 15 } }] },
    { category: 'Swarms', name: '3 swarms on 40 mm', models: [round(40, 3, 20)] },
    { category: 'Cavalry and bikes', name: '3 riders on 60 × 35 mm oval', models: [oval(35, 60, 3, 50)] },
    { category: 'Cavalry and bikes', name: '3 riders on 75 × 42 mm oval', models: [oval(42, 75, 3, 60)] },
    { category: 'Cavalry and bikes', name: '3 riders on 90 × 52 mm oval', models: [oval(52, 90, 3, 70)] },
    { category: 'Monsters', name: 'Large model on 60 mm', models: [round(60, 1, 80)] },
    { category: 'Monsters', name: 'Monster on 80 mm', models: [round(80, 1, 100)] },
    { category: 'Monsters', name: 'Monster on 100 mm', models: [round(100, 1, 120)] },
    { category: 'Monsters', name: 'Monster on 105 × 70 mm oval', models: [oval(70, 105, 1, 100)] },
    { category: 'Monsters', name: 'Monster on 120 × 92 mm oval', models: [oval(92, 120, 1, 120)] },
    { category: 'Monsters', name: 'Winged monster on 100 mm', models: [{ ...round(100, 1, 130), overhang: { front: 10, right: 40, back: 20, left: 40 } }] },
    { category: 'Vehicles', name: 'Walker on 60 mm', models: [round(60, 1, 75)] },
    { category: 'Vehicles', name: 'Walker on 90 mm', models: [round(90, 1, 110)] },
    { category: 'Vehicles', name: 'Vehicle on 60 mm with 2 drones on 32 mm', models: [round(60, 1, 60, 'Vehicle'), round(32, 2, 40, 'Drone')] },
    { category: 'Vehicles', name: 'Skimmer on 105 × 70 mm oval', models: [oval(70, 105, 1, 90)] },
    { category: 'Vehicles', name: 'Small tank without a base, 70 × 100 mm', models: [{ shape: 'pads', sizeX: 70, sizeY: 100, count: 1, heightMm: 60 }] },
    { category: 'Vehicles', name: 'Large tank without a base, 100 × 140 mm', models: [{ shape: 'pads', sizeX: 100, sizeY: 140, count: 1, heightMm: 80 }] },
  ],
});
