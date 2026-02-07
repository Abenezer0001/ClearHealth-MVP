import { createRoot } from "react-dom/client";
import "@fontsource/sora/600.css";
import "@fontsource/sora/700.css";
import "@fontsource/space-grotesk/400.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/600.css";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
