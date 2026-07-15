'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { authErrorTh, callbackErrorTh } from '@/lib/authErrors';
import { AuthError, FieldLabel, PasswordInput, Spinner } from '@/components/AuthUI';

type Busy = null | 'password' | 'magic';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [magicSent, setMagicSent] = useState(false);
  const [error, setError] = useState<string | null>(
    callbackErrorTh(searchParams.get('error'))
  );

  // Computed on click, not during render: `window` does not exist while this
  // component is being server-rendered.
  function callbackUrl() {
    const origin = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    return `${origin}/auth/callback?next=${encodeURIComponent(next)}`;
  }

  async function signInWithPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy('password');

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setBusy(null);
      setError(authErrorTh(error.message));
      return;
    }

    // Full refresh so the server re-reads the new session cookie.
    router.replace(next.startsWith('/') ? next : '/');
    router.refresh();
  }

  /** Fallback for people who forgot they ever set a password. */
  async function sendMagicLink() {
    if (!email.trim()) {
      setError('กรอกอีเมลก่อนนะ แล้วเราจะส่งลิงก์ไปให้');
      return;
    }

    setError(null);
    setBusy('magic');

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: callbackUrl() },
    });

    setBusy(null);

    if (error) {
      setError(authErrorTh(error.message));
      return;
    }

    setMagicSent(true);
  }

  if (magicSent) {
    return (
      <div className="card text-center">
        <span aria-hidden className="card-mark rounded-full bg-bau-blue" />
        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-none border-4 border-bau-ink bg-bau-blue text-white shadow-hard">
          <Mail className="h-10 w-10" strokeWidth={2.5} aria-hidden />
        </div>
        <h2 className="text-2xl font-black">ส่งลิงก์ไปแล้ว</h2>
        <p className="mt-3 font-medium leading-relaxed text-bau-ink/60">
          เราส่งลิงก์เข้าสู่ระบบไปที่
        </p>
        <p className="mt-2 break-all border-2 border-bau-ink bg-bau-yellow px-3 py-2 font-bold">
          {email}
        </p>
        <p className="mt-3 text-sm font-medium text-bau-ink/50">
          เปิดอีเมลแล้วกดลิงก์ได้เลย (เช็คในกล่องสแปมด้วยนะ)
        </p>
        <button
          type="button"
          onClick={() => setMagicSent(false)}
          className="btn-outline mt-6 w-full"
        >
          กลับไปหน้าเข้าสู่ระบบ
        </button>
      </div>
    );
  }

  return (
    <div className="card">
      <span aria-hidden className="card-mark rounded-full bg-bau-green" />

      <form onSubmit={signInWithPassword} className="space-y-5">
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

        <div>
          <div className="flex items-baseline justify-between">
            <FieldLabel htmlFor="password">รหัสผ่าน</FieldLabel>
            <Link
              href="/forgot-password"
              className="mb-2 text-[11px] font-bold uppercase tracking-widest text-bau-blue underline decoration-2 underline-offset-4"
            >
              ลืมรหัสผ่าน
            </Link>
          </div>
          <PasswordInput
            id="password"
            value={password}
            onChange={setPassword}
            placeholder="••••••••"
            autoComplete="current-password"
            visible={showPassword}
            onToggleVisible={() => setShowPassword((v) => !v)}
          />
        </div>

        <button
          type="submit"
          disabled={busy !== null || !email.trim() || !password}
          className="btn-primary w-full"
        >
          {busy === 'password' ? (
            <>
              <Spinner /> กำลังเข้าสู่ระบบ
            </>
          ) : (
            'เข้าสู่ระบบ'
          )}
        </button>
      </form>

      <div className="my-6 flex items-center gap-3">
        <span className="h-0.5 flex-1 bg-bau-ink" />
        <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-bau-ink/50">
          หรือ
        </span>
        <span className="h-0.5 flex-1 bg-bau-ink" />
      </div>

      <button
        type="button"
        onClick={sendMagicLink}
        disabled={busy !== null}
        className="btn-outline w-full"
      >
        {busy === 'magic' ? (
          <>
            <Spinner /> กำลังส่งลิงก์
          </>
        ) : (
          <>
            <Mail className="h-5 w-5" strokeWidth={2.5} aria-hidden />
            ส่งลิงก์เข้าอีเมลแทน
          </>
        )}
      </button>

      {error && <AuthError message={error} />}

      <p className="mt-6 border-t-2 border-bau-ink pt-5 text-center text-sm font-medium text-bau-ink/60">
        ยังไม่มีบัญชี?{' '}
        <Link
          href={`/register?next=${encodeURIComponent(next)}`}
          className="font-black text-bau-green underline decoration-2 underline-offset-4"
        >
          สมัครสมาชิก
        </Link>
      </p>
    </div>
  );
}
