import { AssistMode, type EngineSnapshot } from "../crossing/crossingEngine";
interface Session {
  name: string;
  csv: string;
}
const key = "crosswise_csv_sessions";
export class BrowserSessionLogger {
  private rows: string[] = [];
  private started = 0;
  private last = 0;
  private urls: string[] = [];
  record(snapshot: EngineSnapshot, enabled: boolean) {
    if (!enabled || snapshot.mode === AssistMode.IDLE) {
      this.flush();
      return;
    }
    if (!this.started) {
      this.started = Date.now();
      this.rows = ["elapsed_ms,mode,tracks,hazards,signal"];
    }
    if (Date.now() - this.last < 1000) return;
    this.last = Date.now();
    this.rows.push(
      [
        Date.now() - this.started,
        snapshot.mode,
        snapshot.tracks.length,
        snapshot.hazards.length,
        snapshot.signal.phase,
      ].join(","),
    );
    if (this.rows.length >= 10000) this.flush();
  }
  private stored(): Session[] {
    try {
      const raw = JSON.parse(localStorage.getItem(key) ?? "[]");
      return Array.isArray(raw)
        ? raw.filter(
            (s) => typeof s.name === "string" && typeof s.csv === "string",
          )
        : [];
    } catch {
      return [];
    }
  }
  private current(): Session {
    return {
      name: `crosswise-${new Date(this.started).toISOString().replace(/[:.]/g, "-")}.csv`,
      csv: this.rows.join("\n") + "\n",
    };
  }
  private flush() {
    if (!this.started) return;
    try {
      localStorage.setItem(
        key,
        JSON.stringify([this.current(), ...this.stored()].slice(0, 10)),
      );
    } catch {
      /* Storage unavailable; keep the current session available to export. */ return;
    }
    this.started = 0;
    this.rows = [];
  }
  sessions() {
    this.urls.forEach((u) => URL.revokeObjectURL(u));
    this.urls = [];
    const files = this.started
      ? [this.current(), ...this.stored()]
      : this.stored();
    return files.map((f) => {
      const blob = new Blob([f.csv], { type: "text/csv" }),
        uri = URL.createObjectURL(blob);
      this.urls.push(uri);
      return {
        uri,
        name: f.name,
        sizeKb: Math.max(1, Math.ceil(blob.size / 1024)),
      };
    });
  }
  clear() {
    localStorage.removeItem(key);
    this.started = 0; this.rows = [];
    this.urls.forEach(url => URL.revokeObjectURL(url)); this.urls = [];
  }
}
