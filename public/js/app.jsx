const { useState, useEffect, useCallback, useRef } = React;
const API = window.API;

/* ── icons ─────────────────────────────────────────────────── */
const svg = (d, extra) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{d}{extra}</svg>
);
const Ic = {
  logo: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h4l2 5 3-10 2 5h4"/></svg>,
  dash: svg(<path d="M3 13h8V3H3zM13 21h8V3h-8zM3 21h8v-6H3z"/>),
  refer: svg(<path d="M12 5v14M5 12h14"/>),
  patients: svg(<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>, <circle cx="9" cy="7" r="4"/>),
  list: svg(<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>),
  user: svg(<circle cx="12" cy="8" r="4"/>, <path d="M4 21v-1a6 6 0 0 1 12 0v1"/>),
  gear: svg(<circle cx="12" cy="12" r="3"/>, <path d="M19 12a7 7 0 0 0-.1-1l2-1.6-2-3.4-2.4 1a7 7 0 0 0-1.7-1L14.5 2h-4l-.3 2.4a7 7 0 0 0-1.7 1l-2.4-1-2 3.4L4 11a7 7 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 1.7 1l.3 2.4h4l.3-2.4a7 7 0 0 0 1.7-1l2.4 1 2-3.4-2-1.6a7 7 0 0 0 .1-1z"/>),
  clock: svg(<circle cx="12" cy="12" r="9"/>, <path d="M12 7v5l3 2"/>),
  chat: svg(<path d="M21 11.5a8.4 8.4 0 0 1-11.7 7.7L3 21l1.8-6.3A8.4 8.4 0 1 1 21 11.5z"/>),
};

/* ── tiny router ───────────────────────────────────────────── */
function parseHash() {
  const raw = location.hash.replace(/^#/, "") || "/";
  const [path, qs] = raw.split("?");
  return { path, query: Object.fromEntries(new URLSearchParams(qs || "")) };
}
function useHashRoute() {
  const [route, setRoute] = useState(parseHash());
  useEffect(() => {
    const on = () => setRoute(parseHash());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}
const navigate = (to) => { location.hash = to; };

/* ── small helpers ─────────────────────────────────────────── */
const Badge = ({ tone = "teal", children }) => <span className={`badge ${tone}`}>{children}</span>;
const fmtDMY = (d) => {
  if (!d) return "—";
  const dt = new Date(d);
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${dt.getUTCFullYear()}`;
};
// Timestamps (e.g. referral created_at) - fixed DD/MM/YYYY 24-hour format,
// local time (unlike fmtDMY, these carry a real time-of-day, so local time
// is what should be shown, not UTC).
const fmtDMYHM = (d) => {
  if (!d) return "—";
  const dt = new Date(d);
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const hh = String(dt.getHours()).padStart(2, "0");
  const min = String(dt.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${dt.getFullYear()} ${hh}:${min}`;
};

function ImageModal({ src, alt, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" aria-label="Close" onClick={onClose}>✕</button>
        <img src={src} alt={alt} />
        {children}
      </div>
    </div>
  );
}

// Official NUH "What is FH?" patient leaflet, in each of Singapore's four
// languages — verified as real PDFs (HTTP 200, application/pdf) before adding.
// Served from our own public/leaflets/ folder (same-origin), not linked
// directly to NUH — needed so contentWindow.print() below is allowed to
// run. See public/leaflets/README.md for the exact filenames expected here.
const FH_LEAFLETS = [
  ["English", "/leaflets/what-is-fh-english.pdf"],
  ["Malay", "/leaflets/what-is-fh-malay.pdf"],
  ["Tamil", "/leaflets/what-is-fh-tamil.pdf"],
  ["Chinese", "/leaflets/what-is-fh-chinese.pdf"],
];

// Language picker + "Print leaflet" button — auto-prints the chosen
// language's PDF via a hidden iframe. This has been unreliable specifically
// for the Malay file (wrong/blank content, even printing the parent app page
// once) while English/Tamil/Chinese print fine — a "open in new tab instead"
// fallback link sits alongside it so there's always a manual escape hatch,
// since a "printed the wrong thing" failure doesn't throw a catchable error.
function PrintLeafletButton() {
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState(FH_LEAFLETS[0][0]);
  const [err, setErr] = useState("");
  const [printSrc, setPrintSrc] = useState(null);
  const printKeyRef = useRef(0);
  const currentUrl = (FH_LEAFLETS.find(([label]) => label === lang) || [])[1];

  const print = () => {
    setErr("");
    if (!currentUrl) return;
    printKeyRef.current += 1;
    setPrintSrc(currentUrl);
  };
  const onIframeLoad = (e) => {
    // The iframe's load event fires once the PDF viewer shell has
    // initialised, not once it has actually finished rendering — a short
    // delay gives the renderer time to finish before print() is called.
    const win = e.target.contentWindow;
    setTimeout(() => {
      try {
        win.focus();
        win.print();
      } catch (err) {
        setErr("Could not open the print dialog — try \"open in a new tab\" instead.");
      }
    }, 700);
  };

  if (!open) {
    return <button className="btn" onClick={() => setOpen(true)}>Print leaflet</button>;
  }
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <select className="input" style={{ width: "auto", marginBottom: 0 }} value={lang} onChange={(e) => setLang(e.target.value)}>
        {FH_LEAFLETS.map(([label]) => <option key={label} value={label}>{label}</option>)}
      </select>
      <button className="btn-ghost btn-sm" onClick={print}>Print</button>
      {currentUrl && (
        <a className="small" href={currentUrl} target="_blank" rel="noopener">or open in a new tab</a>
      )}
      {err && <span className="small" style={{ color: "var(--red)" }}>{err}</span>}
      {printSrc && (
        <iframe key={printKeyRef.current} src={printSrc} title="leaflet-print" style={{ display: "none" }} onLoad={onIframeLoad} />
      )}
    </span>
  );
}

function Field({ label, value, onChange, bad, type = "text", placeholder, disabled }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input className={"input" + (bad ? " bad" : "")} type={type} value={value ?? ""} disabled={disabled}
        placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Select({ label, value, onChange, options, bad, disabled }) {
  return (
    <div>
      <label className="label">{label}</label>
      <select className={"input" + (bad ? " bad" : "")} value={value ?? ""} disabled={disabled}
        onChange={(e) => onChange(e.target.value)}>
        <option value="">Select…</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   AUTH PAGES
   ══════════════════════════════════════════════════════════════ */
// Fixed mock code shown to whoever is running/demoing this build — matches
// the server's DEMO_2FA_CODE. No real authenticator app / SMS-TOTP is wired
// up, so this is the same code for every login, every time.
const DEMO_2FA_CODE = "340587";

function Login({ onAuthed }) {
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [pendingToken, setPendingToken] = useState(null);
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submitPassword = async () => {
    setErr("");
    if (!id || !pw) return setErr("Enter your clinician ID and password.");
    setBusy(true);
    try {
      const { pendingToken } = await API.auth.login(id, pw);
      setPendingToken(pendingToken); setCode("");
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const submitCode = async () => {
    setErr("");
    if (!code.trim()) return setErr("Enter the verification code.");
    setBusy(true);
    try {
      const { token, user } = await API.auth.verify2fa(pendingToken, code.trim());
      API.setToken(token); onAuthed(user); navigate("/");
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="auth-wrap">
      <div className="login-card">
        <div className="login-left">
          <div className="brand" style={{ padding: 0, marginBottom: 18 }}>
            <span className="brand-mark" style={{ background: "var(--teal)" }}>{Ic.logo}</span>
            <span style={{ fontWeight: 700, fontSize: 18, color: "var(--ink)" }}>FH Referral Assistant</span>
          </div>
          <p style={{ fontSize: 16, color: "var(--ink-soft)", margin: "0 0 6px", lineHeight: 1.5 }}>
            A clean, secure clinician tool for faster FH genetic testing referrals.
          </p>
          <div className="feat"><span className="feat-ic">{Ic.clock}</span>
            <span style={{ paddingTop: 8, fontSize: 14 }}>Reduce consultation admin time</span></div>
          <div className="feat"><span className="feat-ic">{Ic.chat}</span>
            <span style={{ paddingTop: 8, fontSize: 14 }}>Guide patient explanation and consent</span></div>
          <div className="feat"><span className="feat-ic">{Ic.list}</span>
            <span style={{ paddingTop: 8, fontSize: 14 }}>Submit referrals with fewer missing fields</span></div>
        </div>
        <div className="login-right">
          {!pendingToken ? (
            <>
              <h2 className="title" style={{ fontSize: 22 }}>Sign in</h2>
              <p className="sub">Secure clinician access only.</p>
              <label className="label">Clinician ID</label>
              <input className="input" value={id} onChange={(e) => setId(e.target.value)} />
              <label className="label">Password</label>
              <input className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitPassword()} />
              {err && <p className="err">{err}</p>}
              <button className="btn btn-full" disabled={busy} onClick={submitPassword}>{busy ? "Checking…" : "Sign in"}</button>
              <p style={{ textAlign: "center", margin: "14px 0 0" }}>
                <a href="#/forgot">Forgot password?</a>
              </p>
            </>
          ) : (
            <>
              <h2 className="title" style={{ fontSize: 22 }}>Two-factor verification</h2>
              <p className="sub">Enter the 6-digit code from your authenticator app.</p>
              <p className="small muted" style={{ background: "var(--teal-soft)", borderRadius: 10, padding: "10px 14px", margin: "0 0 16px" }}>
                No authenticator app is wired up in this build — the demo code is always <b>{DEMO_2FA_CODE}</b>.
              </p>
              <label className="label">Verification code</label>
              <input className="input" value={code} placeholder="6-digit code" onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitCode()} />
              {err && <p className="err">{err}</p>}
              <button className="btn btn-full" disabled={busy} onClick={submitCode}>{busy ? "Verifying…" : "Verify and sign in"}</button>
              <p style={{ textAlign: "center", margin: "14px 0 0" }}>
                <a href="#" onClick={(e) => { e.preventDefault(); setPendingToken(null); setErr(""); }}>Back to sign in</a>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Forgot() {
  const [cid, setCid] = useState(""); const [msg, setMsg] = useState(null); const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      const r = await API.auth.forgot({ clinician_id: cid });
      // In this build the reset link is returned so you can complete the flow.
      setMsg(r.link || "If that account exists, a reset link has been generated.");
    } catch (e) { setMsg(e.message); } finally { setBusy(false); }
  };
  return (
    <div className="auth-wrap"><div className="auth-card card">
      <h2 className="title" style={{ fontSize: 22 }}>Reset password</h2>
      <p className="sub">Enter your clinician ID to generate a reset link.</p>
      <Field label="Clinician ID" value={cid} onChange={setCid} placeholder="e.g. DR-10567" />
      <button className="btn btn-full" disabled={busy} onClick={submit}>{busy ? "Working…" : "Generate reset link"}</button>
      {msg && (
        <div style={{ marginTop: 14 }}>
          <p className="small muted">Reset link (demo — normally emailed):</p>
          <a className="small" href={msg} style={{ wordBreak: "break-all" }}>{msg}</a>
        </div>
      )}
      <p className="small muted" style={{ textAlign: "center", marginTop: 12 }}><a href="#/login">Back to sign in</a></p>
    </div></div>
  );
}

function ResetPassword({ token }) {
  const [pw, setPw] = useState(""); const [pw2, setPw2] = useState("");
  const [err, setErr] = useState(""); const [done, setDone] = useState(false); const [busy, setBusy] = useState(false);
  const submit = async () => {
    setErr("");
    if (pw.length < 8) return setErr("Password must be at least 8 characters.");
    if (pw !== pw2) return setErr("Passwords do not match.");
    setBusy(true);
    try { await API.auth.reset(token, pw); setDone(true); } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <div className="auth-wrap"><div className="auth-card card">
      <h2 className="title" style={{ fontSize: 22 }}>Choose a new password</h2>
      {done ? (
        <>
          <p className="ok">Password updated. You can sign in now.</p>
          <button className="btn btn-full" onClick={() => navigate("/login")}>Go to sign in</button>
        </>
      ) : !token ? (
        <p className="err">This reset link is missing its token.</p>
      ) : (
        <>
          <Field label="New password" type="password" value={pw} onChange={setPw} />
          <Field label="Confirm new password" type="password" value={pw2} onChange={setPw2} />
          {err && <p className="err">{err}</p>}
          <button className="btn btn-full" disabled={busy} onClick={submit}>{busy ? "Saving…" : "Set new password"}</button>
        </>
      )}
    </div></div>
  );
}

/* ══════════════════════════════════════════════════════════════
   APP SHELL
   ══════════════════════════════════════════════════════════════ */
const NAV = [
  { path: "/refer", label: "New referral", icon: Ic.refer },
  { path: "/referrals", label: "Referrals", icon: Ic.list },
  { path: "/profile", label: "Profile", icon: Ic.user },
  { path: "/settings", label: "Settings", icon: Ic.gear },
];

function Shell({ user, route, onSignOut, children }) {
  const base = "/" + (route.path.split("/")[1] || "refer");
  return (
    <div className="shell">
      <aside className="sidebar no-print">
        <div className="brand">
          <span className="brand-mark">{Ic.logo}</span>
          <span className="brand-name">FH Referral<br />Assistant</span>
        </div>
        <div className="doc">
          <div className="doc-name">{user.name}</div>
          <div className="doc-id">{user.clinician_id}{user.role === "admin" ? " · admin" : ""}</div>
        </div>
        {NAV.map((n) => (
          <button key={n.path} className={"navitem" + (base === n.path ? " active" : "")}
            onClick={() => navigate(n.path)}>
            <span className="navic">{n.icon}</span><span className="navlabel">{n.label}</span>
          </button>
        ))}
        <div className="signout"><button className="btn-ghost btn-full" onClick={onSignOut}>Sign out</button></div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   REFERRAL WIZARD  (checklist → Q&A → consent → fetch → form → done)
   This is the landing page — the eligibility checklist is the homepage.
   ══════════════════════════════════════════════════════════════ */
// Plain-language FH likelihood check, run automatically once the patient
// record is retrieved from the EMR — replaces the old self-reported
// checklist with something driven by the actual record. Deliberately a
// met/not-met checklist rather than a weighted point score (e.g. DLCNS) —
// a numeric score needs the reader to already know what the numbers mean,
// which defeats the point of decision support at a glance.
// `firstDegreeFH` is entirely clinician-entered rather than sourced from the
// EMR record — always starts unchecked, the clinician ticks it themselves.
// `ldlOverride` lets the clinician mark the LDL criterion met even when the
// EMR figure is below threshold, when they hold external proof of a
// qualifying result — the UI only shows that checkbox when the EMR LDL is
// itself below 5.5, and requires an uploaded document when it's used.
function assessFH(patient, firstDegreeFH = false, ldlOverride = false) {
  // Hard programme rule, not a score input — the programme is limited to
  // Singapore Citizens and Permanent Residents, so this blocks a referral
  // outright regardless of how strong the clinical criteria below are.
  const eligible = /citizen|permanent resident|\bpr\b/i.test(patient.nationality || "");

  const ldl = Number(patient.ldl) || 0;
  const highLdl = ldl >= 6.5;
  const rawElevatedLdl = ldl >= 5.5; // programme referral threshold, from the EMR record
  const elevatedLdl = rawElevatedLdl || ldlOverride;
  const personalCad = !!patient.coronary_stent_or_bypass;

  const criteria = [
    { key: "eligible", label: "Singapore Citizen or Permanent Resident", met: eligible },
    {
      key: "ldl",
      label: rawElevatedLdl
        ? `LDL-C (${ldl || "—"} mmol/L) at or above the 5.5 mmol/L referral threshold`
        : `LDL-C (${ldl || "—"} mmol/L) below the 5.5 mmol/L threshold — override if external proof of a qualifying result is available`,
      met: elevatedLdl,
      editable: !rawElevatedLdl,
    },
    { key: "personalCad", label: "Personal history of coronary stent or bypass", met: personalCad },
    { key: "firstDegreeFH", label: "First-degree relative with known FH", met: firstDegreeFH, editable: true },
  ];
  const metCount = criteria.filter((c) => c.met).length;

  // Referral is suggested if EITHER LDL-C ≥5.5 OR a first-degree relative
  // with known/suspected FH is present — blocked only when both are absent.
  // Personal CAD history is shown for context but doesn't factor into this gate.
  let recommendation, tone;
  if (!eligible) { recommendation = "Not eligible — Singapore Citizens/PRs only"; tone = "red"; }
  else if (elevatedLdl && firstDegreeFH) { recommendation = highLdl ? "Strong indication for referral" : "Referral recommended"; tone = "green"; }
  else if (elevatedLdl) { recommendation = "Meets LDL threshold — referral appropriate"; tone = "green"; }
  else if (firstDegreeFH) { recommendation = "First-degree relative with FH — referral appropriate"; tone = "green"; }
  else { recommendation = "LDL below threshold and no first-degree relative with FH — referral not indicated"; tone = "amber"; }

  return { recommendation, tone, criteria, metCount, eligible };
}
const FAQS = [
  ["What is familial hypercholesterolaemia (FH)?", "FH is an inherited condition that raises LDL cholesterol from birth. In Singapore about 1 in 250 people carry a gene change that can cause it, and it is usually silent — no symptoms — so it is often missed."],
  ["How serious is it if untreated?", "Untreated FH can raise the risk of early heart disease by up to around 20 times. It responds well to treatment and lifestyle changes."],
  ["I have no symptoms — why test?", "FH has no warning signs; the first sign can be a heart attack. A genetic test confirms the cause and lets close relatives be checked early."],
  ["Why test if I already take statins?", "A confirmed diagnosis sharpens treatment and enables cascade screening of relatives, who each have about a 50% chance of carrying the same gene change. An LDL result counts even if it was high before treatment."],
  ["What does the test involve?", "A referral to the Genetic Assessment Centre (GAC), pre-test counselling, a blood sample, and post-test counselling to explain results."],
  ["What will it cost?", "Eligible SC/PRs get means-tested subsidies of up to 70%. After subsidy, index testing is roughly $117–$575 and cascade screening $53–$253. The counsellor confirms your exact cost before testing."],
  ["Will this affect my insurance?", "Under the MOH–LIA Moratorium (since October 2021), life insurers cannot use predictive genetic test results within set limits. The GAC counsellor can explain what applies."],
  ["What does it mean for my family?", "Each first-degree relative has about a 50% chance of also having FH. If you test positive they can have subsidised cascade screening."],
  ["Where do my results go?", "Into your National Electronic Health Record, viewable via HealthHub, with the GAC report filed under your referral notes."],
];

const WIZARD_STEPS = ["Consent", "Retrieve", "Assessment", "Q&A", "Referral", "Submit"];
function Progress({ step }) {
  const n = WIZARD_STEPS.length;
  const donePct = Math.max(0, Math.min(100, (step / (n - 1)) * 100));
  return (
    <div className="stepper no-print">
      <div className="stepper-track">
        <div className="stepper-track-fill" style={{ width: donePct + "%" }} />
      </div>
      <div className="stepper-items">
        {WIZARD_STEPS.map((label, i) => (
          <div key={label} className={"stepper-item" + (i === step ? " active" : i < step ? " done" : "")}>
            <span className="stepper-dot">{i < step ? "✓" : i + 1}</span>
            <span className="stepper-label">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* AI assistant for the clinician — general program Q&A, no patient data. */
function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]); // { role: "user"|"model", text }
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    const history = messages;
    setMessages((m) => [...m, { role: "user", text }]);
    setInput(""); setErr(""); setSending(true);
    try {
      const { answer } = await API.chat.ask(text, history);
      setMessages((m) => [...m, { role: "model", text: answer }]);
    } catch (e) {
      setErr(e.message || "Something went wrong — please try again.");
    } finally {
      setSending(false);
    }
  };

  if (!open) {
    return (
      <button className="chatwidget-fab" onClick={() => setOpen(true)}>
        {Ic.chat}<span>Ask AI assistant</span>
      </button>
    );
  }
  return (
    <div className="chatwidget-panel">
      <div className="chatwidget-head">
        <b>Ask about the program</b>
        <button className="chatwidget-close" aria-label="Close" onClick={() => setOpen(false)}>✕</button>
      </div>
      <p className="small muted" style={{ margin: "0 0 10px" }}>
        For you, the clinician — eligibility, process, costs. Not for patient-specific advice;
        AI-generated, so confirm anything clinically important with the GAC.
      </p>
      <div className="chatwidget-msgs">
        {messages.length === 0 && (
          <p className="small muted">e.g. "Does a historical LDL result before starting statins still count?"</p>
        )}
        {messages.map((m, i) => <div key={i} className={"chatwidget-msg " + m.role}>{m.text}</div>)}
        {sending && <div className="chatwidget-msg model">…</div>}
      </div>
      {err && <p className="small" style={{ color: "var(--red)", margin: "6px 0 0" }}>{err}</p>}
      <div className="chatwidget-input">
        <input className="input" value={input} placeholder="Type a question…" disabled={sending}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()} />
        <button className="btn btn-sm" onClick={send} disabled={sending || !input.trim()}>Ask</button>
      </div>
    </div>
  );
}

/* FAQ accordion + AI assistant — shared by the referral wizard's Q&A step
   and the standalone Consulting page. */
function FaqAndAssistant() {
  const [openFaq, setOpenFaq] = useState(0);
  return (
    <>
      <div className="card">
        {FAQS.map(([q, a], i) => (
          <div key={i} style={{ borderBottom: "1px solid var(--line)" }}>
            <button onClick={() => setOpenFaq(openFaq === i ? -1 : i)} style={{ width: "100%", textAlign: "left", background: "none", border: "none", padding: "14px 0", fontSize: 16, fontWeight: 600, display: "flex", justifyContent: "space-between", gap: 12, color: "var(--ink)" }}>
              {q}<span style={{ color: "var(--teal)", fontSize: 20 }}>{openFaq === i ? "–" : "+"}</span>
            </button>
            {openFaq === i && <p className="muted" style={{ margin: "0 0 16px", fontSize: 15, lineHeight: 1.55 }}>{a}</p>}
          </div>
        ))}
      </div>
      <p className="small muted" style={{ marginTop: 14 }}>Figures are based on public MOH / GAC program information and may change — confirm current details with the GAC.</p>

      <div style={{ marginTop: 22 }}>
        <b>Unsure about something yourself?</b>
        <p className="sub" style={{ margin: "4px 0 12px" }}>Ask the AI assistant about the program — eligibility, process, costs.</p>
        <ChatWidget />
      </div>
    </>
  );
}

function Consulting() {
  return (
    <div>
      <h2 className="title">Consulting</h2>
      <p className="sub">Look up common questions or ask the AI assistant about the FH referral program — outside of an active referral.</p>
      <FaqAndAssistant />
    </div>
  );
}

function ReferralWizard({ user }) {
  const [step, setStep] = useState(0);
  const [patient, setPatient] = useState(null);
  const [fetching, setFetching] = useState(false);
  const [fetchErr, setFetchErr] = useState("");
  const [result, setResult] = useState(null);
  // Clinician-editable override for the "first-degree relative with FH"
  // criterion — starts at whatever the EMR record says, once a patient is
  // fetched.
  const [firstDegreeFH, setFirstDegreeFH] = useState(false);
  // Clinician override for the LDL criterion when the EMR figure is below
  // threshold but external proof of a qualifying result exists.
  const [ldlOverride, setLdlOverride] = useState(false);

  const getCurrent = async () => {
    setFetchErr(""); setFetching(true);
    try { const { patient } = await API.emr.currentPatient(); setPatient(patient); setFirstDegreeFH(false); setLdlOverride(false); setStep(2); }
    catch (e) { setPatient(null); setFetchErr(e.message); } finally { setFetching(false); }
  };
  const simulateNext = async () => {
    setFetchErr(""); setFetching(true);
    try { const { patient } = await API.emr.nextPatient(); setPatient(patient); setFirstDegreeFH(false); setLdlOverride(false); setStep(2); }
    catch (e) { setPatient(null); setFetchErr(e.message); } finally { setFetching(false); }
  };

  // Ends the wizard without a referral (declined/deferred, not suggested by
  // the system, or not eligible on nationality). Nothing is written to the
  // referrals table for these — logged separately so the patient still
  // shows up in the history list.
  const endWithoutReferral = (outcome) => {
    if (patient) {
      const reason = outcome.notEligible ? "not_eligible" : outcome.notSuggested ? "not_suggested" : "declined";
      API.referrals.logNotMade({ patient_nric: patient.nric, patient_name: patient.name, reason }).catch(() => {});
    }
    setResult(outcome);
  };

  if (result) return <Submitted referral={result} onRestart={() => {
    setStep(0); setPatient(null); setResult(null); setFirstDegreeFH(false); setLdlOverride(false);
  }} />;

  return (
    <div>
      <div className="topbar"><Progress step={step} /></div>

      {step === 0 && (
        <div>
          <h2 className="title">Record consent</h2>
          <p className="sub">Confirm the patient agrees to proceed for the GAC referral and personal data will be collected from EMR when referral is made.</p>
          <div className="card">
            <p style={{ fontSize: 15, lineHeight: 1.6, marginTop: 0 }}>
              Please record the patient's consent before proceeding. Do they agree to proceed?
            </p>
            <p style={{ background: "var(--teal-soft)", borderRadius: 10, padding: "10px 14px" }} className="small muted">
              The patient's record is retrieved from the EMR only after consent is recorded.
            </p>
            <div className="row-actions">
              <button className="btn" onClick={() => setStep(1)}>Patient consents — continue</button>
              <button className="btn-danger" onClick={() => endWithoutReferral({ declined: true })}>Patient declines or defers</button>
            </div>
          </div>
        </div>
      )}

      {step === 1 && (
        <div>
          <h2 className="title">Retrieve patient record</h2>
          <p className="sub">Consent recorded. The tool now requests the patient currently open in the EMR — no manual lookup.</p>
          <div className="card">
            <button className="btn" disabled={fetching} onClick={getCurrent}>
              {fetching ? "Contacting EMR…" : "Get current patient from EMR"}
            </button>
            <p className="small muted" style={{ marginTop: 12 }}>
              The website calls the EMR API for the patient open in this consultation and autofills the referral from the record it returns.
            </p>
            <p className="small muted" style={{ marginTop: 8 }}>
              Open a patient in the <a href="/emr" target="_blank">demo EMR</a> first, or <a href="#" onClick={(e) => { e.preventDefault(); simulateNext(); }}>simulate one</a>.
            </p>
            {fetchErr && <p className="err">{fetchErr}</p>}
          </div>
          <div style={{ marginTop: 18 }}><button className="btn-ghost" onClick={() => setStep(0)}>Back</button></div>
        </div>
      )}

      {step === 2 && patient && (() => {
        const a = assessFH(patient, firstDegreeFH, ldlOverride);
        const suggested = a.tone === "green";
        return (
          <div>
            <h2 className="title">Assessment</h2>
            <p className="sub">Automated FH likelihood check from the retrieved EMR record — a decision-support aid, not a replacement for clinical judgement.</p>
            <div className="card" style={{ marginBottom: 18 }}>
              <div className="row-actions" style={{ justifyContent: "space-between" }}>
                <b>{patient.name} · {patient.nric}</b>
                <Badge tone={a.tone}>{a.recommendation}</Badge>
              </div>
              <p className="sub" style={{ margin: "6px 0 14px" }}>{a.metCount} of {a.criteria.length} criteria met, based on fields available from the EMR.</p>
              {a.criteria.map((c) => (
                <div key={c.key} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
                  {c.editable ? (
                    <input type="checkbox" checked={c.met}
                      onChange={(e) => (c.key === "ldl" ? setLdlOverride(e.target.checked) : setFirstDegreeFH(e.target.checked))}
                      style={{ marginTop: 3, width: 16, height: 16, flex: "0 0 auto", accentColor: "var(--teal)" }} />
                  ) : (
                    <span style={{ fontWeight: 700, fontSize: 15, color: c.met ? "var(--green)" : "var(--ink-soft)" }}>{c.met ? "✓" : "—"}</span>
                  )}
                  <span style={{ fontSize: 15 }}>{c.label}</span>
                </div>
              ))}
            </div>

            {suggested ? (
              <div className="row-actions">
                <button className="btn-ghost" onClick={() => { setPatient(null); setStep(1); }}>Back</button>
                <button className="btn" onClick={() => setStep(3)}>Continue to patient Q&amp;A</button>
                <button className="btn-danger" onClick={() => endWithoutReferral({ declined: true })}>Patient declines or defers</button>
              </div>
            ) : (
              <div className="row-actions">
                <button className="btn-ghost" onClick={() => { setPatient(null); setStep(1); }}>Back</button>
                <button className="btn-danger" onClick={() => endWithoutReferral(!a.eligible ? { notEligible: true } : { notSuggested: true })}>
                  {!a.eligible ? "Not eligible — do not refer" : "Not suggested by system — do not refer"}
                </button>
                <button className="btn-danger" onClick={() => endWithoutReferral({ declined: true })}>Patient declines or defers</button>
              </div>
            )}
          </div>
        );
      })()}

      {step === 3 && (
        <div>
          <h2 className="title">Explain to the patient</h2>
          <p className="sub">Use these to answer common questions and keep messaging consistent.</p>
          <FaqAndAssistant />

          <div className="row-actions" style={{ marginTop: 18 }}>
            <button className="btn-ghost" onClick={() => setStep(2)}>Back</button>
            <button className="btn" onClick={() => setStep(4)}>Continue to referral form</button>
            <button className="btn-danger" onClick={() => endWithoutReferral({ declined: true })}>Patient declines or defers</button>
          </div>
        </div>
      )}

      {step === 4 && patient && (
        <ReferralForm patient={patient} user={user} firstDegreeFH={firstDegreeFH} ldlOverride={ldlOverride}
          onBack={() => setStep(3)}
          onDone={(ref) => setResult(ref)} />
      )}
    </div>
  );
}

const LDL_OVERRIDE_NOTE = "Doctor manually overrode the LDL-C threshold — external proof of a qualifying result (≥5.5 mmol/L) has been sighted and is attached.";
const FIRST_DEGREE_FH_NOTE = "Patient has a first-degree relative with known FH.";

function ReferralForm({ patient, user, firstDegreeFH, ldlOverride, onBack, onDone }) {
  const systemSuggested = assessFH(patient, firstDegreeFH, ldlOverride).tone === "green";
  const [form, setForm] = useState({
    patient_name: patient.name, patient_nric: patient.nric, dob: patient.dob ? patient.dob.slice(0, 10) : "",
    sex: patient.gender, nationality: patient.nationality, contact: patient.contact,
    ldl: patient.ldl, ldl_test_date: patient.ldl_test_date ? patient.ldl_test_date.slice(0, 10) : "",
    // No source data for testing location — default to Singapore rather than
    // leave blank; this is a referral-time default only, never written back
    // to the patient record.
    ldl_test_location: "Singapore", total_chol: patient.total_chol ?? "",
    on_statin: patient.on_statin == null ? "" : (patient.on_statin ? "Yes" : "No"),
    referrer_label: user.clinician_id, clinic: user.clinic || patient.clinic,
    notes: [firstDegreeFH && FIRST_DEGREE_FH_NOTE, ldlOverride && LDL_OVERRIDE_NOTE].filter(Boolean).join("\n"),
  });
  const [tried, setTried] = useState(false); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const [proofFile, setProofFile] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const required = ["patient_name", "patient_nric", "contact", "ldl", "ldl_test_date", "ldl_test_location", "on_statin", "referrer_label", "clinic"];
  const missing = required.filter((k) => !String(form[k]).trim());
  const proofMissing = ldlOverride && !proofFile;

  const submit = async () => {
    setTried(true); setErr("");
    if (missing.length || proofMissing) return;
    setBusy(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v ?? ""));
      fd.append("system_suggested", String(systemSuggested));
      fd.append("ldl_override", String(!!ldlOverride));
      if (proofFile) fd.append("ldl_proof", proofFile);
      const { referral } = await API.referrals.create(fd);
      onDone(referral);
    }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <div>
      <h2 className="title">Referral form</h2>
      <p className="sub">Fields pre-filled from the EMR. Review, add notes, then submit.</p>
      <div className="card">
        <div className="row-actions" style={{ justifyContent: "space-between", marginBottom: 14 }}>
          <div className="row-actions">
            <Badge tone="green">Autofilled from EMR</Badge>
            {!systemSuggested && <Badge tone="amber">Not suggested by system</Badge>}
            {ldlOverride && <Badge tone="amber">LDL threshold overridden</Badge>}
          </div>
          {tried && missing.length > 0 && <span className="err">{missing.length} required field(s) missing</span>}
        </div>
        <div className="grid-2">
          <Field label="Patient name" value={form.patient_name} onChange={(v) => set("patient_name", v)} disabled />
          <Field label="NRIC" value={form.patient_nric} onChange={(v) => set("patient_nric", v)} disabled />
          <Field label="Contact" value={form.contact} onChange={(v) => set("contact", v)} disabled />
          <Field label="Date of birth" type="date" value={form.dob} onChange={(v) => set("dob", v)} disabled />
          <Field label="Sex" value={form.sex} onChange={(v) => set("sex", v)} disabled />
          <Field label="Nationality" value={form.nationality} onChange={(v) => set("nationality", v)} disabled />
          <Field label="LDL (mmol/L) *" value={form.ldl} onChange={(v) => set("ldl", v)} bad={tried && !String(form.ldl).trim()} disabled />
          <Field label="LDL test date *" type="date" value={form.ldl_test_date} onChange={(v) => set("ldl_test_date", v)} bad={tried && !form.ldl_test_date} />
          <Field label="Testing location *" value={form.ldl_test_location} onChange={(v) => set("ldl_test_location", v)} bad={tried && !String(form.ldl_test_location).trim()} />
          <Select label="On statin *" value={form.on_statin} onChange={(v) => set("on_statin", v)} options={["Yes", "No"]} bad={tried && !form.on_statin} />
          <Field label="Total cholesterol" value={form.total_chol} onChange={(v) => set("total_chol", v)} />
          <Field label="Referring clinician" value={form.referrer_label} onChange={(v) => set("referrer_label", v)} disabled />
          <Field label="Clinic" value={form.clinic} onChange={(v) => set("clinic", v)} disabled />
        </div>
        <label className="label" style={{ marginTop: 14 }}>Clinical notes (optional)</label>
        <textarea className="input" value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Family history, supporting features, relevant findings…" />

        {ldlOverride && (
          <div style={{ marginBottom: 16 }}>
            <label className="label">Supporting document for LDL override *</label>
            <input type="file" accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => setProofFile(e.target.files[0] || null)} />
            {proofFile && <p className="small muted" style={{ marginTop: 6 }}>Selected: {proofFile.name}</p>}
            {tried && proofMissing && <p className="err">Attach the supporting document before submitting.</p>}
          </div>
        )}

        {err && <p className="err">{err}</p>}
        <div className="row-actions">
          <button className="btn-ghost" onClick={onBack}>Back</button>
          <button className="btn" disabled={busy} onClick={submit}>{busy ? "Submitting…" : "Submit referral to GAC"}</button>
        </div>
      </div>
    </div>
  );
}

function Submitted({ referral, onRestart }) {
  const [showInfo, setShowInfo] = useState(false);
  if (referral.declined || referral.notSuggested || referral.notEligible) {
    return (
      <div className="card" style={{ textAlign: "center" }}>
        <Badge tone="red">Referral not made</Badge>
        <h2 className="title" style={{ marginTop: 14 }}>
          {referral.notEligible ? "Not eligible for this programme"
            : referral.notSuggested ? "Not suggested by the automated assessment"
            : "Patient declined or deferred referral"}
        </h2>
        <p className="sub">
          {referral.notEligible
            ? "Programme eligibility is limited to Singapore Citizens and Permanent Residents. No referral was submitted."
            : referral.notSuggested
            ? "Based on the EMR data available, the assessment did not find enough criteria met to suggest a referral for this patient. No referral was submitted."
            : "No referral was submitted."}
        </p>
        <div className="row-actions-center">
          <button className="btn" onClick={onRestart}>Start a new patient</button>
          <button className="btn" onClick={() => setShowInfo(true)}>More information for patients</button>
          <PrintLeafletButton />
        </div>
        {showInfo && (
          <ImageModal
            src="/images/QR2.png"
            alt="More information"
            onClose={() => setShowInfo(false)}
          />
        )}
      </div>
    );
  }
  return (
    <div>
      <div className="topbar no-print" style={{ marginBottom: 18 }}><Progress step={5} /></div>
      <div className="card no-print" style={{ marginBottom: 18 }}>
        <Badge tone="green">Referral submitted</Badge>
        <h2 className="title" style={{ marginTop: 14 }}>Sent to the Genetic Assessment Centre</h2>
        <p className="sub">Reference <b>{referral.reference}</b>. Print a copy for the patient below.</p>
        <div className="row-actions">
          <button className="btn" onClick={() => window.print()}>Print patient copy</button>
          <button className="btn-ghost" onClick={onRestart}>Start a new patient</button>
        </div>
      </div>
      <ReferralPrint r={referral} />
    </div>
  );
}

function ReferralPrint({ r }) {
  const Row = ({ k, v }) => (
    <div style={{ display: "flex", padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
      <div style={{ width: 180, flex: "0 0 180px", color: "var(--ink-soft)", fontSize: 14, fontWeight: 600 }}>{k}</div>
      <div style={{ flex: 1, minWidth: 0, fontSize: 15, whiteSpace: "pre-wrap" }}>{v}</div>
    </div>
  );
  return (
    <div className="card">
      <div style={{ borderBottom: "2px solid var(--ink)", paddingBottom: 12, marginBottom: 16 }}>
        <div style={{ fontSize: 22, fontWeight: 700 }}>FH Genetic Testing Referral</div>
        <div className="small muted">Genetic Assessment Centre · Reference {r.reference}</div>
      </div>
      <Row k="Patient" v={`${r.patient_name} (${r.patient_nric})`} />
      <Row k="Date of birth / Sex" v={`${fmtDMY(r.dob)} · ${r.sex ?? "—"}`} />
      <Row k="Nationality" v={r.nationality ?? "—"} />
      <Row k="Contact" v={r.contact} />
      <Row k="LDL" v={`${r.ldl} mmol/L`} />
      <Row k="LDL test date" v={fmtDMY(r.ldl_test_date)} />
      <Row k="Testing location" v={r.ldl_test_location || "—"} />
      <Row k="Total cholesterol" v={r.total_chol ? `${r.total_chol} mmol/L` : "—"} />
      <Row k="On statin" v={r.on_statin || "—"} />
      <Row k="Referring clinician" v={r.referrer_label} />
      <Row k="Clinic" v={r.clinic} />
      <Row k="Notes" v={r.notes || "—"} />
    </div>
  );
}

// "View" button for a referral in the history list — gated behind an SMS
// code the patient has to read out to the clinician, rather than a plain
// drill-down. Three-step: confirm the patient has consented to the SMS
// (PDPA — they're the one paying for/receiving it, so they should agree to
// it first), request a code (sent to the patient's phone; this build has no
// SMS gateway, so it's logged server-side and only echoed back in the
// response outside production — same pattern as the no-mail-server "Forgot
// password" flow), then verify it to reveal the full referral.
function ViewReferralButton({ reference }) {
  const [step, setStep] = useState("idle"); // idle | consent | enter | viewing
  const [otp, setOtp] = useState("");
  const [devOtp, setDevOtp] = useState("");
  const [contactHint, setContactHint] = useState("");
  const [referral, setReferral] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const start = async () => {
    setErr(""); setBusy(true);
    try {
      const r = await API.referrals.requestViewOtp(reference);
      setContactHint(r.contactHint || ""); setDevOtp(r.otp || ""); setOtp("");
      setStep("enter");
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };
  const verify = async () => {
    setErr(""); setBusy(true);
    try {
      const { referral } = await API.referrals.verifyViewOtp(reference, otp);
      setReferral(referral); setStep("viewing");
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };
  const close = () => { setStep("idle"); setOtp(""); setErr(""); setReferral(null); setDevOtp(""); };

  return (
    <>
      <button className="btn-ghost btn-sm" onClick={() => { setErr(""); setStep("consent"); }} disabled={busy}>View</button>
      {step === "idle" && err && <p className="small err" style={{ marginTop: 4 }}>{err}</p>}

      {step === "consent" && (
        <div className="modal-overlay" onClick={close}>
          <div className="modal-box" style={{ maxWidth: 380, textAlign: "left" }} onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" aria-label="Close" onClick={close}>✕</button>
            <h3 style={{ margin: "0 0 8px", fontSize: 18 }}>Confirm patient consent</h3>
            <p className="sub" style={{ margin: "0 0 16px" }}>
              Before a verification code is sent, please confirm the patient is
              present and has agreed to receive an SMS to verify this request.
            </p>
            {err && <p className="err">{err}</p>}
            <button className="btn btn-full" disabled={busy} onClick={start}>
              {busy ? "Sending…" : "Patient consents — send code"}
            </button>
          </div>
        </div>
      )}

      {step === "enter" && (
        <div className="modal-overlay" onClick={close}>
          <div className="modal-box" style={{ maxWidth: 380, textAlign: "left" }} onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" aria-label="Close" onClick={close}>✕</button>
            <h3 style={{ margin: "0 0 8px", fontSize: 18 }}>Verify with patient</h3>
            <p className="sub" style={{ margin: "0 0 12px" }}>
              A verification code has been sent by SMS to the patient's phone{contactHint ? ` (${contactHint})` : ""}.
              Ask them to read it out before viewing this referral.
            </p>
            {devOtp && (
              <p className="small muted" style={{ margin: "0 0 12px" }}>
                No SMS gateway is set up for this build — code (dev only): <b>{devOtp}</b>
              </p>
            )}
            <Field label="Verification code" value={otp} onChange={setOtp} placeholder="6-digit code" />
            {err && <p className="err">{err}</p>}
            <button className="btn btn-full" disabled={busy || !otp.trim()} onClick={verify}>
              {busy ? "Verifying…" : "Verify and view"}
            </button>
          </div>
        </div>
      )}

      {step === "viewing" && referral && (
        <div className="modal-overlay" onClick={close}>
          <div className="modal-box" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" aria-label="Close" onClick={close}>✕</button>
            <div style={{ maxHeight: "80vh", overflowY: "auto", overflowX: "hidden" }}>
              <div className="row-actions no-print" style={{ marginBottom: 14 }}>
                <button className="btn" onClick={() => window.print()}>Print copy</button>
              </div>
              <ReferralPrint r={referral} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ══════════════════════════════════════════════════════════════
   REFERRALS
   ══════════════════════════════════════════════════════════════ */
function Referrals() {
  const [q, setQ] = useState(""); const [list, setList] = useState([]); const [err, setErr] = useState("");
  const load = useCallback(() => {
    setErr("");
    const s = q.trim().toLowerCase();
    const matches = (name, nric) => !s || (name || "").toLowerCase().includes(s) || (nric || "").toLowerCase().includes(s);
    Promise.all([API.referrals.list(q), API.referrals.listNotMade()])
      .then(([referred, notMade]) => {
        const referredRows = referred.referrals.map((r) => ({ ...r, outcome: "referred" }));
        const notMadeRows = notMade.entries
          .filter((e) => matches(e.patient_name, e.patient_nric))
          .map((e) => ({ ...e, outcome: e.reason }));
        const merged = [...referredRows, ...notMadeRows]
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        setList(merged);
      })
      .catch((e) => setErr(e.message));
  }, [q]);
  useEffect(() => { load(); }, [load]);
  return (
    <div>
      <div className="page-head"><div>
        <h2 className="title">Referrals</h2>
        <p className="sub">Patients seen through the referral tool — submitted, declined/deferred, or not suggested by the system.</p>
      </div></div>
      <input className="input" placeholder="Search reference, patient name, or NRIC" value={q} onChange={(e) => setQ(e.target.value)} />
      {err && <p className="err">{err}</p>}
      {list.length === 0 ? <p className="muted">No referrals yet.</p> : (
        <table className="table">
          <thead><tr><th>Reference</th><th>NRIC</th><th>Outcome</th><th>When</th><th>Details</th></tr></thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.reference || `nm-${r.id}`}>
                <td>{r.reference || "—"}</td><td>{r.patient_nric}</td>
                <td>
                  {r.outcome === "referred"
                    ? <Badge tone="teal">{r.status}</Badge>
                    : <Badge tone="red">
                        {r.outcome === "not_eligible" ? "Not eligible (nationality)"
                          : r.outcome === "not_suggested" ? "Not suggested — not referred"
                          : "Declined / deferred"}
                      </Badge>}
                </td>
                <td>{fmtDMYHM(r.created_at)}</td>
                <td>{r.outcome === "referred" && <ViewReferralButton reference={r.reference} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   PROFILE & SETTINGS
   ══════════════════════════════════════════════════════════════ */
function Profile({ user }) {
  return (
    <div>
      <h2 className="title">Profile</h2>
      <p className="sub">Your clinician details. These are set by your administrator and cannot be changed here.</p>
      <div className="card" style={{ maxWidth: 520 }}>
        <Field label="Clinician ID" value={user.clinician_id} onChange={() => { }} disabled />
        <Field label="Full name" value={user.name} onChange={() => { }} disabled />
        <Field label="Clinic" value={user.clinic || ""} onChange={() => { }} disabled />
        <p className="small muted" style={{ marginTop: 14 }}>Contact your system administrator to update these details.</p>
      </div>
    </div>
  );
}

function Settings({ user }) {
  const [cur, setCur] = useState(""); const [n1, setN1] = useState(""); const [n2, setN2] = useState("");
  const [msg, setMsg] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const change = async () => {
    setMsg(""); setErr("");
    if (n1.length < 8) return setErr("New password must be at least 8 characters.");
    if (n1 !== n2) return setErr("New passwords do not match.");
    setBusy(true);
    try { await API.me.changePassword(cur, n1); setMsg("Password changed."); setCur(""); setN1(""); setN2(""); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <div>
      <h2 className="title">Settings</h2>
      <p className="sub">Account security and preferences.</p>
      <div className="card" style={{ maxWidth: 520, marginBottom: 18 }}>
        <b>Change password</b>
        <div style={{ marginTop: 12 }}>
          <Field label="Current password" type="password" value={cur} onChange={setCur} />
          <Field label="New password" type="password" value={n1} onChange={setN1} />
          <Field label="Confirm new password" type="password" value={n2} onChange={setN2} />
          {msg && <p className="ok">{msg}</p>}{err && <p className="err">{err}</p>}
          <button className="btn" disabled={busy} onClick={change}>{busy ? "Saving…" : "Update password"}</button>
        </div>
      </div>
      <div className="card" style={{ maxWidth: 520 }}>
        <b>Account</b>
        <p className="small muted" style={{ marginTop: 8 }}>
          Signed in as {user.name} ({user.clinician_id}), role {user.role}.
        </p>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   ROOT
   ══════════════════════════════════════════════════════════════ */
function App() {
  const route = useHashRoute();
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!API.getToken()) { setReady(true); return; }
    API.me.get().then(({ user }) => setUser(user)).catch(() => API.clearToken()).finally(() => setReady(true));
  }, []);

  const signOut = () => { API.clearToken(); setUser(null); navigate("/login"); };

  if (!ready) return <div className="auth-wrap"><p className="muted">Loading…</p></div>;

  // Unauthenticated routes
  if (!user) {
    if (route.path === "/register") return <Register onAuthed={setUser} />;
    if (route.path === "/forgot") return <Forgot />;
    if (route.path === "/reset") return <ResetPassword token={route.query.token} />;
    return <Login onAuthed={setUser} />;
  }

  // Authenticated app — the eligibility checklist (referral wizard) is home.
  let page;
  const seg = route.path.split("/");
  if (seg[1] === "refer" || route.path === "/" || route.path === "") page = <ReferralWizard user={user} key="new" />;
  else if (seg[1] === "referrals") page = <Referrals />;
  else if (seg[1] === "consulting") page = <Consulting />;
  else if (seg[1] === "profile") page = <Profile user={user} />;
  else if (seg[1] === "settings") page = <Settings user={user} />;
  else page = <ReferralWizard user={user} key="new" />;

  return <Shell user={user} route={route} onSignOut={signOut}>{page}</Shell>;
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
