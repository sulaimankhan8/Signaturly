import { useMemo, useState } from "react";
import { BTN, PANEL, INPUT, EYEBROW, ICONS } from "../billing/theme";
import { Note } from "../billing/ui";
import { Avatar, RoleTag, Bar, SectionHead } from "./parts";
import { ROLE_LABELS, ROLE_HELP } from "../../utils/workspace";
import { ROLE_TONE, seatsOf, seatsSaid, invitationTimes, isEmail, dateOf } from "../../utils/team";

/**
 * Everyone in a team: who they are and what they may do, who is still to join, and inviting
 * more. The owner and admins manage people; everyone else sees the list.
 */

const ROLES = ["admin", "member", "viewer"];
const ROLE_SELECT = {
  admin: "bg-red-600 text-white",
  member: "bg-blue-600 text-white",
  viewer: "bg-[#374151] text-white",
};

// What each role can do, as services/authorize.service.js on the server decides it
const CAN = [
  ["Read the team's documents and activity", ["owner", "admin", "member", "viewer"]],
  ["Send documents and use templates", ["owner", "admin", "member"]],
  ["Manage the team's templates", ["owner", "admin"]],
  ["Invite and remove people, change roles", ["owner", "admin"]],
  ["Change branding and security rules", ["owner", "admin"]],
  ["Pay for the team, set up single sign-on", ["owner"]],
];

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const splitAddresses = (text) =>
  String(text)
    .split(/[\s,;]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

function InvitePanel({ seats, isOwner, busy, onInvite, onAddSeat }) {
  const [chips, setChips] = useState([]);
  const [draft, setDraft] = useState("");
  const [role, setRole] = useState("member");

  const add = (addresses) => setChips((old) => [...new Set([...old, ...addresses])]);
  // What will be sent: the addresses already turned into chips, and whatever is still being typed
  const pending = [...new Set([...chips, ...splitAddresses(draft)])];
  const wrong = pending.filter((a) => !isEmail(a));
  const tooMany = pending.length > seats.free;

  const send = async (event) => {
    event.preventDefault();
    if (!pending.length || wrong.length || tooMany) return;
    const failed = await onInvite(pending, role);
    setChips(failed);
    setDraft("");
  };

  return (
    <form id="invite" onSubmit={send} className={`${PANEL} p-5 !border-yellow-400 !shadow-[5px_5px_0px_0px_#facc15]`}>
      <h3 className="text-base font-black uppercase text-white">Invite people</h3>
      <p className="text-xs text-gray-400">They get an email with a link. Paste several addresses at once.</p>

      <label htmlFor="invite-emails" className={`${EYEBROW} block mt-4`}>
        Email addresses
      </label>
      <div className="mt-1.5 p-2 rounded-xl border-2 border-white/20 bg-[#090a0f] flex flex-wrap gap-1.5 focus-within:border-yellow-400">
        {chips.map((address) => (
          <span
            key={address}
            className={`inline-flex items-center gap-1.5 pl-2 pr-1 py-0.5 rounded-lg border-2 text-xs font-bold max-w-full ${isEmail(address) ? "bg-[#1e2235] border-white/20 text-white" : "bg-red-600/20 border-red-500 text-red-200"}`}
          >
            <span className="truncate">{address}</span>
            <button type="button" aria-label={`Remove ${address}`} className="w-5 h-5 grid place-items-center text-gray-400 hover:text-white" onClick={() => setChips(chips.filter((c) => c !== address))}>
              <ICONS.close className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          id="invite-emails"
          inputMode="email"
          autoComplete="off"
          placeholder={chips.length ? "Add another…" : "name@company.com"}
          value={draft}
          onChange={(e) => {
            // Typing a comma or a space, or pasting a list, turns what came before into chips
            const parts = e.target.value.split(/[\s,;]+/);
            if (parts.length > 1) {
              add(splitAddresses(parts.slice(0, -1).join(" ")));
              setDraft(parts.at(-1));
            } else setDraft(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && draft.trim()) {
              e.preventDefault();
              add(splitAddresses(draft));
              setDraft("");
            } else if (e.key === "Backspace" && !draft && chips.length) setChips(chips.slice(0, -1));
          }}
          onBlur={() => {
            if (draft.trim()) {
              add(splitAddresses(draft));
              setDraft("");
            }
          }}
          className="flex-[1_1_140px] min-w-0 min-h-[30px] bg-transparent text-sm font-bold text-white placeholder-gray-500 outline-none focus-visible:outline-none"
        />
      </div>
      {wrong.length > 0 && <p className="mt-1.5 text-xs font-bold text-red-300">{wrong.length === 1 ? `"${wrong[0]}" is not an email address.` : `${wrong.length} of these are not email addresses.`}</p>}

      <fieldset className="mt-4">
        <legend className={EYEBROW}>Their role</legend>
        <div className="mt-1.5 grid gap-2">
          {ROLES.map((id) => (
            <label
              key={id}
              className={`flex gap-2.5 p-3 rounded-xl border-2 cursor-pointer transition-all ${role === id ? "border-yellow-400 bg-yellow-400/[0.06] shadow-[3px_3px_0px_0px_#facc15]" : "border-white/15 bg-[#0f1118] hover:border-white/35"}`}
            >
              <input type="radio" name="invite-role" checked={role === id} onChange={() => setRole(id)} className="mt-0.5 w-4 h-4 shrink-0 accent-yellow-400" />
              <span className="min-w-0">
                <span className="block text-sm font-black uppercase text-white">{ROLE_LABELS[id]}</span>
                <span className="block text-xs text-gray-400">{ROLE_HELP[id]}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {seats.allowed === null ? (
        <p className="mt-4 text-xs text-gray-400">An invitation holds a seat until it is answered, or for 7 days.</p>
      ) : tooMany ? (
        <Note tone="red" icon="alert" className="mt-4 !text-xs">
          {seats.free === 0 ? "Every seat is in use." : `Only ${plural(seats.free, "seat")} ${seats.free === 1 ? "is" : "are"} free.`}{" "}
          {isOwner ? (
            <button type="button" className="font-black underline" disabled={busy === "seats"} onClick={onAddSeat}>
              Add a seat
            </button>
          ) : (
            "Ask the owner to add seats."
          )}
        </Note>
      ) : (
        <p className="mt-4 px-3 py-2.5 rounded-xl bg-purple-500/10 border-2 border-purple-500/35 text-xs text-purple-100">
          {pending.length
            ? `${plural(pending.length, "invitation")} will use ${pending.length} of your ${plural(seats.free, "free seat")}. `
            : `${plural(seats.free, "seat")} free. `}
          An unanswered invitation frees its seat after 7 days.
        </p>
      )}

      <button type="submit" className={`${BTN.primary} w-full mt-4`} disabled={busy === "invite" || !pending.length || wrong.length > 0 || tooMany}>
        {busy === "invite" ? "Sending…" : pending.length > 1 ? `Send ${pending.length} invitations` : "Send invitation"}
      </button>
    </form>
  );
}

export default function TeamPeople({ team, me, canManage, isOwner, busy, onRole, onRemove, onResend, onRevoke, onInvite, onAddSeat, onInviteClick }) {
  const [now] = useState(() => Date.now());
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const seats = seatsOf(team);

  const count = (role) => team.members.filter((m) => m.role === role).length;
  const filters = [
    ["all", `All ${team.members.length}`],
    ["admin", `Admins ${count("admin") + count("owner")}`],
    ["member", `Members ${count("member")}`],
    ["viewer", `Viewers ${count("viewer")}`],
  ];
  const shown = useMemo(() => {
    const words = search.trim().toLowerCase();
    return team.members.filter(
      (m) => (filter === "all" || m.role === filter || (filter === "admin" && m.role === "owner")) && (!words || `${m.name} ${m.email}`.toLowerCase().includes(words))
    );
  }, [team.members, filter, search]);

  const th = "px-3 py-2.5 bg-[#090a0f] border-y-2 border-white/10 text-left text-[10px] font-black uppercase tracking-wider text-gray-400";

  return (
    <div className="grid gap-6">
      <SectionHead
        title="People"
        action={
          canManage && (
            <button type="button" className={BTN.primary} onClick={onInviteClick}>
              <ICONS.plus className="w-4 h-4" /> Invite people
            </button>
          )
        }
      >
        Everyone in the team, what they may do, and who is still to join.
      </SectionHead>

      {team.seats && (
        <div className={`${PANEL} p-4 flex flex-wrap items-center gap-x-5 gap-y-3 !border-purple-500 !shadow-[4px_4px_0px_0px_#a855f7]`}>
          <span className="text-sm font-black text-white">{seats.allowed === null ? `${seats.used} seats in use · no limit` : seatsSaid(seats)}</span>
          {seats.allowed !== null && (
            <div className="flex-[1_1_200px]">
              <Bar
                parts={[
                  [seats.people / seats.allowed, "#a855f7"],
                  [seats.invited / seats.allowed, "#a855f7", true],
                ]}
              />
            </div>
          )}
          <span className="text-xs text-gray-400">
            {plural(seats.people, "person", "people")} · {plural(seats.invited, "invitation")}
            {seats.allowed !== null && ` · ${seats.free} free`}
          </span>
          {isOwner && seats.allowed !== null && (
            <button type="button" className={BTN.small} disabled={busy === "seats"} onClick={onAddSeat}>
              <ICONS.plus className="w-3.5 h-3.5" /> Add a seat
            </button>
          )}
        </div>
      )}

      <div className={`grid gap-6 items-start ${canManage ? "xl:grid-cols-[minmax(0,1fr)_20rem]" : ""}`}>
        <div className="grid gap-6 min-w-0" data-testid="team-members">
          <section className={`${PANEL} overflow-hidden`} aria-labelledby="members-h">
            <div className="p-4 flex flex-wrap items-center gap-2.5">
              <h3 id="members-h" className="mr-auto text-sm font-black uppercase text-white">
                Members
              </h3>
              <label htmlFor="people-search" className="sr-only">
                Search people
              </label>
              <input id="people-search" type="search" placeholder="Search by name or email" value={search} onChange={(e) => setSearch(e.target.value)} className={`${INPUT} !min-h-[36px] !w-56 text-xs`} />
              <div role="group" aria-label="Show" className="flex flex-wrap gap-1.5">
                {filters.map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={filter === id}
                    onClick={() => setFilter(id)}
                    className={`min-h-[36px] px-3 rounded-lg border-2 text-[11px] font-black uppercase tracking-wider ${filter === id ? "bg-yellow-400 text-black border-black" : "bg-[#0d0f16] text-gray-300 border-white/20 hover:border-white/40"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr>
                    <th scope="col" className={`${th} pl-4`}>
                      Person
                    </th>
                    <th scope="col" className={th}>
                      Role
                    </th>
                    <th scope="col" className={th}>
                      Two-step sign-in
                    </th>
                    <th scope="col" className={th}>
                      Joined
                    </th>
                    <th scope="col" className={`${th} pr-4`}>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((m) => {
                    const isMe = String(m.userId) === String(me?.id);
                    return (
                      <tr key={m.userId} className="border-t border-white/[0.07] hover:bg-white/[0.02]">
                        <td className="pl-4 pr-3 py-3">
                          <span className="flex items-center gap-2.5 min-w-0">
                            <Avatar name={m.name} email={m.email} />
                            <span className="min-w-0">
                              <span className="block font-black text-white truncate">
                                {m.name || m.email}
                                {isMe && <span className="text-gray-400 font-bold"> (you)</span>}
                              </span>
                              <span className="block text-xs text-gray-400 truncate">{m.email}</span>
                            </span>
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          {m.role === "owner" || !canManage ? (
                            <RoleTag role={m.role} />
                          ) : (
                            <select
                              aria-label={`Role for ${m.name || m.email}`}
                              title={ROLE_HELP[m.role]}
                              value={m.role}
                              disabled={busy === "role"}
                              onChange={(e) => onRole(m, e.target.value)}
                              className={`min-h-[32px] pl-2 pr-1 rounded-lg border-2 border-black text-[10px] font-black uppercase tracking-wider cursor-pointer ${ROLE_SELECT[m.role] || ROLE_SELECT.member}`}
                            >
                              {ROLES.map((role) => (
                                <option key={role} value={role} className="bg-[#13151f] text-white">
                                  {ROLE_LABELS[role]}
                                </option>
                              ))}
                            </select>
                          )}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          {m.twoFactor ? <span className="text-xs font-black text-emerald-400">● On</span> : <span className="text-xs font-black text-yellow-400">▲ Not set up</span>}
                        </td>
                        <td className="px-3 py-3 text-xs text-gray-400 whitespace-nowrap">{m.role === "owner" ? "Started the team" : dateOf(m.joinedAt)}</td>
                        <td className="pl-3 pr-4 py-3 text-right">
                          {m.role !== "owner" && (canManage || isMe) && (
                            <button type="button" className={`${BTN.small} !text-red-300`} onClick={() => onRemove(m)}>
                              {isMe ? "Leave" : "Remove"}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {shown.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-sm text-gray-400">
                        Nobody matches.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {team.invitations.length > 0 && (
            <section className={`${PANEL} p-4`} aria-labelledby="invites-h">
              <h3 id="invites-h" className="text-sm font-black uppercase text-white">
                Waiting to join <span className="text-yellow-400">{team.invitations.length}</span>
              </h3>
              <ul className="mt-3 grid gap-2">
                {team.invitations.map((invitation) => {
                  const times = invitationTimes(invitation, now);
                  return (
                    <li key={invitation.id} className={`flex flex-wrap items-center gap-x-3 gap-y-2 p-3 rounded-xl border-2 border-dashed ${times.soon ? "border-yellow-400 bg-yellow-400/[0.05]" : "border-white/15"}`}>
                      <span className="w-9 h-9 shrink-0 grid place-items-center rounded-full border-2 border-dashed border-white/30 text-gray-400 font-black" aria-hidden="true">
                        @
                      </span>
                      <span className="flex-[1_1_200px] min-w-0">
                        <span className="block font-black text-white truncate">{invitation.email}</span>
                        <span className={`block text-xs ${times.soon ? "text-yellow-400" : "text-gray-400"}`}>
                          Sent {dateOf(times.sent)} · {times.daysLeft <= 1 ? "expires today" : times.soon ? `expires in ${times.daysLeft} days` : `expires ${dateOf(invitation.expiresAt)}`}
                        </span>
                      </span>
                      <span className={`px-2 py-0.5 rounded-md border-2 text-[10px] font-black uppercase tracking-wider ${ROLE_TONE[invitation.role] === "red" ? "bg-red-600 border-black text-white" : ROLE_TONE[invitation.role] === "blue" ? "bg-blue-600 border-black text-white" : "bg-[#374151] border-black text-white"}`}>
                        {ROLE_LABELS[invitation.role]}
                      </span>
                      {canManage && (
                        <span className="flex gap-2">
                          <button type="button" className={BTN.small} disabled={busy === `resend-${invitation.id}`} onClick={() => onResend(invitation)}>
                            {busy === `resend-${invitation.id}` ? "Sending…" : "Resend"}
                          </button>
                          <button type="button" className={`${BTN.small} !text-red-300`} disabled={busy === `revoke-${invitation.id}`} onClick={() => onRevoke(invitation)}>
                            Withdraw
                          </button>
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>

        {canManage && <InvitePanel seats={seats} isOwner={isOwner} busy={busy} onInvite={onInvite} onAddSeat={onAddSeat} />}
      </div>

      <section className={`${PANEL} overflow-hidden`} aria-labelledby="roles-h">
        <h3 id="roles-h" className="p-4 text-sm font-black uppercase text-white">
          What each role can do
        </h3>
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[620px] text-sm">
            <thead>
              <tr>
                <th scope="col" className={`${th} pl-4`}>
                  Can…
                </th>
                {["owner", "admin", "member", "viewer"].map((role) => (
                  <th key={role} scope="col" className={`${th} !text-center`}>
                    <RoleTag role={role} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CAN.map(([what, roles]) => (
                <tr key={what} className="border-t border-white/[0.07]">
                  <th scope="row" className="pl-4 pr-3 py-2.5 text-left font-medium text-gray-200">
                    {what}
                  </th>
                  {["owner", "admin", "member", "viewer"].map((role) => (
                    <td key={role} className="px-3 py-2.5 text-center">
                      {roles.includes(role) ? (
                        <>
                          <ICONS.check className="w-4 h-4 inline text-emerald-400" />
                          <span className="sr-only">Yes</span>
                        </>
                      ) : (
                        <>
                          <span className="text-gray-600" aria-hidden="true">
                            —
                          </span>
                          <span className="sr-only">No</span>
                        </>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
