function playTone(
  frequency: number,
  durationMs: number,
  type: OscillatorType = "sine",
): void {
  if (typeof window === "undefined") {
    return;
  }

  const AudioContextClass =
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;

  if (!AudioContextClass) {
    return;
  }

  const context = new AudioContextClass();
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = type;
  oscillator.frequency.value = frequency;
  gain.gain.value = 0.08;

  oscillator.connect(gain);
  gain.connect(context.destination);

  oscillator.start();
  oscillator.stop(context.currentTime + durationMs / 1000);

  window.setTimeout(() => {
    void context.close();
  }, durationMs + 100);
}

export function playSuccessBeep(): void {
  playTone(880, 120, "sine");
  window.setTimeout(() => playTone(1175, 120, "sine"), 130);
}

export function playErrorBeep(): void {
  playTone(220, 220, "square");
}

export function vibrateSuccess(): void {
  navigator.vibrate?.(120);
}

export function vibrateError(): void {
  navigator.vibrate?.([120, 80, 120]);
}
