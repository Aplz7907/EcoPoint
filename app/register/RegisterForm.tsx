'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { authErrorTh } from '@/lib/authErrors';
import { AuthError, FieldLabel, PasswordInput, Spinner } from '@/components/AuthUI';

const MIN_PASSWORD_LENGTH = 8;

type Busy = null | 'signup';

export function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/';

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [confirmSent, setConfirmSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function callbackUrl() {
    const origin = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    return `${origin}/auth/callback?next=${encodeURIComponent(next)}`;
  }

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`รหัสผ่านต้องยาวอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษรนะ`);
      return;
    }

    if (password !== confirm) {
      setError('รหัสผ่านสองช่องไม่ตรงกัน ลองพิมพ์ใหม่อีกครั้งนะ');
      return;
    }

    setBusy('signup');

    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: callbackUrl(),
        // The on_auth_user_created trigger in schema.sql reads full_name out of
        // raw_user_meta_data to seed profiles.display_name.
        data: { full_name: displayName.trim() || null },
      },
    });

    if (error) {
      setBusy(null);
      setError(authErrorTh(error.message));
      return;
    }

    // When email confirmation is ON, Supabase deliberately returns a decoy user
    // with an empty identities array for an address that already exists, rather
    // than leaking "this email is registered". Detect it and say so ourselves —
    // the person is standing here trying to sign up, so it is not a leak.
    if (data.user && data.user.identities?.length === 0) {
      setBusy(null);
      setError('อีเมลนี้สมัครไว้แล้ว ลองเข้าสู่ระบบแทนนะ');
      return;
    }

    // Session present = email confirmation is turned off → straight into the app.
    if (data.session) {
      router.replace(next.startsWith('/') ? next : '/');
      router.refresh();
      return;
    }

    setBusy(null);
    setConfirmSent(true);
  }

  if (confirmSent) {
    return (
      <div className="card text-center">
        <span aria-hidden className="card-mark rounded-full bg-bau-green" />
        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-none border-4 border-bau-ink bg-bau-green text-white shadow-hard">
          <Mail className="h-10 w-10" strokeWidth={2.5} aria-hidden />
        </div>
        <h2 className="text-2xl font-black">อีกขั้นเดียว</h2>
        <p className="mt-3 font-medium leading-relaxed text-bau-ink/60">
          เราส่งลิงก์ยืนยันไปที่
        </p>
        <p className="mt-2 break-all border-2 border-bau-ink bg-bau-yellow px-3 py-2 font-bold">
          {email}
        </p>
        <p className="mt-3 text-sm font-medium text-bau-ink/50">
          เปิดอีเมลแล้วกดลิงก์เพื่อยืนยันบัญชี (ถ้าไม่เจอ ลองดูในกล่องสแปม)
        </p>
        <Link href="/login" className="btn-outline mt-6 w-full">
          ไปหน้าเข้าสู่ระบบ
        </Link>
      </div>
    );
  }

  const passwordTooShort =
    password.length > 0 && password.length < MIN_PASSWORD_LENGTH;
  const mismatch = confirm.length > 0 && password !== confirm;

  return (
    <div className="card">
      <span aria-hidden className="card-mark rounded-none bg-bau-blue" />

      <form onSubmit={signUp} className="space-y-5">
        <div>
          <FieldLabel htmlFor="displayName">ชื่อที่อยากให้เรียก</FieldLabel>
          <input
            id="displayName"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="เช่น สมชาย"
            autoComplete="name"
            maxLength={50}
            className="input"
          />
        </div>

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
          <FieldLabel htmlFor="password">รหัสผ่าน</FieldLabel>
          <PasswordInput
            id="password"
            value={password}
            onChange={setPassword}
            placeholder="อย่างน้อย 8 ตัวอักษร"
            autoComplete="new-password"
            visible={showPassword}
            onToggleVisible={() => setShowPassword((v) => !v)}
          />
          {passwordTooShort && (
            <p className="mt-2 border-2 border-bau-ink bg-bau-yellow px-3 py-1.5 text-xs font-bold">
              สั้นไปนิด — ต้องอย่างน้อย {MIN_PASSWORD_LENGTH} ตัวอักษร
            </p>
          )}
        </div>

        <div>
          <FieldLabel htmlFor="confirm">ยืนยันรหัสผ่าน</FieldLabel>
          <PasswordInput
            id="confirm"
            value={confirm}
            onChange={setConfirm}
            placeholder="พิมพ์รหัสผ่านอีกครั้ง"
            autoComplete="new-password"
            visible={showPassword}
            onToggleVisible={() => setShowPassword((v) => !v)}
          />
          {mismatch && (
            <p className="mt-2 border-2 border-bau-ink bg-bau-yellow px-3 py-1.5 text-xs font-bold">
              ยังไม่ตรงกับรหัสผ่านด้านบน
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={
            busy !== null ||
            !email.trim() ||
            password.length < MIN_PASSWORD_LENGTH ||
            password !== confirm
          }
          className="btn-primary w-full"
        >
          {busy === 'signup' ? (
            <>
              <Spinner /> กำลังสมัครสมาชิก
            </>
          ) : (
            'สมัครสมาชิก'
          )}
        </button>
      </form>

      {error && <AuthError message={error} />}

      <p className="mt-6 border-t-2 border-bau-ink pt-5 text-center text-sm font-medium text-bau-ink/60">
        มีบัญชีอยู่แล้ว?{' '}
        <Link
          href={`/login?next=${encodeURIComponent(next)}`}
          className="font-black text-bau-green underline decoration-2 underline-offset-4"
        >
          เข้าสู่ระบบ
        </Link>
      </p>
    </div>
  );
}
