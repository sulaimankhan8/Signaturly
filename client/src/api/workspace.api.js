import API from "./axios";

const data = (res) => res.data?.data;

export const fetchWorkspacesApi = async () => data(await API.get("/workspaces"));
export const createWorkspaceApi = async (body) => data(await API.post("/workspaces", body));
export const fetchWorkspaceApi = async (workspaceId) => data(await API.get(`/workspaces/${workspaceId}`));
export const fetchWorkspaceActivityApi = async (workspaceId) => data(await API.get(`/workspaces/${workspaceId}/activity`));

// changes: { name, branding: {...}, policy: {...}, allowedFrameOrigins: [...] }
export const updateWorkspaceApi = async (workspaceId, changes) => data(await API.patch(`/workspaces/${workspaceId}`, changes));
export const updateWorkspaceBrandingApi = async (workspaceId, body) => data(await API.patch(`/workspaces/${workspaceId}/branding`, body));

export const inviteWorkspaceMemberApi = async (workspaceId, body) => data(await API.post(`/workspaces/${workspaceId}/invitations`, body));
export const revokeInvitationApi = async (workspaceId, invitationId) => data(await API.delete(`/workspaces/${workspaceId}/invitations/${invitationId}`));
export const changeMemberRoleApi = async (workspaceId, memberId, role) => data(await API.patch(`/workspaces/${workspaceId}/members/${memberId}`, { role }));
export const removeWorkspaceMemberApi = async (workspaceId, memberId) => data(await API.delete(`/workspaces/${workspaceId}/members/${memberId}`));

// The invitation link: what it is for, and accepting it once signed in
export const describeInvitationApi = async (token) => data(await API.get(`/workspaces/invitations/${token}`));
export const acceptInvitationApi = async (token) => data(await API.post(`/workspaces/invitations/${token}/accept`));

// Two-step sign-in with an authenticator app, for the signed-in person's own account
export const fetchTwoFactorApi = async () => data(await API.get("/auth/2fa"));
export const beginTwoFactorApi = async () => data(await API.post("/auth/2fa/begin"));
export const confirmTwoFactorApi = async (code) => data(await API.post("/auth/2fa/confirm", { code }));
export const disableTwoFactorApi = async (code) => data(await API.post("/auth/2fa/disable", { code }));

// Single sign-on (Enterprise)
export const startSsoApi = async (email) => data(await API.post("/auth/sso/start", { email }));
export const fetchSsoSettingsApi = async (workspaceId) => data(await API.get(`/auth/sso/settings/${workspaceId}`));
export const saveSsoSettingsApi = async (workspaceId, body) => data(await API.put(`/auth/sso/settings/${workspaceId}`, body));
export const verifySsoDomainsApi = async (workspaceId) => data(await API.post(`/auth/sso/settings/${workspaceId}/verify-domains`));
