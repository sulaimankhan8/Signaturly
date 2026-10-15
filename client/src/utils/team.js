/**
 * What the team pages (pages/TeamWorkspaces.jsx and components/team/*) work out from a team's
 * details: seats, the activity feed's words and groups, and the small labels they share.
 */

// A server message without its "UPGRADE_REQUIRED:"-style code in front
export const messageOf = (err, fallback) => (err?.response?.data?.message || fallback).replace(/^[A-Z_]+:\s*/, "");

export const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export const dateOf = (value) => (value ? new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "");
export const timeOf = (value) => (value ? new Date(value).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }) : "");

const DAY = 24 * 60 * 60 * 1000;
export const INVITATION_DAYS = 7;

// "MR" for "Mehta & Rao Legal", "AR" for "Arjun Rao", "N" for "neha@…"
export const initialsOf = (text) => {
  const words = String(text || "")
    .replace(/@.*/, "")
    .split(/[\s._-]+/)
    .filter((w) => /[a-z0-9]/i.test(w));
  return ((words[0]?.[0] || "?") + (words[1]?.[0] || "")).toUpperCase();
};

// A steady colour per person, so the same person always wears the same avatar
const AVATARS = ["#facc15", "#f87171", "#60a5fa", "#34d399", "#c084fc", "#fb923c", "#2dd4bf", "#d1d5db"];
export const avatarOf = (key) => AVATARS[[...String(key || "")].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % AVATARS.length];

// Each role's tag, as the role table and the people list show it
export const ROLE_TONE = { owner: "yellow", admin: "red", member: "blue", viewer: "gray" };

export const BRAND_COLOURS = [
  ["#0f766e", "Teal"],
  ["#4f46e5", "Indigo"],
  ["#dc2626", "Red"],
  ["#b45309", "Amber"],
  ["#7c3aed", "Violet"],
  ["#0f172a", "Navy"],
];
export const isHex = (value) => /^#[0-9a-f]{6}$/i.test(value || "");

/**
 * The seats a team uses: its people, and invitations not yet answered, which hold a seat each.
 * `allowed` is null when there is no limit (Enterprise without a number set).
 */
export const seatsOf = (details) => {
  const used = details?.seats?.used ?? 0;
  const allowed = Number.isFinite(details?.seats?.allowed) ? details.seats.allowed : null;
  const invited = details?.invitations?.length ?? 0;
  return { used, allowed, invited, people: Math.max(0, used - invited), free: allowed === null ? Infinity : Math.max(0, allowed - used), full: allowed !== null && used >= allowed };
};

export const seatsSaid = (seats) => `${seats.used} of ${seats.allowed === null ? "unlimited" : seats.allowed} seats in use`;

// When an invitation was last sent, and how long it has left
export const invitationTimes = (invitation, now) => {
  const expires = new Date(invitation.expiresAt).getTime();
  const daysLeft = Math.max(0, Math.ceil((expires - now) / DAY));
  return { sent: new Date(expires - INVITATION_DAYS * DAY), daysLeft, soon: daysLeft <= 2 };
};

// ----- activity -----

export const EVENT_WORDS = {
  created: "uploaded",
  sent: "sent for signature",
  viewed: "opened",
  identity_verified: "passed the identity check on",
  signed: "signed",
  completed: "completed",
  sealed: "sealed",
  declined: "declined",
  voided: "voided",
  downloaded: "downloaded",
  expired: "expired",
  reminder_sent: "sent a reminder for",
  automated_reminder: "was reminded about",
  recipient_updated: "updated a signer on",
  deleted: "deleted",
  esign_started: "started Aadhaar eSign on",
  esign_verified: "completed Aadhaar eSign on",
  esign_failed: "did not complete Aadhaar eSign on",
  retention_deleted: "was removed under the retention rule:",
};

// The groups the activity filter offers, and the look of each entry in them
export const ACTIVITY_KINDS = [
  ["all", "All"],
  ["sent", "Sent"],
  ["signed", "Signed"],
  ["completed", "Completed"],
  ["declined", "Declined"],
  ["other", "Other"],
];
const KIND_OF_EVENT = {
  sent: "sent",
  reminder_sent: "sent",
  signed: "signed",
  identity_verified: "signed",
  esign_verified: "signed",
  completed: "completed",
  sealed: "completed",
  declined: "declined",
  voided: "declined",
  expired: "declined",
  esign_failed: "declined",
};
export const kindOf = (event) => KIND_OF_EVENT[event] || "other";

export const activityLine = (entry) => `${entry.actor || "Someone"} ${EVENT_WORDS[entry.event] || entry.event} ${entry.document || ""}`.trim();

// "Today", "Yesterday", or the date, for grouping the feed by day
export const dayHeading = (value, now) => {
  const day = new Date(value);
  const today = new Date(now);
  const start = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((start(today) - start(day)) / DAY);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return day.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: day.getFullYear() === today.getFullYear() ? undefined : "numeric" });
};

// The feed as a spreadsheet file, for the entries currently shown
export const activityCsv = (entries) => {
  const cell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const rows = [["When", "Who", "What", "Document"], ...entries.map((e) => [new Date(e.at).toISOString(), e.actor || "", EVENT_WORDS[e.event] || e.event, e.document || ""])];
  return rows.map((row) => row.map(cell).join(",")).join("\r\n");
};

// ----- retention -----

export const KEEP_CHOICES = [
  ["forever", "Keep forever", null],
  ["1y", "1 year", 365],
  ["3y", "3 years", 1095],
  ["7y", "7 years", 2555],
  ["custom", "Custom", undefined],
];
export const keepChoiceOf = (days) => (days === null || days === "" || days === undefined ? "forever" : KEEP_CHOICES.find(([, , d]) => d === Number(days))?.[0] || "custom");
