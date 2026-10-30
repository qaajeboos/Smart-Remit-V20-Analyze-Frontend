async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
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
    throw new Error(message);
  }

  if (response.status === 204) return null;
  return response.json();
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

export function fetchFeedback() {
  return request("/api/feedback");
}

export function createFeedback(payload) {
  return request("/api/feedback", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateStatus(id, status) {
  return request(`/api/feedback/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}
