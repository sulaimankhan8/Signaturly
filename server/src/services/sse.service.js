/**
 * Server-Sent Events (SSE) Real-Time Notification Service
 * Broadcasts document status transitions directly to active client browsers.
 */

const userConnections = new Map(); // userId -> Set of express Response objects

/**
 * Register a new SSE connection for a user
 */
export const registerSseClient = (userId, req, res) => {
  const uid = userId.toString();

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  if (typeof res.flushHeaders === "function") {
    res.flushHeaders();
  }

  // Send initial handshake
  res.write(`data: ${JSON.stringify({ type: "CONNECTED", timestamp: Date.now() })}\n\n`);

  if (!userConnections.has(uid)) {
    userConnections.set(uid, new Set());
  }
  const clientSet = userConnections.get(uid);
  clientSet.add(res);

  // Heartbeat keep-alive every 25 seconds
  const keepAliveTimer = setInterval(() => {
    try {
      res.write(`: ping\n\n`);
    } catch {
      clearInterval(keepAliveTimer);
    }
  }, 25000);

  // Cleanup on connection drop
  req.on("close", () => {
    clearInterval(keepAliveTimer);
    if (userConnections.has(uid)) {
      const set = userConnections.get(uid);
      set.delete(res);
      if (set.size === 0) {
        userConnections.delete(uid);
      }
    }
  });
};

/**
 * Broadcast a real-time event to all active sessions of a user
 */
export const notifyUserDocumentUpdate = (userId, payload = {}) => {
  if (!userId) return;
  const uid = userId.toString();

  const clientSet = userConnections.get(uid);
  if (clientSet && clientSet.size > 0) {
    const data = JSON.stringify({
      type: "DOCUMENT_UPDATED",
      timestamp: Date.now(),
      ...payload,
    });

    for (const res of clientSet) {
      try {
        res.write(`data: ${data}\n\n`);
      } catch (err) {
        console.warn("SSE write error:", err.message);
      }
    }
  }
};
