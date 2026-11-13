/* El mismo sonido y la misma preferencia en toda la sección. */
export const SONIDO_KEY = "typely_orbita_sonido";
export function sonidoActivado(): boolean {
  try { return localStorage.getItem(SONIDO_KEY) === "1"; }
  catch { return false; }
}

export function blip(freq: number, hasta: number, ganancia = 0.05) {
  const Ctor = window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return;
  const ctx = new Ctor();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(hasta, ctx.currentTime + 0.12);
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(ganancia, ctx.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.16);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.18);
  osc.onended = () => { osc.disconnect(); gain.disconnect(); void ctx.close(); };
}
