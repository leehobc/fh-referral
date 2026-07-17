/* Minimal API client. Exposes window.API. Token kept in localStorage. */
(function () {
  const TOKEN_KEY = "fh_token";
  const getToken = () => localStorage.getItem(TOKEN_KEY);
  const setToken = (t) => localStorage.setItem(TOKEN_KEY, t);
  const clearToken = () => localStorage.removeItem(TOKEN_KEY);

  async function request(path, { method = "GET", body, auth = true } = {}) {
    const headers = { "Content-Type": "application/json" };
    if (auth && getToken()) headers.Authorization = "Bearer " + getToken();
    const res = await fetch(path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
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
      update: (payload) => request("/api/me", { method: "PUT", body: payload }),
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
      get: (reference) => request("/api/referrals/" + encodeURIComponent(reference)),
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
  };
})();
