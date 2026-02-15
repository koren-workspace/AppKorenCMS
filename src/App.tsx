import React from "react"
import { FireCMSCloudApp } from "@firecms/cloud";
import appConfig from "./index";

function App() {
    return <FireCMSCloudApp
        projectId={"koren-stage-b"}
        appConfig={appConfig}
        backendApiHost={import.meta.env.DEV ? `${window.location.origin}/api` : undefined}
    />;
}

export default App
