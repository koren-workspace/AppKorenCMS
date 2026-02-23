import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App"
import "./index.css"
import { firebaseConfig } from "./config/firebase"

console.log("[Firebase] האפליקציה משתמשת במפתח:", firebaseConfig.apiKey)

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
        <App/>
    </React.StrictMode>
)
