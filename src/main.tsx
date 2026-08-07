import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./i18n";
import "./index.css";
import { setResultsUrl } from "./lib/vat";
import { initLanguage } from "./lib/language";

setResultsUrl(`${import.meta.env.BASE_URL}data/results.json`);
initLanguage();

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
