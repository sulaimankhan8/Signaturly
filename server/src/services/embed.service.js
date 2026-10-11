import crypto from "crypto";
import { Workspace } from "../models/Workspace.model.js";
import { ApiError } from "../utils/ApiError.js";
import { env } from "../config/env.js";
import { safeEqual } from "../utils/tokens.js";

/**
 * Embedded signing (plan task P6-12): a customer shows a signing page inside their own website.
 *
 * A signing page refuses to appear inside another site unless it was opened with an embed
 * session. A session is made through the API for one signer and one website, is short-lived,
 * and works only while that website is on the workspace's list of allowed sites.
 */

const SESSION_TTL_MS = 15 * 60 * 1000;

const key = () => crypto.createHmac("sha256", String(env.fileUrlSecret || env.accessSecret)).update("embedded-signing-session").digest();
const sign = (body) => crypto.createHmac("sha256", key()).update(body).digest("base64url");

/**
 * Turns what was typed into a bare origin (scheme, host and port), or null.
 * Only https sites may embed, except a local address while developing.
 */
export const cleanOrigin = (value) => {
  let url;
  try {
    url = new URL(String(value || "").trim());
  } catch {
    return null;
  }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !(url.protocol === "http:" && local && !env.isProd)) return null;
  return url.origin;
};

const allowedOriginsOf = async (pdf) => {
  if (!pdf.workspaceId) return [];
  const workspace = await Workspace.findById(pdf.workspaceId).select("allowedFrameOrigins").lean();
  return workspace?.allowedFrameOrigins || [];
};

/**
 * Makes the address a customer's website loads in a frame for one signer.
 */
export const createEmbedSession = async ({ recipient, pdf, origin }) => {
  const site = cleanOrigin(origin);
  if (!site) throw new ApiError(400, "Give the website that will show the signing page, such as https://app.example.com");
  if (!(await allowedOriginsOf(pdf)).includes(site)) {
    throw new ApiError(403, `${site} is not on this workspace's list of sites allowed to embed signing. Add it in the workspace settings first.`);
  }
  if (["signed", "declined"].includes(recipient.status)) throw new ApiError(409, "This signer has already finished");

  const expiresAt = Date.now() + SESSION_TTL_MS;
  const body = Buffer.from(JSON.stringify({ r: recipient._id.toString(), o: site, e: expiresAt })).toString("base64url");
  const session = `${body}.${sign(body)}`;

  return {
    url: `${env.appUrl}/sign/${recipient.token}?embed=${session}`,
    expiresAt: new Date(expiresAt),
    origin: site,
  };
};

/**
 * Checks the session a signing page was opened with. Returns the website allowed to frame
 * the page, or null: a missing, altered, expired or withdrawn session is simply no session.
 */
export const readEmbedSession = async (session, recipient, pdf) => {
  if (typeof session !== "string" || !session.includes(".")) return null;
  const [body, signature] = session.split(".");
  if (!body || !signature || !safeEqual(signature, sign(body))) return null;

  let claims;
  try {
    claims = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (claims.r !== recipient._id.toString() || !(claims.e > Date.now())) return null;
  // The site may have been taken off the list since the session was made
  if (!(await allowedOriginsOf(pdf)).includes(claims.o)) return null;
  return { origin: claims.o };
};
