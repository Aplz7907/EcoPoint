'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, Hourglass } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { authErrorTh } from '@/lib/authErrors';
import { AuthError, FieldLabel, PasswordInput, Spinner } from '@/components/AuthUI';
import { AuthShell } from '@/components/AuthShell';

const MIN_PASSWORD_LENGTH = 8;

export default function ResetPasswordPage() {
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Getting here without a session means the recovery link expired or was
  // already used. Say that plainly instead of showing a form that cannot work.
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(Boolean(data.session));
      setChecking(false);
    });
  }, []);

  async function updatePassword(e: React.FormEvent) {
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

    setBusy(true);

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    setBusy(false);

    if (error) {
      setError(authErrorTh(error.message));
      return;
    }

    setDone(true);
  }

  return (
    <AuthShell title="ตั้งรหัสผ่านใหม่" band="green">
      {checking ? (
        <div className="card flex items-center justify-center gap-3 py-12 font-bold uppercase tracking-widest text-bau-ink/50">
          <Spinner /> กำลังตรวจสอบลิงก์
        </div>
      ) : done ? (
        <div className="card text-center">
          <span aria-hidden className="card-mark rounded-full bg-bau-green" />
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full border-4 border-bau-ink bg-bau-green text-white shadow-hard">
            <Check className="h-10 w-10" strokeWidth={4} aria-hidden />
          </div>
          <h2 className="text-2xl font-black">เปลี่ยนรหัสผ่านเรียบร้อย</h2>
          <p className="mt-3 font-medium text-bau-ink/60">
            ครั้งหน้าเข้าสู่ระบบด้วยรหัสผ่านใหม่ได้เลย
          </p>
          <button
            type="button"
            onClick={() => {
              router.replace('/');
              router.refresh();
            }}
            className="btn-primary mt-6 w-full"
          >
            เริ่มเก็บแต้มเลย
          </button>
        </div>
      ) : !hasSession ? (
        <div className="card text-center">
          <span aria-hidden className="card-mark rounded-none bg-bau-red" />
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-none border-4 border-bau-ink bg-bau-red text-white shadow-hard">
            <Hourglass className="h-10 w-10" strokeWidth={2.5} aria-hidden />
          </div>
          <h2 className="text-2xl font-black">ลิงก์หมดอายุแล้ว</h2>
          <p className="mt-3 font-medium leading-relaxed text-bau-ink/60">
            ลิงก์ตั้งรหัสผ่านใช้ได้ครั้งเดียวและมีอายุจำกัด ขอลิงก์ใหม่อีกครั้งนะ
          </p>
          <Link href="/forgot-password" className="btn-primary mt-6 w-full">
            ขอลิงก์ใหม่
          </Link>
        </div>
      ) : (
        <div className="card">
          <span aria-hidden className="card-mark rounded-full bg-bau-green" />

          <form onSubmit={updatePassword} className="space-y-5">
            <div>
              <FieldLabel htmlFor="password">รหัสผ่านใหม่</FieldLabel>
              <PasswordInput
                id="password"
                value={password}
                onChange={setPassword}
                placeholder="อย่างน้อย 8 ตัวอักษร"
                autoComplete="new-password"
                visible={show}
                onToggleVisible={() => setShow((v) => !v)}
              />
            </div>

            <div>
              <FieldLabel htmlFor="confirm">ยืนยันรหัสผ่านใหม่</FieldLabel>
              <PasswordInput
                id="confirm"
                value={confirm}
                onChange={setConfirm}
                placeholder="พิมพ์รหัสผ่านอีกครั้ง"
                autoComplete="new-password"
                visible={show}
                onToggleVisible={() => setShow((v) => !v)}
              />
            </div>

            <button
              type="submit"
              disabled={
                busy ||
                password.length < MIN_PASSWORD_LENGTH ||
                password !== confirm
              }
              className="btn-primary w-full"
            >
              {busy ? (
                <>
                  <Spinner /> กำลังบันทึก
                </>
              ) : (
                'บันทึกรหัสผ่านใหม่'
              )}
            </button>
          </form>

          {error && <AuthError message={error} />}
        </div>
      )}
    </AuthShell>
  );
}
