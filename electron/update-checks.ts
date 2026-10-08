import type { UpdateInfo } from '../src/types';

/** Network checks are rare; manual clicks share the same in-flight request. */
export class UpdateChecks {
  private lastAttempt = -Infinity;
  private nextCheck = 0;
  private pending: Promise<UpdateInfo> | null = null;
  constructor(private deps: {
    check: () => Promise<void>;
    state: () => UpdateInfo;
    blocked: () => boolean;
    now?: () => number;
  }) {}
  async run(manual = false): Promise<UpdateInfo> {
    if (this.pending) return this.pending;
    const now = (this.deps.now || Date.now)();
    const state = this.deps.state();
    if (this.deps.blocked()) return manual ? { status: 'error', error: 'Проверка недоступна во время игры или без подключения к сети.' } : state;
    if (['checking', 'available', 'downloading', 'ready'].includes(state.status)
        || now - this.lastAttempt < 60_000 || !manual && now < this.nextCheck) return state;
    this.lastAttempt = now;
    this.nextCheck = now + 2 * 60 * 60_000;
    this.pending = (async () => {
      try { await this.deps.check(); }
      catch { this.nextCheck = (this.deps.now || Date.now)() + 15 * 60_000; }
      return this.deps.state();
    })();
    try { return await this.pending; }
    finally { this.pending = null; }
  }
}
