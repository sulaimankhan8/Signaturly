import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import {
  fetchWorkspacesApi,
  createWorkspaceApi,
  inviteWorkspaceMemberApi,
  updateWorkspaceBrandingApi,
  removeWorkspaceMemberApi,
} from "../api/workspace.api";
import { fetchUserSubscription } from "../api/billing.api";
import ConfirmModal from "../components/ConfirmModal";
import { UpgradeModal } from "../components/UpgradeModal";
import toast, { Toaster } from "react-hot-toast";

export default function TeamWorkspaces() {
  const navigate = useNavigate();
  const user = useSelector((state) => state.auth.user);

  const [workspaces, setWorkspaces] = useState([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [subData, setSubData] = useState(null);
  const [confirmRemoveTarget, setConfirmRemoveTarget] = useState(null);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);

  // New Workspace form
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
  const [newWsName, setNewWsName] = useState("");

  // Invite member form
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [isInviting, setIsInviting] = useState(false);

  // Branding form
  const [brandCompanyName, setBrandCompanyName] = useState("");
  const [brandLogo, setBrandLogo] = useState("");
  const [brandColor, setBrandColor] = useState("#ef4444");
  const [brandFooterText, setBrandFooterText] = useState("");
  const [isSavingBranding, setIsSavingBranding] = useState(false);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [wsList, sub] = await Promise.all([
        fetchWorkspacesApi().catch(() => []),
        fetchUserSubscription().catch(() => null),
      ]);
      setWorkspaces(wsList || []);
      setSubData(sub);

      if (wsList && wsList.length > 0) {
        const active = wsList[0];
        setSelectedWorkspace(active);
        setBrandCompanyName(active.branding?.companyName || "");
        setBrandLogo(active.branding?.logo || "");
        setBrandColor(active.branding?.primaryColor || "#ef4444");
        setBrandFooterText(active.branding?.emailFooterText || "");
      }
    } catch (err) {
      console.error("Workspace load error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const isEnterprise = subData?.subscription?.plan === "enterprise";

  const handleCreateWorkspace = async (e) => {
    e.preventDefault();
    if (!newWsName.trim()) return;

    try {
      const created = await createWorkspaceApi({ name: newWsName });
      toast.success(`Workspace "${created.name}" created!`);
      setNewWsName("");
      setIsCreatingWorkspace(false);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create workspace");
    }
  };

  const handleInviteMember = async (e) => {
    e.preventDefault();
    if (!isEnterprise) {
      setUpgradeModalOpen(true);
      return;
    }
    if (!selectedWorkspace || !inviteEmail.trim()) return;

    try {
      setIsInviting(true);
      await inviteWorkspaceMemberApi(selectedWorkspace._id, {
        email: inviteEmail,
        role: inviteRole,
      });
      toast.success(`Invitation sent to ${inviteEmail}!`);
      setInviteEmail("");
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to invite member");
    } finally {
      setIsInviting(false);
    }
  };

  const handleSaveBranding = async (e) => {
    e.preventDefault();
    if (!isEnterprise) {
      setUpgradeModalOpen(true);
      return;
    }
    if (!selectedWorkspace) return;

    try {
      setIsSavingBranding(true);
      await updateWorkspaceBrandingApi(selectedWorkspace._id, {
        companyName: brandCompanyName,
        logo: brandLogo,
        primaryColor: brandColor,
        emailFooterText: brandFooterText,
      });
      toast.success("Workspace branding updated successfully!");
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save branding");
    } finally {
      setIsSavingBranding(false);
    }
  };

  const handleRemoveMember = (memberId, memberName) => {
    setConfirmRemoveTarget({ memberId, memberName });
  };

  const executeRemoveMember = async () => {
    if (!confirmRemoveTarget) return;
    try {
      await removeWorkspaceMemberApi(selectedWorkspace._id, confirmRemoveTarget.memberId);
      toast.success(`Member "${confirmRemoveTarget.memberName}" removed`);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to remove member");
    } finally {
      setConfirmRemoveTarget(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#08090d] text-white flex flex-col font-sans">
      <Navbar />
      <Toaster position="top-right" />

      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full space-y-5">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/40">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white">
                Team Workspaces &amp; White-Labeling
              </h1>
              <span className="text-[9px] font-mono font-black uppercase px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/40">
                Enterprise
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Collaborate with team members, set RBAC roles, and white-label signing interfaces with your company brand.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (!isEnterprise) {
                  setUpgradeModalOpen(true);
                } else {
                  setIsCreatingWorkspace(true);
                }
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span>+ Create Workspace</span>
              {!isEnterprise && (
                <span className="text-[9px] font-mono bg-black/40 px-1.5 py-0.5 rounded text-blue-200">
                  LOCKED
                </span>
              )}
            </button>
          </div>
        </div>

        {/* 1. If NOT on Enterprise AND NO existing workspaces: Render promotional locked screen */}
        {!isEnterprise && workspaces.length === 0 ? (
          <div className="bg-[#12141c] border-2 border-blue-500/40 rounded-2xl p-5 sm:p-6 text-center space-y-4 shadow-xl relative overflow-hidden">
            <div className="w-11 h-11 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center mx-auto border border-blue-500/40 shadow-inner">
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>

            <div className="max-w-xl mx-auto space-y-1.5">
              <span className="text-[9px] font-mono font-bold uppercase tracking-wider bg-blue-950 text-blue-300 px-2.5 py-0.5 rounded-full border border-blue-800">
                Enterprise Restricted Feature
              </span>
              <h2 className="text-lg sm:text-xl font-black text-white">
                Unlock Multi-Tenant Workspaces &amp; Custom White-Labeling
              </h2>
              <p className="text-xs text-gray-300 leading-relaxed">
                Your current plan (<strong className="text-yellow-400 font-mono uppercase">{subData?.subscription?.plan || "Free Starter"}</strong>) does not have access to Team Workspaces. Upgrade to the Enterprise Tier to invite team members, assign RBAC permissions, and white-label signing pages.
              </p>
            </div>

            {/* Enterprise Feature Highlights */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-left max-w-3xl mx-auto">
              <div className="bg-[#08090d] p-3.5 rounded-xl border border-white/10 space-y-1">
                <div className="w-6 h-6 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h4 className="font-bold text-white text-[11px] uppercase text-blue-400">Multi-User Workspaces</h4>
                <p className="text-[10px] text-gray-400 leading-tight">
                  Isolate documents, audit trails, and client files by department, client, or team seat.
                </p>
              </div>

              <div className="bg-[#08090d] p-3.5 rounded-xl border border-white/10 space-y-1">
                <div className="w-6 h-6 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                  </svg>
                </div>
                <h4 className="font-bold text-white text-[11px] uppercase text-blue-400">Custom Brand White-Label</h4>
                <p className="text-[10px] text-gray-400 leading-tight">
                  Upload your corporate logo, primary brand theme colors, and custom compliance disclaimers.
                </p>
              </div>

              <div className="bg-[#08090d] p-3.5 rounded-xl border border-white/10 space-y-1">
                <div className="w-6 h-6 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h4 className="font-bold text-white text-[11px] uppercase text-blue-400">Granular RBAC Permissions</h4>
                <p className="text-[10px] text-gray-400 leading-tight">
                  Assign Owner, Admin, Manager, and Signer roles with seat-level audit oversight.
                </p>
              </div>
            </div>

            {/* Action CTA */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setUpgradeModalOpen(true)}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-blue-950/60 transition-all cursor-pointer transform hover:-translate-y-0.5"
              >
                <svg className="w-3.5 h-3.5 fill-current text-white" viewBox="0 0 20 20">
                  <path d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.381z" />
                </svg>
                <span>Upgrade to Enterprise ($14.99/seat) →</span>
              </button>
              <button
                type="button"
                onClick={() => navigate("/dashboard")}
                className="w-full sm:w-auto px-5 py-2.5 bg-white/10 hover:bg-white/20 text-gray-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        ) : (
          /* 2. UNLOCKED / READ-ONLY WORKSPACES INTERFACE */
          <div className="space-y-6">
            {/* Read-Only Notice if downgraded */}
            {!isEnterprise && (
              <div className="bg-amber-950/40 border-2 border-amber-500/40 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center justify-center shrink-0 font-bold text-xs">
                    !
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-white uppercase tracking-wider">
                      Workspace in Read-Only Mode (Enterprise Inactive)
                    </h3>
                    <p className="text-[11px] text-gray-300">
                      Your workspaces are saved. You can view configurations and remove members. Upgrade to Enterprise to invite new members and white-label contracts.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setUpgradeModalOpen(true)}
                  className="px-4 py-1.5 bg-amber-400 hover:bg-amber-300 text-black font-black text-xs uppercase tracking-wider rounded-xl border border-black shadow-[2px_2px_0px_0px_#000] cursor-pointer whitespace-nowrap"
                >
                  Renew Enterprise
                </button>
              </div>
            )}
            {/* Create Workspace Modal / Form */}
            {isCreatingWorkspace && (
              <div className="bg-[#12141c] border-2 border-white/20 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">
                    Create New Organization Workspace
                  </h3>
                  <button
                    onClick={() => setIsCreatingWorkspace(false)}
                    className="text-gray-400 hover:text-white text-sm cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
                <form onSubmit={handleCreateWorkspace} className="flex gap-3">
                  <input
                    type="text"
                    required
                    placeholder="e.g. Acme Legal Corp, Sales Team..."
                    value={newWsName}
                    onChange={(e) => setNewWsName(e.target.value)}
                    className="flex-1 bg-[#08090d] border border-white/10 rounded-xl px-4 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 font-medium"
                  />
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl cursor-pointer"
                  >
                    Save Workspace
                  </button>
                </form>
              </div>
            )}

            {/* Main Content Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left: Workspace Selector & Team Members */}
              <div className="space-y-6">
                <div className="bg-[#12141c] rounded-3xl p-6 border-2 border-white/10 space-y-4">
                  <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider">
                    Your Workspaces ({workspaces.length})
                  </h3>

                  {workspaces.length === 0 ? (
                    <div className="text-center py-6 text-gray-500 text-xs">
                      No organization workspaces created yet. Click "+ Create Workspace" above.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {workspaces.map((ws) => (
                        <div
                          key={ws._id}
                          onClick={() => {
                            setSelectedWorkspace(ws);
                            setBrandCompanyName(ws.branding?.companyName || "");
                            setBrandLogo(ws.branding?.logo || "");
                            setBrandColor(ws.branding?.primaryColor || "#ef4444");
                            setBrandFooterText(ws.branding?.emailFooterText || "");
                          }}
                          className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                            selectedWorkspace?._id === ws._id
                              ? "bg-blue-950/40 border-blue-500 text-white shadow-md"
                              : "bg-[#08090d] border-white/10 text-gray-300 hover:border-white/30"
                          }`}
                        >
                          <div>
                            <div className="font-bold text-xs">{ws.name}</div>
                            <div className="text-[10px] text-gray-400">
                              {ws.members?.length || 1} team seats active
                            </div>
                          </div>
                          <span className="text-xs">→</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Team Seat Manager */}
                {selectedWorkspace && (
                  <div className="bg-[#12141c] rounded-3xl p-6 border-2 border-white/10 space-y-4">
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider">
                      Seat Licenses ({selectedWorkspace.members?.length || 0})
                    </h3>

                    {/* Invite Form */}
                    <form onSubmit={handleInviteMember} className="space-y-3">
                      <div>
                        <input
                          type="email"
                          required
                          placeholder="colleague@company.com"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          className="w-full bg-[#08090d] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div className="flex gap-2">
                        <select
                          value={inviteRole}
                          onChange={(e) => setInviteRole(e.target.value)}
                          className="bg-[#08090d] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                        >
                          <option value="member">Signer Seat</option>
                          <option value="manager">Manager Seat</option>
                          <option value="admin">Admin Seat</option>
                        </select>
                        <button
                          type="submit"
                          disabled={isInviting}
                          className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
                        >
                          {isInviting ? "Inviting..." : "+ Invite Seat"}
                        </button>
                      </div>
                    </form>

                    {/* Member List */}
                    <div className="space-y-2 pt-2 border-t border-white/10">
                      {selectedWorkspace.members?.map((m) => {
                        const isOwner = selectedWorkspace.ownerId?._id === m.userId || selectedWorkspace.ownerId === m.userId;
                        return (
                          <div
                            key={m.userId}
                            className="bg-[#08090d] p-3 rounded-xl border border-white/5 flex items-center justify-between text-xs"
                          >
                            <div>
                              <div className="font-bold text-white">
                                {m.userId === user?._id ? `${user?.name || "You"} (Owner)` : m.email || "Team Member"}
                              </div>
                              <span className="text-[10px] font-mono uppercase font-bold text-blue-400 bg-blue-950 px-2 py-0.5 rounded">
                                {m.role || "member"}
                              </span>
                            </div>

                            {!isOwner && m.userId !== user?._id && (
                              <button
                                type="button"
                                onClick={() => handleRemoveMember(m.userId, m.email || "Member")}
                                className="text-red-400 hover:text-red-300 text-xs font-bold cursor-pointer"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Right: Custom White-Labeling Branding Suite */}
              <div className="lg:col-span-2">
                <div className="bg-[#12141c] rounded-3xl p-6 sm:p-8 border-2 border-white/10 space-y-6">
                  <div className="border-b border-white/10 pb-4">
                    <h2 className="text-lg font-black text-white">
                      Custom Brand White-Labeling
                    </h2>
                    <p className="text-xs text-gray-400 mt-1">
                      White-label signing interfaces, email notifications, and audit certificates with your organization's logo and primary theme colors.
                    </p>
                  </div>

                  {selectedWorkspace ? (
                    <form onSubmit={handleSaveBranding} className="space-y-5">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-300 mb-2">
                          Company / Organization Name
                        </label>
                        <input
                          type="text"
                          value={brandCompanyName}
                          onChange={(e) => setBrandCompanyName(e.target.value)}
                          placeholder="e.g. Goldman Sachs Legal, Apex Partners"
                          className="w-full bg-[#08090d] border border-white/10 rounded-xl p-3 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-300 mb-2">
                          Brand Logo URL (PNG/SVG)
                        </label>
                        <input
                          type="url"
                          value={brandLogo}
                          onChange={(e) => setBrandLogo(e.target.value)}
                          placeholder="https://yourcompany.com/assets/logo.png"
                          className="w-full bg-[#08090d] border border-white/10 rounded-xl p-3 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 font-mono"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-gray-300 mb-2">
                            Primary Theme Hex Color
                          </label>
                          <div className="flex items-center gap-3">
                            <input
                              type="color"
                              value={brandColor}
                              onChange={(e) => setBrandColor(e.target.value)}
                              className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-0"
                            />
                            <input
                              type="text"
                              value={brandColor}
                              onChange={(e) => setBrandColor(e.target.value)}
                              className="flex-1 bg-[#08090d] border border-white/10 rounded-xl p-2.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-gray-300 mb-2">
                            Custom Email Disclaimer / Footer
                          </label>
                          <input
                            type="text"
                            value={brandFooterText}
                            onChange={(e) => setBrandFooterText(e.target.value)}
                            placeholder="Confidential legal document powered by Acme Corp."
                            className="w-full bg-[#08090d] border border-white/10 rounded-xl p-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>

                      {/* White Label Preview Box */}
                      <div className="bg-[#08090d] p-5 rounded-2xl border border-white/10 space-y-3">
                        <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-gray-400">
                          Live White-Label Signing Banner Preview
                        </span>
                        <div
                          style={{ borderColor: brandColor }}
                          className="bg-neutral-900 p-4 rounded-xl border-l-4 flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            {brandLogo ? (
                              <img
                                src={brandLogo}
                                alt="Brand Logo"
                                className="h-7 w-auto object-contain"
                                onError={(e) => (e.currentTarget.style.display = "none")}
                              />
                            ) : (
                              <div
                                style={{ backgroundColor: brandColor }}
                                className="w-7 h-7 rounded flex items-center justify-center font-bold text-white text-xs"
                              >
                                {brandCompanyName[0] || "C"}
                              </div>
                            )}
                            <div>
                              <div className="font-bold text-white text-xs">
                                {brandCompanyName || "Your Enterprise Organization"}
                              </div>
                              <div className="text-[10px] text-gray-400">
                                {brandFooterText || "Non-repudiation cryptographic e-signing seal"}
                              </div>
                            </div>
                          </div>
                          <span
                            style={{ backgroundColor: brandColor }}
                            className="text-[10px] text-white font-bold px-2.5 py-1 rounded shadow"
                          >
                            Verified Organization
                          </span>
                        </div>
                      </div>

                      <div className="pt-2">
                        <button
                          type="submit"
                          disabled={isSavingBranding}
                          className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all cursor-pointer"
                        >
                          {isSavingBranding ? "Saving..." : "Save Branding Preferences"}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="text-center py-12 text-gray-500 text-xs">
                      Please select or create a workspace on the left to configure branding.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Confirm Remove Member Modal */}
      <ConfirmModal
        isOpen={Boolean(confirmRemoveTarget)}
        title="Remove Team Member"
        message={`Are you sure you want to remove "${confirmRemoveTarget?.memberName}" from this workspace? They will lose access to team documents.`}
        confirmText="Remove Member"
        cancelText="Cancel"
        type="danger"
        onConfirm={executeRemoveMember}
        onCancel={() => setConfirmRemoveTarget(null)}
      />

      {/* Upgrade to Enterprise Modal */}
      <UpgradeModal
        isOpen={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        featureName="Enterprise Workspaces"
        requiredPlan="enterprise"
        reason="Upgrade to Enterprise to create new workspaces, invite team members, and white-label signing interfaces."
      />
    </div>
  );
}
