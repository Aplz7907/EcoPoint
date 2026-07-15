/**
 * Supabase auth errors come back in English and are often terse ("Invalid login
 * credentials"). The user must never see one of those raw, so everything gets
 * mapped to a specific, friendly Thai sentence here.
 */
export function authErrorTh(message: string | undefined): string {
  const m = (message ?? '').toLowerCase();

  if (m.includes('invalid login credentials')) {
    return 'อีเมลหรือรหัสผ่านไม่ถูกต้อง ลองใหม่อีกครั้งนะ';
  }
  if (m.includes('email not confirmed')) {
    return 'ยังไม่ได้ยืนยันอีเมล กรุณาเปิดลิงก์ยืนยันในกล่องจดหมายของคุณก่อน';
  }
  if (m.includes('user already registered') || m.includes('already been registered')) {
    return 'อีเมลนี้สมัครไว้แล้ว ลองเข้าสู่ระบบแทนนะ';
  }
  if (m.includes('password should be at least') || m.includes('password should contain')) {
    return 'รหัสผ่านไม่ปลอดภัยพอ ใช้อย่างน้อย 8 ตัวอักษรนะ';
  }
  if (m.includes('weak password')) {
    return 'รหัสผ่านเดาง่ายเกินไป ลองผสมตัวอักษรกับตัวเลขดูนะ';
  }
  if (m.includes('rate') || m.includes('too many')) {
    return 'ลองถี่เกินไป รอสักครู่แล้วค่อยลองใหม่นะ';
  }
  if (m.includes('unable to validate email') || m.includes('invalid email')) {
    return 'รูปแบบอีเมลไม่ถูกต้อง ตรวจสอบอีกครั้งนะ';
  }
  if (m.includes('same password')) {
    return 'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม';
  }
  if (m.includes('expired') || m.includes('invalid token')) {
    return 'ลิงก์หมดอายุแล้ว กรุณาขอลิงก์ใหม่อีกครั้ง';
  }
  if (m.includes('network') || m.includes('fetch')) {
    return 'เชื่อมต่อไม่สำเร็จ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่นะ';
  }

  return 'เกิดข้อผิดพลาด ลองใหม่อีกครั้งนะ 🌱';
}

/** Errors that come back on the /login URL as ?error=… */
export function callbackErrorTh(code: string | null): string | null {
  if (!code) return null;

  switch (code) {
    case 'missing_code':
      return 'ลิงก์ไม่สมบูรณ์ กรุณาลองเข้าสู่ระบบอีกครั้ง';
    case 'exchange_failed':
      return 'ลิงก์หมดอายุหรือถูกใช้ไปแล้ว กรุณาลองใหม่อีกครั้ง';
    default:
      return 'เข้าสู่ระบบไม่สำเร็จ ลองใหม่อีกครั้งนะ';
  }
}
