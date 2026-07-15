# ♻️ EcoPoints

เว็บแอปเก็บแต้มจากการแยกขยะ — ผู้ใช้ถ่ายรูปขยะรีไซเคิลที่แยกแล้ว AI ตรวจสอบรูป แล้วให้แต้มไปแลกของรางวัล

**Stack:** Next.js 14 (App Router) · TypeScript · Tailwind CSS · Supabase (DB/Auth/Storage) · Google Gemini · Vercel

---

## หลักความปลอดภัย (อ่านก่อนแก้โค้ด)

ระบบนี้เกี่ยวกับ "แต้ม" ซึ่งแลกเป็นของจริงได้ คนโกงจึงมีแรงจูงใจ กฎ 4 ข้อนี้ห้ามละเมิด:

1. **`GEMINI_API_KEY` และ `SUPABASE_SERVICE_ROLE_KEY` อยู่ฝั่งเซิร์ฟเวอร์เท่านั้น** ห้ามใส่ prefix `NEXT_PUBLIC_` เด็ดขาด ไฟล์ที่แตะคีย์เหล่านี้ (`lib/supabase/server.ts`, `lib/gemini.ts`) มี `import 'server-only'` อยู่บนสุด — ถ้ามีใครเผลอ import เข้า client component **build จะพังทันที** ไม่หลุดเงียบๆ

2. **แต้มคำนวณฝั่งเซิร์ฟเวอร์ 100%** ฝั่ง client ส่งมาแค่ไฟล์รูป (`body.append('image', file)`) ไม่มีตัวเลขแต้ม ไม่มีชนิดขยะ ไม่มีจำนวน เซิร์ฟเวอร์ไปอ่านราคาจากตาราง `waste_types` เอง

3. **RLS เปิดทุกตาราง** ผู้ใช้อ่านได้แค่แถวตัวเอง — ไม่มีข้อยกเว้น ไม่มี role ไหนอ่านข้ามคนได้ และ `points_balance` แก้ได้ผ่าน service role หรือฟังก์ชัน `SECURITY DEFINER` เท่านั้น มี trigger `protect_profile_columns` กันซ้ำอีกชั้น

4. **เรียก AI ผ่าน Route Handler เท่านั้น** (`app/api/submit`) ไม่เรียกจากเบราว์เซอร์

---

## ติดตั้ง (ทีละขั้น)

### 1. สร้างโปรเจกต์ Supabase

ไปที่ [supabase.com/dashboard](https://supabase.com/dashboard) → **New project** → ตั้งชื่อ + รหัสผ่านฐานข้อมูล → เลือก region ใกล้ไทย (Singapore) → รอสร้างเสร็จประมาณ 2 นาที

### 2. รัน schema

เปิด **SQL Editor → New query** → ก๊อป [`schema.sql`](schema.sql) **ทั้งไฟล์** → paste → กด **Run**

ควรขึ้น `Success` — ไฟล์นี้รันซ้ำได้ ไม่พังถ้าเผลอรันสองรอบ

ขั้นตอนนี้จะสร้างให้ทั้งหมด:
- ตาราง `profiles` · `waste_types` · `submissions` · `rewards` · `redemptions`
- RLS policy ทุกตาราง + index
- ฟังก์ชัน `redeem_reward()` · `add_points()` · `admin_review_submission()`
- trigger สร้างแถว `profiles` อัตโนมัติตอนมีคนสมัคร
- ข้อมูลตั้งต้น: ค่าแต้มขยะ 4 ชนิด + ของรางวัล 3 ชิ้น
- **storage bucket `submissions` แบบ private** (ไม่ต้องไปกดสร้างเองในหน้า Storage)

### 3. ตั้งค่า Auth

**Authentication → URL Configuration**
- Site URL: `http://localhost:3000` (ตอน deploy เปลี่ยนเป็น URL จริง)
- Redirect URLs: เพิ่ม `http://localhost:3000/auth/callback` และ `https://<โดเมนของคุณ>/auth/callback`

**Authentication → Sign In / Providers → Email**
- เปิด Email provider ไว้
- ตอน dev แนะนำให้ **ปิด "Confirm email"** จะได้สมัครแล้วเข้าใช้ได้เลย ไม่ต้องรอเมล
  (โค้ดรองรับทั้งสองแบบ: ถ้าเปิดไว้จะขึ้นหน้า "เช็คอีเมล" ให้เอง)

> **ไม่มี Google login:** แอปนี้ใช้อีเมล+รหัสผ่าน (และ magic link) อย่างเดียว
> ถ้าวันหลังอยากเพิ่ม Google ให้เปิด provider ใน Supabase แล้วเรียก `supabase.auth.signInWithOAuth({ provider: 'google' })` — [/auth/callback](app/auth/callback/route.ts) รองรับ OAuth code flow อยู่แล้ว ไม่ต้องแก้

> ⚠️ **เรื่องอีเมล:** SMTP ที่ Supabase แถมมาให้เป็นของสำหรับเทสต์เท่านั้น จำกัดไม่กี่ฉบับต่อชั่วโมงและมักส่งไม่ถึงจริง
> ถ้าจะใช้ magic link หรือ "ลืมรหัสผ่าน" ต้องต่อ SMTP ของตัวเองที่ **Project Settings → Authentication → SMTP Settings**
> (เช่น [Resend](https://resend.com) ฟรี 3,000 ฉบับ/เดือน — host `smtp.resend.com`, port `465`, user `resend`, password = API key)

### 4. ขอ Gemini API key

[aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) → **Create API key** → ก๊อปมา (ขึ้นต้น `AIza...`) ใช้ free tier ได้ ไม่ต้องผูกบัตร

> ⚠️ **อย่าใช้ `gemini-2.0-flash` หรือ `gemini-2.5-flash`** — API key ที่สร้างใหม่จะได้โควตา free tier = 0 กับโมเดลรุ่นนั้น ยิงไปเจอ 429 ทุกครั้ง
> ค่า default ในโค้ดคือ `gemini-3.1-flash-lite` (ตอบใน ~1.5 วินาที) เปลี่ยนได้ผ่าน env `GEMINI_MODEL`

### 5. ตั้งค่า environment variables

```bash
cp .env.example .env.local
```

แล้วเติมค่าจริง (ดูรายละเอียดแต่ละตัวใน [`.env.example`](.env.example)):

| ตัวแปร | หาได้จาก | ฝั่ง |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL | public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → `anon public` | public |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` ตอน dev | public |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → `service_role` | 🔒 **server-only** |
| `GEMINI_API_KEY` | Google AI Studio | 🔒 **server-only** |

> **สองตัวล่างคือความลับจริงๆ** service role key ข้าม RLS ได้ทั้งหมด ใครได้ไปคือแก้แต้มใครก็ได้
> ห้าม commit ห้าม paste ลงแชท ถ้าหลุดให้กด **Reset** ใน Supabase ทันที
> (`.env.local` ถูกใส่ใน `.gitignore` ไว้แล้ว)

**ระวังตอนก๊อป:** `NEXT_PUBLIC_SUPABASE_URL` ต้องเป็น origin ล้วนๆ (`https://xxx.supabase.co`) ห้ามมี `/rest/v1/` ต่อท้าย และคีย์ JWT ต้องไม่มีจุด `.` เกินท้าย ไม่งั้นจะเจอ 401/404 แบบงงๆ

### 6. รัน

```bash
npm install
npm run dev
```

เปิด http://localhost:3000 → สมัครสมาชิก → ถ่ายรูปขยะรีไซเคิลจริงส่งดู

### 7. Deploy ขึ้น Vercel

1. push โค้ดขึ้น GitHub
2. [vercel.com](https://vercel.com) → **Add New → Project** → เลือก repo
3. **Settings → Environment Variables** → ใส่ทั้ง 5 ตัวจากข้อ 5 (เปลี่ยน `NEXT_PUBLIC_SITE_URL` เป็นโดเมนจริง)
   ⚠️ อย่าลืม `SUPABASE_SERVICE_ROLE_KEY` กับ `GEMINI_API_KEY` — ไม่มีสองตัวนี้ `/api/submit` จะพังทันที
4. Deploy
5. กลับไป Supabase → **Authentication → URL Configuration** → เพิ่มโดเมน Vercel เข้า **Redirect URLs** และแก้ **Site URL**

---

## โครงสร้างโปรเจกต์

```
app/
  api/submit/route.ts     ← หัวใจของระบบ: ตรวจสอบ → เรียก AI → คิดแต้ม → ให้แต้ม
  page.tsx                ← หน้าแรก: แต้มสะสม + ปุ่มกล้อง + รายการล่าสุด
  submit/                 ← หน้าถ่ายรูป (บังคับกล้องหลัง)
  rewards/                ← แลกของรางวัล (เรียก redeem_reward)
  history/                ← ประวัติแบบแบ่งหน้า + รูปย่อ
  login/ register/ forgot-password/ reset-password/
  auth/callback/          ← แลก OAuth code เป็น session
  auth/signout/           ← ออกจากระบบ (ล้าง session)

lib/
  supabase/client.ts      ← client ฝั่ง browser (anon key)
  supabase/server.ts      ← client ฝั่ง server + service role + signed URL
  supabase/middleware.ts  ← refresh session + กันคนไม่ล็อกอิน
  gemini.ts               ← เรียก vision + parser ที่ทนคำตอบพัง
  guards.ts               ← rate limit + เช็ครูปซ้ำ (SHA-256) + เช็ครูปคล้าย (dHash)
  phash.ts                ← คำนวณ dHash (perceptual hash) กันถ่ายขยะชิ้นเดิมซ้ำ
  types.ts  copy.ts  authErrors.ts

schema.sql                ← รันใน Supabase SQL Editor
```

---

## ลำดับการทำงานของ `POST /api/submit`

ออกแบบให้ **ด่านฟรีมาก่อนด่านที่เสียเงิน** เสมอ เพื่อประหยัดโควตา Gemini:

| # | ขั้นตอน | ถ้าไม่ผ่าน | เสียโควตาไหม |
|---|---|---|---|
| 1 | ตรวจ session | 401 | ไม่ |
| 2 | เช็คว่าถูกแบนไหม | 403 | ไม่ |
| 3 | Rate limit — วันละ 5 ครั้ง, เว้น 30 วินาที | 429 | ไม่ |
| 4a | Hash รูป (SHA-256) เช็ค**ไฟล์**เดิมซ้ำ **ข้ามทุก user** | 409 | ไม่ |
| 4b | dHash เช็ค**ภาพ**คล้าย (ถ่ายขวดใบเดิมซ้ำ) ระยะ ≤ 6/64 bits **ข้ามทุก user** | 409 | ไม่ |
| 5 | **เรียก Gemini** | 503 (ไม่บันทึกอะไรเลย) | ✅ ใช่ |
| 6 | Parse JSON แบบระวังตัว (ตัด markdown fence, try/catch) | 503 | — |
| 7 | ตัดสินสถานะ | — | — |
| 8 | คิดแต้มจาก `waste_types` ใน DB | — | — |
| 9 | อัปโหลดรูปเข้า private bucket | — | — |
| 10 | บันทึก + เพิ่มแต้มด้วย service role | — | — |

**AI ตัดสินจบในตัว ไม่มี admin ไม่มีคิวรอคนตรวจ:**

| เงื่อนไข | ผลลัพธ์ |
|---|---|
| `is_screen_photo = true` (ถ่ายจากหน้าจอ) | **rejected** 0 แต้ม |
| `is_recyclable_photo = false` หรือไม่เจอขยะเลย | **rejected** 0 แต้ม |
| item ไหน `confidence < 0.6` | **ไม่นับ item นั้น** — ไม่จ่ายเงินให้การเดา |
| ไม่มี item ไหนผ่านเกณฑ์ความมั่นใจเลย | **rejected** พร้อมบอกให้ถ่ายใหม่ให้ชัดขึ้น |
| แต้มรวมเกิน 100 ในครั้งเดียว | **จ่าย 100** (เพดานกันโกง) |
| นอกนั้น | **approved** ให้แต้มทันที |

**ถ้า Gemini ล่มหรือตอบ JSON พัง → ตอบ 503 และไม่บันทึกอะไรลงฐานข้อมูลเลย** ไม่กินสิทธิ์วันละ 5 ครั้ง ไม่ติด cooldown 10 นาที ผู้ใช้ส่งรูปเดิมซ้ำได้ทันที — ระบบเราพัง ผู้ใช้ไม่ควรเป็นคนรับกรรม

---

## ค่าแต้มและกติกา

| ขยะ | แต้ม/ชิ้น |
|---|---|
| ขวดพลาสติก | 10 |
| กระป๋อง | 15 |
| ขวดแก้ว | 8 |
| กล่องกระดาษ | 5 |

แก้ค่าได้ที่ตาราง `waste_types` โดยไม่ต้องแก้โค้ดหรือ deploy ใหม่

- ส่งได้วันละ **5 ครั้ง** (นับตามวันของไทย ไม่ใช่ UTC) — นี่คือตัวจำกัดความเสียหายตัวจริง
- เว้นระยะระหว่างครั้ง **30 วินาที** — สั้นๆ พอกันสคริปต์ยิงรัว (นานกว่าเวลาที่ Gemini ใช้ตอบด้วยซ้ำ) แต่ไม่ขวางคนที่แยกขยะจริงแล้วอยากถ่ายทีละชนิดต่อเนื่องกัน
- รูปเดิมส่งซ้ำไม่ได้ แม้จะเป็นคนละบัญชี

## เศรษฐศาสตร์ของของรางวัล (ด่านกันโกงที่แท้จริง)

การตรวจรูปซ้ำช่วยยกระดับความยาก แต่ไม่ใช่กำแพงตายตัว:

- **SHA-256** จับ *ไฟล์เดิมเป๊ะๆ* (อัปโหลดไฟล์เดิมซ้ำ)
- **dHash** จับ *ฉากเดิม* — ถ่ายขวดใบเดิมบนโต๊ะเดิมอีกรูป ค่า hash จะห่างจากรูปแรกแค่ไม่กี่ bit (เกณฑ์ ≤ 6/64) เพราะ dHash จำ "โครงสร้างความสว่าง" ของภาพ ไม่ใช่ byte ดิบ จึงทนต่อการ re-encode / ย่อ / crop / screenshot
- **แต่ dHash ก็หลบได้** ถ้าตั้งใจเปลี่ยนมุม เปลี่ยนพื้นหลัง หรือย้ายขยะไปวางที่อื่นแล้วถ่ายใหม่ ค่า hash จะห่างจนหลุดเกณฑ์ — และเรา**จงใจตั้งเกณฑ์ให้แคบ (6 bit)** เพราะการเผลอปฏิเสธคนที่แยกขยะจริง (ถ่ายขวด แล้วถ่ายกระป๋องบนโต๊ะเดิม พื้นหลังคล้ายกัน) เป็นความผิดพลาดที่แย่กว่าการปล่อยรูปซ้ำหลุดไปบ้าง

สรุป: ด่านตรวจรูปทำให้การโกงแบบขี้เกียจ (ถ่ายซ้ำจากที่เดิม) โดนจับ แต่คนที่ตั้งใจโกงยังหลบได้อยู่ เพดานความเสียหายจึงยังจำกัดที่ราว **50 แต้ม/วัน** (5 ครั้ง × ~10 แต้ม) เราจึง**ตั้งราคาของรางวัลให้การโกงไม่คุ้ม** เป็นด่านสุดท้ายแทนที่จะไล่จับ:

| ของรางวัล | แต้ม | ถ้าโกงล้วนๆ ต้องใช้ | คิดเป็น |
|---|---|---|---|
| ส่วนลดเครื่องดื่ม 10 บาท | 500 | 10 วัน | ~1 บาท/วัน |
| ถุงผ้า | 1,500 | 30 วัน | — |
| บัตรเติมเงิน 20 บาท | 3,000 | 60 วัน | ~0.3 บาท/วัน |

ไม่มีใครนั่งถ่ายรูปปลอม 2 เดือนเพื่อเงิน 20 บาท ส่วนคนที่แยกขยะจริง (ถ่ายทีละหลายชิ้น) เก็บถึงเป้าได้ในไม่กี่วัน

**ถ้าจะเพิ่มมูลค่าของรางวัลให้สูงขึ้นมากๆ ต้องทำ challenge code ก่อน** (สุ่มเลข 4 หลักให้เขียนใส่กระดาษวางข้างขยะ แล้วให้ AI อ่าน) — เป็นทางเดียวที่บังคับให้ต้องถ่ายใหม่จริงทุกครั้ง แลกกับ UX ที่ยุ่งขึ้นมาก

---

## การแลกของรางวัล — โค้ดไม่ตัดตัวเอง ⚠️

`redeem_reward()` หักแต้ม ตัด stock และออกโค้ด (`ECO-XXXXXXXX`) ให้ผู้ใช้ ทั้งหมดนี้เป็น atomic กดรัวแค่ไหนก็หักแต้มครั้งเดียว

**แต่ระบบไม่รู้ว่าโค้ดถูกใช้ไปหรือยัง** — คอลัมน์ `redemptions.status` มีค่า `active` / `used` อยู่ แต่ไม่มีหน้าจอไหนในแอปที่เปลี่ยนมันเป็น `used` เลย (จงใจไม่ทำใน MVP)

**แปลว่าโค้ดใบเดียวเอาไปใช้ซ้ำได้ไม่จำกัดครั้ง ถ้าไม่มีคนคุมหน้าร้าน**

ขั้นตอนหน้าร้านตอนนี้จึงต้องทำมือ:

1. ลูกค้าโชว์โค้ดบนมือถือ
2. พนักงาน**จดโค้ดลงสมุด** แล้วเช็คว่าโค้ดนี้เคยถูกจดไปแล้วหรือยัง
3. (ถ้าอยากให้ระบบรู้ด้วย) เข้า Supabase → Table Editor → `redemptions` → หาแถวนั้น → เปลี่ยน `status` เป็น `used` ด้วยมือ

**ก่อนจะขยายเป็นหลายร้าน หรือของรางวัลมีมูลค่าสูงขึ้น ควรทำหน้า `/redeem/[code]`** ให้พนักงานเปิดเช็คโค้ดและกดปุ่ม "ใช้แล้ว" (พร้อม QR ให้สแกน) — ตารางและคอลัมน์รองรับไว้หมดแล้ว เหลือแค่ UI กับฟังก์ชัน `mark_redemption_used()`

## สิ่งที่ยังไม่ได้ทำ (จงใจตัดออกจาก MVP)

เพิ่มเมื่อเจอคนโกงจริงเท่านั้น อย่าเพิ่งทำตอนนี้:

- ตรวจ EXIF / GPS
- challenge code (ให้เขียนเลขสุ่มใส่กระดาษวางข้างขยะ) — ทางเดียวที่หยุด "ถ่ายขยะชิ้นเดิมซ้ำ" ได้จริง
- หน้าตัดโค้ดสำหรับพนักงาน (`/redeem/[code]`) — ดูหัวข้อด้านบน
- ผู้ดูแลระบบ / คิวให้คนตรวจรูป — AI ตัดสินจบในตัว
- สุ่มตรวจ 5% ของรายการที่ approved
#   E c o P o i n t  
 