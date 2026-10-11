// Where to take someone after they sign up or sign in, when they arrived on the way to
// somewhere (a public template page sends them on to that template's fill-in screen).

/**
 * The "next" address from a query string, if it is a page of this site.
 * Anything else is ignored, so a crafted link cannot send a person to another site after sign-in.
 */
export const nextPathFrom = (search) => {
  const next = new URLSearchParams(search || "").get("next");
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\") || next.includes("://")) return null;
  return next;
};

// The same query string, to carry from the sign-up page to the sign-in page and back
export const withNext = (path, next) => (next ? `${path}?next=${encodeURIComponent(next)}` : path);
