import React, { useState, useEffect, useRef } from 'react';
const MOCK_CIRCULARS = [
  {
    id: "RBI-2024-112",
    source: "RBI",
    title: "KYC Re-verification for Dormant Accounts",
    date: "2024-05-10",
    text: "All scheduled commercial banks must conduct KYC re-verification for accounts that have remained inactive or dormant for a period exceeding 24 months. This process must be completed within 90 days of this circular. Banks must update their CBS systems accordingly and submit a compliance report to RBI within 30 days of completion. Failure to comply may attract penalties under Section 47A of the Banking Regulation Act.",
    severity: null,
    maps: [],
    conflicts: [],
    status: "unprocessed",
  },
  {
    id: "SEBI-2024-78",
    source: "SEBI",
    title: "Enhanced Cybersecurity Framework for Market Participants",
    date: "2024-05-14",
    text: "All market participants including stock brokers, depositories and asset management companies must implement an enhanced cybersecurity framework. This includes mandatory quarterly penetration testing, implementation of zero-trust architecture, and appointment of a dedicated Chief Information Security Officer (CISO) within 60 days. Existing cybersecurity policies must be reviewed and updated to align with SEBI's updated guidelines within 45 days.",
    severity: null,
    maps: [],
    conflicts: [],
    status: "unprocessed",
  },
  {
    id: "RBI-2024-098",
    source: "RBI",
    title: "Digital Lending Guidelines — Updated Framework",
    date: "2024-04-22",
    text: "Banks and NBFCs engaged in digital lending must ensure full compliance with the updated digital lending framework. All Lending Service Providers (LSPs) must be re-registered and their contracts reviewed. Data storage must be on India-based servers only. EMI disbursals must go directly to borrower accounts. Grievance redressal mechanisms must be updated within 30 days.",
    severity: null,
    maps: [],
    conflicts: [],
    status: "unprocessed",
  },
];

const PAST_CIRCULARS_DB = [
  { id: "RBI-2022-045", title: "KYC Guidelines for Bank Accounts", summary: "Banks must conduct KYC for accounts inactive for 36 months (previous threshold was 36 months, now updated to 24 months in new circular)." },
  { id: "RBI-2021-033", title: "Cybersecurity Controls for Banks", summary: "Annual cybersecurity audit requirements for banks — now potentially superseded by SEBI's quarterly penetration testing mandate for overlapping entities." },
  { id: "RBI-2023-067", title: "Digital Lending Framework v1", summary: "Original digital lending guidelines — the new circular updates and partially supersedes this with stricter LSP registration and data localisation requirements." },
];

const DEPT_COLORS = {
  "Operations": "#06b6d4",
  "IT": "#8b5cf6",
  "Risk": "#f59e0b",
  "Compliance": "#10b981",
  "Legal": "#ef4444",
  "Finance": "#3b82f6",
};

function StatusDot({ status }) {
  const colors = { unprocessed: "#64748b", processing: "#f59e0b", done: "#10b981", conflict: "#ef4444" };
  return (
    <span style={{
      display: "inline-block", width: 8, height: 8, borderRadius: "50%",
      background: colors[status] || "#64748b",
      boxShadow: status === "processing" ? `0 0 8px ${colors.processing}` : "none",
      animation: status === "processing" ? "pulse 1s infinite" : "none"
    }} />
  );
}

function Chip({ label, color }) {
  return (
    <span style={{
      background: `${color}22`, border: `1px solid ${color}55`,
      color, borderRadius: 100, padding: "2px 10px", fontSize: 11,
      fontWeight: 700, letterSpacing: 0.5, fontFamily: "Syne, sans-serif"
    }}>{label}</span>
  );
}

function SeverityBadge({ level }) {
  const map = { Critical: "#ef4444", High: "#f59e0b", Medium: "#06b6d4", Low: "#10b981" };
  const color = map[level] || "#64748b";
  return <Chip label={level || "Pending"} color={color} />;
}

export default function RegSentinelAI() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [circulars, setCirculars] = useState(MOCK_CIRCULARS);
  const [selected, setSelected] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    { role: "assistant", content: "Hello! I'm your Compliance Co-Pilot. Ask me anything — pending tasks, circular summaries, risk status, or department-wise compliance. How can I help?" }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  async function callClaude(systemPrompt, userMessage) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    });
    const data = await res.json();
    return data.content?.[0]?.text || "";
  }

  async function processCircular(circularId) {
    const circ = circulars.find(c => c.id === circularId);
    if (!circ || circ.status === "done") return;

    setProcessing(circularId);
    setCirculars(prev => prev.map(c => c.id === circularId ? { ...c, status: "processing" } : c));

    try {
      const systemPrompt = `You are RegSentinel AI, a banking compliance intelligence system for Indian banks. 
You analyze RBI, SEBI, and IRDAI circulars and return ONLY valid JSON. No markdown, no explanation, just JSON.`;

      const userMsg = `Analyze this regulatory circular and return JSON in EXACTLY this format:
{
  "severity": "Critical|High|Medium|Low",
  "summary": "2-sentence plain English summary",
  "obligations": ["obligation 1", "obligation 2"],
  "deadline_days": 90,
  "maps": [
    {
      "id": "MAP-001",
      "title": "Short action title",
      "description": "What needs to be done",
      "department": "Operations|IT|Risk|Compliance|Legal|Finance",
      "deadline_days": 30,
      "priority": "Critical|High|Medium"
    }
  ],
  "conflicts": [
    {
      "circular_id": "RBI-2022-045",
      "circular_title": "Previous circular title",
      "conflict_description": "How they conflict"
    }
  ]
}

PAST CIRCULARS IN DATABASE:
${PAST_CIRCULARS_DB.map(p => `- ${p.id}: ${p.title} — ${p.summary}`).join("\n")}

CIRCULAR TO ANALYZE:
ID: ${circ.id}
Source: ${circ.source}
Title: ${circ.title}
Text: ${circ.text}`;

      const raw = await callClaude(systemPrompt, userMsg);
      let result;
      try {
        const clean = raw.replace(/```json|```/g, "").trim();
        result = JSON.parse(clean);
      } catch {
        result = { severity: "High", summary: "Analysis complete.", obligations: [], deadline_days: 60, maps: [], conflicts: [] };
      }

      setCirculars(prev => prev.map(c => c.id === circularId ? {
        ...c,
        status: result.conflicts?.length > 0 ? "conflict" : "done",
        severity: result.severity,
        summary: result.summary,
        obligations: result.obligations,
        maps: result.maps || [],
        conflicts: result.conflicts || [],
        deadline_days: result.deadline_days,
      } : c));

    } catch (e) {
      setCirculars(prev => prev.map(c => c.id === circularId ? { ...c, status: "done", severity: "Medium", maps: [], conflicts: [] } : c));
    }
    setProcessing(false);
  }

  async function sendChat() {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg = chatInput.trim();
    setChatInput("");
    setChatMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setChatLoading(true);

    const processedCirculars = circulars.filter(c => c.status === "done" || c.status === "conflict");
    const allMAPs = processedCirculars.flatMap(c => (c.maps || []).map(m => ({ ...m, circular: c.title, circularId: c.id })));
    const allConflicts = processedCirculars.flatMap(c => (c.conflicts || []).map(cf => ({ ...cf, fromCircular: c.title })));

    const systemPrompt = `You are the RegSentinel AI Compliance Co-Pilot for an Indian bank. You are knowledgeable, concise, and helpful. 
You have access to the following live compliance data:

PROCESSED CIRCULARS: ${JSON.stringify(processedCirculars.map(c => ({ id: c.id, title: c.title, source: c.source, severity: c.severity, summary: c.summary, deadline_days: c.deadline_days })))}

ACTIVE MAPs (${allMAPs.length} total): ${JSON.stringify(allMAPs)}

CONFLICTS DETECTED (${allConflicts.length} total): ${JSON.stringify(allConflicts)}

UNPROCESSED CIRCULARS: ${circulars.filter(c => c.status === "unprocessed").map(c => c.title).join(", ") || "None"}

Answer the user's question based on this data. Be specific, mention actual circular IDs and MAP titles when relevant. Keep responses clear and actionable. If no circulars have been processed yet, tell the user to process circulars first using the Circulars tab.`;

    try {
      const reply = await callClaude(systemPrompt, userMsg);
      setChatMessages(prev => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setChatMessages(prev => [...prev, { role: "assistant", content: "Sorry, I encountered an error. Please try again." }]);
    }
    setChatLoading(false);
  }

  const processedCount = circulars.filter(c => c.status === "done" || c.status === "conflict").length;
  const totalMAPs = circulars.flatMap(c => c.maps || []).length;
  const totalConflicts = circulars.flatMap(c => c.conflicts || []).length;
  const criticalMAPs = circulars.flatMap(c => c.maps || []).filter(m => m.priority === "Critical").length;

  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: "⬡" },
    { id: "circulars", label: "Circulars", icon: "◈" },
    { id: "maps", label: "MAPs", icon: "◎" },
    { id: "conflicts", label: "Conflicts", icon: "⚠" },
    { id: "copilot", label: "Co-Pilot", icon: "✦" },
  ];

  return (
    <div style={{
      fontFamily: "'DM Sans', sans-serif",
      background: "#070b1a",
      minHeight: "100vh",
      color: "#e2e8f0",
      display: "flex",
      flexDirection: "column",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap');
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin { to{transform:rotate(360deg)} }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1e3a5f; border-radius: 4px; }
        * { box-sizing: border-box; }
        textarea:focus, input:focus { outline: none; }
        button { cursor: pointer; }
      `}</style>

      {/* TOP NAV */}
      <div style={{
        background: "rgba(7,11,26,0.95)", borderBottom: "1px solid rgba(37,99,235,0.2)",
        padding: "0 24px", display: "flex", alignItems: "center", gap: 24,
        backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 100,
        minHeight: 56,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginRight: 16 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: "linear-gradient(135deg, #1a3a8f, #06b6d4)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, fontWeight: 800, fontFamily: "Syne, sans-serif",
          }}>R</div>
          <span style={{ fontFamily: "Syne, sans-serif", fontWeight: 800, fontSize: 15, letterSpacing: -0.5 }}>
            RegSentinel <span style={{ color: "#06b6d4" }}>AI</span>
          </span>
        </div>

        <div style={{ display: "flex", gap: 4, flex: 1 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
              background: activeTab === t.id ? "rgba(37,99,235,0.2)" : "transparent",
              border: activeTab === t.id ? "1px solid rgba(37,99,235,0.4)" : "1px solid transparent",
              color: activeTab === t.id ? "#fff" : "#64748b",
              borderRadius: 8, padding: "6px 14px", fontSize: 12,
              fontFamily: "Syne, sans-serif", fontWeight: 600,
              display: "flex", alignItems: "center", gap: 6, transition: "all 0.2s",
            }}>
              <span>{t.icon}</span> {t.label}
              {t.id === "conflicts" && totalConflicts > 0 && (
                <span style={{ background: "#ef4444", color: "#fff", borderRadius: 100, padding: "0 5px", fontSize: 10, fontWeight: 800 }}>{totalConflicts}</span>
              )}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 8px #10b981" }} />
          <span style={{ fontSize: 11, color: "#10b981", fontFamily: "Syne, sans-serif", fontWeight: 700 }}>LIVE</span>
        </div>
      </div>

      {/* CONTENT */}
      <div style={{ flex: 1, padding: "24px", maxWidth: 1100, margin: "0 auto", width: "100%" }}>

        {/* DASHBOARD */}
        {activeTab === "dashboard" && (
          <div style={{ animation: "fadeIn 0.3s ease" }}>
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontFamily: "Syne, sans-serif", fontSize: 11, color: "#06b6d4", fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>Compliance Intelligence</div>
              <h1 style={{ fontFamily: "Syne, sans-serif", fontSize: 28, fontWeight: 800, letterSpacing: -1, marginBottom: 4 }}>
                Regulatory Dashboard
              </h1>
              <p style={{ color: "#64748b", fontSize: 13 }}>Real-time compliance status across RBI, SEBI & IRDAI</p>
            </div>

            {/* STAT CARDS */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 28 }}>
              {[
                { label: "Circulars Monitored", value: circulars.length, color: "#2563eb", icon: "◈" },
                { label: "MAPs Generated", value: totalMAPs, color: "#06b6d4", icon: "◎" },
                { label: "Conflicts Detected", value: totalConflicts, color: "#ef4444", icon: "⚠" },
                { label: "Critical Actions", value: criticalMAPs, color: "#f59e0b", icon: "!" },
              ].map((s, i) => (
                <div key={i} style={{
                  background: `linear-gradient(135deg, ${s.color}12, ${s.color}06)`,
                  border: `1px solid ${s.color}30`, borderRadius: 14, padding: "18px 20px",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontSize: 32, fontFamily: "Syne, sans-serif", fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
                      <div style={{ fontSize: 11, color: "#64748b", marginTop: 6, fontWeight: 500 }}>{s.label}</div>
                    </div>
                    <span style={{ fontSize: 20, color: s.color, opacity: 0.5 }}>{s.icon}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* RECENT ACTIVITY */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: 20 }}>
                <div style={{ fontFamily: "Syne, sans-serif", fontSize: 11, color: "#94a3b8", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 16 }}>Recent Circulars</div>
                {circulars.map(c => (
                  <div key={c.id} onClick={() => { setActiveTab("circulars"); setSelected(c.id); }} style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "10px 0",
                    borderBottom: "1px solid rgba(255,255,255,0.04)", cursor: "pointer",
                  }}>
                    <StatusDot status={c.status} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: "#e2e8f0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.title}</div>
                      <div style={{ fontSize: 11, color: "#64748b" }}>{c.source} · {c.date}</div>
                    </div>
                    {c.severity && <SeverityBadge level={c.severity} />}
                  </div>
                ))}
              </div>

              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: 20 }}>
                <div style={{ fontFamily: "Syne, sans-serif", fontSize: 11, color: "#94a3b8", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 16 }}>Department Load</div>
                {Object.entries(DEPT_COLORS).map(([dept, color]) => {
                  const count = circulars.flatMap(c => c.maps || []).filter(m => m.department === dept).length;
                  const max = Math.max(...Object.keys(DEPT_COLORS).map(d => circulars.flatMap(c => c.maps || []).filter(m => m.department === d).length), 1);
                  return (
                    <div key={dept} style={{ marginBottom: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                        <span style={{ color: "#cbd5e1" }}>{dept}</span>
                        <span style={{ color, fontWeight: 700 }}>{count} MAPs</span>
                      </div>
                      <div style={{ height: 4, borderRadius: 100, background: "rgba(255,255,255,0.06)" }}>
                        <div style={{ height: "100%", borderRadius: 100, background: `linear-gradient(90deg, ${color}, ${color}88)`, width: `${(count / max) * 100}%`, transition: "width 0.6s ease" }} />
                      </div>
                    </div>
                  );
                })}
                {totalMAPs === 0 && <div style={{ color: "#64748b", fontSize: 12, textAlign: "center", padding: "20px 0" }}>Process circulars to see department load</div>}
              </div>
            </div>
          </div>
        )}

        {/* CIRCULARS TAB */}
        {activeTab === "circulars" && (
          <div style={{ animation: "fadeIn 0.3s ease" }}>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontFamily: "Syne, sans-serif", fontSize: 11, color: "#06b6d4", fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>Regulatory Intelligence</div>
              <h2 style={{ fontFamily: "Syne, sans-serif", fontSize: 24, fontWeight: 800, letterSpacing: -0.5 }}>Monitored Circulars</h2>
              <p style={{ color: "#64748b", fontSize: 13 }}>Click a circular to view details. Hit "Process" to run AI analysis.</p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 1.5fr" : "1fr", gap: 14 }}>
              {/* LIST */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {circulars.map(c => (
                  <div key={c.id} onClick={() => setSelected(selected === c.id ? null : c.id)} style={{
                    background: selected === c.id ? "rgba(37,99,235,0.15)" : "rgba(255,255,255,0.02)",
                    border: `1px solid ${selected === c.id ? "rgba(37,99,235,0.5)" : "rgba(255,255,255,0.06)"}`,
                    borderRadius: 12, padding: 16, cursor: "pointer", transition: "all 0.2s",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <StatusDot status={c.status} />
                        <Chip label={c.source} color={c.source === "RBI" ? "#06b6d4" : "#8b5cf6"} />
                        <span style={{ fontSize: 11, color: "#64748b", fontFamily: "Syne, sans-serif" }}>{c.id}</span>
                      </div>
                      {c.severity && <SeverityBadge level={c.severity} />}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "#e2e8f0", marginBottom: 4 }}>{c.title}</div>
                    <div style={{ fontSize: 11, color: "#64748b" }}>{c.date} · {c.maps?.length || 0} MAPs · {c.conflicts?.length || 0} conflicts</div>

                    {c.status === "unprocessed" && (
                      <button onClick={(e) => { e.stopPropagation(); processCircular(c.id); }} style={{
                        marginTop: 10, background: "linear-gradient(135deg, #1a3a8f, #2563eb)",
                        border: "none", color: "#fff", borderRadius: 8, padding: "7px 16px",
                        fontSize: 12, fontFamily: "Syne, sans-serif", fontWeight: 700, display: "flex", alignItems: "center", gap: 6,
                      }}>
                        ⚡ Run AI Analysis
                      </button>
                    )}
                    {c.status === "processing" && (
                      <div style={{ marginTop: 10, fontSize: 12, color: "#f59e0b", display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>⟳</span> Analysing with AI...
                      </div>
                    )}
                    {(c.status === "done" || c.status === "conflict") && (
                      <div style={{ marginTop: 8, fontSize: 12, color: "#10b981" }}>✓ Analysis complete</div>
                    )}
                  </div>
                ))}
              </div>

              {/* DETAIL PANEL */}
              {selected && (() => {
                const c = circulars.find(x => x.id === selected);
                if (!c) return null;
                return (
                  <div style={{
                    background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)",
                    borderRadius: 14, padding: 22, animation: "fadeIn 0.25s ease",
                    maxHeight: "75vh", overflowY: "auto",
                  }}>
                    <div style={{ fontFamily: "Syne, sans-serif", fontSize: 11, color: "#06b6d4", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 }}>Circular Detail</div>
                    <h3 style={{ fontFamily: "Syne, sans-serif", fontSize: 17, fontWeight: 700, marginBottom: 8 }}>{c.title}</h3>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
                      <Chip label={c.source} color={c.source === "RBI" ? "#06b6d4" : "#8b5cf6"} />
                      <Chip label={c.id} color="#64748b" />
                      <Chip label={c.date} color="#64748b" />
                      {c.severity && <SeverityBadge level={c.severity} />}
                    </div>

                    {c.summary && (
                      <div style={{ background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.2)", borderRadius: 10, padding: "12px 14px", marginBottom: 16, fontSize: 13, color: "#cbd5e1", lineHeight: 1.6 }}>
                        <strong style={{ color: "#06b6d4", fontSize: 10, fontFamily: "Syne,sans-serif", letterSpacing: 1, textTransform: "uppercase", display: "block", marginBottom: 4 }}>AI Summary</strong>
                        {c.summary}
                      </div>
                    )}

                    {c.maps?.length > 0 && (
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ fontFamily: "Syne, sans-serif", fontSize: 11, color: "#94a3b8", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>Measurable Action Points ({c.maps.length})</div>
                        {c.maps.map((m, i) => (
                          <div key={i} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "12px 14px", marginBottom: 8 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                              <span style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0" }}>{m.title}</span>
                              <SeverityBadge level={m.priority} />
                            </div>
                            <p style={{ fontSize: 12, color: "#94a3b8", margin: "4px 0 8px" }}>{m.description}</p>
                            <div style={{ display: "flex", gap: 8 }}>
                              <Chip label={m.department} color={DEPT_COLORS[m.department] || "#64748b"} />
                              <Chip label={`${m.deadline_days}d deadline`} color="#64748b" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {c.conflicts?.length > 0 && (
                      <div>
                        <div style={{ fontFamily: "Syne, sans-serif", fontSize: 11, color: "#ef4444", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>⚠ Conflicts Detected ({c.conflicts.length})</div>
                        {c.conflicts.map((cf, i) => (
                          <div key={i} style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 10, padding: "12px 14px", marginBottom: 8 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: "#fca5a5", marginBottom: 4 }}>{cf.circular_title} ({cf.circular_id})</div>
                            <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>{cf.conflict_description}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    <div style={{ marginTop: 14 }}>
                      <div style={{ fontFamily: "Syne, sans-serif", fontSize: 10, color: "#475569", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>Original Text</div>
                      <p style={{ fontSize: 12, color: "#64748b", lineHeight: 1.7 }}>{c.text}</p>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* MAPs TAB */}
        {activeTab === "maps" && (
          <div style={{ animation: "fadeIn 0.3s ease" }}>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontFamily: "Syne, sans-serif", fontSize: 11, color: "#06b6d4", fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>Action Management</div>
              <h2 style={{ fontFamily: "Syne, sans-serif", fontSize: 24, fontWeight: 800, letterSpacing: -0.5 }}>Measurable Action Points</h2>
              <p style={{ color: "#64748b", fontSize: 13 }}>All generated MAPs across circulars, organised by department and priority.</p>
            </div>

            {totalMAPs === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 20px", color: "#64748b" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>◎</div>
                <div style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, marginBottom: 6 }}>No MAPs Yet</div>
                <div style={{ fontSize: 13 }}>Go to Circulars and run AI analysis to generate MAPs</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {circulars.flatMap(c => (c.maps || []).map(m => ({ ...m, circularTitle: c.title, circularId: c.id, source: c.source }))).map((m, i) => (
                  <div key={i} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "16px 20px", display: "flex", alignItems: "center", gap: 16 }}>
                    <div style={{ width: 4, height: 52, borderRadius: 2, background: DEPT_COLORS[m.department] || "#64748b", flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>{m.title}</span>
                        <SeverityBadge level={m.priority} />
                      </div>
                      <p style={{ fontSize: 12, color: "#64748b", margin: "2px 0 8px", lineHeight: 1.5 }}>{m.description}</p>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <Chip label={m.department} color={DEPT_COLORS[m.department] || "#64748b"} />
                        <Chip label={`${m.deadline_days}d`} color="#64748b" />
                        <Chip label={m.circularId} color="#475569" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* CONFLICTS TAB */}
        {activeTab === "conflicts" && (
          <div style={{ animation: "fadeIn 0.3s ease" }}>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontFamily: "Syne, sans-serif", fontSize: 11, color: "#ef4444", fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>Conflict Intelligence</div>
              <h2 style={{ fontFamily: "Syne, sans-serif", fontSize: 24, fontWeight: 800, letterSpacing: -0.5 }}>Regulatory Conflicts</h2>
              <p style={{ color: "#64748b", fontSize: 13 }}>Contradictions between new circulars and existing policies — detected automatically.</p>
            </div>

            {totalConflicts === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 20px", color: "#64748b" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>⚠</div>
                <div style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, marginBottom: 6 }}>No Conflicts Detected</div>
                <div style={{ fontSize: 13 }}>Process circulars to run conflict detection</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {circulars.flatMap(c => (c.conflicts || []).map(cf => ({ ...cf, fromCircular: c.title, fromId: c.id, source: c.source }))).map((cf, i) => (
                  <div key={i} style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 14, padding: 20 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
                      <span style={{ color: "#ef4444", fontSize: 16 }}>⚠</span>
                      <span style={{ fontFamily: "Syne, sans-serif", fontSize: 11, color: "#ef4444", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>Conflict Detected</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 12, alignItems: "center", marginBottom: 12 }}>
                      <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "10px 14px" }}>
                        <div style={{ fontSize: 10, color: "#06b6d4", fontFamily: "Syne,sans-serif", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>New Circular</div>
                        <div style={{ fontSize: 12, color: "#e2e8f0", fontWeight: 500 }}>{cf.fromCircular}</div>
                        <div style={{ fontSize: 11, color: "#64748b" }}>{cf.fromId}</div>
                      </div>
                      <div style={{ color: "#ef4444", fontSize: 18, fontWeight: 700 }}>↔</div>
                      <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "10px 14px" }}>
                        <div style={{ fontSize: 10, color: "#f59e0b", fontFamily: "Syne,sans-serif", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>Existing Policy</div>
                        <div style={{ fontSize: 12, color: "#e2e8f0", fontWeight: 500 }}>{cf.circular_title}</div>
                        <div style={{ fontSize: 11, color: "#64748b" }}>{cf.circular_id}</div>
                      </div>
                    </div>
                    <div style={{ background: "rgba(239,68,68,0.08)", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#fca5a5", lineHeight: 1.6 }}>
                      {cf.conflict_description}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* CO-PILOT */}
        {activeTab === "copilot" && (
          <div style={{ animation: "fadeIn 0.3s ease", display: "flex", flexDirection: "column", height: "calc(100vh - 120px)" }}>
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontFamily: "Syne, sans-serif", fontSize: 11, color: "#06b6d4", fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>AI Assistant</div>
              <h2 style={{ fontFamily: "Syne, sans-serif", fontSize: 24, fontWeight: 800, letterSpacing: -0.5 }}>Compliance Co-Pilot ✦</h2>
              <p style={{ color: "#64748b", fontSize: 13 }}>Ask anything about your compliance status, pending MAPs, or regulatory conflicts.</p>
            </div>

            {/* CHAT AREA */}
            <div style={{ flex: 1, overflowY: "auto", marginBottom: 14, display: "flex", flexDirection: "column", gap: 12 }}>
              {chatMessages.map((msg, i) => (
                <div key={i} style={{
                  display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                  animation: "fadeIn 0.2s ease",
                }}>
                  {msg.role === "assistant" && (
                    <div style={{
                      width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg,#1a3a8f,#06b6d4)",
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12,
                      flexShrink: 0, marginRight: 10, marginTop: 2,
                    }}>✦</div>
                  )}
                  <div style={{
                    maxWidth: "75%",
                    background: msg.role === "user" ? "linear-gradient(135deg,#1a3a8f,#2563eb)" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${msg.role === "user" ? "transparent" : "rgba(255,255,255,0.07)"}`,
                    borderRadius: msg.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                    padding: "12px 16px", fontSize: 13, lineHeight: 1.65, color: "#e2e8f0",
                    whiteSpace: "pre-wrap",
                  }}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg,#1a3a8f,#06b6d4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>✦</div>
                  <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px 14px 14px 4px", padding: "12px 16px" }}>
                    <span style={{ display: "inline-flex", gap: 4 }}>
                      {[0, 0.2, 0.4].map((d, i) => (
                        <span key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "#06b6d4", display: "inline-block", animation: `pulse 1s ${d}s infinite` }} />
                      ))}
                    </span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* QUICK PROMPTS */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              {["What's pending this week?", "Which dept is most at risk?", "Summarise all conflicts", "How many MAPs are Critical?"].map(q => (
                <button key={q} onClick={() => setChatInput(q)} style={{
                  background: "rgba(37,99,235,0.1)", border: "1px solid rgba(37,99,235,0.3)",
                  color: "#93c5fd", borderRadius: 100, padding: "5px 12px", fontSize: 11,
                  fontFamily: "Syne, sans-serif", fontWeight: 600, transition: "all 0.2s",
                }}>{q}</button>
              ))}
            </div>

            {/* INPUT */}
            <div style={{ display: "flex", gap: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: "10px 14px" }}>
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendChat()}
                placeholder="Ask about compliance status, MAPs, conflicts, deadlines..."
                style={{ flex: 1, background: "transparent", border: "none", color: "#e2e8f0", fontSize: 13, fontFamily: "DM Sans, sans-serif" }}
              />
              <button onClick={sendChat} disabled={chatLoading || !chatInput.trim()} style={{
                background: chatLoading || !chatInput.trim() ? "rgba(37,99,235,0.3)" : "linear-gradient(135deg,#1a3a8f,#2563eb)",
                border: "none", color: "#fff", borderRadius: 10, padding: "8px 18px",
                fontSize: 12, fontFamily: "Syne, sans-serif", fontWeight: 700, transition: "all 0.2s",
              }}>
                {chatLoading ? "..." : "Send →"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


