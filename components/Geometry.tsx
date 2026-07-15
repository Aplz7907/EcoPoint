/**
 * The three Bauhaus primitives. Every decorative element in this app is one of
 * these — nothing is drawn freehand, nothing is a stock illustration.
 */

/** Triangle, via clip-path: a real triangle, not a rotated square pretending. */
export function Triangle({ className = '' }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={className}
      style={{ clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' }}
    />
  );
}

/**
 * The brand mark: circle, square, triangle in the three primaries. Read left to
 * right it is the Bauhaus alphabet — and it doubles as the app's logo so we
 * never need a raster asset.
 */
export function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const box =
    size === 'lg' ? 'h-8 w-8' : size === 'sm' ? 'h-4 w-4' : 'h-6 w-6';

  return (
    <span className="inline-flex items-center gap-1.5" aria-hidden>
      <span
        className={`${box} rounded-full border-2 border-bau-ink bg-bau-green`}
      />
      <span
        className={`${box} rounded-none border-2 border-bau-ink bg-bau-blue`}
      />
      <Triangle className={`${box} bg-bau-yellow`} />
    </span>
  );
}

/**
 * Oversized shapes bled off the edge of a coloured band. Purely compositional —
 * this is what stops a solid colour block from reading as a plain background.
 */
export function ShapeField({ variant = 'green' }: { variant?: 'green' | 'blue' | 'yellow' | 'ink' }) {
  const shape =
    variant === 'yellow' || variant === 'ink' ? 'bg-bau-ink' : 'bg-white';

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className={`absolute -right-10 -top-12 h-40 w-40 rounded-full ${shape} opacity-[0.12]`}
      />
      <div
        className={`absolute -bottom-14 -left-8 h-32 w-32 rotate-45 rounded-none ${shape} opacity-[0.12]`}
      />
      <Triangle
        className={`absolute right-24 -bottom-6 h-20 w-20 ${shape} opacity-[0.10]`}
      />
    </div>
  );
}

/**
 * The corner marker on a card. Cycles through the primaries and through the
 * three shapes, so a list of cards reads as a composition rather than a stack
 * of identical boxes.
 */
export function CardMark({ index }: { index: number }) {
  const colors = ['bg-bau-green', 'bg-bau-blue', 'bg-bau-yellow'];
  const color = colors[index % 3];
  const shape = index % 3;

  if (shape === 0) {
    return <span aria-hidden className={`card-mark rounded-full ${color}`} />;
  }
  if (shape === 1) {
    return <span aria-hidden className={`card-mark rounded-none ${color}`} />;
  }
  return <Triangle className={`card-mark ${color}`} />;
}
