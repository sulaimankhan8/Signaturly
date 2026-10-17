import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import { store } from "./store/store";
import App, { preloadPageFor } from "./App";
import "./fonts";
import "./index.css";
import "./i18n";
import { Analytics } from "@vercel/analytics/react";

import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./queryClient";

const container = document.getElementById("root");

const appElement = (
  <Provider store={store}>
    <QueryClientProvider client={queryClient}>
      <App />
      <Analytics />
    </QueryClientProvider>
  </Provider>
);

const start = () => {
  ReactDOM.createRoot(container).render(appElement);
};

// A public page that arrived as ready-made HTML stays on screen until its code has loaded
if (container.hasChildNodes()) {
  preloadPageFor(window.location.pathname).then(start);
} else {
  start();
}

// Register PWA Service Worker
if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/service-worker.js")
      .catch((err) => console.debug("ServiceWorker registration skipped:", err));
  });
}
