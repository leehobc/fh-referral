/* Minimal API client. Exposes window.API. Token kept in localStorage. */
(function () {
  const TOKEN_KEY = "fh_token";
  const getToken = () => localStorage.getItem(TOKEN_KEY);
  const setToken = (t) => localStorage.setItem(TOKEN_KEY, t);
  const clearToken = () => localStorage.removeItem(TOKEN_KEY);

  async function request(path, { method = "GET", body, auth = true } = {}) {
    // FormData (used for the referral form, which can carry a file) sets
    // its own multipart Content-Type with boundary — must NOT be set here.
    const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
    const headers = isFormData ? {} : { "Content-Type": "application/json" };
    if (auth && getToken()) headers.Authorization = "Bearer " + getToken();
    const res = await fetch(path, {
      method,
      headers,
      body: isFormData ? body : (body ? JSON.stringify(body) : undefined),
    });
    let data = {};
    try { data = await res.json(); } catch { /* no body */ }
    if (!res.ok) {
      const err = new Error(data.error || `Request failed (${res.status})`);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  window.API = {
    getToken, setToken, clearToken,

    auth: {
      login: (clinician_id, password) =>
        request("/api/auth/login", { method: "POST", auth: false, body: { clinician_id, password } }),
      register: (payload) =>
        request("/api/auth/register", { method: "POST", auth: false, body: payload }),
      forgot: (payload) =>
        request("/api/auth/forgot-password", { method: "POST", auth: false, body: payload }),
      reset: (token, password) =>
        request("/api/auth/reset-password", { method: "POST", auth: false, body: { token, password } }),
    },

    me: {
      get: () => request("/api/me"),
      changePassword: (current, next) =>
        request("/api/me/change-password", { method: "POST", body: { current, next } }),
    },

    patients: {
      list: (params = {}) => {
        const qs = new URLSearchParams(params).toString();
        return request("/api/patients" + (qs ? "?" + qs : ""));
      },
      get: (nric) => request("/api/patients/" + encodeURIComponent(nric)),
    },

    referrals: {
      create: (payload) => request("/api/referrals", { method: "POST", body: payload }),
      list: (query) => request("/api/referrals" + (query ? "?query=" + encodeURIComponent(query) : "")),
      // Viewing a referral's full details requires SMS-verifying with the
      // patient first — there's no plain "get" anymore.
      requestViewOtp: (reference) => request("/api/referrals/" + encodeURIComponent(reference) + "/request-otp", { method: "POST" }),
      verifyViewOtp: (reference, otp) => request("/api/referrals/" + encodeURIComponent(reference) + "/verify-otp", { method: "POST", body: { otp } }),
      // Patients seen through the wizard who did NOT end up referred (declined/deferred, or not suggested by the system).
      logNotMade: (payload) => request("/api/referrals/not-made", { method: "POST", body: payload }),
      listNotMade: () => request("/api/referrals/not-made"),
    },

    stats: {
      overview: () => request("/api/stats/overview"),
    },

    emr: {
      // The patient currently open in the doctor's EMR (mock context).
      currentPatient: () => request("/api/emr/current-patient"),
      // Demo helper: simulate a different patient being opened in the EMR.
      nextPatient: () => request("/api/emr/current-patient/next", { method: "POST" }),
    },

    chat: {
      // AI assistant for clinicians (program Q&A, not patient-specific).
      // history: [{ role: "user"|"model", text }] of prior turns in this conversation.
      ask: (message, history) => request("/api/chat/ask", { method: "POST", body: { message, history } }),
    },
  };
})();
