'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Mail } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { authErrorTh } from '@/lib/authErrors';
import { AuthError, FieldLabel, Spinner } from '@/components/AuthUI';
import { AuthShell } from '@/components/AuthShell';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendReset(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    const origin = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      // The recovery link lands on /auth/callback, which turns the code into a
      // session and then forwards here → /reset-password can call updateUser().
      redirectTo: `${origin}/auth/callback?next=/reset-password`,
    });

    setBusy(false);

    if (error) {
      setError(authErrorTh(error.message));
      return;
    }

    setSent(true);
  }

  return (
    <AuthShell
      title="ลืมรหัสผ่าน"
      subtitle="ใส่อีเมลที่ใช้สมัคร แล้วเราจะส่งลิงก์ไปตั้งรหัสผ่านใหม่ให้"
      band="yellow"
    >
      {sent ? (
        <div className="card text-center">
          <span aria-hidden className="card-mark rounded-full bg-bau-yellow" />
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-none border-4 border-bau-ink bg-bau-yellow shadow-hard">
            <Mail className="h-10 w-10" strokeWidth={2.5} aria-hidden />
          </div>
          <h2 className="text-2xl font-black">ส่งลิงก์ไปแล้ว</h2>
          <p className="mt-3 font-medium leading-relaxed text-bau-ink/60">
            ถ้ามีบัญชีที่ใช้อีเมลนี้ เราส่งลิงก์ตั้งรหัสผ่านใหม่ไปให้แล้ว
            (เช็คในกล่องสแปมด้วยนะ)
          </p>
          <p className="mt-3 break-all border-2 border-bau-ink bg-bau-muted px-3 py-2 font-bold">
            {email}
          </p>
          <Link href="/login" className="btn-outline mt-6 w-full">
            กลับไปหน้าเข้าสู่ระบบ
          </Link>
        </div>
      ) : (
        <div className="card">
          <span aria-hidden className="card-mark rounded-none bg-bau-yellow" />

          <form onSubmit={sendReset} className="space-y-5">
            <div>
              <FieldLabel htmlFor="email">อีเมล</FieldLabel>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                inputMode="email"
                className="input"
              />
            </div>

            <button
              type="submit"
              disabled={busy || !email.trim()}
              className="btn-primary w-full"
            >
              {busy ? (
                <>
                  <Spinner /> กำลังส่งลิงก์
                </>
              ) : (
                'ส่งลิงก์ตั้งรหัสผ่านใหม่'
              )}
            </button>
          </form>

          {error && <AuthError message={error} />}

          <p className="mt-6 border-t-2 border-bau-ink pt-5 text-center">
            <Link
              href="/login"
              className="text-xs font-bold uppercase tracking-widest text-bau-blue underline decoration-2 underline-offset-4"
            >
              ← กลับไปหน้าเข้าสู่ระบบ
            </Link>
          </p>
        </div>
      )}
    </AuthShell>
  );
}
