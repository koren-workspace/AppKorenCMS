# Firebase Project Migration Checklist

This file documents how to move this CMS between Firebase projects safely.

## 1) Update project identifiers

- Update FireCMS project ID in `src/App.tsx`:
  - `projectId={"<new-project-id>"}`
- Update deploy target in `package.json`:
  - `"deploy": "run-s build && firecms deploy --project=<new-project-id>"`

## 2) Update Firebase configuration (if used)

- Check `src/config/firebase.ts` and replace all values with the new project config:
  - `apiKey`
  - `authDomain`
  - `projectId`
  - `storageBucket`
  - `messagingSenderId`
  - `appId`
  - `measurementId`

Note: If this file is not used by runtime code, keep it aligned anyway to avoid confusion.

## 3) Update environment variables and secrets

- Review `.env.local` and replace project-specific values.
- Verify any external API tokens (for example `VITE_BAGEL_TOKEN`) are correct for the new environment.
- If CI/CD exists, update secrets in pipeline settings too.

## 4) Verify Firebase backend setup

- Firestore collections/paths expected by the app exist:
  - `toc`
  - `translations/{translationId}/prayers/{prayerId}/items`
  - `db-update-time`
- Security rules allow required read/write operations for CMS users.
- Required indexes exist for current queries:
  - `array-contains-any`
  - filters used by `partId` and related fields

## 5) FireCMS account/project checks

- Run `firecms login` with the correct account.
- Confirm the target project exists and is accessible in FireCMS.
- Deploy with `npm run deploy`.

## 6) Post-migration verification

- Run locally: `npm run dev`
- Build check: `npm run build`
- In CMS UI, verify end-to-end flow:
  - TOC loads
  - Navigation works: TOC -> Translation -> Category -> Prayer -> Part
  - Item edits save successfully
  - Publish flow updates the expected backend
- Open browser console and confirm no Firestore connectivity errors.

## Quick rollback

If migration fails and a quick rollback is needed:

1. Revert `src/App.tsx` projectId.
2. Revert `package.json` deploy project.
3. Restore previous `.env.local`.
4. Re-run `npm run dev` and `npm run build`.

