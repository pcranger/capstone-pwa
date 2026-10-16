import { useEffect, useRef, useState } from 'react';
import { englishSpeechPack, prepareEnglishSpeechPack, retryEnglishSpeechPack } from '../platform/speech';
import { useStore } from '../state/store';
import { Action } from './ProductPage';

export function SpeechPackStartup({ onDone }: { onDone: () => void }) {
  const pack = useStore(englishSpeechPack);
  const heading = useRef<HTMLHeadingElement>(null);
  const finish = useRef(onDone);
  finish.current = onDone;
  const [leaving, setLeaving] = useState(false);
  const working = pack.phase === 'idle' || pack.phase === 'checking' || pack.phase === 'downloading';

  useEffect(() => {
    heading.current?.focus();
    void prepareEnglishSpeechPack();
  }, []);
  useEffect(() => {
    if (pack.phase !== 'ready' && pack.phase !== 'unavailable') return;
    const timer = window.setTimeout(() => setLeaving(true), 600);
    return () => window.clearTimeout(timer);
  }, [pack.phase]);
  useEffect(() => {
    if (!leaving) return;
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const timer = window.setTimeout(() => finish.current(), reducedMotion ? 0 : 350);
    return () => window.clearTimeout(timer);
  }, [leaving]);

  return <section role="region" aria-label="Preparing offline voice"
    className={`cw-speech-startup${leaving ? ' cw-speech-startup-leaving' : ''}`}>
    <div className="cw-speech-startup-content">
      <h1 ref={heading} tabIndex={-1}>Preparing offline voice</h1>
      <p>CrossWise is preparing the English recognition pack for voice commands.</p>
      {working && <progress aria-label="English voice pack download progress" />}
      <p role={pack.phase === 'error' || pack.phase === 'needs-gesture' ? 'alert' : 'status'}>
        {pack.message || 'Checking browser support…'}
      </p>
      {pack.phase === 'downloading' && <p>Download size depends on your browser and device. The browser does not report a percentage.</p>}
      {(pack.phase === 'error' || pack.phase === 'needs-gesture') &&
        <Action onClick={() => { void retryEnglishSpeechPack(); }}>Retry download</Action>}
      {(working || pack.phase === 'error' || pack.phase === 'needs-gesture') &&
        <Action secondary onClick={() => setLeaving(true)}>Continue to CrossWise</Action>}
    </div>
  </section>;
}
