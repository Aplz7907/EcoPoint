import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getProfile } from '@/lib/supabase/server';
import { SubmitForm } from './SubmitForm';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'ส่งรูปขยะ — EcoPoints',
};

export default async function SubmitPage() {
  const profile = await getProfile();
  if (!profile) redirect('/login');
  if (profile.is_banned) redirect('/');

  return (
    <div className="min-h-dvh">
      <header className="rule flex items-center gap-3 bg-white px-4 py-3">
        <Link
          href="/"
          aria-label="กลับหน้าแรก"
          className="flex h-11 w-11 items-center justify-center border-2 border-bau-ink bg-white shadow-hard-sm transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
        >
          <ArrowLeft className="h-5 w-5" strokeWidth={3} aria-hidden />
        </Link>
        <h1 className="text-xl font-black uppercase tracking-tight">
          ส่งรูปขยะ
        </h1>
      </header>

      <main className="mx-auto max-w-md px-5 py-6">
        <SubmitForm />
      </main>
    </div>
  );
}
