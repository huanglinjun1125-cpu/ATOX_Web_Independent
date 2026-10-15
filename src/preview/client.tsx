import { createRoot } from "react-dom/client";
import { PreviewApp } from "./app";
createRoot(document.getElementById("root")!).render(
  <PreviewApp
    pathname={window.location.pathname.replace(/\/$/, "") || "/"}
    query={window.location.search}
  />,
);
