import { createRoot } from "react-dom/client";
import App from "./App";

createRoot(document.getElementById("root")!).render(<App />);

// Close all AudioContexts on Vite hot reload to prevent audio device lock
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    const ctx = (window as any).__audioContexts as AudioContext[] | undefined;
    ctx?.forEach((c) => c.close().catch(() => {}));
  });
}
