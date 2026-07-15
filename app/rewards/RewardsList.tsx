'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PartyPopper } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Spinner } from '@/components/AuthUI';
import { CardMark, ShapeField } from '@/components/Geometry';
import { formatPoints } from '@/lib/copy';
import type { Reward } from '@/lib/types';

/**
 * redeem_reward() raises bare error codes so the UI owns the wording. Anything
 * unmapped still gets a friendly Thai sentence — never a raw Postgres error.
 */
function redeemErrorTh(message: string): string {
  const m = message.toUpperCase();

  if (m.includes('INSUFFICIENT_POINTS')) {
    return 'แต้มไม่พอแลกของรางวัลชิ้นนี้ เก็บเพิ่มอีกนิดนะ';
  }
  if (m.includes('OUT_OF_STOCK')) {
    return 'ของรางวัลชิ้นนี้หมดแล้ว ลองดูชิ้นอื่นนะ';
  }
  if (m.includes('REWARD_NOT_FOUND')) {
    return 'ไม่พบของรางวัลชิ้นนี้แล้ว อาจถูกปิดไปนะ';
  }
  if (m.includes('USER_BANNED')) {
    return 'บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ';
  }
  if (m.includes('UNAUTHENTICATED')) {
    return 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่นะ';
  }

  return 'แลกของรางวัลไม่สำเร็จ ลองใหม่อีกครั้งนะ';
}

interface RedeemSuccess {
  code: string;
  reward_name: string;
  points_spent: number;
  points_balance: number;
}

export function RewardsList({
  rewards,
  balance,
}: {
  rewards: Reward[];
  balance: number;
}) {
  const router = useRouter();

  const [busyId, setBusyId] = useState<number | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [success, setSuccess] = useState<RedeemSuccess | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function redeem(reward: Reward) {
    setError(null);
    setConfirmId(null);
    setBusyId(reward.id);

    const supabase = createClient();

    // The client sends only the reward id. The database checks the balance,
    // checks the stock, deducts, decrements and issues the code in one atomic
    // transaction — a double-tap cannot spend the same points twice.
    const { data, error } = await supabase.rpc('redeem_reward', {
      reward_id: reward.id,
    });

    setBusyId(null);

    if (error) {
      setError(redeemErrorTh(error.message));
      return;
    }

    setSuccess(data as RedeemSuccess);
    router.refresh();
  }

  if (success) {
    return (
      <section className="relative overflow-hidden border-2 border-bau-ink bg-bau-green p-6 text-center text-white shadow-hard-lg sm:border-4">
        <ShapeField variant="green" />

        <div className="relative">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border-4 border-bau-ink bg-white">
            <PartyPopper
              className="h-9 w-9 text-bau-green"
              strokeWidth={2.5}
              aria-hidden
            />
          </div>

          <h2 className="text-3xl font-black uppercase tracking-tighter">
            แลกสำเร็จ
          </h2>
          <p className="mt-1 font-bold text-white/80">{success.reward_name}</p>

          <p className="mt-6 text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">
            แสดงโค้ดนี้ให้เจ้าหน้าที่
          </p>
          <p className="mt-2 select-all border-4 border-bau-ink bg-bau-yellow py-4 font-mono text-2xl font-black tracking-[0.2em] text-bau-ink shadow-hard">
            {success.code}
          </p>

          <p className="mt-4 text-sm font-bold text-white/80">
            ใช้ไป {formatPoints(success.points_spent)} · เหลือ{' '}
            {formatPoints(success.points_balance)} แต้ม
          </p>

          <button
            type="button"
            onClick={() => setSuccess(null)}
            className="btn-yellow mt-6 w-full"
          >
            เรียบร้อย
          </button>
        </div>
      </section>
    );
  }

  if (rewards.length === 0) {
    return (
      <div className="card text-center">
        <CardMark index={2} />
        <p className="text-xl font-black">ยังไม่มีของรางวัลตอนนี้</p>
        <p className="mt-2 font-medium text-bau-ink/55">
          แวะมาดูใหม่เร็วๆ นี้นะ
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {error && (
        <p
          role="alert"
          className="border-2 border-bau-ink bg-bau-red px-4 py-3 text-center font-bold text-white shadow-hard"
        >
          {error}
        </p>
      )}

      {rewards.map((reward, i) => {
        const affordable = balance >= reward.points_cost;
        const inStock = reward.stock > 0;
        const canRedeem = affordable && inStock;
        const shortBy = reward.points_cost - balance;
        const isConfirming = confirmId === reward.id;
        const progress = Math.min(100, (balance / reward.points_cost) * 100);

        return (
          <div
            key={reward.id}
            className="card !p-4 transition-transform duration-200 ease-out hover:-translate-y-1"
          >
            <CardMark index={i} />

            <div className="flex items-start gap-4 pr-6">
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-black leading-tight">
                  {reward.name}
                </h3>
                {reward.description && (
                  <p className="mt-1 text-sm font-medium leading-relaxed text-bau-ink/55">
                    {reward.description}
                  </p>
                )}
                <p className="mt-2 text-[11px] font-bold uppercase tracking-wider text-bau-ink/40">
                  {inStock ? `เหลือ ${reward.stock} ชิ้น` : 'ของหมดแล้ว'}
                </p>
              </div>

              <div className="shrink-0 text-right">
                <p className="text-3xl font-black leading-none tracking-tighter text-bau-blue">
                  {formatPoints(reward.points_cost)}
                </p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-bau-ink/40">
                  แต้ม
                </p>
              </div>
            </div>

            {/* Progress as a hard-edged bar: how much of this reward you own.
                Far more motivating than a disabled button with no context. */}
            {!affordable && inStock && (
              <div
                className="mt-4 h-3 w-full border-2 border-bau-ink bg-white"
                role="progressbar"
                aria-valuenow={Math.round(progress)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`ความคืบหน้าสู่ ${reward.name}`}
              >
                <div
                  className="h-full bg-bau-green"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}

            {isConfirming ? (
              <div className="mt-4 border-2 border-bau-ink bg-bau-yellow p-3">
                <p className="text-center text-sm font-bold">
                  ยืนยันใช้ {formatPoints(reward.points_cost)} แต้ม
                  แลกของชิ้นนี้?
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmId(null)}
                    className="btn-outline flex-1 !min-h-[3rem] !px-3 !text-sm !shadow-hard-sm"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="button"
                    onClick={() => redeem(reward)}
                    className="btn-primary flex-1 !min-h-[3rem] !px-3 !text-sm !shadow-hard-sm"
                  >
                    ยืนยัน
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                disabled={!canRedeem || busyId !== null}
                onClick={() => setConfirmId(reward.id)}
                className="btn-primary mt-4 w-full !min-h-[3.25rem] !text-base"
              >
                {busyId === reward.id ? (
                  <>
                    <Spinner /> กำลังแลก
                  </>
                ) : !inStock ? (
                  'ของหมดแล้ว'
                ) : !affordable ? (
                  `ขาดอีก ${formatPoints(shortBy)} แต้ม`
                ) : (
                  'แลกเลย'
                )}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
