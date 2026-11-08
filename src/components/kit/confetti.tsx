const COLORS = ["#0D5C63", "#C9A84C", "#A8D832", "#E8B4B8"];

// Fixed positions, so the burst renders the same on server and browser.
const PIECES = Array.from({ length: 30 }, (_, index) => ({
  left: (index * 37) % 100,
  delay: (index % 8) * 0.12,
  size: 6 + (index % 4) * 3,
  color: COLORS[index % COLORS.length],
  round: index % 3 === 0,
}));

export function Confetti() {
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden="true">
      {PIECES.map((piece, index) => (
        <span
          key={index}
          className="anim-confetti absolute top-0 block"
          style={{
            left: `${piece.left}%`,
            width: piece.size,
            height: piece.round ? piece.size : piece.size * 1.6,
            borderRadius: piece.round ? "9999px" : "2px",
            backgroundColor: piece.color,
            animationDelay: `${piece.delay}s`,
          }}
        />
      ))}
    </div>
  );
}