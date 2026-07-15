import type { Metadata, Viewport } from 'next';
import { Outfit, Kanit } from 'next/font/google';
import './globals.css';

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['400', '500', '700', '900'],
  display: 'swap',
  variable: '--font-outfit',
});

/**
 * Carries every Thai glyph in the app. Outfit has none, so without this the
 * entire interface would fall back to a system font and the design would
 * evaporate on the first line of copy.
 */
const kanit = Kanit({
  subsets: ['thai', 'latin'],
  weight: ['400', '500', '700', '900'],
  display: 'swap',
  variable: '--font-kanit',
});

export const metadata: Metadata = {
  title: 'ECOPOINTS — แยกขยะ เก็บแต้ม',
  description: 'ถ่ายรูปขยะรีไซเคิลที่แยกแล้ว รับแต้มไปแลกของรางวัล',
};

export const viewport: Viewport = {
  themeColor: '#0F7B36',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" className={`${outfit.variable} ${kanit.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
