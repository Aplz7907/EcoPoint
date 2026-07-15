import { Suspense } from 'react';
import { AuthShell } from '@/components/AuthShell';
import { RegisterForm } from './RegisterForm';

export const metadata = {
  title: 'สมัครสมาชิก — EcoPoints',
};

export default function RegisterPage() {
  return (
    <AuthShell
      title="สมัครสมาชิก"
      subtitle="เริ่มเก็บแต้มจากขยะรีไซเคิลของคุณวันนี้"
      band="blue"
      footnote="การสมัครสมาชิกถือว่าคุณยอมรับให้เราเก็บรูปขยะที่คุณส่งเข้ามา เพื่อใช้ตรวจสอบและคิดแต้มเท่านั้น"
    >
      <Suspense
        fallback={
          <div className="card h-[32rem] animate-pulse bg-bau-muted" aria-hidden />
        }
      >
        <RegisterForm />
      </Suspense>
    </AuthShell>
  );
}
