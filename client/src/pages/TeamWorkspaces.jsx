import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import toast, { Toaster } from "react-hot-toast";
import Navbar from "../components/Navbar";
import ConfirmModal from "../components/ConfirmModal";
import ContactSales from "../components/ContactSales";
import PlanCheckout from "../components/PlanCheckout";
import { BTN, PANEL, ICONS } from "../components/billing/theme";
import { Note, Spinner } from "../components/billing/ui";
import { TeamHeader, TeamNav } from "../components/team/TeamChrome";
import TeamOverview from "../components/team/TeamOverview";
import TeamPeople from "../components/team/TeamPeople";
import TeamBranding from "../components/team/TeamBranding";
import TeamSecurity from "../components/team/TeamSecurity";
import TeamActivity from "../components/team/TeamActivity";
import NoTeam, { CreateTeamForm } from "../components/team/NoTeam";
import { loadWorkspaces } from "../store/workspaceActions";
import {
  createWorkspaceApi,
  fetchWorkspaceApi,
  fetchWorkspaceActivityApi,
  updateWorkspaceApi,
  inviteWorkspaceMemberApi,
  revokeInvitationApi,
  resendInvitationApi,
  remindTwoFactorApi,
  changeMemberRoleApi,
  removeWorkspaceMemberApi,
  fetchSsoSettingsApi,
  saveSsoSettingsApi,
  verifySsoDomainsApi,
} from "../api/workspace.api";
import { fetchUserSubscription } from "../api/billing.api";
import { payFor } from "../utils/checkout";
import { offersOf, offerOf, savingOn } from "../utils/plans";
import { getActiveWorkspaceId, setActiveWorkspaceId } from "../utils/workspace";
import { messageOf } from "../utils/team";

/**
 * Team workspaces (plan tasks P5-04 to P5-09, P5-11, P6-12, P6-15): who is in a team and what
 * each may do, how its documents look to signers, the rules it sets for its members, and what
 * has happened in it lately. Each part is a page of its own, chosen with `?tab=`; the parts
 * are in components/team/, and everything they change goes through here.
 */

const TABS = ["overview", "people", "branding", "security", "activity"];

export default function TeamWorkspaces() {
  const dispatch = useDispatch();
  const me = useSelector((state) => state.auth.user);
  const [params, setParams] = useSearchParams();
  const tab = TABS.includes(params.get("tab")) ? params.get("tab") : "overview";

  const [workspaces, setWorkspaces] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [selectedId, setSelectedId] = useState("");
  const [details, setDetails] = useState(null);
  const [failed, setFailed] = useState(false);
  const [activity, setActivity] = useState(null);
  const [sso, setSso] = useState(null);
  const [busy, setBusy] = useState("");
  const [removing, setRemoving] = useState(null);
  const [creating, setCreating] = useState(false);
  const [askingSales, setAskingSales] = useState(false);
  // How many seats the checkout step for the Business plan opens with, while it is open
  const [buyingSeats, setBuyingSeats] = useState(0);

  const teams = (workspaces || []).filter((w) => !w.personal);
  // The team requires two-step sign-in and the person does not have it: they can see the team and
  // leave it, and the server refuses everything else until they set it up
  const locked = Boolean(details?.policy?.requireTwoFactor && !details?.twoFactorReady);
  const canManage = ["owner", "admin"].includes(details?.role) && !locked;
  const isOwner = details?.role === "owner";
  const plans = subscription?.catalogue?.plans || [];
  const plan = plans.find((p) => p.id === subscription?.subscription?.plan);
  const mayCreate = Boolean(subscription?.entitlements?.features?.workspaces ?? ["business", "enterprise"].includes(plan?.tier));
  const businessPlan = plans.find((p) => p.perSeat && p.purchasable);
  const enterprisePlan = plans.find((p) => p.tier === "enterprise" && !p.yearlyOf);

  // The Business price as the no-team page shows it: by the month, billed yearly where it can be
  const businessOffer = businessPlan ? offerOf(offersOf(plans), businessPlan.id) : null;
  const saving = businessOffer ? savingOn(businessOffer) : null;
  const businessPrice = businessPlan ? { perMonth: saving ? saving.perMonthInr : businessPlan.priceInr, monthly: businessPlan.priceInr, yearly: Boolean(saving) } : null;

  const setTab = (id) => setParams((old) => {
    const next = new URLSearchParams(old);
    if (id === "overview") next.delete("tab");
    else next.set("tab", id);
    return next;
  });

  const loadDetails = useCallback(async (id) => {
    if (!id) return;
    try {
      setDetails(await fetchWorkspaceApi(id));
      setFailed(false);
    } catch (err) {
      toast.error(messageOf(err, "The team could not be loaded"));
      setFailed(true);
    }
  }, []);

  // Read afresh through the store, so the navbar's switcher shows a team made or left here at once
  const loadAll = useCallback(async () => {
    const [list, sub] = await Promise.all([dispatch(loadWorkspaces({ force: true })).catch(() => []), fetchUserSubscription().catch(() => null)]);
    setWorkspaces(list || []);
    setSubscription(sub);
    const teamList = (list || []).filter((w) => !w.personal);
    const first = teamList.find((w) => String(w.id) === getActiveWorkspaceId()) || teamList[0];
    setSelectedId((current) => (current && teamList.some((w) => String(w.id) === current) ? current : first ? String(first.id) : ""));
  }, [dispatch]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    loadDetails(selectedId);
  }, [selectedId, loadDetails]);

  // The feed is read when a page that shows it is opened; single sign-on when the owner opens Security
  useEffect(() => {
    if (!selectedId || details?.id === undefined || String(details.id) !== selectedId || locked) return;
    if ((tab === "overview" || tab === "activity") && activity === null) {
      fetchWorkspaceActivityApi(selectedId)
        .then(setActivity)
        .catch(() => setActivity([]));
    }
    if (tab === "security" && isOwner && sso === null) {
      fetchSsoSettingsApi(selectedId)
        .then(setSso)
        .catch((err) => setSso({ unavailable: messageOf(err, "Single sign-on is part of the Enterprise plan.") }));
    }
  }, [tab, selectedId, details, activity, sso, isOwner, locked]);

  const pick = (id) => {
    if (id === selectedId) return;
    setActivity(null);
    setSso(null);
    setDetails(null);
    setSelectedId(id);
  };

  // Runs one action, says what happened, and reads the team again. True when it worked.
  const run = async (name, work, done) => {
    setBusy(name);
    try {
      await work();
      if (done) toast.success(done);
      await loadDetails(selectedId);
      return true;
    } catch (err) {
      toast.error(messageOf(err, "That did not work. Please try again."));
      return false;
    } finally {
      setBusy("");
    }
  };

  const create = async (name) => {
    setBusy("create");
    try {
      const workspace = await createWorkspaceApi({ name });
      toast.success(`${workspace.name} is ready. Invite your team.`);
      setCreating(false);
      await loadAll();
      pick(String(workspace.id));
      setTab("people");
    } catch (err) {
      toast.error(messageOf(err, "The team could not be created"));
    } finally {
      setBusy("");
    }
  };

  const workIn = () => {
    setActiveWorkspaceId(String(details.id));
    window.location.assign("/dashboard");
  };

  // Goes to the invite form and puts the cursor in it
  const openInvite = () => {
    setTab("people");
    setTimeout(() => {
      const field = document.getElementById("invite-emails");
      field?.scrollIntoView({ block: "center", behavior: "smooth" });
      field?.focus({ preventScroll: true });
    }, 50);
  };

  const addSeat = async () => {
    setBusy("seats");
    try {
      const result = await payFor("seats", "1", { stay: true });
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

  // Sends each invitation in turn. Returns the addresses that could not be invited, to try again.
  const invite = async (emails, role) => {
    setBusy("invite");
    const failures = [];
    for (const email of emails) {
      try {
        await inviteWorkspaceMemberApi(selectedId, { email, role });
      } catch (err) {
        failures.push([email, messageOf(err, "could not be invited")]);
      }
    }
    const sent = emails.length - failures.length;
    if (sent) toast.success(sent === 1 ? "Invitation sent" : `${sent} invitations sent`);
    for (const [email, message] of failures) toast.error(`${email}: ${message}`);
    await loadDetails(selectedId);
    setBusy("");
    return failures.map(([email]) => email);
  };

  const saveSso = async (body) => {
    setBusy("sso");
    try {
      setSso(await saveSsoSettingsApi(selectedId, body));
      toast.success("Single sign-on settings saved");
      await loadDetails(selectedId);
      return true;
    } catch (err) {
      toast.error(messageOf(err, "The settings could not be saved"));
      return false;
    } finally {
      setBusy("");
    }
  };

  const checkDomains = async () => {
    setBusy("sso");
    try {
      const settings = await verifySsoDomainsApi(selectedId);
      setSso(settings);
      if (settings.verifiedDomains.length) toast.success(`Verified: ${settings.verifiedDomains.join(", ")}`);
      else toast.error("The record was not found yet. DNS changes can take a while to appear.");
    } catch (err) {
      toast.error(messageOf(err, "The domains could not be checked"));
    } finally {
      setBusy("");
    }
  };

  const section = details && {
    overview: (
      <TeamOverview
        team={details}
        usage={isOwner ? subscription?.usage : null}
        activity={activity}
        locked={locked}
        canManage={canManage}
        isOwner={isOwner}
        enterprise={plan?.tier === "enterprise"}
        onTab={setTab}
        onInvite={openInvite}
        onTalkToSales={() => setAskingSales(true)}
      />
    ),
    people: (
      <TeamPeople
        team={details}
        me={me}
        canManage={canManage}
        isOwner={isOwner}
        busy={busy}
        onRole={(member, role) => run("role", () => changeMemberRoleApi(selectedId, member.userId, role), "Role updated")}
        onRemove={setRemoving}
        onResend={(invitation) => run(`resend-${invitation.id}`, () => resendInvitationApi(selectedId, invitation.id), `Invitation sent again to ${invitation.email}`)}
        onRevoke={(invitation) => run(`revoke-${invitation.id}`, () => revokeInvitationApi(selectedId, invitation.id), "Invitation withdrawn")}
        onInvite={invite}
        onAddSeat={addSeat}
        onInviteClick={openInvite}
      />
    ),
    branding: <TeamBranding team={details} canManage={canManage} busy={busy} onSave={(branding) => run("brand", () => updateWorkspaceApi(selectedId, { branding }), "Branding saved")} />,
    security: (
      <TeamSecurity
        team={details}
        me={me}
        canManage={canManage}
        isOwner={isOwner}
        locked={locked}
        busy={busy}
        sso={sso}
        onSave={(changes, done) => run("rules", () => updateWorkspaceApi(selectedId, changes), done)}
        onRemind={(member) => run(`remind-${member.userId}`, () => remindTwoFactorApi(selectedId, member.userId), `Reminder sent to ${member.name || member.email}`)}
        onSaveSso={saveSso}
        onCheckDomains={checkDomains}
        onTalkToSales={() => setAskingSales(true)}
      />
    ),
    activity: <TeamActivity team={details} activity={activity} locked={locked} />,
  }[tab];

  return (
    <div className="min-h-screen bg-[#08090d] text-gray-100">
      <Toaster position="top-right" />
      <Navbar />
      <main className="max-w-[1320px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {workspaces === null ? (
          <Spinner className="w-8 h-8" />
        ) : teams.length === 0 ? (
          <NoTeam mayCreate={mayCreate} busy={busy} onCreate={create} price={businessPrice} canBuy={Boolean(businessPlan && subscription?.billingEnabled)} onBuy={() => setBuyingSeats(3)} />
        ) : failed && !details ? (
          <div className={`${PANEL} p-6`}>
            <p className="text-sm text-gray-300">This team could not be loaded.</p>
            <button type="button" className={`${BTN.secondary} mt-4`} onClick={() => loadDetails(selectedId)}>
              Try again
            </button>
          </div>
        ) : !details ? (
          <Spinner className="w-8 h-8" />
        ) : (
          <>
            <TeamHeader team={details} teams={teams} onPick={pick} mayCreate={mayCreate} onNewTeam={() => setCreating(true)} onWorkIn={workIn} planName={isOwner ? plan?.name : null} />
            {details.status === "read_only" && (
              <Note tone="amber" icon="alert" className="mt-4">
                This team is read-only because its plan has lapsed. Documents can be read and downloaded; nothing new can be sent until the owner renews.
              </Note>
            )}
            {locked && (
              <Note tone="amber" icon="alert" className="mt-4" testId="team-two-factor-locked">
                This team requires two-step sign-in. Switch it on for your account to open the team&apos;s documents, templates and activity.{" "}
                <Link to="/settings" className="font-black underline">
                  Set it up
                </Link>
              </Note>
            )}
            <div className="mt-6 grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)] items-start">
              <div className="lg:sticky lg:top-24 min-w-0">
                <TeamNav tab={tab} onTab={setTab} team={details} isOwner={isOwner} />
              </div>
              <div className="min-w-0" key={details.id}>
                {section}
              </div>
            </div>
          </>
        )}
      </main>

      <ConfirmModal
        isOpen={Boolean(removing)}
        title={removing && String(removing.userId) === String(me?.id) ? "Leave this team?" : "Remove this person?"}
        message={removing ? `${removing.name || removing.email} will lose access to everything in ${details?.name}. Documents and templates they made here stay with the team and pass to its owner.` : ""}
        confirmText={removing && String(removing.userId) === String(me?.id) ? "Leave" : "Remove"}
        onCancel={() => setRemoving(null)}
        onConfirm={async () => {
          const member = removing;
          setRemoving(null);
          const leaving = String(member.userId) === String(me?.id);
          const left = await run("remove", () => removeWorkspaceMemberApi(selectedId, member.userId), leaving ? "You have left the team" : "Removed");
          if (left && leaving) {
            if (getActiveWorkspaceId() === selectedId) setActiveWorkspaceId("");
            setDetails(null);
            setActivity(null);
            setSso(null);
            setSelectedId("");
            await loadAll();
          }
        }}
      />

      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md" role="dialog" aria-modal="true" aria-labelledby="new-team-h" onKeyDown={(e) => e.key === "Escape" && setCreating(false)}>
          <div className={`${PANEL} w-full max-w-md p-6 !shadow-[8px_8px_0px_0px_#a855f7]`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="new-team-h" className="text-xl font-black uppercase text-white">
                  New team
                </h2>
                <p className="mt-1 text-sm text-gray-400">Its documents, templates and rules are kept apart from your other teams.</p>
              </div>
              <button type="button" className={BTN.ghost} aria-label="Close" onClick={() => setCreating(false)}>
                <ICONS.close className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-5">
              <CreateTeamForm busy={busy} onCreate={create} autoFocus />
            </div>
          </div>
        </div>
      )}

      {askingSales && <ContactSales open plan={enterprisePlan} user={me} onClose={() => setAskingSales(false)} />}

      {buyingSeats > 0 && businessPlan && (
        <PlanCheckout
          open
          plans={plans.filter((p) => p.purchasable && (p.id === businessPlan.id || p.yearlyOf === businessPlan.id))}
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
