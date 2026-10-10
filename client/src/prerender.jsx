import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router-dom";
import { Provider } from "react-redux";
import { store } from "./store/store";
import "./i18n";
import Landing from "./pages/Landing";
import Pricing from "./pages/Pricing";
import PublicVerify from "./pages/PublicVerify";
import UserGuide from "./pages/UserGuide";

/**
 * The pages that are written out as ready-made HTML when the site is built, so that a search
 * engine, a link preview or a phone still waiting for the scripts gets the content itself and
 * not an empty shell. Used only by scripts/prerender.mjs; it is not part of the app bundle.
 *
 * `contains` is text the finished page must hold: the build fails if it is missing.
 */
export const PAGES = [
  {
    path: "/",
    component: Landing,
    title: "PactDoc — E-signatures for Indian businesses",
    description:
      "Send agreements for signature by email, SMS or WhatsApp. Signers sign on their phone, in their language, and everyone gets a sealed copy with a signing record.",
    contains: "Sign Agreements",
    priority: "1.0",
  },
  {
    path: "/pricing",
    component: Pricing,
    title: "Pricing — PactDoc",
    description: "PactDoc plans and prices for individuals, small businesses and teams.",
    contains: "Choose the Perfect Plan",
    priority: "0.9",
  },
  {
    path: "/verify",
    component: PublicVerify,
    title: "Verify a signed document — PactDoc",
    description:
      "Check a signed PDF against PactDoc's signing records: upload the file or paste its SHA-256 hash to see whether it is unchanged since it was signed.",
    contains: "Verify Document",
    priority: "0.8",
  },
  {
    path: "/userguide",
    component: UserGuide,
    title: "User guide — PactDoc",
    description: "How to upload a document, place fields, send it for signature and download the signed copy with PactDoc.",
    contains: "User Flow Manual",
    priority: "0.6",
  },
];

export const render = (page) => {
  const Component = page.component;
  return renderToString(
    <Provider store={store}>
      <StaticRouter location={page.path}>
        <Component />
      </StaticRouter>
    </Provider>
  );
};
