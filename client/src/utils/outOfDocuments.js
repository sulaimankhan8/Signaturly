// The event that says a request was refused because the month's documents are used up.
// api/axios.js sends it; components/OutOfDocumentsPrompt.jsx shows what can be done about it.
export const OUT_OF_DOCUMENTS = "pactdoc:out-of-documents";

// The server's refusal: 403 with "Monthly document quota exceeded ..."
export const isOutOfDocuments = (error) => error?.response?.status === 403 && /quota exceeded/i.test(String(error.response?.data?.message || ""));
