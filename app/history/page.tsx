import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Camera, ImageOff } from 'lucide-react';
import {
  createClient,
  getProfile,
  getSignedImageUrls,
} from '@/lib/supabase/server';
import { BottomNav } from '@/components/BottomNav';
import { StatusBadge } from '@/components/StatusBadge';
import { CardMark, ShapeField } from '@/components/Geometry';
import { WASTE_LABELS, formatPoints, timeAgoTh } from '@/lib/copy';
import type { DetectedItem, Submission } from '@/lib/types';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'ประวัติการส่ง — EcoPoints',
};

const PAGE_SIZE = 10;

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const profile = await getProfile();
  if (!profile) redirect('/login');

  const page = Math.max(1, Number(searchParams.page) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = createClient();

  const { data, count } = await supabase
    .from('submissions')
    .select(
      'id, image_url, status, points_earned, reject_reason, ai_result, created_at',
      { count: 'exact' }
    )
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false })
    .range(from, to);

  const submissions = (data ?? []) as Pick<
    Submission,
    | 'id'
    | 'image_url'
    | 'status'
    | 'points_earned'
    | 'reject_reason'
    | 'ai_result'
    | 'created_at'
  >[];

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Private bucket → the images are only viewable through a signed URL minted
  // here, on the server, for paths we already know belong to this user.
  const signedUrls = await getSignedImageUrls(
    submissions.map((s) => s.image_url).filter((p): p is string => Boolean(p))
  );

  return (
    <div className="min-h-dvh pb-28">
      <header className="rule relative overflow-hidden bg-bau-yellow px-5 py-8 text-bau-ink">
        <ShapeField variant="yellow" />

        <div className="relative mx-auto flex max-w-md items-end justify-between gap-4">
          <h1 className="text-4xl font-black uppercase leading-[0.9] tracking-tighter">
            ประวัติ
            <br />
            การส่ง
          </h1>
          <div className="shrink-0 border-2 border-bau-ink bg-white px-4 py-2 text-right shadow-hard">
            <p className="text-[10px] font-bold uppercase tracking-widest text-bau-ink/50">
              ทั้งหมด
            </p>
            <p className="text-3xl font-black leading-none tracking-tighter">
              {total}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md px-5 py-8">
        {submissions.length === 0 ? (
          <div className="card text-center">
            <CardMark index={0} />
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border-4 border-bau-ink bg-bau-yellow">
              <Camera className="h-8 w-8" strokeWidth={2.5} aria-hidden />
            </div>
            <p className="text-xl font-black">ยังไม่มีประวัติการส่ง</p>
            <p className="mt-2 font-medium text-bau-ink/55">
              ส่งรูปแรกของคุณ แล้วเริ่มเก็บแต้มกันเลย
            </p>
            <Link href="/submit" className="btn-primary mt-5 w-full">
              ถ่ายรูปขยะ
            </Link>
          </div>
        ) : (
          <ul className="space-y-5">
            {submissions.map((s, i) => {
              const url = s.image_url ? signedUrls.get(s.image_url) : undefined;
              const items = (s.ai_result?.items ?? []) as DetectedItem[];
              const notes = s.ai_result?.notes as string | undefined;

              return (
                <li key={s.id} className="card !p-4">
                  <CardMark index={i} />

                  <div className="flex gap-4 pr-6">
                    {url ? (
                      /* Grayscale by default, colour on hover — the Bauhaus
                         image treatment, and it keeps the palette clean when a
                         dozen photos share one screen. */
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={url}
                        alt="รูปขยะที่ส่ง"
                        loading="lazy"
                        className="h-24 w-24 shrink-0 border-2 border-bau-ink object-cover grayscale transition duration-300 ease-out hover:grayscale-0"
                      />
                    ) : (
                      <div className="flex h-24 w-24 shrink-0 items-center justify-center border-2 border-bau-ink bg-bau-muted">
                        <ImageOff
                          className="h-8 w-8 text-bau-ink/40"
                          strokeWidth={2.5}
                          aria-hidden
                        />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <StatusBadge status={s.status} />
                        {s.points_earned > 0 ? (
                          <span className="text-2xl font-black leading-none tracking-tighter text-bau-green">
                            +{formatPoints(s.points_earned)}
                          </span>
                        ) : (
                          <span className="text-2xl font-black leading-none text-bau-ink/15">
                            0
                          </span>
                        )}
                      </div>

                      <p className="mt-2 text-[11px] font-bold uppercase tracking-wider text-bau-ink/40">
                        {timeAgoTh(s.created_at)}
                      </p>

                      {items.length > 0 ? (
                        <p className="mt-1.5 text-sm font-medium leading-relaxed text-bau-ink/65">
                          {items
                            .map(
                              (item) =>
                                `${WASTE_LABELS[item.type]?.emoji ?? '♻️'} ${
                                  WASTE_LABELS[item.type]?.th ?? item.type
                                } ×${item.count}`
                            )
                            .join('  ')}
                        </p>
                      ) : (
                        notes && (
                          <p className="mt-1.5 line-clamp-2 text-sm font-medium leading-relaxed text-bau-ink/55">
                            {notes}
                          </p>
                        )
                      )}
                    </div>
                  </div>

                  {s.status === 'rejected' && s.reject_reason && (
                    <p className="mt-4 border-2 border-bau-ink bg-bau-red px-3 py-2 text-xs font-bold leading-relaxed text-white">
                      {s.reject_reason}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {totalPages > 1 && (
          <nav className="mt-8 flex items-center justify-between gap-3">
            {page > 1 ? (
              <Link
                href={`/history?page=${page - 1}`}
                className="btn-outline flex-1 !min-h-[3.25rem] !text-sm"
              >
                ← ก่อนหน้า
              </Link>
            ) : (
              <span className="flex-1" />
            )}

            <span className="shrink-0 border-2 border-bau-ink bg-bau-ink px-3 py-2 text-sm font-black text-white">
              {page} / {totalPages}
            </span>

            {page < totalPages ? (
              <Link
                href={`/history?page=${page + 1}`}
                className="btn-outline flex-1 !min-h-[3.25rem] !text-sm"
              >
                ถัดไป →
              </Link>
            ) : (
              <span className="flex-1" />
            )}
          </nav>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
