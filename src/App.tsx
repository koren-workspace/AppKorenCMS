import React from "react";
import { FireCMSFirebaseApp } from "@firecms/firebase";
import appConfig from "./index";
import { firebaseConfig } from "./firebase_config";

function App() {
    return (
        <FireCMSFirebaseApp
            name={"My CMS"}
            firebaseConfig={firebaseConfig}
            collections={appConfig.collections}
            views={appConfig.views}
            propertyConfigs={Object.values(appConfig.propertyConfigs)}
        />
    );
}

export default App;
