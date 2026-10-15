import { useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import ConfirmModal from "../ConfirmModal";
import { BTN, PANEL, INPUT, LABEL, ICONS } from "../billing/theme";
import { Pill, Spinner } from "../billing/ui";
import { Avatar, Toggle, SectionHead, ReadOnlyNote } from "./parts";
import { ROLE_LABELS } from "../../utils/workspace";
import { KEEP_CHOICES, keepChoiceOf } from "../../utils/team";

/**
 * The rules everyone in a team works under: two-step sign-in, single sign-on (Enterprise, set
 * up by the owner), how long finished documents are kept, and which sites may show its
 * signing pages inside their own.
 */

const copy = (text) =>
  navigator.clipboard
    .writeText(text)
    .then(() => toast.success("Copied"))
    .catch(() => toast.error("Could not copy. Select the text and copy it instead."));

const CopyLine = ({ text }) => (
  <div className="mt-2 flex flex-wrap items-center gap-2 p-2 pl-3 rounded-xl bg-[#090a0f] border-2 border-white/15">
    <code className="flex-1 min-w-0 text-xs text-gray-200 break-all">{text}</code>
    <button type="button" className={BTN.small} onClick={() => copy(text)}>
      <ICONS.copy className="w-3.5 h-3.5" /> Copy
    </button>
  </div>
);

const Step = ({ n, title, children }) => (
  <li className="p-4 rounded-xl border-2 border-white/10 bg-[#0f1118]">
    <p className="flex items-center gap-2.5 font-black uppercase text-white text-sm">
      <span className="w-6 h-6 grid place-items-center rounded-md border-2 border-black bg-yellow-400 text-black text-xs" aria-hidden="true">
        {n}
      </span>
      {title}
    </p>
    <div className="mt-2 text-sm text-gray-400">{children}</div>
  </li>
);

function SingleSignOn({ team, isOwner, locked, sso, busy, onSave, onCheck, onTalkToSales }) {
  const [form, setForm] = useState(() => ({ issuer: sso?.issuer || "", clientId: sso?.clientId || "", clientSecret: "", emailDomains: (sso?.emailDomains || []).join(", ") }));

  const save = async (enabled) => {
    const body = {
      issuer: form.issuer.trim(),
      clientId: form.clientId.trim(),
      emailDomains: form.emailDomains.split(/[\s,]+/).filter(Boolean),
      ...(form.clientSecret ? { clientSecret: form.clientSecret } : {}),
      ...(enabled === undefined ? {} : { enabled }),
    };
    if (await onSave(body)) setForm((f) => ({ ...f, clientSecret: "" }));
  };

  const head = (
    <div className="flex flex-wrap items-start gap-3">
      <span className="w-10 h-10 shrink-0 grid place-items-center rounded-xl border-2 border-black bg-blue-600 text-white" aria-hidden="true">
        <ICONS.lock className="w-5 h-5" />
      </span>
      <div className="flex-1 min-w-0">
        <h3 className="flex flex-wrap items-center gap-2 text-base font-black uppercase text-white">
          Single sign-on {team.sso?.enabled ? <Pill tone="green">On</Pill> : <Pill>Off</Pill>}
        </h3>
        <p className="text-sm text-gray-400">People at your organisation sign in with your company login, such as Google Workspace, Microsoft Entra or Okta (OpenID Connect).</p>
      </div>
    </div>
  );

  if (!isOwner) {
    return (
      <section className={`${PANEL} p-5`}>
        {head}
        <p className="mt-3 text-xs font-bold text-gray-400">Only the team&apos;s owner can set up single sign-on.</p>
      </section>
    );
  }
  if (locked) {
    return (
      <section className={`${PANEL} p-5`}>
        {head}
        <p className="mt-3 text-xs font-bold text-gray-400">Set up two-step sign-in for your account to manage single sign-on.</p>
      </section>
    );
  }
  if (sso === null) {
    return (
      <section className={`${PANEL} p-5`}>
        {head}
        <Spinner className="w-5 h-5 mt-3" />
      </section>
    );
  }
  if (sso.unavailable) {
    return (
      <section className={`${PANEL} p-5`}>
        {head}
        <div className="mt-4 flex flex-wrap items-center gap-3 p-3 rounded-xl border-2 border-blue-500/60 bg-blue-500/[0.08]">
          <Pill tone="blue">Enterprise</Pill>
          <span className="flex-1 min-w-[12rem] text-sm text-blue-50">{sso.unavailable}</span>
          <button type="button" className={BTN.small} onClick={onTalkToSales}>
            Talk to sales
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className={`${PANEL} p-5`} data-testid="team-sso">
      {head}
      <ol className="mt-4 grid gap-3">
        <Step n="1" title="Connect your identity provider">
          Register this address in your identity provider as the place to send people back to:
          <CopyLine text={sso.callbackUrl} />
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="sso-issuer" className={LABEL}>
                Issuer address
              </label>
              <input id="sso-issuer" className={INPUT} placeholder="https://login.example.com" value={form.issuer} onChange={(e) => setForm({ ...form, issuer: e.target.value })} />
            </div>
            <div>
              <label htmlFor="sso-client" className={LABEL}>
                Client id
              </label>
              <input id="sso-client" className={INPUT} value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })} />
            </div>
            <div>
              <label htmlFor="sso-secret" className={LABEL}>
                Client secret {sso.hasClientSecret && <span className="normal-case font-bold text-gray-500">(saved; type a new one to replace it)</span>}
              </label>
              <input id="sso-secret" className={INPUT} type="password" autoComplete="off" value={form.clientSecret} onChange={(e) => setForm({ ...form, clientSecret: e.target.value })} />
            </div>
          </div>
        </Step>

        <Step n="2" title="Prove your email domain is yours">
          <label htmlFor="sso-domains" className={`${LABEL} mt-1`}>
            Your email domains, separated by commas
          </label>
          <input id="sso-domains" className={INPUT} placeholder="example.com" value={form.emailDomains} onChange={(e) => setForm({ ...form, emailDomains: e.target.value })} />
          <div className="mt-3">
            <button type="button" className={BTN.secondary} disabled={busy === "sso"} onClick={() => save()}>
              {busy === "sso" ? "Saving…" : "Save these settings"}
            </button>
          </div>
          {sso.dnsRecord && (
            <>
              <p className="mt-4">Add this as a TXT record on each domain, then check. Only addresses at verified domains can sign in this way.</p>
              <CopyLine text={sso.dnsRecord} />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {(sso.emailDomains || []).map((domain) => (
                  <Pill key={domain} tone={sso.verifiedDomains.includes(domain) ? "green" : "gray"}>
                    {domain} · {sso.verifiedDomains.includes(domain) ? "verified" : "not verified"}
                  </Pill>
                ))}
                <button type="button" className={BTN.small} disabled={busy === "sso" || !sso.emailDomains?.length} onClick={onCheck}>
                  Check now
                </button>
              </div>
            </>
          )}
        </Step>

        <Step n="3" title="Switch it on for everyone">
          <p>Once on, people at your verified domains sign in through your identity provider.</p>
          <button type="button" className={`${sso.enabled ? BTN.secondary : BTN.primary} mt-3`} disabled={busy === "sso"} onClick={() => save(!sso.enabled)}>
            {sso.enabled ? "Switch single sign-on off" : "Switch single sign-on on"}
          </button>
        </Step>
      </ol>
    </section>
  );
}

export default function TeamSecurity({ team, me, canManage, isOwner, locked = false, busy, sso, onSave, onRemind, onSaveSso, onCheckDomains, onTalkToSales }) {
  const [asking, setAsking] = useState(false);
  const [keep, setKeep] = useState(() => keepChoiceOf(team.policy?.retentionDays));
  const [customDays, setCustomDays] = useState(() => (keepChoiceOf(team.policy?.retentionDays) === "custom" ? String(team.policy.retentionDays) : ""));
  const [origin, setOrigin] = useState("");

  const required = Boolean(team.policy?.requireTwoFactor);
  // Whoever requires it must have it themselves; the server refuses otherwise
  const mayRequire = required || Boolean(team.twoFactorReady);
  const missing = team.members.filter((m) => !m.twoFactor);
  const origins = team.allowedFrameOrigins || [];
  const readOnlyNote = locked ? "Set up two-step sign-in for your account to change this." : undefined;

  const chosenDays = keep === "custom" ? (customDays === "" ? NaN : Number(customDays)) : KEEP_CHOICES.find(([id]) => id === keep)?.[2] ?? null;
  const savedDays = team.policy?.retentionDays ?? null;
  const keepChanged = chosenDays !== savedDays;
  const keepValid = chosenDays === null || (Number.isInteger(chosenDays) && chosenDays >= 30 && chosenDays <= 3650);

  const setTwoStep = (on) => {
    // Turning it on locks out whoever has not set it up, so that is said first
    if (on && missing.length) setAsking(true);
    else onSave({ policy: { requireTwoFactor: on } }, on ? "Two-step sign-in is now required" : "Two-step sign-in is no longer required");
  };

  const addOrigin = async (event) => {
    event.preventDefault();
    const value = origin.trim();
    if (!value) return;
    if (await onSave({ allowedFrameOrigins: [...origins, value] }, "Website added")) setOrigin("");
  };

  return (
    <div className="grid gap-6">
      <SectionHead title="Security">The rules everyone in the team works under. Only the owner and admins can change them.</SectionHead>

      <section className={`${PANEL} p-5`}>
        <div className="flex flex-wrap items-start gap-3">
          <span className="w-10 h-10 shrink-0 grid place-items-center rounded-xl border-2 border-black bg-emerald-500 text-black" aria-hidden="true">
            <ICONS.shield className="w-5 h-5" />
          </span>
          <div className="flex-[1_1_260px] min-w-0">
            <h3 className="text-base font-black uppercase text-white">Require two-step sign-in</h3>
            <p className="text-sm text-gray-400">Everyone signs in with a code from an authenticator app as well as their password. Someone without it can open nothing in this team until they set it up.</p>
            {canManage && !mayRequire && (
              <p className="mt-1.5 text-xs font-bold text-yellow-300">
                Switch it on for your own account before requiring it of everyone.{" "}
                <Link to="/settings" className="underline">
                  Set it up
                </Link>
              </p>
            )}
          </div>
          <Toggle checked={required} onChange={setTwoStep} disabled={!canManage || !mayRequire || busy === "rules"} label="Require two-step sign-in" />
        </div>

        <div className="mt-4 pt-4 border-t-2 border-white/[0.06]">
          <p className="text-sm text-gray-300">
            {team.members.length - missing.length} of {team.members.length} {team.members.length === 1 ? "person has" : "people have"} it on.
            {missing.length > 0 && (required ? " Those below can open nothing in the team until they set it up." : " If you require it, those below will need to set it up first.")}
          </p>
          {missing.length > 0 && (
            <ul className="mt-3 grid gap-2">
              {missing.map((m) => {
                const isMe = String(m.userId) === String(me?.id);
                return (
                  <li key={m.userId} className="flex flex-wrap items-center gap-2.5">
                    <Avatar name={m.name} email={m.email} size="w-8 h-8 text-[11px]" />
                    <span className="flex-1 min-w-0 text-sm font-bold text-white truncate">
                      {m.name || m.email} <span className="font-medium text-gray-400">· {ROLE_LABELS[m.role]}</span>
                    </span>
                    {isMe ? (
                      <Link to="/settings" className={BTN.small}>
                        Set it up for yourself
                      </Link>
                    ) : (
                      canManage &&
                      m.role !== "owner" && (
                        <button type="button" className={BTN.small} disabled={busy === `remind-${m.userId}`} onClick={() => onRemind(m)}>
                          {busy === `remind-${m.userId}` ? "Sending…" : "Send a reminder"}
                        </button>
                      )
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <SingleSignOn key={sso ? "loaded" : "loading"} team={team} isOwner={isOwner} locked={locked} sso={sso} busy={busy} onSave={onSaveSso} onCheck={onCheckDomains} onTalkToSales={onTalkToSales} />

      <div className="grid gap-6 xl:grid-cols-2 items-start">
        <section className={`${PANEL} p-5`} data-testid="team-rules">
          <h3 className="text-base font-black uppercase text-white">Keep finished documents</h3>
          <p className="text-sm text-gray-400">After this, finished documents are erased. The record of who signed is always kept.</p>
          <div role="radiogroup" aria-label="Keep finished documents" className="mt-4 flex flex-wrap gap-2">
            {KEEP_CHOICES.map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={keep === id}
                disabled={!canManage}
                onClick={() => setKeep(id)}
                className={`min-h-[40px] px-3 rounded-lg border-2 text-[11px] font-black uppercase tracking-wider disabled:opacity-60 ${keep === id ? "bg-yellow-400 text-black border-black shadow-[2px_2px_0px_0px_#ef4444]" : "bg-[#0d0f16] text-gray-300 border-white/20 hover:border-white/40"}`}
              >
                {label}
              </button>
            ))}
          </div>
          {keep === "custom" && (
            <div className="mt-3">
              <label htmlFor="keep-days" className={LABEL}>
                Days, from 30 to 3,650
              </label>
              <input id="keep-days" type="number" min={30} max={3650} disabled={!canManage} className={`${INPUT} !w-40`} value={customDays} onChange={(e) => setCustomDays(e.target.value)} />
            </div>
          )}
          <p className="mt-3 text-xs text-gray-400">
            {chosenDays === null ? "Documents stay until someone deletes them." : keepValid ? `Finished documents are erased ${chosenDays.toLocaleString("en-IN")} days after they finish. This cannot be undone.` : "Choose between 30 and 3,650 days."}
          </p>
          {canManage ? (
            keepChanged && (
              <button type="button" className={`${BTN.primary} mt-4`} disabled={busy === "rules" || !keepValid} onClick={() => onSave({ policy: { retentionDays: chosenDays } }, "Saved")}>
                Save
              </button>
            )
          ) : (
            <div className="mt-3">
              <ReadOnlyNote>{readOnlyNote}</ReadOnlyNote>
            </div>
          )}
        </section>

        <section className={`${PANEL} p-5`}>
          <h3 className="text-base font-black uppercase text-white">Signing inside your own site</h3>
          <p className="text-sm text-gray-400">Signing pages appear inside these websites only, for embedded signing through the API. Every other site is refused.</p>
          {origins.length === 0 ? (
            <p className="mt-3 text-xs text-gray-400">No websites yet.</p>
          ) : (
            <ul className="mt-3 flex flex-wrap gap-2">
              {origins.map((o) => (
                <li key={o} className="inline-flex items-center gap-1.5 pl-2.5 pr-1 py-1 rounded-lg bg-[#1e2235] border-2 border-white/20 text-xs font-bold text-white max-w-full">
                  <span className="truncate font-mono">{o}</span>
                  {canManage && (
                    <button
                      type="button"
                      aria-label={`Remove ${o}`}
                      disabled={busy === "rules"}
                      className="w-6 h-6 grid place-items-center text-gray-400 hover:text-white"
                      onClick={() => onSave({ allowedFrameOrigins: origins.filter((x) => x !== o) }, "Website removed")}
                    >
                      <ICONS.close className="w-3 h-3" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {canManage ? (
            <form onSubmit={addOrigin} className="mt-4 flex flex-wrap gap-2">
              <label htmlFor="add-origin" className="sr-only">
                Add a website
              </label>
              <input id="add-origin" className={`${INPUT} flex-[1_1_200px] !w-auto font-mono`} placeholder="https://app.example.com" value={origin} onChange={(e) => setOrigin(e.target.value)} />
              <button type="submit" className={BTN.secondary} disabled={busy === "rules" || !origin.trim()}>
                Add
              </button>
            </form>
          ) : (
            <div className="mt-3">
              <ReadOnlyNote>{readOnlyNote}</ReadOnlyNote>
            </div>
          )}
        </section>
      </div>

      <ConfirmModal
        isOpen={asking}
        type="warning"
        title="Require two-step sign-in?"
        message={`${missing.length === 1 ? "1 person has" : `${missing.length} people have`} not set it up yet: ${missing.map((m) => m.name || m.email).join(", ")}. They will open nothing in this team until they do.`}
        confirmText="Require it"
        onCancel={() => setAsking(false)}
        onConfirm={() => {
          setAsking(false);
          onSave({ policy: { requireTwoFactor: true } }, "Two-step sign-in is now required");
        }}
      />
    </div>
  );
}
