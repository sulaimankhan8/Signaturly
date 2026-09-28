import API from "./axios";

export const fetchWorkspacesApi = async () => {
  const res = await API.get("/workspaces");
  return res.data?.data;
};

export const createWorkspaceApi = async (data) => {
  const res = await API.post("/workspaces", data);
  return res.data?.data;
};

export const inviteWorkspaceMemberApi = async (workspaceId, data) => {
  const res = await API.post(`/workspaces/${workspaceId}/members`, data);
  return res.data?.data;
};

export const updateWorkspaceBrandingApi = async (workspaceId, data) => {
  const res = await API.patch(`/workspaces/${workspaceId}/branding`, data);
  return res.data?.data;
};

export const removeWorkspaceMemberApi = async (workspaceId, memberId) => {
  const res = await API.delete(`/workspaces/${workspaceId}/members/${memberId}`);
  return res.data?.data;
};
