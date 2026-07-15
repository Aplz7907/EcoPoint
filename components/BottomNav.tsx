'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Circle, Gift, ScrollText } from 'lucide-react';

const TABS = [
  { href: '/', label: 'หน้าแรก', Icon: Circle, accent: 'bg-bau-green' },
  { href: '/rewards', label: 'ของรางวัล', Icon: Gift, accent: 'bg-bau-blue' },
  { href: '/history', label: 'ประวัติ', Icon: ScrollText, accent: 'bg-bau-yellow' },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t-4 border-bau-ink bg-white pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-md divide-x-2 divide-bau-ink">
        {TABS.map(({ href, label, Icon, accent }) => {
          const active =
            href === '/' ? pathname === '/' : pathname.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`relative flex flex-1 flex-col items-center gap-1 py-3 text-[11px] font-bold uppercase tracking-widest transition-colors duration-200 ${
                active ? 'text-bau-ink' : 'text-bau-ink/35'
              }`}
            >
              {/* The active tab is marked by a solid bar, not a colour shift —
                  a plane sliding in, which is how Bauhaus indicates state. */}
              {active && (
                <span
                  aria-hidden
                  className={`absolute inset-x-0 top-0 h-1.5 ${accent}`}
                />
              )}
              <Icon
                className="h-6 w-6"
                strokeWidth={active ? 3 : 2}
                aria-hidden
              />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
