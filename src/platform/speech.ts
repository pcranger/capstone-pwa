import type { SpeechInput } from "../voice/nativeSpeech";
import { speechStatus } from "../voice/speechStatus";
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  processLocally: boolean;
  onstart: (() => void) | null;
  onresult:
    | ((e: {
        results: {
          [index: number]: { [index: number]: { transcript: string } };
        };
      }) => void)
    | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  abort(): void;
}
type Constructor = {
  new (): Recognition;
  available?: (o: {
    langs: string[];
    processLocally: boolean;
  }) => Promise<string>;
};
export class BrowserSpeechInput implements SpeechInput {
  private ctor: Constructor | null = null;
  private stop: (() => void) | null = null;
  async prepare() {
    const ctor = (window as unknown as { SpeechRecognition?: Constructor })
      .SpeechRecognition;
    try {
      if (
        !ctor?.available ||
        (await ctor.available({ langs: ["en-US"], processLocally: true })) !==
          "available"
      )
        throw new Error(
          "Offline English recognition is unavailable in this browser.",
        );
      this.ctor = ctor;
      speechStatus.set({ locale: "en-US", error: null });
    } catch (e) {
      speechStatus.set({
        locale: null,
        error: e instanceof Error ? e.message : "Voice unavailable.",
      });
      throw e;
    }
  }
  listen(ready: () => void): Promise<string> {
    this.cancel();
    if (!this.ctor) return Promise.reject(new Error("Voice unavailable."));
    const r = new this.ctor();
    r.lang = "en-US";
    r.processLocally = true;
    r.continuous = false;
    r.interimResults = false;
    return new Promise((resolve, reject) => {
      let finished = false;
      const end = (text: string | null, error?: string) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        this.stop = null;
        r.abort();
        if (text) resolve(text);
        else reject(new Error(error ?? "Request cancelled."));
      };
      const timer = setTimeout(() => end(null, "Voice timed out."), 20000);
      this.stop = () => end(null);
      r.onstart = ready;
      r.onresult = (e) => end(e.results[0][0].transcript);
      r.onerror = (e) =>
        end(
          null,
          e.error === "no-speech"
            ? "No speech heard."
            : "Voice recognition unavailable. Try again.",
        );
      r.onend = () => end(null, "No speech heard.");
      try {
        r.start();
      } catch {
        end(null, "Voice recognition unavailable. Try again.");
      }
    });
  }
  cancel() {
    const stop = this.stop;
    this.stop = null;
    stop?.();
  }
}
