import React from "react";
import { FireCMSFirebaseApp, FirebaseLoginView } from "@firecms/firebase";
import appConfig from "./index";
import { firebaseConfig } from "./firebase_config";

const ALLOWED_EMAILS = (import.meta.env.VITE_ALLOWED_EMAILS as string ?? "")
    .split(",")
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);

function App() {
    return (
        <FireCMSFirebaseApp
            name={"My CMS"}
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