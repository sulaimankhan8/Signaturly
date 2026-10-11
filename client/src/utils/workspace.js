/**
 * Which workspace the person is working in. It is remembered on this device and sent with
 * every request (see api/axios.js). With nothing remembered, the server uses the person's
 * own documents, and it does the same for a workspace they are no longer part of.
 */
const KEY = "pactdoc.workspace";

export const getActiveWorkspaceId = () => {
  try {
    return window.localStorage.getItem(KEY) || "";
  } catch {
    return "";
  }
};

export const setActiveWorkspaceId = (id) => {
  try {
    if (id) window.localStorage.setItem(KEY, id);
    else window.localStorage.removeItem(KEY);
  } catch {
    // Private browsing may refuse storage; the person then works in their own documents
  }
};

export const ROLE_LABELS = { owner: "Owner", admin: "Admin", member: "Member", viewer: "Viewer" };

// What each role may do, in the words shown next to the role picker
export const ROLE_HELP = {
  admin: "Sends documents, manages templates, members and settings",
  member: "Creates and sends documents, uses templates",
  viewer: "Reads documents and activity, changes nothing",
};
