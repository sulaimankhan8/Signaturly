import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import { store } from "./store/store";
import App, { preloadPageFor } from "./App";
import "./fonts";
import "./index.css";
import "./i18n";
import { Analytics } from "@vercel/analytics/react";

const container = document.getElementById("root");

const start = () =>
  ReactDOM.createRoot(container).render(
    <Provider store={store}>
      <App />
      <Analytics />
    </Provider>
  );

// A public page that arrived as ready-made HTML stays on screen until its code has loaded
if (container.hasChildNodes()) {
  preloadPageFor(window.location.pathname).then(start);
} else {
  start();
}
