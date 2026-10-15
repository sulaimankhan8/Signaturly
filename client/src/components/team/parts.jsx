import { Pill } from "../billing/ui";
import { ROLE_LABELS } from "../../utils/workspace";
import { ROLE_TONE, initialsOf, avatarOf } from "../../utils/team";

/**
 * The small pieces every team page uses: a person's avatar, a role's tag, the team's own mark,
 * a bar that fills, an on/off switch, and a section's heading.
 */

export const Avatar = ({ name, email, size = "w-9 h-9 text-xs" }) => (
  <span className={`${size} shrink-0 rounded-full grid place-items-center border-2 border-black text-black font-black`} style={{ background: avatarOf(email || name) }} aria-hidden="true">
    {initialsOf(name || email)}
  </span>
);

export const RoleTag = ({ role }) => <Pill tone={ROLE_TONE[role]}>{ROLE_LABELS[role] || role}</Pill>;

// The team's logo, or its initials on its colour
export const TeamMark = ({ team, size = "w-14 h-14 text-lg rounded-2xl" }) =>
  team?.branding?.logoUrl ? (
    <img src={team.branding.logoUrl} alt="" className={`${size} shrink-0 object-contain bg-white border-2 border-black p-1 shadow-[3px_3px_0px_0px_#000]`} />
  ) : (
    <span
      className={`${size} shrink-0 grid place-items-center border-2 border-black text-white font-black shadow-[3px_3px_0px_0px_#000]`}
      style={{ background: team?.branding?.primaryColor || "#4f46e5" }}
      aria-hidden="true"
    >
      {initialsOf(team?.name)}
    </span>
  );

// A bar that fills: one part solid, an optional second part striped (invitations holding seats)
export const Bar = ({ parts, height = "h-3" }) => (
  <div className={`${height} flex rounded-full border-2 border-black bg-[#0d0f16] overflow-hidden`} aria-hidden="true">
    {parts.map(([share, colour, striped], i) => (
      <div
        key={i}
        style={{
          width: `${Math.min(100, Math.max(0, share * 100))}%`,
          background: striped ? `repeating-linear-gradient(45deg, ${colour} 0 4px, #6b21a8 4px 8px)` : colour,
        }}
      />
    ))}
  </div>
);

export const Toggle = ({ checked, onChange, disabled, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={`relative w-14 h-8 shrink-0 rounded-full border-2 border-black transition-colors disabled:opacity-50 ${checked ? "bg-emerald-500" : "bg-gray-700"}`}
  >
    <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-white border-2 border-black transition-all ${checked ? "left-[26px]" : "left-0.5"}`} />
  </button>
);

export const SectionHead = ({ title, children, action }) => (
  <div className="flex flex-wrap items-end justify-between gap-3">
    <div className="min-w-0">
      <h2 className="text-2xl font-black uppercase text-white tracking-tight">{title}</h2>
      {children && <p className="mt-0.5 text-sm text-gray-400">{children}</p>}
    </div>
    {action}
  </div>
);

// Shown in place of a form's buttons to someone who may look but not change
export const ReadOnlyNote = ({ children = "Only the owner and admins can change this." }) => <p className="text-xs font-bold text-gray-400">{children}</p>;
