import { useEffect, useRef, useState } from 'react';
import { PedestrianClient } from '../perception/pedestrianClient';
import { crossingDecision } from '../perception/pedestrianPolicy';
import { PEDESTRIAN_MAX_IMAGE_EDGE, type PedestrianScene } from '../perception/pedestrianTypes';
import { PedestrianOverlay, pedestrianLabel } from '../ui/PedestrianOverlay';

/** Same worker and models as the live camera. Reference images never enter live crossing state. */
export function PedestrianImageCheck() {
  const client = useRef<PedestrianClient | null>(null);
  const serial = useRef(0);
  const [source, setSource] = useState('');
  const [aspect, setAspect] = useState(1);
  const [scene, setScene] = useState<PedestrianScene | null>(null);
  const [message, setMessage] = useState('');
  useEffect(() => () => { serial.current++; client.current?.dispose(); }, []);
  useEffect(() => () => { if (source) URL.revokeObjectURL(source); }, [source]);
  const analyze = async (file?: File) => {
    if (!file) return;
    const token = ++serial.current; client.current?.dispose(); setScene(null);
    // Some WebKit file pickers omit WebP's MIME type. Decoding below still
    // validates image contents; accept a known extension for untyped files.
    const untypedImage = (!file.type || file.type === 'application/octet-stream') && /\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name);
    if ((!file.type.startsWith('image/') && !untypedImage) || file.size > 20 * 1024 * 1024) { setMessage('Choose an image smaller than 20 MB.'); return; }
    setMessage('Loading the pedestrian detector and checking image…');
    try {
      const bitmap = await createImageBitmap(file);
      if (token !== serial.current) { bitmap.close(); return; }
      const scale = Math.min(1, PEDESTRIAN_MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas'); canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
      const context = canvas.getContext('2d')!; context.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
      setSource(URL.createObjectURL(file)); setAspect(canvas.width / canvas.height);
      client.current = new PedestrianClient(result => {
        if (token !== serial.current) return;
        setScene(result); setMessage(result.error ?? (result.observations.length ? 'Image check complete.' : 'No supported pedestrian signal, countdown or button found.'));
        client.current?.dispose();
      });
      client.current.analyzeImage(context.getImageData(0, 0, canvas.width, canvas.height), performance.now());
    } catch { if (token === serial.current) setMessage('Image could not be checked. Try another image.'); }
  };
  return <details><summary>Check a reference image</summary>
    <p>Experimental image check. Choose a local image; it stays on this device. This is a still-image result, not live crossing guidance.</p>
    <label>Pedestrian reference image <input aria-label="Pedestrian reference image" type="file" accept="image/*" onChange={e => { void analyze(e.target.files?.[0]); e.target.value = ''; }} /></label>
    <p role="status">{message}</p>
    {source && <div data-testid="pedestrian-image-result" style={{ position: 'relative', width: `min(100%, ${70 * aspect}vh)`, aspectRatio: String(aspect), background: '#000' }}>
      <img src={source} alt="Selected pedestrian reference" style={{ position: 'absolute', inset: 0, display: 'block', width: '100%', height: '100%', maxHeight: 'none', maxWidth: 'none', borderRadius: 0, objectFit: 'contain' }} />
      {scene && <PedestrianOverlay scene={scene} frameAspect={aspect} resizeMode="contain" />}
    </div>}
    {scene && <><p>{crossingDecision(scene, scene.timestampMs).message}</p><ul>{scene.observations.map(o => <li key={o.id}>{pedestrianLabel(o)} · {o.source === 'pretrained' ? 'pretrained detector' : o.source === 'ocr' ? 'OCR estimate' : o.source === 'seven-segment' ? 'seven-segment estimate' : 'unverified shape estimate'}</li>)}</ul></>}
  </details>;
}
