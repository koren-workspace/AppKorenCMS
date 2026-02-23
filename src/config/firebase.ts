// Firebase configuration for koren-stage
// export const firebaseConfig = {
//   apiKey: "AIzaSyBRg9Mh14mdRaz_Wik-Xg536GlhVq0vnco",
//   authDomain: "koren-stage.firebaseapp.com",
//   projectId: "koren-stage",
//   storageBucket: "koren-stage.appspot.com",
//   messagingSenderId: "718786783715",
//   appId: "1:718786783715:web:b2287bf4ba274645a018d6",
//   measurementId: "G-PSHCVTZ2VR"
// };
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

