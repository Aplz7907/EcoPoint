'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Camera, Check, X } from 'lucide-react';
import { Spinner } from '@/components/AuthUI';
import { CardMark, ShapeField } from '@/components/Geometry';
import { WASTE_LABELS, formatPoints } from '@/lib/copy';
import type { SubmitResponse } from '@/lib/types';

type Phase = 'pick' | 'preview' | 'uploading' | 'result';

/** Reassuring, rotating copy — the Gemini call takes a few seconds. */
const WAITING_MESSAGES = [
  'กำลังส่งรูปให้ AI ดู',
  'AI กำลังนับขยะในรูปของคุณ',
  'กำลังคิดแต้มให้',
  'ใกล้เสร็จแล้ว รออีกนิด',
];

export function SubmitForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<Phase>('pick');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [waitingIndex, setWaitingIndex] = useState(0);

  // Revoke the object URL when the preview is replaced or the page unmounts,
  // otherwise every retake leaks a few MB of blob.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    if (phase !== 'uploading') return;

    const id = setInterval(
      () => setWaitingIndex((i) => (i + 1) % WAITING_MESSAGES.length),
      2200
    );
    return () => clearInterval(id);
  }, [phase]);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    if (!picked) return;

    if (previewUrl) URL.revokeObjectURL(previewUrl);

    setFile(picked);
    setPreviewUrl(URL.createObjectURL(picked));
    setError(null);
    setResult(null);
    setPhase('preview');
  }

  function retake() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);

    setFile(null);
    setPreviewUrl(null);
    setResult(null);
    setError(null);
    setWaitingIndex(0);
    setPhase('pick');

    // Clearing the input lets the user re-pick the *same* file if they want.
    if (inputRef.current) inputRef.current.value = '';
  }

  async function submit() {
    if (!file) return;

    setError(null);
    setPhase('uploading');

    // The body carries the image and NOTHING else. No point value, no waste
    // type, no count — the server decides all of that.
    const body = new FormData();
    body.append('image', file);

    let data: SubmitResponse;

    try {
      const res = await fetch('/api/submit', { method: 'POST', body });
      data = (await res.json()) as SubmitResponse;
    } catch {
      setPhase('preview');
      setError('เชื่อมต่อไม่สำเร็จ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่นะ');
      return;
    }

    if (!data.ok) {
      setPhase('preview');
      setError(data.message);
      return;
    }

    setResult(data);
    setPhase('result');

    // Pull the new balance into the server-rendered pages behind us.
    router.refresh();
  }

  // ---------------------------------------------------------------- result
  if (phase === 'result' && result) {
    const approved = result.status === 'approved';

    return (
      <div className="space-y-5">
        {/* The verdict is a colour block, not a toast. Green = paid, red = no. */}
        <section
          className={`relative overflow-hidden border-2 border-bau-ink p-6 text-center shadow-hard-lg sm:border-4 ${
            approved ? 'bg-bau-green text-white' : 'bg-bau-red text-white'
          }`}
        >
          <ShapeField variant={approved ? 'green' : 'blue'} />

          <div className="relative">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border-4 border-bau-ink bg-white">
              {approved ? (
                <Check className="h-9 w-9 text-bau-green" strokeWidth={4} aria-hidden />
              ) : (
                <X className="h-9 w-9 text-bau-red" strokeWidth={4} aria-hidden />
              )}
            </div>

            {approved && (
              <>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/70">
                  ได้รับ
                </p>
                <p className="text-7xl font-black leading-[0.85] tracking-tighter">
                  +{formatPoints(result.points_earned ?? 0)}
                </p>
                {result.points_balance !== undefined && (
                  <p className="mt-4 inline-block border-2 border-bau-ink bg-bau-yellow px-3 py-1 text-sm font-bold text-bau-ink">
                    แต้มรวม {formatPoints(result.points_balance)}
                  </p>
                )}
              </>
            )}

            <p
              className={`font-bold leading-relaxed ${
                approved ? 'mt-4 text-sm text-white/90' : 'text-lg'
              }`}
            >
              {result.message}
            </p>
          </div>
        </section>

        {result.items && result.items.length > 0 && (
          <div className="card">
            <CardMark index={1} />
            <h3 className="mb-4 border-b-2 border-bau-ink pb-2 text-xs font-bold uppercase tracking-widest">
              AI เห็นอะไรในรูป
            </h3>
            <ul className="space-y-3">
              {result.items.map((item, i) => (
                <li
                  key={`${item.type}-${i}`}
                  className="flex items-center gap-3 border-2 border-bau-ink bg-bau-canvas px-3 py-3"
                >
                  <span className="text-2xl" aria-hidden>
                    {WASTE_LABELS[item.type]?.emoji ?? '♻️'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">
                      {item.name_th} × {item.count}
                    </p>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-bau-ink/45">
                      มั่นใจ {Math.round(item.confidence * 100)}%
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-xl font-black tracking-tighter ${
                      item.points > 0 ? 'text-bau-green' : 'text-bau-ink/20'
                    }`}
                  >
                    {item.points > 0 ? `+${formatPoints(item.points)}` : '0'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-3">
          <button type="button" onClick={retake} className="btn-primary w-full">
            <Camera className="h-5 w-5" strokeWidth={2.5} aria-hidden />
            ส่งรูปอีกใบ
          </button>
          <Link href="/" className="btn-outline w-full">
            กลับหน้าแรก
          </Link>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------- uploading
  if (phase === 'uploading') {
    return (
      <div className="space-y-5">
        {previewUrl && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={previewUrl}
            alt="รูปที่กำลังส่ง"
            className="aspect-[4/3] w-full border-2 border-bau-ink object-cover grayscale sm:border-4"
          />
        )}

        <div className="relative overflow-hidden border-2 border-bau-ink bg-bau-blue p-8 text-center text-white shadow-hard-lg sm:border-4">
          <ShapeField variant="blue" />
          <div className="relative flex flex-col items-center gap-3">
            <Spinner />
            <p className="text-lg font-black">{WAITING_MESSAGES[waitingIndex]}</p>
            <p className="text-xs font-bold uppercase tracking-widest text-white/70">
              อย่าเพิ่งปิดหน้านี้
            </p>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------- pick / preview
  return (
    <div className="space-y-5">
      {/*
        capture="environment" asks the phone to open the rear camera directly
        instead of the photo library. It is a hint, not a guarantee — the real
        defence against gallery re-uploads is the duplicate hash and the
        is_screen_photo check on the server.
      */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onPick}
        className="sr-only"
        id="waste-photo"
      />

      {previewUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={previewUrl}
          alt="รูปขยะที่ถ่ายไว้"
          className="aspect-[4/3] w-full border-2 border-bau-ink object-cover shadow-hard-lg sm:border-4"
        />
      ) : (
        <label
          htmlFor="waste-photo"
          className="flex aspect-[4/3] w-full cursor-pointer flex-col items-center justify-center gap-4 border-2 border-dashed border-bau-ink bg-white text-center shadow-hard-md transition active:translate-x-[3px] active:translate-y-[3px] active:shadow-none sm:border-4"
        >
          <span className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-bau-ink bg-bau-yellow">
            <Camera className="h-10 w-10" strokeWidth={2.5} aria-hidden />
          </span>
          <span className="text-2xl font-black uppercase tracking-tight">
            แตะเพื่อถ่ายรูป
          </span>
          <span className="max-w-[16rem] text-sm font-medium leading-relaxed text-bau-ink/55">
            วางขยะที่แยกแล้วบนพื้นโล่งๆ ถ่ายให้เห็นทุกชิ้นชัดเจน
          </span>
        </label>
      )}

      {phase === 'preview' && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={submit}
            className="btn-primary w-full !min-h-[4.5rem] !text-xl"
          >
            <Check className="h-7 w-7" strokeWidth={3} aria-hidden />
            ส่งรูปนี้
          </button>
          <button type="button" onClick={retake} className="btn-outline w-full">
            ถ่ายใหม่
          </button>
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="border-2 border-bau-ink bg-bau-red px-4 py-4 text-center font-bold leading-relaxed text-white shadow-hard"
        >
          {error}
        </p>
      )}

      {/* Rules of the game, as a yellow "attention" plane. */}
      <div className="relative border-2 border-bau-ink bg-bau-yellow p-5 shadow-hard sm:border-4">
        <p className="mb-3 text-xs font-bold uppercase tracking-widest">
          เคล็ดลับให้ได้แต้มเต็ม
        </p>
        <ul className="space-y-2 text-sm font-medium leading-relaxed">
          {[
            'แยกขยะแต่ละชิ้นออกจากกัน อย่าวางซ้อนทับ',
            'ถ่ายในที่แสงสว่างพอ ไม่ย้อนแสง',
            'ถ่ายจากขยะจริงเท่านั้น ถ่ายจากหน้าจอจะไม่ผ่าน',
            'แยกถ่ายทีละชนิดได้ ส่งได้วันละ 5 ครั้ง',
          ].map((tip) => (
            <li key={tip} className="flex gap-2.5">
              <span
                aria-hidden
                className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-none bg-bau-ink"
              />
              {tip}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
