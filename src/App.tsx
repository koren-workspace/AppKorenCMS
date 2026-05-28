import React from "react";
import { FireCMSFirebaseApp, FirebaseLoginView } from "@firecms/firebase";
import appConfig from "./index";
import { firebaseConfig } from "./firebase_config";

const ALLOWED_EMAILS = (import.meta.env.VITE_ALLOWED_EMAILS as string ?? "")
    .split(",")
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);

const firebaseProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "";
const firebaseAuthDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? "";
const environmentName =
    [firebaseProjectId, firebaseAuthDomain].some(value => value.toLowerCase().includes("stage"))
        ? "STAGE"
        : "PROD";
const appTitle = `My CMS (${environmentName})`;

function App() {
    React.useEffect(() => {
        document.title = appTitle;
    }, []);

    return (
        <FireCMSFirebaseApp
            name={appTitle}
            firebaseConfig={firebaseConfig}
            collections={appConfig.collections}
            views={appConfig.views}
            propertyConfigs={Object.values(appConfig.propertyConfigs)}
            signInOptions={["password"]}
            authenticator={({ user }) => {
                if (ALLOWED_EMAILS.length === 0) return true;
                return ALLOWED_EMAILS.includes(user?.email?.toLowerCase() ?? "");
            }}
            components={{
                LoginView: props => <FirebaseLoginView {...props} disableSignupScreen />
            }}
        />
    );
}

export default App;
