import mongoose from "mongoose";

/**
 * A workspace is who documents belong to (plan task P5-01).
 *
 * Every user has one personal workspace, where their own documents live. A team workspace is
 * shared: its owner pays for it, and its members work on its documents according to their role.
 * The owner is not listed among the members; `ownerId` is the owner.
 */
const workspaceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // The one workspace each user has for their own documents. It has no members.
    personal: {
      type: Boolean,
      default: false,
    },
    // read_only: the plan that paid for the team lapsed; documents can be read but nothing new is sent
    status: {
      type: String,
      enum: ["active", "read_only", "archived"],
      default: "active",
    },
    members: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        role: {
          type: String,
          enum: ["admin", "member", "viewer"],
          default: "member",
        },
        status: {
          type: String,
          enum: ["active", "suspended"],
          default: "active",
        },
        joinedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    branding: {
      // A small image as a data URL, or an https address
      logoUrl: {
        type: String,
        default: null,
      },
      primaryColor: {
        type: String,
        default: "#4f46e5",
      },
      companyName: {
        type: String,
        default: null,
      },
      emailFooterText: {
        type: String,
        default: null,
      },
    },
    policy: {
      // Every member must have two-step sign-in switched on to work in this workspace
      requireTwoFactor: { type: Boolean, default: false },
      // Days after completion at which a document is deleted. Null keeps documents until someone deletes them.
      retentionDays: { type: Number, default: null, min: 30 },
    },
    // Websites allowed to show this workspace's signing pages inside their own pages
    allowedFrameOrigins: {
      type: [String],
      default: [],
    },
    // Single sign-on through the organisation's own identity provider (OpenID Connect)
    sso: {
      enabled: { type: Boolean, default: false },
      issuer: { type: String, default: null },
      clientId: { type: String, default: null },
      // Stored encrypted (utils/secretBox.js)
      clientSecret: { type: String, default: null, select: false },
      // Domains the organisation says are its own
      emailDomains: { type: [String], default: [] },
      // The ones it has proved it controls, by publishing domainToken in a DNS TXT record.
      // Only addresses at these may sign in through the identity provider.
      verifiedDomains: { type: [String], default: [] },
      domainToken: { type: String, default: null },
    },
  },
  { timestamps: true }
);

// One personal workspace per user
// Named, because databases from before this release already have a plain index on ownerId under the default name
workspaceSchema.index({ ownerId: 1 }, { unique: true, partialFilterExpression: { personal: true }, name: "one_personal_workspace_per_owner" });
workspaceSchema.index({ ownerId: 1, personal: 1 });
workspaceSchema.index({ "members.userId": 1 });

export const Workspace = mongoose.model("Workspace", workspaceSchema);

/**
 * An invitation to join a team workspace, sent by email (plan task P5-04).
 * It can be accepted by someone who has no account yet: they sign up first, then accept.
 * Only a hash of the link's token is stored.
 */
const invitationSchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    role: { type: String, enum: ["admin", "member", "viewer"], default: "member" },
    tokenHash: { type: String, required: true, unique: true },
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: ["pending", "accepted", "revoked"], default: "pending" },
    expiresAt: { type: Date, required: true },
    acceptedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

invitationSchema.index({ workspaceId: 1, email: 1, status: 1 });

export const Invitation = mongoose.model("Invitation", invitationSchema);
