# AICTE Voice — Privacy-Protected Visual Evidence

Real, local, privacy-first image evidence for AICTE Voice posts: drag-and-drop
upload → **real face detection + blurring** → **real sensitive-content screening**
→ review before publish → consent-gated display → authorized complaint review.

No paid AI API. All models run locally on the TensorFlow.js **WASM** backend
(no native build — works on Node 24 / Windows). The **original image is never
retained**: it is face-blurred in memory and only the protected rendition is stored.

## One-time setup (Windows)

```powershell
# 1. Install deps (already in package.json)
npm install

# 2. Download the local AI models (~7 MB, once; needs internet)
npm run evidence:fetch-models

# 3. Apply the DB migration (adds the Evidence table)
npx prisma migrate dev

# 4. (optional) verify the AI pipeline end-to-end, on a real photo if you like
npm run evidence:selftest
npm run evidence:selftest -- --image C:\path\to\photo.jpg

# 5. Run the app
npm run dev          # or: npm run build; npm run start
```

Run the tests any time:

```powershell
npm test
```

## AI models / libraries used

| Capability | Library | Model | Notes |
|---|---|---|---|
| Face detection | `@vladmandic/face-api` (WASM build) | `tiny_face_detector` (~190 KB) | Real detection; handles multiple/small faces. |
| Face blurring | `sharp` (libvips) | — | Pixelate + gaussian over padded boxes; irrecoverable. |
| Explicit screening | `nsfwjs` model via `@tensorflow/tfjs` | MobileNetV2 (~4 MB) | Real 5-class classifier (Drawing/Hentai/Neutral/Porn/Sexy). |
| Image decode/validate/re-encode | `sharp` | — | Authoritative format check; strips EXIF; safe re-encode to WEBP. |

**Honest limitation — graphic violence / injuries:** there is no suitable free,
locally-runnable, licensed model for this. We do **not** fake it. By default
(`EVIDENCE_GRAPHIC_POLICY=manual`) a non-explicit image is marked
**REVIEW_REQUIRED** and stays hidden until an officer reviews it. You may either:
set `EVIDENCE_GRAPHIC_POLICY=off` (operator explicitly accepts no graphic
screening — non-explicit images show normally), or configure a real external
moderation provider via `EVIDENCE_VIOLENCE_PROVIDER` (slot present; left
unimplemented until a key/endpoint is supplied).

## Environment variables

All optional — see `.env.example`. Key ones: `EVIDENCE_MAX_FILES` (5),
`EVIDENCE_MAX_MB` (10), `EVIDENCE_EXPLICIT_THRESHOLD` (0.6),
`EVIDENCE_GRAPHIC_POLICY` (`manual`|`off`), `EVIDENCE_DRAFT_TTL_HOURS` (24),
`EVIDENCE_DIR`, `EVIDENCE_MODELS_DIR`. No secrets required.

## Security model

- Private storage under `./storage/evidence` (git-ignored, **never** under `public/`).
- Images served only via `GET /api/evidence/:id`, authorized **per request**
  (not by hiding UI). Random filenames are not a capability → IDOR-safe.
- Sensitive images serve a blurred **placeholder** until an explicit `?reveal=1`
  consent; even revealed, the image is still face-blurred.
- `GET /api/evidence/:id/original` **always refuses** (410) — originals are not
  retained; there is no privileged path, not even for admins. Attempts are audited.
- Role checks server-side (`requireUser`/`requireRole`); staff view of sensitive or
  complaint-linked evidence is written to the `AuditLog`.
- Unprocessed or face-failed evidence cannot be published (server-side gate).
- Retention: `npm run evidence:cleanup` purges abandoned drafts + orphaned files.

## User journey

1. **Create post** (`/voice/new`): write concern + drag/drop images.
2. **Process**: each file is validated, face-blurred and screened server-side.
3. **Review privacy**: the protected result + status chips show inline; warnings
   appear if detection failed or screening needs review.
4. **Confirm**: publish — only processed, safe images attach (atomic, idempotent).
5. **Protected display** (`/voice`): blurred faces; sensitive images behind a
   "Potentially Disturbing Image" overlay (View / Keep Hidden), hidden by default.
6. **Complaint linkage** (`/complaints/:id`): officers/admins see linked-post
   evidence with statuses, can clear/keep-hidden (audited); originals shown as
   "not retained by policy".

## Tests (`npm test`, all pass)

`tests/evidence/`: `validate` (spoofed MIME, bad type, oversized, corrupt),
`pure` (authorization matrix, consent rendition, screening policy, publish gate),
`pipeline` (real face-blur + screening on generated images), `db` (complaint-link
preservation, cascade delete + cleanup, text-only posts, idempotent attach).
Model-dependent tests auto-skip if models aren't installed. No real/sensitive
imagery is used.
