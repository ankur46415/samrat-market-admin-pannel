"use client"

type Tone = {
  freq: number
  start: number
  duration: number
  type?: OscillatorType
  gain?: number
}

let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null
  const Ctor =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  if (!audioCtx || audioCtx.state === "closed") {
    audioCtx = new Ctor()
  }
  if (audioCtx.state === "suspended") {
    void audioCtx.resume()
  }
  return audioCtx
}

function playTone(ctx: AudioContext, tone: Tone) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  const start = tone.start
  const duration = tone.duration
  osc.type = tone.type ?? "square"
  osc.frequency.setValueAtTime(tone.freq, start)
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(tone.gain ?? 0.2, start + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(start)
  osc.stop(start + duration + 0.03)
}

function vibrate(pattern: number[]) {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    /* ignore */
  }
}

/** Short high chirp after a product is found and held for Add. */
export function playScanFound() {
  const ctx = getAudioContext()
  if (!ctx) return
  const t = ctx.currentTime
  playTone(ctx, { freq: 880, start: t, duration: 0.07, type: "sine", gain: 0.14 })
  playTone(ctx, { freq: 1320, start: t + 0.08, duration: 0.1, type: "sine", gain: 0.14 })
}

/** Harsh repeating buzz when the barcode is not in inventory. */
export function playScanNotFound() {
  const ctx = getAudioContext()
  if (!ctx) return
  const t = ctx.currentTime
  for (let i = 0; i < 5; i++) {
    const start = t + i * 0.17
    playTone(ctx, { freq: 196, start, duration: 0.12, type: "square", gain: 0.32 })
    playTone(ctx, { freq: 147, start, duration: 0.12, type: "sawtooth", gain: 0.18 })
  }
  vibrate([200, 80, 200, 80, 320])
}

/** Soft warning if someone tries to scan while a card is on hold. */
export function playScanLocked() {
  const ctx = getAudioContext()
  if (!ctx) return
  const t = ctx.currentTime
  playTone(ctx, { freq: 320, start: t, duration: 0.09, type: "square", gain: 0.16 })
  playTone(ctx, { freq: 240, start: t + 0.1, duration: 0.12, type: "square", gain: 0.16 })
}

export function unlockScanAudio() {
  getAudioContext()
}
