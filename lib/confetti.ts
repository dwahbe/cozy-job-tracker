import confetti from 'canvas-confetti';

export function celebrateOffer() {
  // Fire confetti from both sides
  const duration = 2000;
  const end = Date.now() + duration;

  const colors = ['#10b981', '#34d399', '#6ee7b7', '#fbbf24', '#f59e0b'];

  (function frame() {
    confetti({
      particleCount: 3,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.6 },
      colors,
    });
    confetti({
      particleCount: 3,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.6 },
      colors,
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  })();

  // Center burst
  confetti({
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 },
    colors,
  });
}
