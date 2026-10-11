import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useSelector } from "react-redux";
import toast, { Toaster } from "react-hot-toast";
import { describeInvitationApi, acceptInvitationApi } from "../api/workspace.api";
import { setActiveWorkspaceId, ROLE_LABELS } from "../utils/workspace";
import { withNext } from "../utils/nextPath";

/**
 * The page an invitation email leads to (plan task P5-04). It says which team the invitation
 * is for. Someone with no account signs up first and is brought back here to accept.
 */
export default function InviteAccept() {
  const { token } = useParams();
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
      window.location.assign("/dashboard");
    } catch (err) {
      toast.error(err.response?.data?.message || "The invitation could not be accepted");
      setBusy(false);
    }
  };

  const wrongAccount = user && invitation && String(user.email).toLowerCase() !== invitation.email;

  return (
    <div className="min-h-screen bg-[#08090d] text-gray-100 flex items-center justify-center p-4">
      <Toaster position="top-right" />
      <div className="max-w-md w-full bg-[#12141c] border border-white/10 rounded-2xl p-8 space-y-5 text-center" data-testid="invitation">
        <p className="text-lg font-black text-white">
          Pact<span className="text-red-500">Doc</span>
        </p>

        {problem ? (
          <>
            <h1 className="text-xl font-black text-white">This invitation cannot be used</h1>
            <p className="text-sm text-gray-400">{problem}</p>
            <Link to="/" className="inline-block text-sm font-bold text-red-400 hover:text-red-300">
              Go to the home page
            </Link>
          </>
        ) : !invitation ? (
          <div className="w-8 h-8 mx-auto border-4 border-white/10 border-t-red-600 rounded-full animate-spin" />
        ) : (
          <>
            <h1 className="text-xl font-black text-white">Join {invitation.workspaceName}</h1>
            <p className="text-sm text-gray-400">
              You have been invited as {invitation.role === "admin" ? "an" : "a"} <span className="text-white font-bold">{ROLE_LABELS[invitation.role]?.toLowerCase()}</span>. The invitation was sent to{" "}
              <span className="text-white font-bold">{invitation.email}</span>.
            </p>

            {!user ? (
              <div className="space-y-3">
                <Link
                  to={withNext(invitation.hasAccount ? "/login" : "/register", here)}
                  className="block w-full px-4 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-bold"
                >
                  {invitation.hasAccount ? "Sign in to accept" : "Create an account to accept"}
                </Link>
                <Link to={withNext(invitation.hasAccount ? "/register" : "/login", here)} className="block text-xs text-gray-400 hover:text-white">
                  {invitation.hasAccount ? "Create an account instead" : "I already have an account"}
                </Link>
              </div>
            ) : wrongAccount ? (
              <p className="text-sm text-amber-300">
                You are signed in as {user.email}. Sign out and sign in as {invitation.email} to accept this invitation.
              </p>
            ) : (
              <button onClick={accept} disabled={busy} className="w-full px-4 py-3 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white rounded-xl text-sm font-bold">
                {busy ? "Joining…" : `Join ${invitation.workspaceName}`}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
