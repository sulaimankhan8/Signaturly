import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import toast, { Toaster } from "react-hot-toast";
import { describeInvitationApi, acceptInvitationApi } from "../api/workspace.api";
import { loadWorkspaces } from "../store/workspaceActions";
import { setActiveWorkspaceId, ROLE_LABELS } from "../utils/workspace";
import { withNext } from "../utils/nextPath";
import { BTN, ICONS } from "../components/billing/theme";
import { Spinner } from "../components/billing/ui";
import { TeamMark } from "../components/team/parts";
import BrandGlyph from "../components/BrandGlyph";
import { isHex, dateOf } from "../utils/team";

/**
 * The page an invitation email leads to (plan task P5-04). It shows the team in its own name
 * and colours, who asked, and what the role allows. Someone with no account signs up first
 * and is brought back here to accept.
 */

// What each role allows, in the words of the role table on the team's People page
const ROLE_CAN = {
  admin: ["Send documents in the team's name", "Manage the team's templates, people and settings", "See the team's documents and activity"],
  member: ["Send documents in the team's name", "Use the team's templates", "See the team's documents and activity"],
  viewer: ["Read the team's documents", "See the team's activity"],
};

const ROLE_CHIP = { admin: "bg-red-600 text-white", member: "bg-blue-600 text-white", viewer: "bg-[#374151] text-white" };

export default function InviteAccept() {
  const { token } = useParams();
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const [invitation, setInvitation] = useState(null);
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);
  const here = `/invite/${token}`;

  useEffect(() => {
    describeInvitationApi(token)
      .then(setInvitation)
      .catch((err) => setProblem(err.response?.data?.message || "This invitation is no longer valid. Ask for a new one."));
  }, [token]);

  const accept = async () => {
    setBusy(true);
    try {
      const workspace = await acceptInvitationApi(token);
      setActiveWorkspaceId(String(workspace.id));
      toast.success(`You have joined ${workspace.name}`);
      // So the dashboard opens with the new team already in the navbar's switcher
      await dispatch(loadWorkspaces({ force: true })).catch(() => {});
      window.location.assign("/dashboard");
    } catch (err) {
      toast.error(err.response?.data?.message || "The invitation could not be accepted");
      setBusy(false);
    }
  };

  const wrongAccount = user && invitation && String(user.email).toLowerCase() !== invitation.email;
  const accent = isHex(invitation?.branding?.primaryColor) ? invitation.branding.primaryColor : "#0f766e";
  const role = invitation?.role;
  const article = role === "admin" ? "an" : "a";

  return (
    <div className="min-h-screen bg-[#08090d] text-gray-100 flex flex-col items-center px-4 py-12">
      <Toaster position="top-right" />
      <p className="flex items-center gap-3 text-2xl font-black text-white">
        <span className="w-10 h-10 grid place-items-center rounded-xl bg-red-600 border-2 border-black shadow-[2px_2px_0px_0px_#ffffff]" aria-hidden="true">
          <BrandGlyph className="w-7 h-7" />
        </span>
        <span>
          Pact<span className="text-red-500">Doc</span>
        </span>
      </p>

      <main
        className="mt-7 w-full max-w-[30rem] bg-[#13151f] border-2 rounded-2xl overflow-hidden"
        style={{ borderColor: problem ? "rgba(255,255,255,0.2)" : accent, boxShadow: `6px 6px 0 0 ${problem ? "#ef4444" : accent}` }}
        data-testid="invitation"
      >
        {problem ? (
          <div className="p-7 text-center">
            <span className="w-14 h-14 mx-auto grid place-items-center rounded-2xl border-2 border-black bg-red-600 text-white shadow-[3px_3px_0px_0px_#000]" aria-hidden="true">
              <ICONS.alert className="w-7 h-7" />
            </span>
            <h1 className="mt-4 text-xl font-black uppercase text-white">This invitation cannot be used</h1>
            <p className="mt-2 text-sm text-gray-400">{problem}</p>
            <Link to="/" className="inline-block mt-5 text-sm font-black text-red-400 hover:text-red-300">
              Go to the home page
            </Link>
          </div>
        ) : !invitation ? (
          <div className="p-10 grid place-items-center">
            <Spinner className="w-8 h-8" />
          </div>
        ) : (
          <>
            <div className="px-7 pt-7 text-center">
              <span className="inline-block">
                <TeamMark team={{ name: invitation.branding?.companyName || invitation.workspaceName, branding: { ...invitation.branding, primaryColor: accent } }} size="w-[72px] h-[72px] text-2xl rounded-2xl" />
              </span>
              <p className="mt-4 text-sm text-gray-400">
                {invitation.inviterName ? (
                  <>
                    <strong className="text-white">{invitation.inviterName}</strong> invited you to join
                  </>
                ) : (
                  "You have been invited to join"
                )}
              </p>
              <h1 className="mt-1 text-3xl font-black uppercase leading-tight text-white break-words">{invitation.workspaceName}</h1>
              <p className="mt-2">
                <span className={`inline-block px-2 py-0.5 rounded-md border-2 border-black text-[10px] font-black uppercase tracking-wider ${ROLE_CHIP[role] || ROLE_CHIP.member}`}>
                  As {article} {ROLE_LABELS[role]?.toLowerCase() || role}
                </span>
              </p>
            </div>

            {ROLE_CAN[role] && (
              <div className="mx-7 mt-5 p-4 rounded-xl bg-[#0f1118] border-2 border-white/10">
                <p className="text-[11px] font-black uppercase tracking-wider text-gray-400">
                  As {article} {ROLE_LABELS[role]?.toLowerCase()} you can
                </p>
                <ul className="mt-2 grid gap-1.5 text-sm">
                  {ROLE_CAN[role].map((line) => (
                    <li key={line} className="flex gap-2">
                      <ICONS.check className="w-4 h-4 mt-0.5 shrink-0 text-emerald-400" />
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="p-7">
              {!user ? (
                <>
                  <Link to={withNext(invitation.hasAccount ? "/login" : "/register", here)} className={`${BTN.primary} w-full min-h-[50px]`}>
                    {invitation.hasAccount ? "Sign in to accept" : "Create an account to accept"}
                  </Link>
                  <Link to={withNext(invitation.hasAccount ? "/register" : "/login", here)} className="block mt-3 text-center text-xs font-bold text-gray-400 hover:text-white">
                    {invitation.hasAccount ? "Create an account instead" : "I already have an account"}
                  </Link>
                </>
              ) : wrongAccount ? (
                <p className="p-3 rounded-xl border-2 border-yellow-400/60 bg-yellow-400/[0.07] text-sm text-yellow-50">
                  You are signed in as <strong>{user.email}</strong>. Sign out and sign in as <strong>{invitation.email}</strong> to accept this invitation.
                </p>
              ) : (
                <button type="button" onClick={accept} disabled={busy} className={`${BTN.primary} w-full min-h-[50px]`}>
                  {busy ? "Joining…" : `Join ${invitation.workspaceName}`}
                </button>
              )}
              <p className="mt-4 text-xs text-center text-gray-400">
                Sent to {invitation.email}
                {invitation.expiresAt && ` · expires ${dateOf(invitation.expiresAt)}`} · costs you nothing: the team pays
              </p>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
