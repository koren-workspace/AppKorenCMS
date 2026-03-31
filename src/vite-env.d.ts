/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;
  readonly VITE_FIREBASE_MEASUREMENT_ID: string;
  readonly VITE_GOOGLE_SHEETS_SPREADSHEET_ID: string;
  readonly VITE_GOOGLE_SHEETS_SHEET_NAME?: string;
  /** true = לוגי itemId מפורטים בקונסולה (itemUtils / חלק מ-partEditService) */
  readonly VITE_DEBUG_CMS_ITEM_IDS?: string;
}
