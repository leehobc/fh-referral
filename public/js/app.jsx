const { useState, useEffect, useCallback } = React;
const API = window.API;
const LDL_THRESHOLD = 5.5;

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
const fmtDate = (d) => (d ? new Date(d).toLocaleString() : "—");

function ImageModal({ src, alt, onClose }) {
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
      </div>
    </div>
  );
}

function Field({ label, value, onChange, bad, type = "text", placeholder }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input className={"input" + (bad ? " bad" : "")} type={type} value={value ?? ""}
        placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   AUTH PAGES
   ══════════════════════════════════════════════════════════════ */
function Login({ onAuthed }) {
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setErr("");
    if (!id || !pw) return setErr("Enter your clinician ID and password.");
    setBusy(true);
    try {
      const { token, user } = await API.auth.login(id, pw);
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
          <h2 className="title" style={{ fontSize: 22 }}>Sign in</h2>
          <p className="sub">Secure clinician access only.</p>
          <label className="label">Clinician ID</label>
          <input className="input" value={id} onChange={(e) => setId(e.target.value)} placeholder="e.g. DR-10567" />
          <label className="label">Password</label>
          <input className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="••••••••" />
          {err && <p className="err">{err}</p>}
          <button className="btn btn-full" disabled={busy} onClick={submit}>{busy ? "Signing in…" : "Sign in"}</button>
          <p style={{ textAlign: "center", margin: "14px 0 0" }}>
            <a href="#/forgot">Forgot password?</a>
          </p>
          <p className="small muted" style={{ textAlign: "center", marginTop: 10 }}>
            New here? <a href="#/register">Create an account</a>
          </p>
        </div>
      </div>
    </div>
  );
}

function Register({ onAuthed }) {
  const [f, setF] = useState({ clinician_id: "", name: "", email: "", clinic: "", password: "" });
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const submit = async () => {
    setErr(""); setBusy(true);
    try {
      const { token, user } = await API.auth.register(f);
      API.setToken(token); onAuthed(user); navigate("/");
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <div className="auth-wrap"><div className="auth-card card">
      <h2 className="title" style={{ fontSize: 22 }}>Create clinician account</h2>
      <p className="sub">Register to start referring patients.</p>
      <Field label="Clinician ID *" value={f.clinician_id} onChange={(v) => set("clinician_id", v)} placeholder="e.g. DR-20481" />
      <Field label="Full name *" value={f.name} onChange={(v) => set("name", v)} placeholder="Dr …" />
      <Field label="Email" value={f.email} onChange={(v) => set("email", v)} />
      <Field label="Clinic" value={f.clinic} onChange={(v) => set("clinic", v)} />
      <Field label="Password * (min 8 chars)" type="password" value={f.password} onChange={(v) => set("password", v)} />
      {err && <p className="err">{err}</p>}
      <button className="btn btn-full" disabled={busy} onClick={submit}>{busy ? "Creating…" : "Create account"}</button>
      <p className="small muted" style={{ textAlign: "center", marginTop: 12 }}><a href="#/login">Back to sign in</a></p>
    </div></div>
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
const REQUIRED = [
  { key: "resident", label: "Patient is a Singapore Citizen or Permanent Resident", hint: "Eligibility is limited to SC / PR." },
  { key: "ldl", label: `LDL-C ≥ ${LDL_THRESHOLD} mmol/L — now, or documented in the past`, hint: "Historical or pre-treatment results count if well-documented." },
  { key: "secondary", label: "Secondary causes considered or excluded", hint: "e.g. hypothyroidism, nephrotic syndrome, certain drugs, or diet." },
  { key: "adult", label: "Patient is an adult able to give informed consent", hint: "Required before any referral proceeds." },
];
const SUPPORTING = [
  "Family history of premature coronary heart disease (men < 55, women < 60)",
  "Family history of very high cholesterol or known FH",
  "Personal history of premature cardiovascular disease",
  "Physical signs: tendon xanthomata or corneal arcus before age 45",
];
const FAQS = [
  ["What is familial hypercholesterolaemia (FH)?", "FH is an inherited condition that raises LDL cholesterol from birth. In Singapore about 1 in 140 people carry a gene change that can cause it, and it is usually silent — no symptoms — so it is often missed."],
  ["How serious is it if untreated?", "Untreated FH can raise the risk of early heart disease by up to around 20 times. It responds well to treatment and lifestyle changes."],
  ["I have no symptoms — why test?", "FH has no warning signs; the first sign can be a heart attack. A genetic test confirms the cause and lets close relatives be checked early."],
  ["Why test if I already take statins?", "A confirmed diagnosis sharpens treatment and enables cascade screening of relatives, who each have about a 50% chance of carrying the same gene change. An LDL result counts even if it was high before treatment."],
  ["What does the test involve?", "A referral to the Genetic Assessment Centre (GAC), pre-test counselling, a blood sample, and post-test counselling to explain results."],
  ["What will it cost?", "Eligible SC/PRs get means-tested subsidies of up to 70%. After subsidy, index testing is roughly $117–$575 and cascade screening $53–$253. The counsellor confirms your exact cost before testing."],
  ["Will this affect my insurance?", "Under the MOH–LIA Moratorium (since October 2021), life insurers cannot use predictive genetic test results within set limits. The GAC counsellor can explain what applies."],
  ["What does it mean for my family?", "Each first-degree relative has about a 50% chance of also having FH. If you test positive they can have subsidised cascade screening."],
  ["Where do my results go?", "Into your National Electronic Health Record, viewable via HealthHub, with the GAC report filed under your referral notes."],
];

const WIZARD_STEPS = ["Consent", "Checklist", "Q&A", "Referral", "Submit"];
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
function Check({ label, hint, checked, onChange, disabled }) {
  return (
    <label className="check" style={{ opacity: disabled ? 0.5 : 1, cursor: disabled ? "not-allowed" : "pointer" }}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span><span style={{ fontSize: 15 }}>{label}</span>
        {hint && <span className="small muted" style={{ display: "block", marginTop: 2 }}>{hint}</span>}</span>
    </label>
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

function ReferralWizard({ user }) {
  const [step, setStep] = useState(0);
  const [checks, setChecks] = useState({ resident: false, ldl: false, secondary: false, adult: false });
  const [support, setSupport] = useState(SUPPORTING.map(() => false));
  const [openFaq, setOpenFaq] = useState(0);
  const [patient, setPatient] = useState(null);
  const [fetching, setFetching] = useState(false);
  const [fetchErr, setFetchErr] = useState("");
  const [result, setResult] = useState(null);

  const allReq = REQUIRED.every((c) => checks[c.key]);

  const getCurrent = async () => {
    setFetchErr(""); setFetching(true);
    try { const { patient } = await API.emr.currentPatient(); setPatient(patient); }
    catch (e) { setPatient(null); setFetchErr(e.message); } finally { setFetching(false); }
  };
  const simulateNext = async () => {
    setFetchErr(""); setFetching(true);
    try { const { patient } = await API.emr.nextPatient(); setPatient(patient); }
    catch (e) { setPatient(null); setFetchErr(e.message); } finally { setFetching(false); }
  };

  if (result) return <Submitted referral={result} onRestart={() => {
    setStep(0); setChecks({ resident: false, ldl: false, secondary: false, adult: false });
    setSupport(SUPPORTING.map(() => false)); setPatient(null); setResult(null);
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
              <button className="btn-danger" onClick={() => setResult({ declined: true })}>Patient declines</button>
            </div>
          </div>
          <div style={{ marginTop: 18 }}><button className="btn-ghost" onClick={() => setStep(1)}>Back</button></div>
        </div>
      )}

      {step === 1 && (
        <div>
          <h2 className="title">Confirm eligibility</h2>
          <p className="sub">Confirm the program criteria for this patient before starting a referral.</p>
          <div className="card" style={{ marginBottom: 18 }}>
            <div className="row-actions" style={{ justifyContent: "space-between" }}>
              <b>Required criteria</b>
              <Badge tone={allReq ? "green" : "amber"}>{allReq ? "All confirmed" : `${REQUIRED.filter(c => checks[c.key]).length} of 4`}</Badge>
            </div>
            <p className="sub" style={{ margin: "6px 0 10px" }}>All four must be confirmed to refer.</p>
            {REQUIRED.map((c) => <Check key={c.key} {...c} checked={checks[c.key]} onChange={(v) => setChecks(s => ({ ...s, [c.key]: v }))} />)}
          </div>
          <div className="card" style={{ marginBottom: 18 }}>
            <b>Supporting clinical features <span className="muted small">(optional)</span></b>
            <p className="sub" style={{ margin: "4px 0 12px" }}>These raise suspicion of FH but are not required. Tick any that apply.</p>
            {SUPPORTING.map((f, i) => <Check key={i} label={f} checked={support[i]} onChange={(v) => setSupport(s => s.map((x, j) => j === i ? v : x))} />)}
          </div>
          <div className="row-actions">
            <button className="btn" disabled={!allReq} onClick={() => setStep(2)}>Continue to patient Q&amp;A</button>
            {!allReq && <span className="small muted">Confirm all required criteria to continue.</span>}
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <h2 className="title">Explain to the patient</h2>
          <p className="sub">Use these to answer common questions and keep messaging consistent.</p>
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

          <div className="row-actions" style={{ marginTop: 18 }}>
            <button className="btn-ghost" onClick={() => setStep(1)}>Back</button>
            <button className="btn" onClick={() => setStep(3)}>Retrieve patient record</button>
          </div>
        </div>
      )}


      {step === 3 && !patient && (
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
          <div style={{ marginTop: 18 }}><button className="btn-ghost" onClick={() => setStep(2)}>Back</button></div>
        </div>
      )}

      {step === 3 && patient && (
        <ReferralForm patient={patient} user={user}
          onBack={() => setPatient(null)}
          onDone={(ref) => setResult(ref)} />
      )}
    </div>
  );
}

function ReferralForm({ patient, user, onBack, onDone }) {
  const [form, setForm] = useState({
    patient_name: patient.name, patient_nric: patient.nric, age: patient.age,
    sex: patient.gender, nationality: patient.nationality, contact: patient.contact,
    ldl: patient.ldl, total_chol: patient.total_chol ?? "",
    on_statin: patient.on_statin == null ? "" : (patient.on_statin ? "Yes" : "No"),
    referrer_label: user.clinician_id, clinic: user.clinic || patient.clinic, notes: "",
  });
  const [tried, setTried] = useState(false); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const required = ["patient_name", "patient_nric", "contact", "ldl", "referrer_label", "clinic"];
  const missing = required.filter((k) => !String(form[k]).trim());
  const below = !(parseFloat(form.ldl) >= LDL_THRESHOLD);

  const submit = async () => {
    setTried(true); setErr("");
    if (missing.length) return;
    setBusy(true);
    try { const { referral } = await API.referrals.create(form); onDone(referral); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <div>
      <h2 className="title">Referral form</h2>
      <p className="sub">Fields pre-filled from the EMR. Review, add notes, then submit.</p>
      <div className="card">
        <div className="row-actions" style={{ justifyContent: "space-between", marginBottom: 14 }}>
          <Badge tone="green">Autofilled from EMR</Badge>
          {tried && missing.length > 0 && <span className="err">{missing.length} required field(s) missing</span>}
        </div>
        {below && <p style={{ background: "var(--amber-bg)", color: "var(--amber)", borderRadius: 10, padding: "10px 14px", fontSize: 14, margin: "0 0 16px" }}>
          Recorded LDL is below {LDL_THRESHOLD} mmol/L. Confirm a documented past result ≥ {LDL_THRESHOLD} before referring.
        </p>}
        <div className="grid-2">
          <Field label="Patient name *" value={form.patient_name} onChange={(v) => set("patient_name", v)} bad={tried && !form.patient_name} />
          <Field label="NRIC *" value={form.patient_nric} onChange={(v) => set("patient_nric", v)} bad={tried && !form.patient_nric} />
          <Field label="Contact *" value={form.contact} onChange={(v) => set("contact", v)} bad={tried && !form.contact} />
          <Field label="Age" value={form.age} onChange={(v) => set("age", v)} />
          <Field label="Sex" value={form.sex} onChange={(v) => set("sex", v)} />
          <Field label="Nationality" value={form.nationality} onChange={(v) => set("nationality", v)} />
          <Field label="LDL (mmol/L) *" value={form.ldl} onChange={(v) => set("ldl", v)} bad={tried && !String(form.ldl).trim()} />
          <Field label="Total cholesterol" value={form.total_chol} onChange={(v) => set("total_chol", v)} />
          <Field label="On statin" value={form.on_statin} onChange={(v) => set("on_statin", v)} />
          <Field label="Referring clinician *" value={form.referrer_label} onChange={(v) => set("referrer_label", v)} bad={tried && !form.referrer_label} />
          <Field label="Clinic *" value={form.clinic} onChange={(v) => set("clinic", v)} bad={tried && !form.clinic} />
        </div>
        <label className="label" style={{ marginTop: 14 }}>Clinical notes (optional)</label>
        <textarea className="input" value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Family history, supporting features, relevant findings…" />
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
  if (referral.declined) {
    return (
      <div className="card" style={{ textAlign: "center" }}>
        <Badge tone="red">Referral not made</Badge>
        <h2 className="title" style={{ marginTop: 14 }}>Patient declined referral</h2>
        <p className="sub">No referral was submitted and no records were retrieved.</p>
        <div className="row-actions-center">
          <button className="btn" onClick={onRestart}>Start a new patient</button>
          <button className="btn" onClick={() => setShowInfo(true)}>More Information</button>
        </div>
        {showInfo && (
          <ImageModal
            src="/images/QR1.png"
            alt="More information"
            onClose={() => setShowInfo(false)}
          />
        )}
      </div>
    );
  }
  return (
    <div>
      <div className="topbar no-print" style={{ marginBottom: 18 }}><Progress step={4} /></div>
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
      <div style={{ width: 180, color: "var(--ink-soft)", fontSize: 14, fontWeight: 600 }}>{k}</div>
      <div style={{ fontSize: 15 }}>{v}</div>
    </div>
  );
  return (
    <div className="card">
      <div style={{ borderBottom: "2px solid var(--ink)", paddingBottom: 12, marginBottom: 16 }}>
        <div style={{ fontSize: 22, fontWeight: 700 }}>FH Genetic Testing Referral</div>
        <div className="small muted">Genetic Assessment Centre · Reference {r.reference}</div>
      </div>
      <Row k="Patient" v={`${r.patient_name} (${r.patient_nric})`} />
      <Row k="Age / Sex" v={`${r.age ?? "—"} · ${r.sex ?? "—"}`} />
      <Row k="Nationality" v={r.nationality ?? "—"} />
      <Row k="Contact" v={r.contact} />
      <Row k="LDL" v={`${r.ldl} mmol/L`} />
      <Row k="Total cholesterol" v={r.total_chol ? `${r.total_chol} mmol/L` : "—"} />
      <Row k="On statin" v={r.on_statin || "—"} />
      <Row k="Referring clinician" v={r.referrer_label} />
      <Row k="Clinic" v={r.clinic} />
      <Row k="Notes" v={r.notes || "—"} />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   REFERRALS
   ══════════════════════════════════════════════════════════════ */
function Referrals() {
  const [q, setQ] = useState(""); const [list, setList] = useState([]); const [sel, setSel] = useState(null); const [err, setErr] = useState("");
  const load = useCallback(() => { API.referrals.list(q).then((d) => setList(d.referrals)).catch((e) => setErr(e.message)); }, [q]);
  useEffect(() => { load(); }, [load]);
  const open = async (ref) => { try { const { referral } = await API.referrals.get(ref); setSel(referral); } catch (e) { setErr(e.message); } };

  if (sel) return (
    <div>
      <div className="row-actions no-print" style={{ marginBottom: 16 }}>
        <button className="btn-ghost" onClick={() => setSel(null)}>← Back to referrals</button>
        <button className="btn" onClick={() => window.print()}>Print copy</button>
      </div>
      <ReferralPrint r={sel} />
    </div>
  );

  return (
    <div>
      <div className="page-head"><div>
        <h2 className="title">Referrals</h2>
        <p className="sub">Referrals you have submitted through the tool.</p>
      </div></div>
      <input className="input" placeholder="Search reference, patient name, or NRIC" value={q} onChange={(e) => setQ(e.target.value)} />
      {err && <p className="err">{err}</p>}
      {list.length === 0 ? <p className="muted">No referrals yet.</p> : (
        <table className="table">
          <thead><tr><th>Reference</th><th>Patient</th><th>NRIC</th><th>LDL</th><th>Status</th><th>When</th></tr></thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.reference} className="clickable" onClick={() => open(r.reference)}>
                <td>{r.reference}</td><td>{r.patient_name}</td><td>{r.patient_nric}</td>
                <td>{r.ldl}</td><td><Badge tone="green">{r.status}</Badge></td><td>{fmtDate(r.created_at)}</td>
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
function Profile({ user, setUser }) {
  const [f, setF] = useState({ name: user.name, email: user.email || "", clinic: user.clinic || "" });
  const [msg, setMsg] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const save = async () => {
    setMsg(""); setErr(""); setBusy(true);
    try { const { user: u } = await API.me.update(f); setUser(u); setMsg("Profile saved."); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <div>
      <h2 className="title">Profile</h2>
      <p className="sub">Your clinician details, used to populate referrals.</p>
      <div className="card" style={{ maxWidth: 520 }}>
        <Field label="Clinician ID" value={user.clinician_id} onChange={() => { }} />
        <p className="small muted" style={{ marginTop: -10, marginBottom: 14 }}>Clinician ID cannot be changed.</p>
        <Field label="Full name" value={f.name} onChange={(v) => set("name", v)} />
        <Field label="Email" value={f.email} onChange={(v) => set("email", v)} />
        <Field label="Clinic" value={f.clinic} onChange={(v) => set("clinic", v)} />
        {msg && <p className="ok">{msg}</p>}{err && <p className="err">{err}</p>}
        <button className="btn" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save profile"}</button>
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
  else if (seg[1] === "profile") page = <Profile user={user} setUser={setUser} />;
  else if (seg[1] === "settings") page = <Settings user={user} />;
  else page = <ReferralWizard user={user} key="new" />;

  return <Shell user={user} route={route} onSignOut={signOut}>{page}</Shell>;
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
