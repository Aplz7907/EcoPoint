import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Ban, Camera, Gift } from 'lucide-react';
import { createClient, getProfile } from '@/lib/supabase/server';
import { BottomNav } from '@/components/BottomNav';
import { StatusBadge } from '@/components/StatusBadge';
import { CardMark, Logo, ShapeField } from '@/components/Geometry';
import { formatPoints, timeAgoTh } from '@/lib/copy';
import type { Submission } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const profile = await getProfile();
  if (!profile) redirect('/login');

  if (profile.is_banned) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-bau-canvas px-5">
        <div className="card max-w-md text-center">
          <span aria-hidden className="card-mark rounded-none bg-bau-red" />
          <Ban
            className="mx-auto mb-4 h-16 w-16 text-bau-red"
            strokeWidth={3}
            aria-hidden
          />
          <h1 className="text-2xl font-black">บัญชีนี้ถูกระงับ</h1>
          <p className="mt-3 font-medium leading-relaxed text-bau-ink/60">
            หากคิดว่าเป็นความผิดพลาด กรุณาติดต่อผู้ดูแลระบบ
          </p>
          <form action="/auth/signout" method="post">
            <button type="submit" className="btn-outline mt-6 w-full">
              ออกจากระบบ
            </button>
          </form>
        </div>
      </main>
    );
  }

  const supabase = createClient();

  const { data: submissions } = await supabase
    .from('submissions')
    .select('id, status, points_earned, created_at, ai_result')
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(5);

  const recent = (submissions ?? []) as Pick<
    Submission,
    'id' | 'status' | 'points_earned' | 'created_at' | 'ai_result'
  >[];

  const firstName = profile.display_name?.split(' ')[0] ?? 'คุณ';

  return (
    <div className="min-h-dvh pb-28">
      {/* NAV — the geometric alphabet, then a hard rule. */}
      <header className="rule flex items-center justify-between bg-white px-5 py-3">
        <div className="flex items-center gap-2.5">
          <Logo size="sm" />
          <span className="text-lg font-black uppercase tracking-tighter">
            EcoPoints
          </span>
        </div>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="border-2 border-bau-ink bg-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest shadow-hard-sm transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
          >
            ออก
          </button>
        </form>
      </header>

      {/* THE BALANCE — colour-blocked band, oversized numeral. This is the one
          number the whole app exists to show, so it gets poster treatment. */}
      <section className="rule relative overflow-hidden bg-bau-green px-5 py-10 text-white">
        <ShapeField variant="green" />

        <div className="relative mx-auto max-w-md">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/70">
            สวัสดี {firstName}
          </p>

          <p className="mt-4 text-xs font-bold uppercase tracking-[0.2em] text-white/70">
            แต้มสะสม
          </p>
          <p className="font-black leading-[0.82] tracking-tighter text-[5.5rem] sm:text-8xl">
            {formatPoints(profile.points_balance)}
          </p>

          <div className="mt-5 flex items-center gap-3">
            <span className="h-4 w-4 rounded-full border-2 border-white" />
            <span className="h-4 w-4 rounded-none border-2 border-white" />
            <span className="h-px flex-1 bg-white/40" />
            <span className="text-xs font-bold uppercase tracking-widest">
              POINTS
            </span>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-md px-5 py-8">
        {/* PRIMARY ACTION — the biggest, heaviest object on the page. */}
        <Link
          href="/submit"
          className="btn-yellow w-full !min-h-[5.5rem] !text-xl"
        >
          <Camera className="h-8 w-8" strokeWidth={2.5} aria-hidden />
          ถ่ายรูปขยะ
        </Link>

        <p className="mt-3 text-center text-sm font-medium leading-relaxed text-bau-ink/55">
          แยกขยะให้เรียบร้อย วางบนพื้นโล่งๆ แล้วถ่ายให้เห็นชัดๆ
        </p>

        <Link href="/rewards" className="btn-blue mt-4 w-full">
          <Gift className="h-5 w-5" strokeWidth={2.5} aria-hidden />
          ดูของรางวัล
        </Link>

        {/* RECENT */}
        <section className="mt-10">
          <div className="mb-4 flex items-end justify-between border-b-2 border-bau-ink pb-2">
            <h2 className="text-2xl font-black tracking-tight">ส่งล่าสุด</h2>
            {recent.length > 0 && (
              <Link
                href="/history"
                className="text-xs font-bold uppercase tracking-widest text-bau-blue underline decoration-2 underline-offset-4"
              >
                ทั้งหมด
              </Link>
            )}
          </div>

          {recent.length === 0 ? (
            <div className="card text-center">
              <CardMark index={0} />
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border-4 border-bau-ink bg-bau-yellow">
                <Camera className="h-8 w-8" strokeWidth={2.5} aria-hidden />
              </div>
              <p className="text-xl font-black">ยังไม่มีรายการ</p>
              <p className="mt-2 font-medium text-bau-ink/55">
                ส่งรูปแรกของคุณ แล้วเริ่มเก็บแต้มกันเลย
              </p>
            </div>
          ) : (
            <ul className="space-y-4">
              {recent.map((s, i) => (
                <li
                  key={s.id}
                  className="card flex items-center gap-4 !p-4 transition-transform duration-200 ease-out hover:-translate-y-1"
                >
                  <CardMark index={i} />

                  <div className="min-w-0 flex-1 pr-6">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={s.status} />
                      <span className="text-[11px] font-bold uppercase tracking-wider text-bau-ink/40">
                        {timeAgoTh(s.created_at)}
                      </span>
                    </div>
                    <p className="mt-2 truncate text-sm font-medium text-bau-ink/65">
                      {(s.ai_result?.notes as string) ?? 'ส่งรูปขยะรีไซเคิล'}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    {s.points_earned > 0 ? (
                      <span className="text-3xl font-black leading-none tracking-tighter text-bau-green">
                        +{formatPoints(s.points_earned)}
                      </span>
                    ) : (
                      <span className="text-3xl font-black leading-none text-bau-ink/15">
                        0
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      <BottomNav />
    </div>
  );
}
