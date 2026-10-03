import { RESOURCE_VALUE, EXCHANGE_SPREAD, PRESSURE_PER_1000_WORTH, PRESSURE_CAP } from '../../entities/GAME_DATA.js';

export function quote({ give, get, amount, pressure = 1 }) {
  if (!(give in RESOURCE_VALUE) || !(get in RESOURCE_VALUE)) throw new RangeError(`Unknown resource: ${give} / ${get}`);
  if (give === get) throw new RangeError('Cannot exchange a resource for itself');
  if (!Number.isInteger(amount) || amount < 1) throw new RangeError('Amount must be a positive integer');
  const unitRate = RESOURCE_VALUE[give] / RESOURCE_VALUE[get] * (1 - EXCHANGE_SPREAD) / pressure;
  return { gain: Math.floor(amount * unitRate), rate: unitRate * 100 };
}

export function addPressure(current, give, amount) {
  return Math.min(PRESSURE_CAP, current + PRESSURE_PER_1000_WORTH * amount * RESOURCE_VALUE[give] / 1000);
}
