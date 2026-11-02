const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ||
  "https://smart-remit-v20-analyze-backend-production.up.railway.app"
).replace(/\/$/, "");

const STORAGE_KEY = "smart-v2-auth";
let authToken = null;

export function readSession() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.token || !parsed?.user) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeSession(session) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  authToken = session.token;
}

export function clearSession() {
  sessionStorage.removeItem(STORAGE_KEY);
  authToken = null;
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    let message = "Something went wrong. Try again.";
    try {
      const body = await response.json();
      if (body.message) message = body.message;
    } catch {
      // The server did not return JSON.
    }
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  if (response.status === 204) return null;
  return response.json();
}

export function login(username, pin) {
  return request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, pin }),
  });
}

export function requestOtp(username) {
  return request("/api/auth/forgot-pin", {
    method: "POST",
    body: JSON.stringify({ username }),
  });
}

export function verifyOtp(username, otp) {
  return request("/api/auth/forgot-pin/verify", {
    method: "POST",
    body: JSON.stringify({ username, otp }),
  });
}

export function resetPinWithOtp(resetToken, newPin, confirmPin) {
  return request("/api/auth/forgot-pin/reset", {
    method: "POST",
    body: JSON.stringify({ resetToken, newPin, confirmPin }),
  });
}

export function fetchMe() {
  return request("/api/auth/me");
}

export function changePin(newPin, confirmPin) {
  return request("/api/auth/pin", {
    method: "POST",
    body: JSON.stringify({ newPin, confirmPin }),
  });
}

export function logout() {
  return request("/api/auth/logout", { method: "POST" });
}

export function createUser(payload) {
  return request("/api/auth/users", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchUsers() {
  return request("/api/auth/users");
}

export function deleteUser(id, pin) {
  return request(`/api/auth/users/${id}`, {
    method: "DELETE",
    body: JSON.stringify({ pin }),
  });
}

export function fetchModules() {
  return request("/api/modules");
}

export function createModule(payload) {
  return request("/api/modules", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateModule(id, payload) {
  return request(`/api/modules/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function fetchFeedback() {
  return request("/api/feedback");
}

export function createFeedback(payload) {
  return request("/api/feedback", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchScreenshot(feedbackId, screenshotId) {
  const response = await fetch(`${API_BASE}/api/feedback/${feedbackId}/screenshots/${screenshotId}`, {
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
  });
  if (!response.ok) {
    let message = "The screenshot could not be opened.";
    try {
      const body = await response.json();
      if (body.message) message = body.message;
    } catch {
      // The image response is not JSON.
    }
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return response.blob();
}

export function updateFeedback(id, payload) {
  return request(`/api/feedback/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteFeedback(id, pin) {
  return request(`/api/feedback/${id}`, {
    method: "DELETE",
    body: JSON.stringify({ pin }),
  });
}

export function deleteModule(id, pin) {
  return request(`/api/modules/${id}`, {
    method: "DELETE",
    body: JSON.stringify({ pin }),
  });
}

export function updateStatus(id, status) {
  return request(`/api/feedback/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}
