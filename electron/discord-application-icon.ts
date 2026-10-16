/** Public application metadata only: no Discord account, token or login required. */
export class DiscordApplicationIcon {
  private image?: string;
  private nextRefresh = 0;
  private pending?: Promise<void>;
  constructor(private applicationId: string, private request: typeof fetch = fetch, private now = Date.now) {}

  get url(): string | undefined { return this.image; }
  refresh(): Promise<void> {
    if (this.pending) return this.pending;
    if (this.now() < this.nextRefresh || !/^[0-9]{17,20}$/.test(this.applicationId)) return Promise.resolve();
    this.nextRefresh = this.now() + 60000;
    this.pending = this.load().catch(() => {
      // Keep the most recently verified icon during a temporary Discord outage.
    }).finally(() => { this.pending = undefined; });
    return this.pending;
  }
  private async load(): Promise<void> {
    const response = await this.request(`https://discord.com/api/v10/applications/${this.applicationId}/rpc`, {
      redirect: 'error', signal: AbortSignal.timeout(8000), headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
    });
    if (!response.ok || !response.body) { await response.body?.cancel(); throw new Error('Application icon unavailable'); }
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 32768) { await reader.cancel(); throw new Error('Application metadata too large'); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (value.id !== this.applicationId) throw new Error('Wrong application');
    if (value.icon === null) { this.image = undefined; return; }
    if (typeof value.icon !== 'string' || !/^(a_)?[0-9a-f]{32}$/.test(value.icon)) throw new Error('Invalid icon hash');
    this.image = `https://cdn.discordapp.com/app-icons/${this.applicationId}/${value.icon}.png?size=512`;
  }
}
