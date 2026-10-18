import { createRoot } from "react-dom/client";
import { App } from "./App";
import { FADE_SECONDS, asset } from "./draw/constants";
import "./styles/app.scss";

document.documentElement.style.setProperty("--fade", `${FADE_SECONDS}s`);
document.documentElement.style.setProperty("--lobby", `url("${asset("lobby.jpg")}")`);

createRoot(document.getElementById("root")!).render(<App />);
