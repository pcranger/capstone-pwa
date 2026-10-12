import { createRoot } from "react-dom/client";
import { CrossWiseApp } from "./ui/CrossWiseApp";
import "./style.css";
import {loadRuntimeConfiguration} from "./config/services";
void loadRuntimeConfiguration().finally(()=>createRoot(document.getElementById("root")!).render(<CrossWiseApp />));
if ("serviceWorker" in navigator && import.meta.env.PROD)
  void navigator.serviceWorker.register("./sw.js").catch(() => {});
