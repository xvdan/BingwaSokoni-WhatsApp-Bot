// In-memory session storage
const sessions = new Map();

const sessionSteps = {
  SELECTING_CATEGORY: 'selecting_category',
  SELECTING_BUNDLE: 'selecting_bundle',
  SELECTING_PAYMENT_METHOD: 'selecting_payment_method',
  ENTERING_PHONE: 'entering_phone',
  PROCESSING_PAYMENT: 'processing_payment',
  MANUAL_PAYMENT: 'manual_payment'
};

function createSession(userId) {
  const session = {
    userId,
    step: null,
    bundle: null,
    phone: null,
    paymentMethod: null,
    transactionId: null,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  sessions.set(userId, session);
  return session;
}

function getSession(userId) {
  return sessions.get(userId);
}

function updateSession(userId, data) {
  const session = sessions.get(userId);
  if (session) {
    Object.assign(session, data, { updatedAt: Date.now() });
  }
  return session;
}

function clearSession(userId) {
  sessions.delete(userId);
}

function cleanupOldSessions(maxAge = 3600000) { // 1 hour default
  const now = Date.now();
  for (const [userId, session] of sessions.entries()) {
    if (now - session.updatedAt > maxAge) {
      sessions.delete(userId);
    }
  }
}

// Run cleanup every 30 minutes
setInterval(cleanupOldSessions, 1800000);

module.exports = {
  sessionSteps,
  createSession,
  getSession,
  updateSession,
  clearSession
};