export class WoundedPool {
  constructor() {
    this._counts = new Map();
  }

  add(woundedByTierKey) {
    for (const [tierKey, count] of Object.entries(woundedByTierKey ?? {})) {
      if (count > 0) this._counts.set(tierKey, (this._counts.get(tierKey) ?? 0) + count);
    }
  }

  get() {
    return Object.fromEntries(this._counts);
  }

  serialize() {
    return this.get();
  }

  deserialize(obj) {
    this._counts = new Map();
    this.add(obj);
  }
}
