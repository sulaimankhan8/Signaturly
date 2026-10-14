import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import toast, { Toaster } from "react-hot-toast";
import Navbar from "../components/Navbar";
import ConfirmModal from "../components/ConfirmModal";
import {
  fetchWorkspacesApi,
  createWorkspaceApi,
  fetchWorkspaceApi,
  fetchWorkspaceActivityApi,
  updateWorkspaceApi,
  inviteWorkspaceMemberApi,
  revokeInvitationApi,
  changeMemberRoleApi,
  removeWorkspaceMemberApi,
  fetchSsoSettingsApi,
  saveSsoSettingsApi,
  verifySsoDomainsApi,
} from "../api/workspace.api";
import { fetchUserSubscription } from "../api/billing.api";
import { payFor, rupees } from "../utils/checkout";
import PlanCheckout from "../components/PlanCheckout";
import { getActiveWorkspaceId, setActiveWorkspaceId, ROLE_LABELS, ROLE_HELP } from "../utils/workspace";

/**
 * Team workspaces (plan tasks P5-04 to P5-09, P5-11, P6-12, P6-15): who is in a team and what
 * each may do, how its documents look to signers, the rules it sets for its members, and what
 * has happened in it lately.
 */

const card = "bg-[#12141c] border border-white/10 rounded-2xl p-6";
const inputClass = "w-full px-3 py-2.5 bg-[#08090d] border border-white/15 rounded-xl text-white text-sm placeholder-gray-500 focus:outline-none focus:border-red-500";
const primary = "px-4 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold";
const quiet = "px-3 py-2 bg-white/5 hover:bg-white/10 disabled:opacity-40 border border-white/10 rounded-xl text-xs font-bold text-gray-200";
const when = (value) => (value ? new Date(value).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "");
const messageOf = (err, fallback) => (err.response?.data?.message || fallback).replace(/^[A-Z_]+:\s*/, "");

const EVENT_WORDS = {
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

const TABS = [
  ["members", "Members"],
  ["branding", "Branding"],
  ["rules", "Rules"],
  ["activity", "Activity"],
  ["sso", "Single sign-on"],
];

export default function TeamWorkspaces() {
  const me = useSelector((state) => state.auth.user);
  const [workspaces, setWorkspaces] = useState(null);
  const [selectedId, setSelectedId] = useState("");
  const [details, setDetails] = useState(null);
  const [subscription, setSubscription] = useState(null);
  // How many seats the checkout step for the Business plan opens with, while it is open
  const [buyingSeats, setBuyingSeats] = useState(0);
  const [tab, setTab] = useState("members");
  const [busy, setBusy] = useState("");
  const [newName, setNewName] = useState("");
  const [invite, setInvite] = useState({ email: "", role: "member" });
  const [removing, setRemoving] = useState(null);
  const [brand, setBrand] = useState({ companyName: "", primaryColor: "#4f46e5", logoUrl: "", emailFooterText: "" });
  const [rules, setRules] = useState({ requireTwoFactor: false, retentionDays: "", origins: "" });
  const [activity, setActivity] = useState(null);
  const [sso, setSso] = useState(null);
  const [ssoForm, setSsoForm] = useState({ issuer: "", clientId: "", clientSecret: "", emailDomains: "" });

  const teams = (workspaces || []).filter((w) => !w.personal);
  const canManage = ["owner", "admin"].includes(details?.role);
  const isOwner = details?.role === "owner";
  const plan = subscription?.catalogue?.plans?.find((p) => p.id === subscription?.subscription?.plan);
  const mayCreate = Boolean(subscription?.entitlements?.features?.workspaces ?? ["business", "enterprise"].includes(plan?.tier));
  const businessPlan = subscription?.catalogue?.plans?.find((p) => p.perSeat && p.purchasable);

  const loadDetails = useCallback(async (id) => {
    if (!id) return setDetails(null);
    try {
      const workspace = await fetchWorkspaceApi(id);
      setDetails(workspace);
      setBrand({
        companyName: workspace.branding?.companyName || "",
        primaryColor: workspace.branding?.primaryColor || "#4f46e5",
        logoUrl: workspace.branding?.logoUrl || "",
        emailFooterText: workspace.branding?.emailFooterText || "",
      });
      setRules({
        requireTwoFactor: Boolean(workspace.policy?.requireTwoFactor),
        retentionDays: workspace.policy?.retentionDays ?? "",
        origins: (workspace.allowedFrameOrigins || []).join("\n"),
      });
    } catch (err) {
      toast.error(messageOf(err, "The workspace could not be loaded"));
      setDetails(null);
    }
  }, []);

  const loadAll = useCallback(async () => {
    const [list, sub] = await Promise.all([fetchWorkspacesApi().catch(() => []), fetchUserSubscription().catch(() => null)]);
    setWorkspaces(list || []);
    setSubscription(sub);
    const teamList = (list || []).filter((w) => !w.personal);
    const active = getActiveWorkspaceId();
    const first = teamList.find((w) => String(w.id) === active) || teamList[0];
    setSelectedId((current) => current || (first ? String(first.id) : ""));
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    setActivity(null);
    setSso(null);
    loadDetails(selectedId);
  }, [selectedId, loadDetails]);

  useEffect(() => {
    if (!selectedId) return;
    if (tab === "activity" && activity === null) {
      fetchWorkspaceActivityApi(selectedId).then(setActivity).catch(() => setActivity([]));
    }
    if (tab === "sso" && sso === null && isOwner) {
      fetchSsoSettingsApi(selectedId)
        .then((settings) => {
          setSso(settings);
          setSsoForm({ issuer: settings.issuer, clientId: settings.clientId, clientSecret: "", emailDomains: settings.emailDomains.join(", ") });
        })
        .catch((err) => setSso({ unavailable: messageOf(err, "Single sign-on is not available for this workspace") }));
    }
  }, [tab, selectedId, activity, sso, isOwner]);

  // Runs one action, shows what happened, and reads the workspace again
  const run = async (name, work, done) => {
    setBusy(name);
    try {
      await work();
      if (done) toast.success(done);
      await loadDetails(selectedId);
    } catch (err) {
      toast.error(messageOf(err, "That did not work. Please try again."));
    } finally {
      setBusy("");
    }
  };

  const create = async (event) => {
    event.preventDefault();
    if (!newName.trim()) return;
    setBusy("create");
    try {
      const workspace = await createWorkspaceApi({ name: newName.trim() });
      setNewName("");
      toast.success(`${workspace.name} is ready`);
      await loadAll();
      setSelectedId(String(workspace.id));
    } catch (err) {
      toast.error(messageOf(err, "The workspace could not be created"));
    } finally {
      setBusy("");
    }
  };

  const workIn = (workspace) => {
    setActiveWorkspaceId(String(workspace.id));
    window.location.assign("/dashboard");
  };

  const buySeats = async (count) => {
    setBusy("seats");
    try {
      const result = await payFor("seats", String(count), { stay: true });
      if (result !== "cancelled") {
        toast.success(result === "processing" ? "Payment received. The seat appears in a moment." : "Seat added");
        await loadDetails(selectedId);
      }
    } catch (err) {
      toast.error(messageOf(err, "The seat could not be added"));
    } finally {
      setBusy("");
    }
  };

  // How many seats, and how to pay for them (renewing or once), are both asked in the checkout step
  const buyBusiness = () => setBuyingSeats(3);

  const pickLogo = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg"].includes(file.type) || file.size > 150 * 1024) {
      toast.error("Choose a PNG or JPEG under 150 KB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setBrand((b) => ({ ...b, logoUrl: String(reader.result) }));
    reader.readAsDataURL(file);
  };

  const saveRules = () =>
    run(
      "rules",
      () =>
        updateWorkspaceApi(selectedId, {
          policy: { requireTwoFactor: rules.requireTwoFactor, retentionDays: rules.retentionDays === "" ? null : Number(rules.retentionDays) },
          allowedFrameOrigins: rules.origins.split(/\s+/).map((s) => s.trim()).filter(Boolean),
        }),
      "Rules saved"
    );

  const saveSso = async (enabled) => {
    setBusy("sso");
    try {
      const body = {
        issuer: ssoForm.issuer.trim(),
        clientId: ssoForm.clientId.trim(),
        emailDomains: ssoForm.emailDomains.split(/[\s,]+/).filter(Boolean),
        ...(ssoForm.clientSecret ? { clientSecret: ssoForm.clientSecret } : {}),
        ...(enabled === undefined ? {} : { enabled }),
      };
      setSso(await saveSsoSettingsApi(selectedId, body));
      setSsoForm((form) => ({ ...form, clientSecret: "" }));
      toast.success("Single sign-on settings saved");
    } catch (err) {
      toast.error(messageOf(err, "The settings could not be saved"));
    } finally {
      setBusy("");
    }
  };

  const checkDomains = async () => {
    setBusy("sso");
    try {
      const settings = await verifySsoDomainsApi(selectedId);
      setSso(settings);
      toast[settings.verifiedDomains.length ? "success" : "error"](
        settings.verifiedDomains.length ? `Verified: ${settings.verifiedDomains.join(", ")}` : "The record was not found yet. DNS changes can take a while to appear."
      );
    } catch (err) {
      toast.error(messageOf(err, "The domains could not be checked"));
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="min-h-screen bg-[#08090d] text-gray-100">
      <Toaster position="top-right" />
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <header>
          <h1 className="text-2xl font-black text-white">Team workspaces</h1>
          <p className="text-sm text-gray-400 mt-1">A team shares documents, templates and one plan. Each person keeps their own sign-in.</p>
        </header>

        {workspaces === null ? (
          <div className="w-8 h-8 border-4 border-white/10 border-t-red-600 rounded-full animate-spin" />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[18rem_1fr] gap-6">
            {/* The teams this person is in, and starting a new one */}
            <aside className="space-y-4">
              <section className={card} data-testid="team-list">
                <h2 className="text-sm font-bold text-white">Your teams</h2>
                {teams.length === 0 && <p className="text-xs text-gray-400 mt-2">You are not in a team yet.</p>}
                <ul className="mt-3 space-y-2">
                  {teams.map((workspace) => (
                    <li key={workspace.id}>
                      <button
                        onClick={() => setSelectedId(String(workspace.id))}
                        className={`w-full text-left px-3 py-2.5 rounded-xl border text-sm ${
                          String(workspace.id) === selectedId ? "bg-red-600/15 border-red-500/50 text-white" : "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10"
                        }`}
                      >
                        <span className="font-bold block truncate">{workspace.name}</span>
                        <span className="text-[11px] text-gray-400">
                          {ROLE_LABELS[workspace.role] || workspace.role}
                          {workspace.status === "read_only" ? " · read-only" : ""}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>

              <section className={card}>
                <h2 className="text-sm font-bold text-white">Start a team</h2>
                {mayCreate ? (
                  <form onSubmit={create} className="mt-3 space-y-2">
                    <input className={inputClass} placeholder="Team name" value={newName} maxLength={80} onChange={(e) => setNewName(e.target.value)} />
                    <button className={primary} disabled={busy === "create" || !newName.trim()}>
                      Create team
                    </button>
                  </form>
                ) : (
                  <div className="mt-2 space-y-3">
                    <p className="text-xs text-gray-400">Teams are part of the Business plan, which is paid per person and pools everyone's documents into one allowance.</p>
                    {businessPlan && subscription?.billingEnabled ? (
                      <button className={primary} disabled={busy === "plan"} onClick={buyBusiness}>
                        Get Business · {rupees(businessPlan.priceInr)} per person a month
                      </button>
                    ) : (
                      <Link to="/billing/plans" className={quiet}>
                        See plans
                      </Link>
                    )}
                  </div>
                )}
              </section>
            </aside>

            {/* The chosen team */}
            <section className="space-y-4 min-w-0">
              {!details ? (
                <div className={card}>
                  <p className="text-sm text-gray-400">Choose a team on the left, or start one.</p>
                </div>
              ) : (
                <>
                  <div className={`${card} flex flex-wrap items-center justify-between gap-3`}>
                    <div className="min-w-0">
                      <h2 className="text-lg font-black text-white truncate">{details.name}</h2>
                      <p className="text-xs text-gray-400">
                        You are {ROLE_LABELS[details.role]?.toLowerCase() === "owner" ? "the owner" : `a${details.role === "admin" ? "n" : ""} ${details.role}`}
                        {details.seats && ` · ${details.seats.used} of ${Number.isFinite(details.seats.allowed) && details.seats.allowed !== null ? details.seats.allowed : "unlimited"} seats in use`}
                      </p>
                      {details.status === "read_only" && (
                        <p className="text-xs text-amber-400 mt-1">This team is read-only because its plan has lapsed. Documents can be read and downloaded; nothing new can be sent until the owner renews.</p>
                      )}
                    </div>
                    <button className={primary} onClick={() => workIn(details)} data-testid="work-in-team">
                      Work in this team
                    </button>
                  </div>

                  <nav className="flex flex-wrap gap-2">
                    {TABS.filter(([id]) => id !== "sso" || isOwner).map(([id, label]) => (
                      <button key={id} onClick={() => setTab(id)} className={`px-3 py-2 rounded-xl text-xs font-bold border ${tab === id ? "bg-white text-black border-white" : "bg-white/5 text-gray-300 border-white/10 hover:bg-white/10"}`}>
                        {label}
                      </button>
                    ))}
                  </nav>

                  {tab === "members" && (
                    <div className={card} data-testid="team-members">
                      <ul className="divide-y divide-white/10">
                        {details.members.map((member) => (
                          <li key={member.userId} className="py-3 flex flex-wrap items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-white truncate">{member.name || member.email}</p>
                              <p className="text-xs text-gray-400 truncate">
                                {member.email}
                                {member.role !== "owner" && details.policy?.requireTwoFactor && !member.twoFactor && <span className="text-amber-400"> · two-step sign-in not set up</span>}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {member.role === "owner" || !canManage ? (
                                <span className="text-xs font-bold text-gray-300">{ROLE_LABELS[member.role]}</span>
                              ) : (
                                <select
                                  value={member.role}
                                  onChange={(e) => run("role", () => changeMemberRoleApi(selectedId, member.userId, e.target.value), "Role updated")}
                                  className="px-2 py-1.5 bg-[#08090d] border border-white/15 rounded-lg text-xs text-white"
                                  title={ROLE_HELP[member.role]}
                                >
                                  {["admin", "member", "viewer"].map((role) => (
                                    <option key={role} value={role}>
                                      {ROLE_LABELS[role]}
                                    </option>
                                  ))}
                                </select>
                              )}
                              {member.role !== "owner" && (canManage || String(member.userId) === String(me?.id)) && (
                                <button className={quiet} onClick={() => setRemoving(member)}>
                                  {String(member.userId) === String(me?.id) ? "Leave" : "Remove"}
                                </button>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>

                      {details.invitations.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-white/10">
                          <h3 className="text-xs font-bold uppercase text-gray-500">Invited, not yet joined</h3>
                          <ul className="mt-2 space-y-2">
                            {details.invitations.map((invitation) => (
                              <li key={invitation.id} className="flex items-center justify-between gap-3 text-sm">
                                <span className="text-gray-300 truncate">
                                  {invitation.email} <span className="text-gray-500">· {ROLE_LABELS[invitation.role]} · until {when(invitation.expiresAt)}</span>
                                </span>
                                {canManage && (
                                  <button className={quiet} onClick={() => run("revoke", () => revokeInvitationApi(selectedId, invitation.id), "Invitation withdrawn")}>
                                    Withdraw
                                  </button>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {canManage && (
                        <form
                          className="mt-4 pt-4 border-t border-white/10 grid grid-cols-1 sm:grid-cols-[1fr_9rem_auto] gap-2"
                          onSubmit={(e) => {
                            e.preventDefault();
                            run("invite", () => inviteWorkspaceMemberApi(selectedId, invite).then(() => setInvite({ email: "", role: invite.role })), "Invitation sent");
                          }}
                        >
                          <input className={inputClass} type="email" required placeholder="name@company.com" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} />
                          <select className={inputClass} value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value })}>
                            {["admin", "member", "viewer"].map((role) => (
                              <option key={role} value={role}>
                                {ROLE_LABELS[role]}
                              </option>
                            ))}
                          </select>
                          <button className={primary} disabled={busy === "invite"}>
                            Invite
                          </button>
                          <p className="sm:col-span-3 text-[11px] text-gray-500">{ROLE_HELP[invite.role]}. An invitation holds a seat until it is answered or expires after 7 days.</p>
                        </form>
                      )}

                      {isOwner && details.seats && Number.isFinite(details.seats.allowed) && details.seats.used >= details.seats.allowed && (
                        <div className="mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-wrap items-center justify-between gap-3">
                          <p className="text-xs text-amber-200">Every seat is in use. Add one to invite another person; you pay only for the rest of the current period.</p>
                          <button className={primary} disabled={busy === "seats"} onClick={() => buySeats(1)}>
                            Add a seat
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {tab === "branding" && (
                    <div className={`${card} space-y-4`} data-testid="team-branding">
                      <p className="text-xs text-gray-400">Shown to signers on this team's emails and signing pages, in place of the PactDoc name and colour.</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <label className="block text-xs text-gray-400">
                          Name shown to signers
                          <input className={`${inputClass} mt-1`} disabled={!canManage} maxLength={80} value={brand.companyName} onChange={(e) => setBrand({ ...brand, companyName: e.target.value })} />
                        </label>
                        <label className="block text-xs text-gray-400">
                          Colour
                          <span className="mt-1 flex gap-2">
                            <input type="color" disabled={!canManage} value={brand.primaryColor} onChange={(e) => setBrand({ ...brand, primaryColor: e.target.value })} className="h-10 w-14 bg-transparent" />
                            <input className={inputClass} disabled={!canManage} value={brand.primaryColor} onChange={(e) => setBrand({ ...brand, primaryColor: e.target.value })} />
                          </span>
                        </label>
                        <label className="block text-xs text-gray-400 sm:col-span-2">
                          Line at the foot of emails
                          <input className={`${inputClass} mt-1`} disabled={!canManage} maxLength={300} value={brand.emailFooterText} onChange={(e) => setBrand({ ...brand, emailFooterText: e.target.value })} />
                        </label>
                        <div className="sm:col-span-2 text-xs text-gray-400">
                          Logo (PNG or JPEG, under 150 KB)
                          <div className="mt-1 flex items-center gap-3">
                            {brand.logoUrl && <img src={brand.logoUrl} alt="" className="h-10 max-w-[10rem] object-contain bg-white rounded p-1" />}
                            {canManage && <input type="file" accept="image/png,image/jpeg" onChange={pickLogo} className="text-xs text-gray-300" />}
                            {canManage && brand.logoUrl && (
                              <button className={quiet} onClick={() => setBrand({ ...brand, logoUrl: "" })}>
                                Remove
                              </button>
                            )}
                          </div>
                          <p className="mt-1 text-[11px] text-gray-500">An uploaded logo shows on the signing page. Email programs show a logo only when it is given as an https address.</p>
                        </div>
                      </div>
                      {canManage && (
                        <button
                          className={primary}
                          disabled={busy === "brand"}
                          onClick={() => run("brand", () => updateWorkspaceApi(selectedId, { branding: { ...brand, logoUrl: brand.logoUrl || null } }), "Branding saved")}
                        >
                          Save branding
                        </button>
                      )}
                    </div>
                  )}

                  {tab === "rules" && (
                    <div className={`${card} space-y-5`} data-testid="team-rules">
                      <label className="flex items-start gap-3">
                        <input type="checkbox" className="mt-1" disabled={!canManage} checked={rules.requireTwoFactor} onChange={(e) => setRules({ ...rules, requireTwoFactor: e.target.checked })} />
                        <span>
                          <span className="block text-sm font-bold text-white">Require two-step sign-in</span>
                          <span className="block text-xs text-gray-400">A member without it can open nothing in this team until they switch it on in their own settings.</span>
                        </span>
                      </label>
                      <label className="block text-xs text-gray-400">
                        Erase finished documents after this many days
                        <input
                          className={`${inputClass} mt-1 max-w-[10rem]`}
                          type="number"
                          min={30}
                          max={3650}
                          disabled={!canManage}
                          placeholder="Keep them"
                          value={rules.retentionDays}
                          onChange={(e) => setRules({ ...rules, retentionDays: e.target.value })}
                        />
                        <span className="block mt-1 text-[11px] text-gray-500">Leave empty to keep documents until someone deletes them. Erasing cannot be undone; the record of who signed is kept.</span>
                      </label>
                      <label className="block text-xs text-gray-400">
                        Websites allowed to show this team's signing pages inside their own pages, one per line
                        <textarea className={`${inputClass} mt-1 font-mono`} rows={3} disabled={!canManage} placeholder="https://app.example.com" value={rules.origins} onChange={(e) => setRules({ ...rules, origins: e.target.value })} />
                        <span className="block mt-1 text-[11px] text-gray-500">Used with embedded signing through the API. A signing page refuses to appear inside any other site.</span>
                      </label>
                      {canManage && (
                        <button className={primary} disabled={busy === "rules"} onClick={saveRules}>
                          Save rules
                        </button>
                      )}
                    </div>
                  )}

                  {tab === "activity" && (
                    <div className={card} data-testid="team-activity">
                      {activity === null ? (
                        <p className="text-sm text-gray-400">Loading…</p>
                      ) : activity.length === 0 ? (
                        <p className="text-sm text-gray-400">Nothing has happened in this team yet.</p>
                      ) : (
                        <ul className="divide-y divide-white/10">
                          {activity.map((entry, index) => (
                            <li key={index} className="py-2.5 text-sm">
                              <span className="text-white font-bold">{entry.actor || "Someone"}</span>{" "}
                              <span className="text-gray-300">{EVENT_WORDS[entry.event] || entry.event}</span>{" "}
                              <span className="text-white">{entry.document}</span>
                              <span className="block text-[11px] text-gray-500">{when(entry.at)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {tab === "sso" && isOwner && (
                    <div className={`${card} space-y-4`} data-testid="team-sso">
                      {sso === null ? (
                        <p className="text-sm text-gray-400">Loading…</p>
                      ) : sso.unavailable ? (
                        <p className="text-sm text-gray-400">{sso.unavailable}</p>
                      ) : (
                        <>
                          <p className="text-xs text-gray-400">
                            People at your organisation sign in through your own identity provider (OpenID Connect). In it, register this address as the place to send people back to:
                            <code className="block mt-1 px-2 py-1 bg-black/40 rounded text-gray-200 break-all">{sso.callbackUrl}</code>
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <label className="block text-xs text-gray-400 sm:col-span-2">
                              Issuer address
                              <input className={`${inputClass} mt-1`} placeholder="https://login.example.com" value={ssoForm.issuer} onChange={(e) => setSsoForm({ ...ssoForm, issuer: e.target.value })} />
                            </label>
                            <label className="block text-xs text-gray-400">
                              Client id
                              <input className={`${inputClass} mt-1`} value={ssoForm.clientId} onChange={(e) => setSsoForm({ ...ssoForm, clientId: e.target.value })} />
                            </label>
                            <label className="block text-xs text-gray-400">
                              Client secret {sso.hasClientSecret && <span className="text-gray-500">(saved; type a new one to replace it)</span>}
                              <input className={`${inputClass} mt-1`} type="password" autoComplete="off" value={ssoForm.clientSecret} onChange={(e) => setSsoForm({ ...ssoForm, clientSecret: e.target.value })} />
                            </label>
                            <label className="block text-xs text-gray-400 sm:col-span-2">
                              Your email domains, separated by commas
                              <input className={`${inputClass} mt-1`} placeholder="example.com" value={ssoForm.emailDomains} onChange={(e) => setSsoForm({ ...ssoForm, emailDomains: e.target.value })} />
                            </label>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button className={primary} disabled={busy === "sso"} onClick={() => saveSso()}>
                              Save
                            </button>
                            <button className={quiet} disabled={busy === "sso" || sso.emailDomains.length === 0} onClick={checkDomains}>
                              Check domains
                            </button>
                            <button className={quiet} disabled={busy === "sso"} onClick={() => saveSso(!sso.enabled)}>
                              {sso.enabled ? "Switch single sign-on off" : "Switch single sign-on on"}
                            </button>
                          </div>
                          {sso.dnsRecord && (
                            <div className="text-xs text-gray-400">
                              To prove a domain is yours, add this as a TXT record on it, then press "Check domains":
                              <code className="block mt-1 px-2 py-1 bg-black/40 rounded text-gray-200 break-all">{sso.dnsRecord}</code>
                              <p className="mt-2">
                                Verified: <span className="text-white">{sso.verifiedDomains.length ? sso.verifiedDomains.join(", ") : "none yet"}</span>. Only addresses at verified domains can sign in this way.
                              </p>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </>
              )}
            </section>
          </div>
        )}
      </main>

      <ConfirmModal
        isOpen={Boolean(removing)}
        title={removing && String(removing.userId) === String(me?.id) ? "Leave this team?" : "Remove this person?"}
        message={
          removing
            ? `${removing.name || removing.email} will lose access to everything in ${details?.name}. Documents and templates they made here stay with the team and pass to its owner.`
            : ""
        }
        confirmText={removing && String(removing.userId) === String(me?.id) ? "Leave" : "Remove"}
        onCancel={() => setRemoving(null)}
        onConfirm={async () => {
          const member = removing;
          setRemoving(null);
          const leaving = String(member.userId) === String(me?.id);
          await run("remove", () => removeWorkspaceMemberApi(selectedId, member.userId), leaving ? "You have left the team" : "Removed");
          if (leaving) {
            if (getActiveWorkspaceId() === selectedId) setActiveWorkspaceId("");
            setSelectedId("");
            await loadAll();
          }
        }}
      />

      {buyingSeats > 0 && businessPlan && (
        <PlanCheckout
          open
          plans={subscription.catalogue.plans.filter((p) => p.purchasable && (p.id === businessPlan.id || p.yearlyOf === businessPlan.id))}
          planId={businessPlan.id}
          seats={buyingSeats}
          chooseSeats
          maxSeats={subscription?.catalogue?.maxSeats}
          gstRatePercent={subscription?.catalogue?.gstRatePercent}
          addOns={subscription?.catalogue?.topups || []}
          onClose={() => setBuyingSeats(0)}
          onDone={async (outcome) => {
            setBuyingSeats(0);
            // Not confirmed yet: the provider's own notice reaches the server a moment later
            if (outcome === "processing") await new Promise((resolve) => setTimeout(resolve, 2500));
            await loadAll();
          }}
        />
      )}
    </div>
  );
}
