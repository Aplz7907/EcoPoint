import { Suspense } from 'react';
import { AuthShell } from '@/components/AuthShell';
import { LoginForm } from './LoginForm';

export const metadata = {
  title: 'เข้าสู่ระบบ — EcoPoints',
};

export default function LoginPage() {
  return (
    <AuthShell
      title="EcoPoints"
      subtitle="แยกขยะ ถ่ายรูป เก็บแต้ม แลกของรางวัล"
      band="green"
      footnote="การเข้าสู่ระบบถือว่าคุณยอมรับให้เราเก็บรูปขยะที่คุณส่งเข้ามา เพื่อใช้ตรวจสอบและคิดแต้มเท่านั้น"
    >
      <Suspense
        fallback={
          <div className="card h-96 animate-pulse bg-bau-muted" aria-hidden />
        }
      >
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
