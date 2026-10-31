// Soft botanical / floral decorations (inline SVG, colour comes from currentColor
// so they follow the brand palette). All are decorative and hidden from
// screen readers.

const leaf = "M0 0C8-9 26-9 38 0 26 9 8 9 0 0Z";

/** A single five-petal blossom. */
export function Blossom({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="currentColor" aria-hidden="true">
      <g transform="translate(50 50)">
        {[0, 72, 144, 216, 288].map((a) => (
          <ellipse key={a} cx="0" cy="-22" rx="13" ry="23" transform={`rotate(${a})`} opacity="0.9" />
        ))}
        <circle r="8" fill="var(--bw-surface)" opacity="0.9" />
        <circle r="3.5" />
      </g>
    </svg>
  );
}

/** A leafy sprig, grows upward. */
export function Sprig({ className = "h-40 w-20" }: { className?: string }) {
  const leaves: [number, number, number, number][] = [
    [60, 168, -150, 0.95], [60, 150, -30, 1], [60, 126, -155, 0.9], [60, 108, -25, 0.95],
    [60, 84, -150, 0.8], [60, 66, -35, 0.8], [60, 44, -140, 0.65], [60, 30, -50, 0.6],
  ];
  return (
    <svg viewBox="0 0 120 200" className={className} fill="currentColor" aria-hidden="true">
      <path d="M60 198C58 150 64 80 60 8" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      {leaves.map(([x, y, rot, s], i) => (
        <path key={i} d={leaf} transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`} opacity={0.55 + (i % 3) * 0.15} />
      ))}
      <ellipse cx="60" cy="8" rx="4" ry="8" />
    </svg>
  );
}

/** Thin line with a blossom in the middle, used under headings. */
export function FloralDivider({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-3 text-primary ${className}`} aria-hidden="true">
      <span className="h-px w-14 bg-current opacity-40 sm:w-24" />
      <svg viewBox="0 0 60 24" className="h-5 w-12" fill="currentColor">
        <path d={leaf} transform="translate(2 12) rotate(-8) scale(0.5)" opacity="0.6" />
        <g transform="translate(30 12) scale(0.2) translate(-50 -50)">
          {[0, 72, 144, 216, 288].map((a) => (
            <ellipse key={a} cx="50" cy="28" rx="13" ry="23" transform={`rotate(${a} 50 50)`} />
          ))}
          <circle cx="50" cy="50" r="7" fill="var(--bw-surface)" />
        </g>
        <path d={leaf} transform="translate(58 12) rotate(188) scale(0.5)" opacity="0.6" />
      </svg>
      <span className="h-px w-14 bg-current opacity-40 sm:w-24" />
    </div>
  );
}

/** Large faded flourish for hero / section backgrounds. */
export function CornerSprigs({ className = "" }: { className?: string }) {
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden text-primary ${className}`} aria-hidden="true">
      <Sprig className="absolute -bottom-6 start-[-1.5rem] h-56 w-28 rotate-[18deg] opacity-[0.12] sm:h-80 sm:w-40" />
      <Sprig className="absolute -top-4 end-[-1rem] h-52 w-26 -rotate-[160deg] opacity-[0.12] sm:h-72 sm:w-36" />
      <Blossom className="absolute end-[12%] top-[16%] h-10 w-10 opacity-[0.16] sm:h-16 sm:w-16" />
      <Blossom className="absolute bottom-[14%] start-[10%] h-8 w-8 opacity-[0.14] sm:h-12 sm:w-12" />
    </div>
  );
}
