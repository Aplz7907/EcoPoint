import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Ticket } from 'lucide-react';
import { createClient, getProfile } from '@/lib/supabase/server';
import { BottomNav } from '@/components/BottomNav';
import { ShapeField } from '@/components/Geometry';
import { formatPoints, timeAgoTh } from '@/lib/copy';
import type { Redemption, Reward } from '@/lib/types';
import { RewardsList } from './RewardsList';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'ของรางวัล — EcoPoints',
};

type RedemptionWithReward = Redemption & { rewards: { name: string } | null };

export default async function RewardsPage() {
  const profile = await getProfile();
  if (!profile) redirect('/login');

  const supabase = createClient();

  const [{ data: rewards }, { data: redemptions }] = await Promise.all([
    supabase
      .from('rewards')
      .select('id, name, description, points_cost, stock, is_active')
      .eq('is_active', true)
      .order('points_cost', { ascending: true }),
    supabase
      .from('redemptions')
      .select(
        'id, code, points_spent, status, created_at, reward_id, user_id, rewards(name)'
      )
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  const myRedemptions = (redemptions ?? []) as unknown as RedemptionWithReward[];

  return (
    <div className="min-h-dvh pb-28">
      <header className="rule relative overflow-hidden bg-bau-blue px-5 py-8 text-white">
        <ShapeField variant="blue" />

        <div className="relative mx-auto flex max-w-md items-end justify-between gap-4">
          <h1 className="text-4xl font-black uppercase leading-[0.9] tracking-tighter">
            ของ
            <br />
            รางวัล
          </h1>
          <div className="shrink-0 border-2 border-bau-ink bg-white px-4 py-2 text-right text-bau-ink shadow-hard">
            <p className="text-[10px] font-bold uppercase tracking-widest text-bau-ink/50">
              แต้มของคุณ
            </p>
            <p className="text-3xl font-black leading-none tracking-tighter">
              {formatPoints(profile.points_balance)}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md px-5 py-8">
        <RewardsList
          rewards={(rewards ?? []) as Reward[]}
          balance={profile.points_balance}
        />

        <section className="mt-12">
          <h2 className="mb-4 border-b-2 border-bau-ink pb-2 text-2xl font-black tracking-tight">
            โค้ดของคุณ
          </h2>

          {myRedemptions.length === 0 ? (
            <div className="card text-center">
              <span aria-hidden className="card-mark rounded-full bg-bau-yellow" />
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-none border-4 border-bau-ink bg-bau-yellow">
                <Ticket className="h-8 w-8" strokeWidth={2.5} aria-hidden />
              </div>
              <p className="text-xl font-black">ยังไม่เคยแลกของรางวัล</p>
              <p className="mt-2 font-medium text-bau-ink/55">
                เก็บแต้มให้ถึงเป้า แล้วมาแลกกันนะ
              </p>
              <Link href="/submit" className="btn-primary mt-5 w-full">
                ไปเก็บแต้ม
              </Link>
            </div>
          ) : (
            <ul className="space-y-4">
              {myRedemptions.map((r) => (
                <li key={r.id} className="card !p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-black">
                        {r.rewards?.name ?? 'ของรางวัล'}
                      </p>
                      <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-bau-ink/40">
                        {timeAgoTh(r.created_at)} · ใช้ไป{' '}
                        {formatPoints(r.points_spent)} แต้ม
                      </p>
                    </div>
                    <span
                      className={`badge shrink-0 ${
                        r.status === 'active'
                          ? 'bg-bau-green text-white'
                          : 'bg-bau-muted text-bau-ink/50'
                      }`}
                    >
                      {r.status === 'active' ? 'ใช้ได้' : 'ใช้แล้ว'}
                    </span>
                  </div>

                  {/* The code is the product. Treat it like a stamped ticket. */}
                  <p className="mt-4 select-all border-2 border-bau-ink bg-bau-yellow py-3 text-center font-mono text-xl font-black tracking-[0.2em]">
                    {r.code}
                  </p>
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
