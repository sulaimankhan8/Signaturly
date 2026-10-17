"use client";

import React, { useState } from "react";
import Link from "next/link";

interface Member {
  id: string;
  name: string;
  email: string;
  role: "Owner" | "Legal Admin" | "Signer" | "Auditor";
  status: "Active" | "Pending";
}

export default function WorkspacesPage() {
  const [activeWorkspace, setActiveWorkspace] = useState("Legal Ops Global");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Member["role"]>("Signer");
  const [members, setMembers] = useState<Member[]>([
    {
      id: "m-1",
      name: "Suleman Khan",
      email: "admin@pactdoc.com",
      role: "Owner",
      status: "Active",
    },
    {
      id: "m-2",
      name: "Alex Morgan",
      email: "alex.morgan@pactdoc.com",
      role: "Legal Admin",
      status: "Active",
    },
    {
      id: "m-3",
      name: "Devon Vance",
      email: "d.vance@external-counsel.com",
      role: "Auditor",
      status: "Active",
    },
  ]);

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    setMembers((prev) => [
      ...prev,
      {
        id: `m-${Date.now()}`,
        name: inviteEmail.split("@")[0],
        email: inviteEmail,
        role: inviteRole,
        status: "Pending",
      },
    ]);
    setInviteEmail("");
  };

  return (
    <div className="min-h-screen bg-surface-canvas text-content-primary">
      {/* Top Header */}
      <header className="border-b border-surface-border bg-surface-canvas/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="text-xs font-mono text-content-muted hover:text-white flex items-center gap-1.5 transition-colors"
            >
              ← Back to Documents
            </Link>
            <span className="text-surface-border">/</span>
            <span className="text-xs font-bold uppercase tracking-wider text-white">Team Workspaces</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-mono text-[11px] text-content-muted">Multi-Tenant Isolation Active</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">
              Collaborative Team Workspaces
            </h1>
            <p className="text-xs sm:text-sm text-content-muted mt-1 font-medium">
              Manage multi-party signing authorization, team roles, and organizational document vaults.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-content-muted">Current:</span>
            <span className="px-3 py-1.5 rounded-xl bg-surface-card border border-surface-border font-bold text-xs text-white">
              {activeWorkspace}
            </span>
          </div>
        </div>

        {/* Invite Member Section */}
        <div className="p-6 rounded-2xl bg-surface-card border border-surface-border space-y-4 shadow-elevation-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-content-secondary">
            Invite Team Signer or Legal Counsel
          </h3>

          <form onSubmit={handleInvite} className="flex flex-col sm:flex-row items-center gap-3">
            <input
              type="email"
              required
              placeholder="colleague@company.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="flex-1 w-full px-3.5 py-2.5 rounded-xl bg-surface-subtle border border-surface-border text-xs text-white placeholder-content-subtle focus:outline-none focus:border-crimson-500"
            />

            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as Member["role"])}
              className="w-full sm:w-auto px-3.5 py-2.5 rounded-xl bg-surface-subtle border border-surface-border text-xs text-white focus:outline-none focus:border-crimson-500 font-mono"
            >
              <option value="Signer">Role: Signer</option>
              <option value="Legal Admin">Role: Legal Admin</option>
              <option value="Auditor">Role: Auditor</option>
            </select>

            <button
              type="submit"
              className="w-full sm:w-auto px-6 py-2.5 bg-crimson-600 hover:bg-crimson-500 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-elevation-1 hover:shadow-crimson-glow transition-all whitespace-nowrap"
            >
              Send Invite
            </button>
          </form>
        </div>

        {/* Team Members List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-content-muted px-2">
            <span>Team Member</span>
            <div className="flex items-center gap-8">
              <span>Role</span>
              <span>Status</span>
            </div>
          </div>

          <div className="space-y-2">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-4 rounded-xl bg-surface-card border border-surface-border shadow-elevation-1"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-crimson-600/15 text-crimson-400 border border-crimson-500/30 flex items-center justify-center font-bold text-xs uppercase">
                    {member.name.slice(0, 2)}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">{member.name}</p>
                    <p className="text-[11px] font-mono text-content-muted">{member.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <span className="font-mono text-[11px] text-content-secondary bg-surface-elevated px-2.5 py-1 rounded-md border border-surface-border">
                    {member.role}
                  </span>
                  <span
                    className={`font-mono text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                      member.status === "Active"
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25"
                        : "bg-seal-amber/10 text-seal-amber border border-seal-amber/25"
                    }`}
                  >
                    {member.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
