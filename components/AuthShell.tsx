import { Logo, ShapeField } from '@/components/Geometry';

/**
 * Every signed-out page is the same poster: a colour-blocked masthead with the
 * geometric mark, a hard rule, then the form plane sitting on the canvas.
 * Centralised so login/register/forgot/reset cannot drift apart.
 */
export function AuthShell({
  title,
  subtitle,
  band = 'green',
  children,
  footnote,
}: {
  title: string;
  subtitle?: string;
  band?: 'green' | 'blue' | 'yellow';
  children: React.ReactNode;
  footnote?: React.ReactNode;
}) {
  const bandClass =
    band === 'blue'
      ? 'bg-bau-blue text-white'
      : band === 'yellow'
        ? 'bg-bau-yellow text-bau-ink'
        : 'bg-bau-green text-white';

  return (
    <div className="min-h-dvh">
      <header
        className={`rule relative overflow-hidden px-5 pb-10 pt-12 ${bandClass}`}
      >
        <ShapeField variant={band} />

        <div className="relative mx-auto max-w-md">
          <Logo />
          <h1 className="mt-6 text-4xl font-black uppercase leading-[0.9] tracking-tighter sm:text-5xl">
            {title}
          </h1>
          {subtitle && (
            <p
              className={`mt-3 max-w-xs font-medium leading-relaxed ${
                band === 'yellow' ? 'text-bau-ink/70' : 'text-white/80'
              }`}
            >
              {subtitle}
            </p>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-md px-5 py-8">
        {children}

        {footnote && (
          <p className="mt-8 text-center text-xs font-medium leading-relaxed text-bau-ink/45">
            {footnote}
          </p>
        )}
      </main>
    </div>
  );
}
