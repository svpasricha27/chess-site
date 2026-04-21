import { useState, useEffect, useCallback } from "react";
import { supabase, isDemoMode } from "./supabase";

// ─── Supabase Auth Hook ────────────────────────────────────────
function useAuth() {
  const [user, setUser] = useState(null);
  const [memberData, setMemberData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isDemoMode) { setLoading(false); return; }
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchMemberData(session.user.id);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchMemberData(session.user.id);
      else setMemberData(null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const fetchMemberData = async (userId) => {
    const { data } = await supabase.from('members').select('*').eq('user_id', userId).single();
    setMemberData(data);
  };

  const signIn = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email, password) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setMemberData(null);
  };

  return { user, memberData, loading, signIn, signUp, signOut, isAdmin: memberData?.role === 'admin' };
}

// ─── Supabase Data Hook ────────────────────────────────────────
function useSupabaseData(table, fallbackData, query) {
  const [data, setData] = useState(fallbackData);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    if (isDemoMode) return;
    try {
      let q = supabase.from(table).select('*');
      if (query?.order) q = q.order(query.order, { ascending: query.ascending ?? true });
      if (query?.eq) q = q.eq(query.eq[0], query.eq[1]);
      const { data: rows, error } = await q;
      if (!error && rows?.length > 0) setData(rows);
      setLoaded(true);
    } catch (e) { console.log('Using fallback data for', table); }
  }, [table]);

  useEffect(() => { refresh(); }, [refresh]);
  return { data, loaded, refresh, setData };
}

// ─── Admin Actions (write to Supabase from the site) ──────────
const adminActions = {
  async addSession({ title, session_date, session_time, session_type, presenter, cme_hours, description }) {
    if (isDemoMode) return { success: true, demo: true };
    const { error } = await supabase.from('sessions').insert({ title, session_date, session_time: session_time || '12:00', session_type: session_type || 'Didactic', presenter, cme_hours: cme_hours || 1.25, description });
    return { success: !error, error };
  },

  async addPublication({ title, authors, journal, year, doi, url, pub_type, status, description }) {
    if (isDemoMode) return { success: true, demo: true };
    const { error } = await supabase.from('publications').insert({ title, authors, journal, year, doi, url, pub_type: pub_type || 'published', status, description });
    return { success: !error, error };
  },

  async approveMember(memberId, newStatus = 'full') {
    if (isDemoMode) return { success: true, demo: true };
    const { error } = await supabase.from('members').update({ status: newStatus, member_since: new Date().toISOString().split('T')[0] }).eq('id', memberId);
    return { success: !error, error };
  },

  async updateMember(memberId, updates) {
    if (isDemoMode) return { success: true, demo: true };
    const { error } = await supabase.from('members').update(updates).eq('id', memberId);
    return { success: !error, error };
  },

  async rejectMember(memberId) {
    if (isDemoMode) return { success: true, demo: true };
    const { error } = await supabase.from('members').update({ status: 'rejected' }).eq('id', memberId);
    return { success: !error, error };
  },

  async submitRegistration({ name, degrees, email, specialty, province, institution, bio, referral_info, directory_visible }) {
    if (isDemoMode) return { success: true, demo: true };
    const { error } = await supabase.from('members').insert({ name, degrees, email, specialty, province, institution, bio, referral_info, directory_visible: directory_visible || false, status: 'pending', role: 'member' });
    return { success: !error, error };
  },

  async exportTable(table) {
    if (isDemoMode) return;
    const { data } = await supabase.from(table).select('*');
    if (!data || data.length === 0) return;
    const headers = Object.keys(data[0]);
    const csv = [headers.join(','), ...data.map(row => headers.map(h => { const v = String(row[h] ?? '').replace(/"/g, '""'); return v.includes(',') || v.includes('"') || v.includes('\n') ? `"${v}"` : v; }).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `chess_${table}_${new Date().toISOString().split('T')[0]}.csv`; a.click();
    URL.revokeObjectURL(url);
  },

  async exportAllAsZip() {
    // Export each table as CSV and trigger individual downloads
    for (const table of ['members', 'sessions', 'publications', 'cme_records', 'evaluations']) {
      await this.exportTable(table);
      await new Promise(r => setTimeout(r, 500)); // small delay between downloads
    }
  }
};

// ─── Sample Data ───────────────────────────────────────────────
const EXEC_TEAM = [
  { name: "Dr. Jennifer Ringrose", role: "President / Case Conferences", specialty: "General Internal Medicine", degrees: "MD, MSc, FRCPC", province: "Alberta", img: "JR", bio: "Dr. Ringrose is an Associate Professor of Medicine and General Internist at the University of Alberta. She directs the GIM Residency Program and co-founded mmHg Inc., a physician-led digital health company. Her research focuses on improving the accuracy of blood pressure measurement, and she leads ongoing studies at the Hypertension Clinic at the Kaye Edmonton Clinic." },
  { name: "Dr. Lisa Dubrofsky", role: "Director of Scholarly Initiatives", specialty: "Nephrology", degrees: "MDCM, FRCPC", province: "Ontario", img: "LD", bio: "Dr. Dubrofsky is an Assistant Professor in the Division of Nephrology at the University of Toronto, practicing at Women's College Hospital and Sunnybrook Health Sciences Centre. She is a certified Hypertension Specialist (ASH) with advanced training in Cardiology-Renal-Endocrine care. Her research interests focus on improving quality of care for people with complex hypertension and hypertensive disorders of pregnancy." },
  { name: "Dr. Karen Tran", role: "Director of Educational Initiatives", specialty: "General Internal Medicine", degrees: "MD, MHSc, FRCPC", province: "British Columbia", img: "KT", bio: "Dr. Tran is a Clinical Assistant Professor in the Division of General Internal Medicine at UBC and co-director of the Vancouver General Hospital Hypertension Clinic. She completed hypertension and vascular medicine fellowship training at McGill. She serves on Hypertension Canada's national guideline committee for resistant hypertension and blood pressure measurement, and her research focuses on digital health technology for hypertension management." },
  { name: "Dr. Apoorva Bollu", role: "Western Representative", specialty: "General Internal Medicine", degrees: "MD, FRCPC", province: "British Columbia", img: "AB", bio: "Dr. Bollu is a General Internist in the Department of Medicine at the University of British Columbia. She is involved in hypertension specialist care and contributed to the landmark national survey characterizing hypertension specialist practice patterns across Canada." },
  { name: "Dr. Iulia Iatan", role: "Co-Director of Communications (Social Media) / Quebec Representative", specialty: "General Internal Medicine", degrees: "MD, PhD, FRCPC", province: "Quebec", img: "II", bio: "Dr. Iatan is a Physician Scientist at McGill University. She completed her MD at Laval University and PhD at McGill studying cholesterol metabolism and premature cardiovascular disease, followed by a Beedie Fellowship in Cardiovascular Disease Prevention at UBC. Her interests span cardiometabolic health, inherited lipid disorders, and cardiovascular genetics." },
  { name: "Dr. Jesse Bittman", role: "Co-Director of Communication (Website)", specialty: "General Internal Medicine", degrees: "MD, FRCPC", province: "British Columbia", img: "JB", bio: "Dr. Bittman is a General Internist in the Division of Community Internal Medicine at the University of British Columbia. He is active in hypertension education and serves as the co-director of communications for CHeSS, overseeing the society's digital presence and website." },
  { name: "Dr. Sachin Pasricha", role: "Eastern Representative / Mentor in Transitions", specialty: "Nephrology", degrees: "MD, FRCPC", province: "Ontario", img: "SP", bio: "Dr. Pasricha serves as Eastern Representative and mentor for physicians transitioning from residency to hypertension practice. His research includes studies on hypertension treatment and control in Canadians with diabetes, and he has contributed to Hypertension Canada's statement on cuffless blood pressure monitoring devices." },
];

const ADVISORS = [
  { name: "Dr. Nadia Khan", specialty: "General Internal Medicine", degrees: "MD, MSc, FRCPC", province: "British Columbia", img: "NK", bio: "Dr. Khan is a Professor of Medicine at the University of British Columbia and a leading figure in Canadian hypertension research. She has served on Hypertension Canada guideline committees for over two decades and has authored numerous national guidelines on hypertension prevention and management." },
  { name: "Dr. Sheldon Tobe", specialty: "Nephrology", degrees: "MD, FRCPC", province: "Ontario", img: "ST", bio: "Dr. Tobe is a Professor of Medicine at the University of Toronto and Northern Ontario School of Medicine, and an associate scientist at the Sunnybrook Research Institute. His research focuses on improving the lives of people with or at risk of kidney disease through prevention, diagnosis, and control of hypertension." },
  { name: "Dr. Raj Padwal", specialty: "General Internal Medicine", degrees: "MD, MSc, FRCPC", province: "Alberta", img: "RP", bio: "Dr. Padwal is Director of the University of Alberta Hypertension Clinic, specializing in resistant and secondary hypertension. His research focuses on inventing more accurate blood pressure measurement methods and technology-assisted care. He received Hypertension Canada's Senior Investigator Award in 2014 and co-founded mmHg Inc." },
  { name: "Dr. Ross Feldman", specialty: "Cardiology", degrees: "MD, FRCPC", province: "Manitoba", img: "RF", bio: "Dr. Feldman is affiliated with Cardiac Sciences at St. Boniface Hospital and the University of Manitoba in Winnipeg. He is a longstanding contributor to Canadian hypertension guidelines and research on hypertension control strategies at the national level." },
];

const MEMBERS = [
  { name: "Dr. Jennifer Ringrose", specialty: "General Internal Medicine", province: "Alberta", status: "Full Member", degrees: "MD, MSc, FRCPC", referral: "Referrals via University of Alberta Hypertension Clinic", interests: "BP measurement accuracy, resistant hypertension, technology-assisted care", research: "Automated office BP, home BP monitor validation", hasPhoto: true },
  { name: "Dr. Lisa Dubrofsky", specialty: "Nephrology", province: "Ontario", status: "Full Member", degrees: "MDCM, FRCPC", referral: "Referrals via Women's College Hospital or Sunnybrook HSC Nephrology", interests: "Complex hypertension, hypertensive disorders of pregnancy, CKD-related hypertension", research: "Quality improvement in hypertension care, renin-guided MRA titration", hasPhoto: true },
  { name: "Dr. Karen Tran", specialty: "General Internal Medicine", province: "British Columbia", status: "Full Member", degrees: "MD, MHSc, FRCPC", referral: "Referrals via VGH Hypertension Clinic or BC Women's Hospital", interests: "Resistant hypertension, hypertension in pregnancy, BP measurement", research: "Home BP telemonitoring, digital health for hypertension", hasPhoto: true },
  { name: "Dr. Apoorva Bollu", specialty: "General Internal Medicine", province: "British Columbia", status: "Full Member", degrees: "MD, FRCPC", referral: "Referrals via UBC Department of Medicine", interests: "Secondary hypertension, resistant hypertension", research: "Hypertension specialist practice patterns in Canada" },
  { name: "Dr. Iulia Iatan", specialty: "General Internal Medicine", province: "Quebec", status: "Full Member", degrees: "MD, PhD, FRCPC", referral: "Referrals via MUHC Vascular Medicine", interests: "Cardiometabolic health, lipid disorders, cardiovascular prevention", research: "Cardiovascular genetics, cholesterol metabolism" },
  { name: "Dr. Jesse Bittman", specialty: "General Internal Medicine", province: "British Columbia", status: "Full Member", degrees: "MD, FRCPC", referral: "Referrals via UBC Community Internal Medicine", interests: "Hypertension management, clinical education", research: "Hypertension education and knowledge translation" },
  { name: "Dr. Sachin Pasricha", specialty: "Nephrology", province: "Ontario", status: "Full Member", degrees: "MD, FRCPC", referral: "Contact via CHeSS", interests: "Hypertension in diabetes, cuffless BP monitoring", research: "Hypertension treatment and control in diabetic populations" },
  { name: "Dr. Nadia Khan", specialty: "General Internal Medicine", province: "British Columbia", status: "Full Member", degrees: "MD, MSc, FRCPC", referral: "Referrals via UBC Division of General Internal Medicine", interests: "Hypertension guidelines, resistant hypertension, cardiovascular risk", research: "National hypertension guidelines, epidemiology" },
  { name: "Dr. Sheldon Tobe", specialty: "Nephrology", province: "Ontario", status: "Full Member", degrees: "MD, FRCPC", referral: "Referrals via Sunnybrook HSC Division of Nephrology", interests: "CKD-related hypertension, Indigenous health, hypertension prevention", research: "Kidney disease prevention through hypertension control" },
  { name: "Dr. Raj Padwal", specialty: "General Internal Medicine", province: "Alberta", status: "Full Member", degrees: "MD, MSc, FRCPC", referral: "Referrals via University of Alberta Hypertension Clinic", interests: "Resistant hypertension, secondary hypertension, BP measurement", research: "BP measurement technology, ambulatory BP monitoring" },
  { name: "Dr. Ross Feldman", specialty: "Cardiology", province: "Manitoba", status: "Full Member", degrees: "MD, FRCPC", referral: "Referrals via St. Boniface Hospital Cardiac Sciences", interests: "Hypertension control strategies, cardiovascular pharmacology", research: "National hypertension control trends" },
];

const EVENTS = [
  { title: "Renal Denervation: Where Do We Stand in 2026?", type: "Didactic", date: "2026-05-14", time: "12:00 PM ET", presenter: "Dr. Connor Walsh", upcoming: true },
  { title: "The Young Patient with Severe Hypertension", type: "Case", date: "2026-06-11", time: "12:00 PM ET", presenter: "Dr. Meera Kapoor & Dr. Amir Bhatt", upcoming: true },
  { title: "To Screen or Not to Screen: Universal PA Testing", type: "Debate", date: "2026-07-09", time: "12:00 PM ET", presenter: "Dr. Anish Patel vs. Dr. James Whitfield", upcoming: true },
  { title: "Resistant HTN: Triple Therapy Failure — Now What?", type: "Case", date: "2026-04-09", time: "12:00 PM ET", presenter: "Dr. Nadia El-Amin", upcoming: false, evalReport: { responses: 42, total: 68, content: 4.5, presenter: 4.7, relevance: 4.3, overall: 4.5, comments: ["Excellent case with practical management pearls", "Would have liked more time for Q&A"] } },
  { title: "2025 Hypertension Canada Guidelines Update", type: "Didactic", date: "2026-03-12", time: "12:00 PM ET", presenter: "Dr. Camille Fournier", upcoming: false, evalReport: { responses: 56, total: 72, content: 4.8, presenter: 4.9, relevance: 4.7, overall: 4.8, comments: ["Best session this year", "Clear and comprehensive summary"] } },
  { title: "Pheochromocytoma Masquerading as Panic Disorder", type: "Case", date: "2026-02-12", time: "12:00 PM ET", presenter: "Dr. James Whitfield", upcoming: false, evalReport: { responses: 38, total: 65, content: 4.6, presenter: 4.4, relevance: 4.2, overall: 4.4, comments: ["Fascinating case", "Great discussion on differential diagnosis"] } },
  { title: "FMD and the Young Hypertensive: A Case Series", type: "Case", date: "2025-12-10", time: "12:00 PM ET", presenter: "Dr. Fatima Hassan", upcoming: false, evalReport: { responses: 35, total: 60, content: 4.3, presenter: 4.5, relevance: 4.1, overall: 4.3, comments: ["Informative case series"] } },
];

const CME_RECORDS = {
  "2026": [
    { session: "Resistant HTN: Triple Therapy Failure — Now What?", date: "April 9, 2026", hours: 1.25, type: "Case", id: "000012" },
    { session: "2025 Hypertension Canada Guidelines Update", date: "March 12, 2026", hours: 1.25, type: "Didactic", id: "000008" },
    { session: "Pheochromocytoma Masquerading as Panic Disorder", date: "February 12, 2026", hours: 1.25, type: "Case", id: "000005" },
  ],
  "2025": [
    { session: "FMD and the Young Hypertensive: A Case Series", date: "December 10, 2025", hours: 1.25, type: "Case", id: "000001" },
    { session: "SGLT2 Inhibitors in Hypertension: Beyond Nephroprotection", date: "November 12, 2025", hours: 1.25, type: "Didactic", id: "000098" },
    { session: "Adrenal Vein Sampling: Who, When, and How", date: "October 8, 2025", hours: 1.25, type: "Didactic", id: "000091" },
    { session: "The Noncompliant Patient: Strategies That Work", date: "September 10, 2025", hours: 1.25, type: "Debate", id: "000085" },
  ],
};

const SUMMARIES = [
  { title: "Resistant HTN: Triple Therapy Failure — Now What?", date: "April 2026", excerpt: "A 58-year-old male with BMI 34, CKD stage 3b, and type 2 diabetes presenting with persistent BP >160/95 despite amlodipine 10mg, ramipril 10mg, and HCTZ 25mg.", tags: ["Resistant HTN", "MRA", "Adherence"] },
  { title: "Pheochromocytoma Masquerading as Panic Disorder", date: "February 2026", excerpt: "A 34-year-old female referred for episodic hypertension with palpitations, diaphoresis, and anxiety.", tags: ["Pheochromocytoma", "Secondary HTN", "Endocrine"] },
  { title: "FMD and the Young Hypertensive: A Case Series", date: "December 2025", excerpt: "Three cases of fibromuscular dysplasia in women under 40, presenting with varied phenotypes.", tags: ["FMD", "Renovascular", "Imaging"] },
];

const PUBLICATIONS = [
  { title: "Canadian Hypertension Specialist Referral Patterns: A National Survey", journal: "Canadian Journal of Cardiology", year: "2026", authors: "Bhatt A, Fournier C, El-Amin N, et al." },
  { title: "Primary Aldosteronism Screening Yield in Canadian Referral Centres", journal: "Hypertension", year: "2025", authors: "Whitfield J, Patel A, Bouchard D, et al." },
  { title: "Renal Denervation in Canada: A Position Statement from CHeSS", journal: "Journal of Hypertension", year: "2025", authors: "Walsh C, Chen R, Bhatt A, et al." },
];

const TOOLS = [
  { name: "Hypertension Canada Guidelines App", desc: "Official Canadian hypertension diagnosis and management guidelines" },
  { name: "Framingham Risk Score Calculator", desc: "10-year cardiovascular risk estimation" },
  { name: "CKD-EPI GFR Calculator", desc: "Estimated GFR using the CKD-EPI equation" },
  { name: "ARR Calculator", desc: "Aldosterone-to-renin ratio with medication adjustment guidance" },
  { name: "ASCVD Risk Estimator Plus", desc: "ACC/AHA pooled cohort equations for atherosclerotic CVD risk" },
];

const PATIENT_RES = [
  { name: "Hypertension Canada – Patient Resources", desc: "Evidence-based patient education materials on blood pressure management" },
  { name: "Heart & Stroke Foundation", desc: "Information on cardiovascular health, risk factors, and healthy living" },
  { name: "Blood Pressure Canada – Home Monitoring", desc: "Guide to accurate home blood pressure measurement technique" },
  { name: "Kidney Foundation of Canada", desc: "Resources on kidney health and the link between hypertension and CKD" },
  { name: "DASH Eating Plan", desc: "Dietary approaches to stop hypertension — meal planning and recipes" },
];

// ─── Colors ────────────────────────────────────────────────────
const C = { navy: "#0B1D3A", navyL: "#132B52", navyM: "#1A3A6B", crim: "#B91C3C", crimL: "#DC2E4E", cream: "#F8F6F1", warmW: "#FDFCFA", warmG: "#E8E4DD", tD: "#1A1A1A", tM: "#4A4A4A", tL: "#7A7A7A", brd: "#E0DCD5", card: "#FFFFFF" };
const typeC = { Didactic: C.navyM, Case: C.crim, Debate: "#7C6A0A" };
const typeBg = { Didactic: C.navy + "12", Case: C.crim + "15", Debate: "#FEF3C7" };
const font = "'DM Sans', sans-serif";
const serif = "'Source Serif 4', 'Georgia', serif";

// ─── App ───────────────────────────────────────────────────────
export default function CHeSS() {
  const [page, setPage] = useState("home");
  const [loggedIn, setLoggedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => { const h = () => setScrolled(window.scrollY > 20); window.addEventListener("scroll", h); return () => window.removeEventListener("scroll", h); }, []);
  const nav = (p) => { setPage(p); setMobileMenu(false); window.scrollTo(0, 0); };

  const NAV = [
    { label: "About", page: "about" },
    { label: "Leadership", page: "leadership" },
    { label: "Members", page: "members" },
    { label: "Schedule", page: "schedule" },
    { label: "Summaries", page: "summaries" },
    { label: "Academic Work", page: "academic" },
    { label: "Education", page: "education" },
    { label: "Clinical Tools", page: "tools" },
    { label: "Patient Resources", page: "patients" },
    { label: "Partners", page: "partners" },
    ...(loggedIn ? [
      { label: "Dashboard", page: "dashboard" },
      { label: "CME Credits", page: "cme" },
    ] : []),
    ...(loggedIn && isAdmin ? [
      { label: "⚙ Admin Panel", page: "admin" },
    ] : []),
    { label: loggedIn ? "Log Out" : "Join CHeSS", page: loggedIn ? "logout" : "register" },
  ];

  const handleNav = (p) => {
    if (p === "logout") { setLoggedIn(false); setIsAdmin(false); nav("home"); }
    else nav(p);
  };

  return (
    <div style={{ fontFamily: serif, color: C.tD, background: C.cream, minHeight: "100vh" }}>
      <link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:wght@300;400;600;700&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        .fu{animation:fadeUp .6s ease-out forwards}
        .fu1{animation:fadeUp .6s ease-out .1s forwards;opacity:0}
        .fu2{animation:fadeUp .6s ease-out .2s forwards;opacity:0}
        .nl{cursor:pointer;padding:6px 0;font-size:13px;font-family:${font};font-weight:500;color:rgba(255,255,255,.78);transition:color .2s;border:none;background:none;letter-spacing:.3px}
        .nl:hover{color:#fff}.nl.ac{color:#fff;border-bottom:2px solid ${C.crim};padding-bottom:4px}
        .cd{background:${C.card};border:1px solid ${C.brd};border-radius:10px;transition:box-shadow .25s,transform .25s}
        .cd:hover{box-shadow:0 8px 30px rgba(11,29,58,.1);transform:translateY(-2px)}
        .bp{display:inline-flex;align-items:center;gap:8px;padding:12px 28px;background:${C.crim};color:#fff;border:none;border-radius:8px;font-family:${font};font-weight:600;font-size:15px;cursor:pointer;transition:background .2s,transform .15s;letter-spacing:.3px}
        .bp:hover{background:${C.crimL};transform:translateY(-1px)}
        .bo{display:inline-flex;align-items:center;gap:8px;padding:11px 26px;background:transparent;color:${C.navy};border:2px solid ${C.navy};border-radius:8px;font-family:${font};font-weight:600;font-size:15px;cursor:pointer;transition:all .2s}
        .bo:hover{background:${C.navy};color:#fff}
        .st{font-size:36px;font-weight:700;color:${C.navy};margin-bottom:8px;line-height:1.15}
        .ss{font-family:${font};font-size:17px;color:${C.tM};margin-bottom:40px;line-height:1.6;max-width:700px}
        .tg{display:inline-block;padding:4px 12px;border-radius:20px;font-family:${font};font-size:12px;font-weight:600;letter-spacing:.5px}
        input,select,textarea{font-family:${font};font-size:15px;padding:12px 16px;border:1.5px solid ${C.brd};border-radius:8px;width:100%;outline:none;transition:border-color .2s;background:#fff;color:${C.tD}}
        input:focus,select:focus,textarea:focus{border-color:${C.navyM}}
        label{font-family:${font};font-size:14px;font-weight:600;color:${C.tD};display:block;margin-bottom:6px}
        .mmb{display:none;background:none;border:none;color:#fff;font-size:24px;cursor:pointer;padding:8px}
        @media(max-width:900px){.dn{display:none!important}.mmb{display:block!important}.st{font-size:28px}}
      `}</style>

      {/* Header */}
      <header style={{ position: "sticky", top: 0, zIndex: 100, background: scrolled ? C.navy + "f5" : C.navy, backdropFilter: scrolled ? "blur(12px)" : "none", borderBottom: `1px solid ${C.navyL}`, transition: "all .3s" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0 8px" }}>
            <div onClick={() => nav("home")} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 42, height: 42, borderRadius: 8, background: `linear-gradient(135deg, #C62828, #B71C1C)`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                <svg viewBox="0 0 40 40" width="36" height="36"><path d="M20 36 C10 28 2 22 2 14 C2 8 7 3 13 3 C16.5 3 19 5 20 7 C21 5 23.5 3 27 3 C33 3 38 8 38 14 C38 22 30 28 20 36Z" fill="#C62828" opacity="0.7"/><path d="M20 36 C10 28 2 22 2 14 C2 8 7 3 13 3 C16.5 3 19 5 20 7 C21 5 23.5 3 27 3 C33 3 38 8 38 14 C38 22 30 28 20 36Z" fill="#E53935" opacity="0.5"/><polyline points="4,20 12,20 15,14 18,26 21,12 24,22 27,18 36,18" stroke="white" strokeWidth="2" fill="none" strokeLinejoin="round" strokeLinecap="round"/></svg>
              </div>
              <div>
                <div style={{ fontFamily: font, fontWeight: 700, fontSize: 20, color: "#fff", letterSpacing: 1 }}>CHeSS</div>
                <div style={{ fontFamily: font, fontSize: 11, color: C.warmG, letterSpacing: .8, marginTop: -2 }}>Canadian Hypertension Specialists Society</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {!loggedIn && <button className="nl" onClick={() => { setLoggedIn(true); nav("dashboard"); }} style={{ fontSize: 13, padding: "6px 16px", border: `1px solid rgba(255,255,255,.3)`, borderRadius: 6 }}>Member Login</button>}
              {loggedIn && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: `linear-gradient(135deg, ${C.crim}, ${C.crimL})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ color: "#fff", fontFamily: font, fontWeight: 700, fontSize: 12 }}>SL</span>
                  </div>
                  <span style={{ fontFamily: font, fontSize: 13, color: "#fff" }}>Dr. Liang</span>
                  <button onClick={() => setIsAdmin(!isAdmin)} style={{ background: isAdmin ? "#F59E0B" : "rgba(255,255,255,.15)", border: "none", color: "#fff", fontFamily: font, fontSize: 11, padding: "4px 10px", borderRadius: 4, cursor: "pointer", marginLeft: 4 }}>{isAdmin ? "Admin ✓" : "Admin"}</button>
                </div>
              )}
              <button className="mmb" onClick={() => setMobileMenu(!mobileMenu)}>{mobileMenu ? "✕" : "☰"}</button>
            </div>
          </div>
          <nav className="dn" style={{ display: "flex", gap: 18, paddingBottom: 10, overflowX: "auto", flexWrap: "wrap" }}>
            {NAV.map(n => <button key={n.page} className={`nl ${page === n.page ? "ac" : ""}`} onClick={() => handleNav(n.page)}>{n.label}</button>)}
          </nav>
        </div>
        {mobileMenu && <div style={{ padding: "8px 24px 16px", display: "flex", flexDirection: "column", gap: 4, borderTop: `1px solid ${C.navyL}` }}>{NAV.map(n => <button key={n.page} className="nl" style={{ textAlign: "left", padding: "10px 0" }} onClick={() => handleNav(n.page)}>{n.label}</button>)}</div>}
      </header>

      <main>
        {page === "home" && <HomePage nav={nav} loggedIn={loggedIn} setLoggedIn={setLoggedIn} />}
        {page === "about" && <AboutPage />}
        {page === "leadership" && <LeadershipPage />}
        {page === "members" && <MembersPage />}
        {page === "schedule" && <SchedulePage isAdmin={isAdmin} />}
        {page === "summaries" && <SummariesPage />}
        {page === "academic" && <AcademicPage />}
        {page === "education" && <EducationPage />}
        {page === "tools" && <ToolsPage />}
        {page === "patients" && <PatientPage />}
        {page === "partners" && <PartnersPage />}
        {page === "register" && <RegisterPage />}
        {page === "dashboard" && <DashboardPage nav={nav} />}
        {page === "cme" && <CMEPage />}
        {page === "survey" && <SurveyPage />}
        {page === "evaluation" && <EvaluationPage />}
        {page === "certificate" && <CertificatePage />}
        {page === "admin" && <AdminPage nav={nav} />}
      </main>

      <footer style={{ background: C.navy, color: C.warmG, padding: "48px 24px 32px", marginTop: 80 }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", flexWrap: "wrap", gap: 40, justifyContent: "space-between" }}>
          <div style={{ maxWidth: 350 }}>
            <div style={{ fontFamily: font, fontWeight: 700, fontSize: 22, color: "#fff", marginBottom: 12, letterSpacing: 1 }}>CHeSS</div>
            <p style={{ fontFamily: font, fontSize: 14, lineHeight: 1.7, color: `${C.warmG}bb` }}>A multidisciplinary network of 120+ physicians dedicated to advancing the care of patients with complex hypertension across Canada.</p>
          </div>
          <div>
            <div style={{ fontFamily: font, fontWeight: 600, fontSize: 13, color: "#fff", letterSpacing: 1, marginBottom: 12, textTransform: "uppercase" }}>Contact</div>
            <p style={{ fontFamily: font, fontSize: 14, lineHeight: 2, color: `${C.warmG}bb` }}>info@chessprovider.ca<br />Follow us on X @CHeSS_Canada</p>
          </div>
        </div>
        <div style={{ maxWidth: 1200, margin: "32px auto 0", paddingTop: 24, borderTop: `1px solid ${C.navyL}`, fontFamily: font, fontSize: 13, color: `${C.warmG}88` }}>© 2026 Canadian Hypertension Specialists Society. All rights reserved.</div>
      </footer>
    </div>
  );
}

function PW({ children, narrow }) { return <div style={{ maxWidth: narrow ? 800 : 1200, margin: "0 auto", padding: "56px 24px 0" }} className="fu">{children}</div>; }
function Label({ children }) { return <div style={{ fontFamily: font, fontWeight: 600, fontSize: 14, color: C.crim, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>{children}</div>; }
function Bar() { return <div style={{ width: 60, height: 4, background: C.crim, borderRadius: 2, marginBottom: 36 }} />; }

// ─── HOME ──────────────────────────────────────────────────────
function HomePage({ nav, loggedIn, setLoggedIn }) {
  return <>
    <div style={{ background: `linear-gradient(160deg, ${C.navy} 0%, ${C.navyM} 100%)`, padding: "100px 24px 90px", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: -100, right: -100, width: 400, height: 400, borderRadius: "50%", background: C.crim + "12" }} />
      <div style={{ maxWidth: 1200, margin: "0 auto", position: "relative" }} className="fu">
        <div style={{ maxWidth: 700 }}>
          <div style={{ fontFamily: font, fontWeight: 600, fontSize: 14, color: C.crimL, letterSpacing: 2, textTransform: "uppercase", marginBottom: 20 }}>Canadian Hypertension Specialists Society</div>
          <h1 style={{ fontSize: 52, fontWeight: 700, color: "#fff", lineHeight: 1.1, marginBottom: 24 }}>Advancing the care of complex hypertension across Canada</h1>
          <p style={{ fontFamily: font, fontSize: 18, color: `${C.warmG}cc`, lineHeight: 1.7, marginBottom: 40, maxWidth: 580 }}>A multidisciplinary network of 120+ specialist physicians collaborating through education, research, and clinical excellence.</p>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <button className="bp" onClick={() => nav("register")}>Join CHeSS →</button>
            {!loggedIn && <button className="bo" style={{ color: "#fff", borderColor: "rgba(255,255,255,.4)" }} onClick={() => { setLoggedIn(true); nav("dashboard"); }}>Member Login</button>}
          </div>
        </div>
      </div>
    </div>
    <div style={{ maxWidth: 1200, margin: "-40px auto 0", padding: "0 24px", position: "relative", zIndex: 10 }}>
      <div className="fu1" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 20 }}>
        {[{ n: "120+", l: "Specialist Physicians" }, { n: "7", l: "Medical Specialties" }, { n: "12", l: "Monthly Sessions / Year" }, { n: "10", l: "Provinces Represented" }].map(s => <div key={s.l} className="cd" style={{ padding: "28px 24px", textAlign: "center" }}><div style={{ fontFamily: font, fontWeight: 700, fontSize: 36, color: C.crim }}>{s.n}</div><div style={{ fontFamily: font, fontSize: 14, color: C.tM, marginTop: 4 }}>{s.l}</div></div>)}
      </div>
    </div>
    <div style={{ maxWidth: 1200, margin: "60px auto 0", padding: "0 24px" }}>
      <div className="fu2" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
        {[{ i: "📋", t: "Upcoming Sessions", d: "View our monthly case conferences, lectures, and debates.", b: "View Schedule", p: "schedule" }, { i: "🔍", t: "Find a Specialist", d: "Search our member directory by specialty, province, or interest.", b: "Browse Directory", p: "members" }, { i: "📄", t: "Case Summaries", d: "Read executive summaries from past educational conferences.", b: "Read Summaries", p: "summaries" }].map(c => <div key={c.p} className="cd" style={{ padding: "32px 28px" }}><div style={{ fontSize: 32, marginBottom: 16 }}>{c.i}</div><h3 style={{ fontFamily: font, fontWeight: 700, fontSize: 20, color: C.navy, marginBottom: 10 }}>{c.t}</h3><p style={{ fontFamily: font, fontSize: 15, color: C.tM, lineHeight: 1.6, marginBottom: 20 }}>{c.d}</p><button className="bp" style={{ padding: "10px 22px", fontSize: 14 }} onClick={() => nav(c.p)}>{c.b}</button></div>)}
      </div>
    </div>
  </>;
}

// ─── ABOUT ─────────────────────────────────────────────────────
function AboutPage() { return <PW narrow><Label>About Us</Label><h1 className="st" style={{ fontSize: 42, marginBottom: 20 }}>Who We Are</h1><Bar /><div style={{ fontFamily: font, fontSize: 16, lineHeight: 1.85, color: C.tM }}><p style={{ marginBottom: 24 }}>The <strong style={{ color: C.navy }}>Canadian Hypertension Specialists Society (CHeSS)</strong> is a national, multidisciplinary organization of over 120 physicians united by a shared commitment to improving the diagnosis, management, and outcomes of patients with complex hypertension.</p><p style={{ marginBottom: 24 }}>Our members represent a broad spectrum of specialties including general internal medicine, nephrology, cardiology, endocrinology, interventional radiology, vascular surgery, diagnostic radiology, and endocrine surgery.</p><div className="cd" style={{ padding: 32, marginBottom: 32, borderLeft: `4px solid ${C.crim}` }}><h3 style={{ fontWeight: 700, fontSize: 18, color: C.navy, marginBottom: 12 }}>Our Mission</h3><p style={{ margin: 0 }}>To advance the education, research, and clinical practice of specialist hypertension care across Canada.</p></div><h2 style={{ fontWeight: 700, fontSize: 24, color: C.navy, marginBottom: 16, fontFamily: serif }}>What We Do</h2><p style={{ marginBottom: 16 }}>Our primary focus is <strong style={{ color: C.navy }}>education</strong>. We run monthly virtual case sessions via Zoom in three formats: didactic lectures, case presentations, and debates on areas of clinical controversy.</p></div></PW>; }

// ─── LEADERSHIP ────────────────────────────────────────────────
function LeadershipPage() { const [exp, setExp] = useState(null); const [expA, setExpA] = useState(null); const renderCard = (m, i, expanded, setExpanded, showRole = true) => <div key={m.name} className="cd" style={{ padding: 0, overflow: "hidden", cursor: "pointer" }} onClick={() => setExpanded(expanded === i ? null : i)}><div style={{ display: "flex", gap: 20, padding: "24px 24px 20px" }}><div style={{ width: 64, height: 64, borderRadius: "50%", background: `linear-gradient(135deg, ${C.navy}, ${C.navyM})`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><span style={{ color: "#fff", fontFamily: font, fontWeight: 700, fontSize: 18 }}>{m.img}</span></div><div><div style={{ fontFamily: font, fontWeight: 700, fontSize: 18, color: C.navy }}>{m.name}</div>{showRole && m.role && <div style={{ fontFamily: font, fontSize: 13, color: C.crim, fontWeight: 600, marginTop: 2 }}>{m.role}</div>}<div style={{ fontFamily: font, fontSize: 13, color: C.tL, marginTop: 4 }}>{m.specialty} · {m.degrees}</div><div style={{ fontFamily: font, fontSize: 13, color: C.tL }}>{m.province}</div></div></div>{expanded === i && <div style={{ padding: "0 24px 24px", fontFamily: font, fontSize: 14, color: C.tM, lineHeight: 1.7, borderTop: `1px solid ${C.brd}`, paddingTop: 16 }}>{m.bio}</div>}</div>; return <PW><Label>Leadership</Label><h1 className="st">Executive Board</h1><p className="ss">The CHeSS executive provides strategic direction and oversees our educational programming, membership, scholarly initiatives, and advocacy. CHeSS was established in 2022.</p><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 24 }}>{EXEC_TEAM.map((m, i) => renderCard(m, i, exp, setExp))}</div><h2 style={{ fontFamily: font, fontWeight: 700, fontSize: 28, color: C.navy, marginTop: 48, marginBottom: 8 }}>Advisors</h2><p className="ss">Senior advisors who provide guidance and mentorship to the CHeSS executive and membership.</p><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 24 }}>{ADVISORS.map((m, i) => renderCard(m, i, expA, setExpA, false))}</div></PW>; }

// ─── MEMBERS ───────────────────────────────────────────────────
function MembersPage() { const [s, setS] = useState(""); const [sp, setSp] = useState("All"); const [pr, setPr] = useState("All"); const [st, setSt] = useState("All"); const [exp, setExp] = useState(null); const sps = ["All", ...new Set(MEMBERS.map(m => m.specialty))]; const pvs = ["All", ...new Set(MEMBERS.map(m => m.province))]; const f = MEMBERS.filter(m => { if (sp !== "All" && m.specialty !== sp) return false; if (pr !== "All" && m.province !== pr) return false; if (st !== "All" && m.status !== st) return false; if (s && !m.name.toLowerCase().includes(s.toLowerCase()) && !m.interests.toLowerCase().includes(s.toLowerCase())) return false; return true; }); return <PW><Label>Directory</Label><h1 className="st">Membership Directory</h1><p className="ss">Find CHeSS members by specialty, province, or interest. Members listed here have opted in to public visibility.</p><div className="cd" style={{ padding: "20px 24px", marginBottom: 32 }}><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}><div><label>Search</label><input placeholder="Name or interest..." value={s} onChange={e => setS(e.target.value)} /></div><div><label>Specialty</label><select value={sp} onChange={e => setSp(e.target.value)}>{sps.map(x => <option key={x}>{x}</option>)}</select></div><div><label>Province</label><select value={pr} onChange={e => setPr(e.target.value)}>{pvs.map(x => <option key={x}>{x}</option>)}</select></div><div><label>Status</label><select value={st} onChange={e => setSt(e.target.value)}>{["All", "Full Member", "Trainee Member"].map(x => <option key={x}>{x}</option>)}</select></div></div></div><div style={{ fontFamily: font, fontSize: 14, color: C.tL, marginBottom: 16 }}>{f.length} member{f.length !== 1 ? "s" : ""} found</div><div style={{ display: "grid", gap: 16 }}>{f.map((m, i) => <div key={m.name} className="cd" style={{ padding: "20px 24px", cursor: "pointer" }} onClick={() => setExp(exp === i ? null : i)}><div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}><div style={{ display: "flex", gap: 16, alignItems: "center" }}><div style={{ width: 48, height: 48, borderRadius: "50%", background: m.hasPhoto ? `url('https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(m.name)}&backgroundColor=0B1D3A,1A3A6B,B91C3C&backgroundType=gradientLinear') center/cover` : `linear-gradient(135deg, ${C.navyM}, ${C.navy})`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: m.hasPhoto ? `2px solid ${C.brd}` : "none" }}>{!m.hasPhoto && <span style={{ color: "#fff", fontFamily: font, fontWeight: 700, fontSize: 14 }}>{m.name.split(" ").map(n => n[0]).join("").slice(0, 2)}</span>}</div><div><div style={{ fontFamily: font, fontWeight: 700, fontSize: 16, color: C.navy }}>{m.name}</div><div style={{ fontFamily: font, fontSize: 13, color: C.tL }}>{m.degrees}</div></div></div><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><span className="tg" style={{ background: C.navy + "12", color: C.navy }}>{m.specialty}</span><span className="tg" style={{ background: C.warmG, color: C.tM }}>{m.province}</span><span className="tg" style={{ background: m.status === "Trainee Member" ? "#FEF3C7" : "#D1FAE5", color: m.status === "Trainee Member" ? "#92400E" : "#065F46" }}>{m.status}</span></div></div>{exp === i && <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${C.brd}`, fontFamily: font, fontSize: 14, lineHeight: 1.7, color: C.tM }}><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 16 }}><div><strong style={{ color: C.navy }}>Clinical Interests:</strong> {m.interests}</div><div><strong style={{ color: C.navy }}>Research:</strong> {m.research}</div><div><strong style={{ color: C.navy }}>Referrals:</strong> {m.referral}</div></div></div>}</div>)}</div></PW>; }

// ─── SCHEDULE (with admin eval reports) ────────────────────────
function SchedulePage({ isAdmin }) {
  const [showReport, setShowReport] = useState(null);
  const upcoming = EVENTS.filter(e => e.upcoming); const past = EVENTS.filter(e => !e.upcoming);
  return <PW><Label>Schedule</Label><h1 className="st">Case Conferences & Events</h1><p className="ss">Monthly sessions are held via Zoom. Session links are distributed to active CHeSS members only.</p>
    <h2 style={{ fontFamily: font, fontWeight: 700, fontSize: 22, color: C.navy, marginBottom: 20 }}>Upcoming Sessions</h2>
    <div style={{ display: "grid", gap: 16, marginBottom: 48 }}>{upcoming.map(e => <div key={e.title} className="cd" style={{ padding: "24px 28px", borderLeft: `4px solid ${typeC[e.type]}` }}><div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}><div><span className="tg" style={{ background: typeBg[e.type], color: typeC[e.type], marginBottom: 10, display: "inline-block" }}>{e.type}</span><h3 style={{ fontFamily: font, fontWeight: 700, fontSize: 18, color: C.navy, marginBottom: 6 }}>{e.title}</h3><div style={{ fontFamily: font, fontSize: 14, color: C.tM }}>Presented by {e.presenter}</div></div><div style={{ textAlign: "right", flexShrink: 0 }}><div style={{ fontFamily: font, fontWeight: 700, fontSize: 16, color: C.navy }}>{new Date(e.date + "T12:00:00").toLocaleDateString("en-CA", { month: "long", day: "numeric", year: "numeric" })}</div><div style={{ fontFamily: font, fontSize: 13, color: C.tL }}>{e.time}</div></div></div></div>)}</div>
    <h2 style={{ fontFamily: font, fontWeight: 700, fontSize: 22, color: C.navy, marginBottom: 20 }}>Past Sessions</h2>
    <div style={{ display: "grid", gap: 12 }}>{past.map((e, i) => <div key={e.title}><div className="cd" style={{ padding: "18px 24px", cursor: isAdmin ? "pointer" : "default" }} onClick={() => isAdmin && setShowReport(showReport === i ? null : i)}><div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, alignItems: "center" }}><div style={{ display: "flex", gap: 12, alignItems: "center" }}><span className="tg" style={{ background: typeBg[e.type], color: typeC[e.type] }}>{e.type}</span><span style={{ fontFamily: font, fontWeight: 600, fontSize: 15, color: C.navy }}>{e.title}</span></div><div style={{ display: "flex", gap: 12, alignItems: "center" }}>{isAdmin && e.evalReport && <span className="tg" style={{ background: "#D1FAE5", color: "#065F46" }}>📊 {e.evalReport.responses} evals</span>}<span style={{ fontFamily: font, fontSize: 13, color: C.tL }}>{new Date(e.date + "T12:00:00").toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" })}</span></div></div></div>
    {isAdmin && showReport === i && e.evalReport && <div style={{ background: "#fff", border: `1px solid ${C.brd}`, borderRadius: "0 0 10px 10px", borderTop: "none", padding: "20px 24px", marginTop: -4 }}>
      <div style={{ fontFamily: font, fontWeight: 700, fontSize: 16, color: C.navy, marginBottom: 12 }}>Evaluation Report — Admin View</div>
      <div style={{ fontFamily: font, fontSize: 14, color: C.tM, marginBottom: 16 }}>{e.evalReport.responses} / {e.evalReport.total} responses ({Math.round(e.evalReport.responses / e.evalReport.total * 100)}% response rate)</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
        {[["Content", e.evalReport.content], ["Presenter", e.evalReport.presenter], ["Relevance", e.evalReport.relevance], ["Overall", e.evalReport.overall]].map(([l, v]) => <div key={l} style={{ background: C.cream, borderRadius: 8, padding: 16, textAlign: "center" }}><div style={{ fontFamily: font, fontWeight: 700, fontSize: 24, color: C.navy }}>{v}</div><div style={{ fontFamily: font, fontSize: 12, color: C.tL }}>/ 5 — {l}</div></div>)}
      </div>
      <div style={{ fontFamily: font, fontSize: 14, color: C.tD }}><strong>Comments:</strong>{e.evalReport.comments.map((c, ci) => <div key={ci} style={{ padding: "6px 0 6px 16px", borderLeft: `3px solid ${C.brd}`, margin: "8px 0", color: C.tM, fontStyle: "italic" }}>"{c}"</div>)}</div>
    </div>}
    </div>)}</div>
  </PW>;
}

// ─── SUMMARIES ─────────────────────────────────────────────────
function SummariesPage() { return <PW><Label>Summaries</Label><h1 className="st">Executive Summaries</h1><p className="ss">Briefs summarizing key learning points from past CHeSS conferences.</p><div style={{ display: "grid", gap: 24 }}>{SUMMARIES.map(s => <div key={s.title} className="cd" style={{ padding: "28px 32px" }}><div style={{ fontFamily: font, fontSize: 13, color: C.tL, marginBottom: 8 }}>{s.date}</div><h3 style={{ fontFamily: font, fontWeight: 700, fontSize: 20, color: C.navy, marginBottom: 12 }}>{s.title}</h3><p style={{ fontFamily: font, fontSize: 15, color: C.tM, lineHeight: 1.7, marginBottom: 16 }}>{s.excerpt}</p><div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>{s.tags.map(t => <span key={t} className="tg" style={{ background: C.navy + "10", color: C.navyM }}>{t}</span>)}</div><button className="bo" style={{ padding: "8px 20px", fontSize: 13 }}>Download PDF ↓</button></div>)}</div></PW>; }

// ─── ACADEMIC ──────────────────────────────────────────────────
function AcademicPage() { return <PW><Label>Research</Label><h1 className="st">Academic Work</h1><p className="ss">Peer-reviewed publications and ongoing research from CHeSS members.</p><div style={{ display: "grid", gap: 16, marginBottom: 48 }}>{PUBLICATIONS.map(p => <div key={p.title} className="cd" style={{ padding: "24px 28px" }}><h3 style={{ fontFamily: font, fontWeight: 700, fontSize: 17, color: C.navy, marginBottom: 8 }}>{p.title}</h3><div style={{ fontFamily: font, fontSize: 14, color: C.tM, marginBottom: 4 }}>{p.authors}</div><div style={{ fontFamily: font, fontSize: 14, color: C.tL }}><em>{p.journal}</em> ({p.year})</div></div>)}</div></PW>; }

function EducationPage() { return <PW narrow><Label>Education</Label><h1 className="st">Hypertension Specialist Course</h1><p className="ss">CHeSS partners with a third-party educational provider to deliver a comprehensive hypertension specialist course.</p><div className="cd" style={{ padding: 40, textAlign: "center", background: `linear-gradient(160deg, ${C.navy}, ${C.navyM})`, border: "none", color: "#fff" }}><div style={{ fontSize: 48, marginBottom: 20 }}>🎓</div><h2 style={{ fontFamily: font, fontWeight: 700, fontSize: 26, marginBottom: 12 }}>Hypertension Specialist Certification Course</h2><p style={{ fontFamily: font, fontSize: 16, color: `${C.warmG}cc`, maxWidth: 500, margin: "0 auto 28px", lineHeight: 1.7 }}>A comprehensive, evidence-based curriculum covering all aspects of specialist hypertension care.</p><button className="bp" style={{ background: "#fff", color: C.navy, fontSize: 16, padding: "14px 32px" }}>Visit Course Website →</button></div></PW>; }

function ToolsPage() { return <PW><Label>For Clinicians</Label><h1 className="st">Clinical Tools</h1><p className="ss">Curated clinical decision support tools and calculators for hypertension management.</p><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 20 }}>{TOOLS.map(t => <div key={t.name} className="cd" style={{ padding: "24px 28px" }}><h3 style={{ fontFamily: font, fontWeight: 700, fontSize: 17, color: C.navy, marginBottom: 8 }}>{t.name}</h3><p style={{ fontFamily: font, fontSize: 14, color: C.tM, lineHeight: 1.6, marginBottom: 16 }}>{t.desc}</p><button className="bo" style={{ padding: "8px 20px", fontSize: 13 }}>Open Tool →</button></div>)}</div></PW>; }

function PatientPage() { return <PW><Label>For Patients</Label><h1 className="st">Patient Resources</h1><p className="ss">Trusted resources for patients and families to learn about high blood pressure.</p><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 20 }}>{PATIENT_RES.map(t => <div key={t.name} className="cd" style={{ padding: "24px 28px" }}><h3 style={{ fontFamily: font, fontWeight: 700, fontSize: 17, color: C.navy, marginBottom: 8 }}>{t.name}</h3><p style={{ fontFamily: font, fontSize: 14, color: C.tM, lineHeight: 1.6, marginBottom: 16 }}>{t.desc}</p><button className="bo" style={{ padding: "8px 20px", fontSize: 13 }}>Visit Resource →</button></div>)}</div></PW>; }

// ─── INDUSTRY PARTNERSHIPS ─────────────────────────────────────
function PartnersPage() {
  const tiers = [
    {
      level: "Platinum",
      range: "$50,000+",
      color: "#6B7280",
      bg: "linear-gradient(135deg, #E5E7EB, #F3F4F6)",
      border: "#9CA3AF",
      partners: [
        { name: "Servier Canada", desc: "Global pharmaceutical company with a longstanding commitment to cardiovascular medicine and hypertension research. Servier supports CHeSS educational programming and the development of Canadian hypertension guidelines.", focus: "Antihypertensive therapeutics, cardiovascular outcomes research" },
        { name: "Medtronic Canada", desc: "Global leader in medical technology supporting innovation in renal denervation and catheter-based hypertension interventions. Medtronic partners with CHeSS on procedural education and device-related research.", focus: "Renal denervation devices, cardiovascular device innovation" },
      ],
    },
    {
      level: "Gold",
      range: "$20,000 – $49,999",
      color: "#B8860B",
      bg: "linear-gradient(135deg, #FEF3C7, #FFFBEB)",
      border: "#D4A843",
      partners: [
        { name: "Bayer Canada", desc: "Bayer supports CHeSS through educational grants focused on mineralocorticoid receptor antagonists and primary aldosteronism screening initiatives.", focus: "MRA therapeutics, aldosterone-mediated hypertension" },
        { name: "AstraZeneca Canada", desc: "AstraZeneca collaborates with CHeSS on educational initiatives related to cardiorenal protection and the role of SGLT2 inhibitors in hypertensive patients with comorbidities.", focus: "SGLT2 inhibitors, cardiorenal medicine" },
      ],
    },
    {
      level: "Silver",
      range: "$10,000 – $19,999",
      color: "#71717A",
      bg: "linear-gradient(135deg, #F4F4F5, #FAFAFA)",
      border: "#A1A1AA",
      partners: [
        { name: "OMRON Healthcare Canada", desc: "OMRON supports CHeSS initiatives in ambulatory and home blood pressure monitoring education, providing validated devices for research and clinical programs.", focus: "BP monitoring devices, home BP validation studies" },
        { name: "Novartis Canada", desc: "Novartis partners with CHeSS on educational programming related to emerging combination therapies and fixed-dose antihypertensive regimens.", focus: "Combination antihypertensive therapy, adherence research" },
      ],
    },
  ];

  return <PW>
    <Label>Partners</Label>
    <h1 className="st">Industry Partnerships</h1>
    <p className="ss">CHeSS is grateful to our industry partners whose support enables our educational programming, research initiatives, and national advocacy efforts. All partnerships are conducted in accordance with Canadian medical education guidelines.</p>

    {/* Current year banner */}
    <div className="cd" style={{ padding: "20px 28px", marginBottom: 36, borderLeft: `4px solid ${C.crim}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
      <div>
        <div style={{ fontFamily: font, fontWeight: 700, fontSize: 18, color: C.navy }}>2026–27 Academic Year Partners</div>
        <div style={{ fontFamily: font, fontSize: 14, color: C.tM, marginTop: 4 }}>July 2026 – June 2027 · Partnership opportunities for 2027–28 open in Spring 2027</div>
      </div>
      <span className="tg" style={{ background: "#D1FAE5", color: "#065F46", fontSize: 13, padding: "6px 16px" }}>Current Year</span>
    </div>

    {tiers.map(tier => (
      <div key={tier.level} style={{ marginBottom: 40 }}>
        {/* Tier header */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
          <div style={{ background: tier.bg, border: `2px solid ${tier.border}`, borderRadius: 8, padding: "8px 20px", display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 12, height: 12, borderRadius: "50%", background: tier.border }} />
            <span style={{ fontFamily: font, fontWeight: 700, fontSize: 16, color: tier.color }}>{tier.level}</span>
          </div>
          <span style={{ fontFamily: font, fontSize: 14, color: C.tL }}>{tier.range}</span>
          <div style={{ flex: 1, height: 1, background: C.brd }} />
        </div>

        {/* Partner cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 20 }}>
          {tier.partners.map(p => (
            <div key={p.name} className="cd" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ background: tier.bg, padding: "20px 24px", borderBottom: `1px solid ${tier.border}44` }}>
                <div style={{ width: 56, height: 56, borderRadius: 10, background: C.navy, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                  <span style={{ color: "#fff", fontFamily: font, fontWeight: 700, fontSize: 16 }}>{p.name.split(" ").map(w => w[0]).join("").slice(0, 2)}</span>
                </div>
                <h3 style={{ fontFamily: font, fontWeight: 700, fontSize: 19, color: C.navy, margin: 0 }}>{p.name}</h3>
              </div>
              <div style={{ padding: "20px 24px" }}>
                <p style={{ fontFamily: font, fontSize: 14, color: C.tM, lineHeight: 1.7, marginBottom: 12 }}>{p.desc}</p>
                <div style={{ fontFamily: font, fontSize: 13, color: C.tL }}><strong style={{ color: C.navy }}>Focus areas:</strong> {p.focus}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    ))}

    {/* Become a partner CTA */}
    <div className="cd" style={{ padding: 40, textAlign: "center", background: `linear-gradient(160deg, ${C.navy}, ${C.navyM})`, border: "none", color: "#fff", marginTop: 20 }}>
      <h2 style={{ fontFamily: font, fontWeight: 700, fontSize: 24, marginBottom: 12 }}>Become a CHeSS Partner</h2>
      <p style={{ fontFamily: font, fontSize: 16, color: `${C.warmG}cc`, maxWidth: 550, margin: "0 auto 24px", lineHeight: 1.7 }}>
        Partnership opportunities for the 2027–28 academic year open in Spring 2027. Industry partners gain visibility among 120+ specialist physicians across Canada and support the advancement of hypertension care.
      </p>
      <button className="bp" style={{ background: "#fff", color: C.navy, fontSize: 16, padding: "14px 32px" }}>Contact Us About Partnerships</button>
      <p style={{ fontFamily: font, fontSize: 13, color: `${C.warmG}88`, marginTop: 16 }}>All partnerships comply with RCPSC and Hypertension Canada conflict of interest policies.</p>
    </div>
  </PW>;
}

function RegisterPage() { const [sub, setSub] = useState(false); if (sub) return <PW narrow><div style={{ textAlign: "center", padding: "60px 0" }}><div style={{ fontSize: 64, marginBottom: 20 }}>✓</div><h1 className="st" style={{ fontSize: 32 }}>Application Submitted</h1><p style={{ fontFamily: font, fontSize: 17, color: C.tM, lineHeight: 1.7, marginTop: 16, maxWidth: 500, margin: "16px auto 0" }}>Thank you for your interest in CHeSS. Your application will be reviewed within 5–10 business days.</p></div></PW>; return <PW narrow><Label>Membership</Label><h1 className="st">Join CHeSS</h1><p className="ss">Submit your application to join. Applications are reviewed by the executive team.</p><div className="cd" style={{ padding: "36px 32px" }}><div style={{ display: "grid", gap: 20 }}><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}><div><label>Full Name *</label><input placeholder="Dr. Jane Smith" /></div><div><label>Degrees *</label><input placeholder="MD, FRCPC" /></div></div><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}><div><label>Email *</label><input type="email" placeholder="jane.smith@university.ca" /></div><div><label>Specialty *</label><select defaultValue=""><option value="" disabled>Select specialty</option><option>General Internal Medicine</option><option>Nephrology</option><option>Cardiology</option><option>Endocrinology</option><option>Interventional Radiology</option><option>Vascular Surgery</option><option>Diagnostic Radiology</option><option>Other</option></select></div></div><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}><div><label>Province *</label><select defaultValue=""><option value="" disabled>Select province</option>{["Alberta", "British Columbia", "Manitoba", "New Brunswick", "Newfoundland and Labrador", "Nova Scotia", "Ontario", "PEI", "Quebec", "Saskatchewan"].map(p => <option key={p}>{p}</option>)}</select></div><div><label>Institution *</label><input placeholder="University Health Network" /></div></div><div><label>Bio / Clinical Interests</label><textarea rows={3} placeholder="Tell us about your clinical focus and interests..." /></div><div><label>Profile Photo (optional)</label><div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 4 }}><div style={{ width: 72, height: 72, borderRadius: "50%", background: C.warmG, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: `2px dashed ${C.brd}` }}><span style={{ fontFamily: font, fontSize: 11, color: C.tL, textAlign: "center", lineHeight: 1.3 }}>No photo</span></div><div><input type="file" accept="image/*" style={{ fontSize: 14 }} /><p style={{ fontFamily: font, fontSize: 12, color: C.tL, margin: "4px 0 0" }}>JPG or PNG, max 2 MB. This will appear on the membership directory if you opt in.</p></div></div></div><div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}><input type="checkbox" style={{ width: 20, height: 20, marginTop: 2 }} /><label style={{ fontWeight: 400, fontSize: 14, color: C.tM, margin: 0 }}>I would like to be listed in the public CHeSS Membership Directory.</label></div><button className="bp" style={{ fontSize: 16, padding: "14px 36px" }} onClick={() => setSub(true)}>Submit Application →</button></div></div></PW>; }

// ═══════════════════════════════════════════════════════════════
// ─── NEW: MEMBER PORTAL PAGES ─────────────────────────────────
// ═══════════════════════════════════════════════════════════════

// ─── MEMBER DASHBOARD ──────────────────────────────────────────
function DashboardPage({ nav }) {
  const [calendarUrl, setCalendarUrl] = useState(null);
  return <PW>
    <Label>Member Portal</Label><h1 className="st">Welcome back, Dr. Liang</h1>
    <div style={{ width: 60, height: 4, background: C.crim, borderRadius: 2, marginBottom: 32 }} />

    {/* Profile bar */}
    <div className="cd" style={{ padding: "24px 28px", marginBottom: 24, display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
      <div style={{ width: 64, height: 64, borderRadius: "50%", background: `linear-gradient(135deg, ${C.navy}, ${C.navyM})`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><span style={{ color: "#fff", fontFamily: font, fontWeight: 700, fontSize: 20 }}>SL</span></div>
      <div><div style={{ fontFamily: font, fontWeight: 700, fontSize: 20, color: C.navy }}>Dr. Sarah Liang</div><div style={{ fontFamily: font, fontSize: 14, color: C.tL }}>MD, FRCPC · Nephrology · Ontario · Full Member</div></div>
    </div>

    {/* Stats */}
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 32 }}>
      <div className="cd" style={{ padding: 24, textAlign: "center" }}><div style={{ fontFamily: font, fontWeight: 700, fontSize: 36, color: C.navy }}>3.75</div><div style={{ fontFamily: font, fontSize: 14, color: C.tL, marginTop: 4 }}>CME Hours (2026)</div></div>
      <div className="cd" style={{ padding: 24, textAlign: "center", borderColor: C.crim }}><div style={{ fontFamily: font, fontWeight: 700, fontSize: 36, color: C.crim }}>1</div><div style={{ fontFamily: font, fontSize: 14, color: C.tL, marginTop: 4 }}>Pending Surveys</div></div>
      <div className="cd" style={{ padding: 24, textAlign: "center" }}><div style={{ fontFamily: font, fontWeight: 700, fontSize: 36, color: C.navy }}>1</div><div style={{ fontFamily: font, fontSize: 14, color: C.tL, marginTop: 4 }}>Pending Evaluations</div></div>
      <div className="cd" style={{ padding: 24, textAlign: "center" }}><div style={{ fontFamily: font, fontWeight: 700, fontSize: 36, color: C.navy }}>8.75</div><div style={{ fontFamily: font, fontSize: 14, color: C.tL, marginTop: 4 }}>Total CME Hours</div></div>
    </div>

    {/* Pending items */}
    <h2 style={{ fontFamily: font, fontWeight: 700, fontSize: 20, color: C.navy, marginBottom: 16 }}>Action Required</h2>
    <div style={{ display: "grid", gap: 12, marginBottom: 40 }}>
      <div className="cd" style={{ padding: "18px 24px", borderLeft: `4px solid ${C.crim}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div><div style={{ fontFamily: font, fontWeight: 600, fontSize: 15, color: C.navy }}>CME Attendance Survey</div><div style={{ fontFamily: font, fontSize: 13, color: C.tL }}>Resistant HTN: Triple Therapy Failure — Now What? · <span style={{ color: C.crim }}>Expires Apr 16</span></div></div>
          <button className="bp" style={{ padding: "8px 20px", fontSize: 13 }} onClick={() => nav("survey")}>Complete Survey →</button>
        </div>
      </div>
      <div className="cd" style={{ padding: "18px 24px", borderLeft: `4px solid ${C.navyM}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div><div style={{ fontFamily: font, fontWeight: 600, fontSize: 15, color: C.navy }}>Session Evaluation</div><div style={{ fontFamily: font, fontSize: 13, color: C.tL }}>Resistant HTN: Triple Therapy Failure — Now What? · <span style={{ color: C.crim }}>Expires Apr 16</span></div></div>
          <button className="bo" style={{ padding: "8px 20px", fontSize: 13 }} onClick={() => nav("evaluation")}>Complete Evaluation →</button>
        </div>
      </div>
    </div>

    {/* Quick links */}
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginBottom: 40 }}>
      <div className="cd" style={{ padding: "24px", cursor: "pointer" }} onClick={() => nav("cme")}><div style={{ fontSize: 28, marginBottom: 10 }}>🎓</div><div style={{ fontFamily: font, fontWeight: 700, fontSize: 16, color: C.navy, marginBottom: 4 }}>CME Credits</div><div style={{ fontFamily: font, fontSize: 13, color: C.tL }}>View and download certificates</div></div>
      <div className="cd" style={{ padding: "24px", cursor: "pointer" }} onClick={() => nav("schedule")}><div style={{ fontSize: 28, marginBottom: 10 }}>📋</div><div style={{ fontFamily: font, fontWeight: 700, fontSize: 16, color: C.navy, marginBottom: 4 }}>Session Schedule</div><div style={{ fontFamily: font, fontSize: 13, color: C.tL }}>Upcoming conferences</div></div>
      <div className="cd" style={{ padding: "24px", cursor: "pointer" }} onClick={() => setCalendarUrl("webcal://chessprovider.ca/chess-calendar/abc123/")}><div style={{ fontSize: 28, marginBottom: 10 }}>📅</div><div style={{ fontFamily: font, fontWeight: 700, fontSize: 16, color: C.navy, marginBottom: 4 }}>Calendar Subscription</div><div style={{ fontFamily: font, fontSize: 13, color: C.tL }}>Auto-sync sessions to your calendar</div></div>
    </div>

    {/* Calendar subscription modal */}
    {calendarUrl && <div className="cd" style={{ padding: 28, borderLeft: `4px solid ${C.navyM}`, marginBottom: 32 }}>
      <h3 style={{ fontFamily: font, fontWeight: 700, fontSize: 18, color: C.navy, marginBottom: 12 }}>Subscribe to CHeSS Calendar</h3>
      <p style={{ fontFamily: font, fontSize: 14, color: C.tM, marginBottom: 16, lineHeight: 1.6 }}>Add all CHeSS sessions to your calendar automatically. When new sessions are added, they'll appear in your calendar within 24 hours.</p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <button className="bp" style={{ padding: "10px 20px", fontSize: 14 }}>Add to Google Calendar</button>
        <button className="bo" style={{ padding: "10px 20px", fontSize: 14 }}>Add to Apple/Outlook</button>
      </div>
      <div><label style={{ fontSize: 13 }}>Or copy this URL into any calendar app:</label><input readOnly value="https://chessprovider.ca/chess-calendar/a8f3k2x9m/" onClick={e => e.target.select()} style={{ marginTop: 4, fontSize: 13, background: C.cream }} /></div>
    </div>}
  </PW>;
}

// ─── CME CREDITS PAGE ──────────────────────────────────────────
function CMEPage() {
  return <PW>
    <Label>CME Credits</Label><h1 className="st">Your CME Certificates</h1>
    <p className="ss">Download individual certificates or track your annual CME hours. Certificates are generated automatically when you confirm session attendance.</p>

    {Object.entries(CME_RECORDS).map(([year, records]) => {
      const total = records.reduce((a, r) => a + r.hours, 0);
      return <div key={year} style={{ marginBottom: 40 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, paddingBottom: 8, borderBottom: `2px solid ${C.navy}` }}>
          <h2 style={{ fontFamily: font, fontWeight: 700, fontSize: 22, color: C.navy, margin: 0 }}>{year}</h2>
          <span style={{ fontFamily: font, fontWeight: 700, fontSize: 16, color: C.crim }}>{total.toFixed(2)} hours total</span>
        </div>
        <div style={{ display: "grid", gap: 10 }}>
          {records.map(r => <div key={r.id} className="cd" style={{ padding: "16px 22px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
              <div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                  <span className="tg" style={{ background: typeBg[r.type], color: typeC[r.type] }}>{r.type}</span>
                  <span style={{ fontFamily: font, fontWeight: 600, fontSize: 15, color: C.navy }}>{r.session}</span>
                </div>
                <div style={{ fontFamily: font, fontSize: 13, color: C.tL }}>{r.date} · {r.hours} hours</div>
              </div>
              <button className="bo" style={{ padding: "6px 18px", fontSize: 13 }}>Download Certificate ↓</button>
            </div>
          </div>)}
        </div>
      </div>;
    })}
  </PW>;
}

// ─── CME SURVEY PAGE ───────────────────────────────────────────
function SurveyPage() {
  const [submitted, setSubmitted] = useState(false);
  const [attended, setAttended] = useState(null);

  if (submitted) return <PW narrow>
    <div style={{ background: "#D1FAE5", border: "1px solid #10B981", borderRadius: 10, padding: 32, textAlign: "center" }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>✓</div>
      <h2 style={{ fontFamily: font, fontWeight: 700, fontSize: 22, color: "#065F46", marginBottom: 8 }}>{attended ? "Attendance Confirmed" : "Response Recorded"}</h2>
      <p style={{ fontFamily: font, fontSize: 15, color: "#065F46", lineHeight: 1.6 }}>{attended ? "Your CME certificate has been generated and emailed to you. You can also download it from your CME Credits page." : "Thank you for letting us know. No CME credit will be recorded."}</p>
    </div>
  </PW>;

  return <PW narrow>
    <Label>CME Survey</Label><h1 className="st" style={{ fontSize: 28 }}>Attendance Confirmation</h1>
    <div style={{ width: 60, height: 4, background: C.crim, borderRadius: 2, marginBottom: 32 }} />

    <div className="cd" style={{ padding: 32 }}>
      <div style={{ background: C.cream, borderRadius: 10, padding: 24, marginBottom: 28 }}>
        <span className="tg" style={{ background: typeBg.Case, color: typeC.Case, marginBottom: 8, display: "inline-block" }}>Case</span>
        <h3 style={{ fontFamily: font, fontWeight: 700, fontSize: 20, color: C.navy, marginBottom: 8 }}>Resistant HTN: Triple Therapy Failure — Now What?</h3>
        <div style={{ fontFamily: font, fontSize: 14, color: C.tL }}>April 9, 2026 · Presented by Dr. Nadia El-Amin · 1.25 CME hours</div>
      </div>

      <p style={{ fontFamily: font, fontSize: 16, color: C.tD, marginBottom: 20 }}>Did you attend this session?</p>
      <div style={{ display: "flex", gap: 16 }}>
        <button className="bp" style={{ flex: 1, justifyContent: "center" }} onClick={() => { setAttended(true); setSubmitted(true); }}>Yes, I Attended</button>
        <button className="bo" style={{ flex: 1, justifyContent: "center" }} onClick={() => { setAttended(false); setSubmitted(true); }}>No, I Did Not Attend</button>
      </div>
      <p style={{ fontFamily: font, fontSize: 12, color: C.tL, marginTop: 20 }}>This survey expires on April 16, 2026. If you confirm attendance, a CME certificate will be automatically generated.</p>
    </div>
  </PW>;
}

// ─── EVALUATION PAGE ───────────────────────────────────────────
function EvaluationPage() {
  const [submitted, setSubmitted] = useState(false);
  const [ratings, setRatings] = useState({ obj: 0, knowledge: 0, expectations: 0, practice: 0, interaction: 0, bias: 0, presEff: 0, presContent: 0, presMethods: 0 });
  const [canmeds, setCanmeds] = useState([]);

  const toggleCanmeds = (role) => setCanmeds(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]);

  const RatingRow = ({ label, field }) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: `1px solid ${C.brd}` }}>
      <span style={{ fontFamily: font, fontSize: 14, color: C.tD, flex: 1 }}>{label}</span>
      <div style={{ display: "flex", gap: 2 }}>
        {[1, 2, 3, 4, 5].map(v => (
          <button key={v} onClick={() => setRatings({ ...ratings, [field]: v })} style={{ width: 36, height: 36, borderRadius: 6, border: `1.5px solid ${v <= ratings[field] ? C.crim : C.brd}`, background: v <= ratings[field] ? C.crim : "#fff", color: v <= ratings[field] ? "#fff" : C.tM, fontFamily: font, fontWeight: 600, fontSize: 14, cursor: "pointer", transition: "all .15s" }}>{v}</button>
        ))}
      </div>
    </div>
  );

  if (submitted) return <PW narrow>
    <div style={{ background: "#D1FAE5", border: "1px solid #10B981", borderRadius: 10, padding: 32, textAlign: "center" }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>✓</div>
      <h2 style={{ fontFamily: font, fontWeight: 700, fontSize: 22, color: "#065F46", marginBottom: 8 }}>Evaluation Submitted</h2>
      <p style={{ fontFamily: font, fontSize: 15, color: "#065F46" }}>Thank you for your feedback! Your responses help us improve our programming.</p>
    </div>
  </PW>;

  return <PW narrow>
    <Label>CPD Evaluation Form</Label><h1 className="st" style={{ fontSize: 28 }}>Session Evaluation</h1>
    <div style={{ width: 60, height: 4, background: C.crim, borderRadius: 2, marginBottom: 32 }} />

    <div className="cd" style={{ padding: 32 }}>
      {/* Session header */}
      <div style={{ background: C.cream, borderRadius: 10, padding: 24, marginBottom: 28 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontFamily: font, fontSize: 13, color: C.tL, marginBottom: 12 }}>
          <div><strong style={{ color: C.navy }}>Event:</strong> CHeSS Case Conference</div>
          <div><strong style={{ color: C.navy }}>Credit Hours:</strong> 1.25</div>
          <div><strong style={{ color: C.navy }}>Presenter:</strong> Dr. Nadia Khan</div>
          <div><strong style={{ color: C.navy }}>Date:</strong> April 9, 2026</div>
        </div>
        <h3 style={{ fontFamily: font, fontWeight: 700, fontSize: 18, color: C.navy, margin: 0 }}>Resistant HTN: Triple Therapy Failure — Now What?</h3>
      </div>

      {/* Activity ratings */}
      <h3 style={{ fontFamily: font, fontWeight: 600, fontSize: 16, color: C.navy, marginBottom: 4 }}>Quality of the Activity</h3>
      <p style={{ fontFamily: font, fontSize: 13, color: C.tL, marginBottom: 16 }}>Rate on a scale of 1 (strongly disagree) to 5 (strongly agree).</p>

      <div style={{ marginBottom: 28 }}>
        <RatingRow label="Met the stated learning objectives" field="obj" />
        <RatingRow label="Enhanced my knowledge" field="knowledge" />
        <RatingRow label="Satisfied my expectations" field="expectations" />
        <RatingRow label="Conveyed information that applied to my practice" field="practice" />
        <RatingRow label="Allocated at least 25% of the time for interaction" field="interaction" />
        <RatingRow label="Was free from commercial bias" field="bias" />
      </div>

      {/* Practice impact */}
      <div style={{ marginBottom: 24 }}>
        <label>What did you learn or how will this event impact your practice?</label>
        <textarea rows={3} placeholder="Describe any takeaways or changes you plan to make..." style={{ marginTop: 4 }} />
      </div>

      {/* CanMEDS */}
      <div style={{ marginBottom: 28 }}>
        <label>Which CanMEDS roles were addressed during this activity?</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
          {["Medical Expert", "Scholar", "Collaborator", "Communicator", "Leader", "Professional", "Health Advocate"].map(role => (
            <button key={role} onClick={() => toggleCanmeds(role)} style={{ padding: "8px 16px", borderRadius: 20, border: `1.5px solid ${canmeds.includes(role) ? C.navy : C.brd}`, background: canmeds.includes(role) ? C.navy : "#fff", color: canmeds.includes(role) ? "#fff" : C.tM, fontFamily: font, fontSize: 13, fontWeight: 500, cursor: "pointer", transition: "all .15s" }}>{canmeds.includes(role) ? "✓ " : ""}{role}</button>
          ))}
        </div>
      </div>

      {/* Presenter evaluation */}
      <h3 style={{ fontFamily: font, fontWeight: 600, fontSize: 16, color: C.navy, marginBottom: 4, marginTop: 8 }}>Evaluation of Presenter</h3>
      <p style={{ fontFamily: font, fontSize: 13, color: C.tL, marginBottom: 16 }}>Rate on a scale of 1 (poor) to 5 (excellent).</p>

      <div style={{ marginBottom: 28 }}>
        <RatingRow label="Overall Presentation Effectiveness" field="presEff" />
        <RatingRow label="Content Relevance" field="presContent" />
        <RatingRow label="Used Effective Teaching Methods" field="presMethods" />
      </div>

      {/* Comments */}
      <div style={{ marginBottom: 20 }}><label>Additional Comments</label><textarea rows={3} placeholder="Any additional feedback on the session..." style={{ marginTop: 4 }} /></div>
      <div style={{ marginBottom: 24 }}><label>Suggestions for Future Activities</label><textarea rows={3} placeholder="Topics or formats you'd like to see in future sessions..." style={{ marginTop: 4 }} /></div>

      <button className="bp" style={{ width: "100%", justifyContent: "center", fontSize: 16 }} onClick={() => setSubmitted(true)}>Submit Evaluation</button>

      <p style={{ fontFamily: font, fontSize: 12, color: C.tL, marginTop: 20, lineHeight: 1.6, fontStyle: "italic" }}>CHeSS Case Conferences are a self-approved group learning activity (Section 1) as defined by the Maintenance of Certification Program of The Royal College of Physicians and Surgeons of Canada.</p>
    </div>
  </PW>;
}

// ─── CERTIFICATE PREVIEW ───────────────────────────────────────
function CertificatePage() {
  return <PW narrow>
    <Label>Certificate</Label>
    <div style={{ background: "#fff", border: `3px solid ${C.navy}`, padding: 56, textAlign: "center", position: "relative", borderRadius: 4 }}>
      <div style={{ position: "absolute", top: 8, left: 8, right: 8, bottom: 8, border: `1px solid ${C.crim}`, pointerEvents: "none" }} />
      <div style={{ fontFamily: font, fontWeight: 700, fontSize: 14, letterSpacing: 3, color: C.crim, textTransform: "uppercase", marginBottom: 8 }}>Canadian Hypertension Specialists Society</div>
      <div style={{ fontFamily: serif, fontSize: 36, fontWeight: 700, color: C.navy, marginBottom: 24 }}>Certificate of Attendance</div>
      <div style={{ fontFamily: font, fontSize: 14, color: C.tL, marginBottom: 32 }}>Continuing Medical Education</div>
      <div style={{ fontFamily: serif, fontSize: 28, fontWeight: 600, color: C.navy, borderBottom: `2px solid ${C.crim}`, display: "inline-block", paddingBottom: 4, marginBottom: 28 }}>Dr. Sarah Liang, MD, FRCPC</div>
      <div style={{ fontFamily: font, fontSize: 15, color: C.tD, lineHeight: 1.8, marginBottom: 8 }}>attended the CHeSS educational session<br /><strong>"Resistant HTN: Triple Therapy Failure — Now What?"</strong><br />on April 9, 2026</div>
      <div style={{ fontFamily: font, fontWeight: 700, fontSize: 20, color: C.crim, margin: "24px 0 32px" }}>1.25 Hours CME Credit</div>
      <div style={{ fontFamily: font, fontSize: 12, color: C.tL, lineHeight: 1.7 }}>This activity was an accredited group learning activity as defined by the<br />Maintenance of Certification Program of the Royal College of Physicians and Surgeons of Canada.</div>
      <div style={{ fontFamily: font, fontSize: 11, color: "#ccc", marginTop: 12 }}>Certificate ID: CHESS-000012 · Generated April 10, 2026</div>
    </div>
    <div style={{ textAlign: "center", marginTop: 20 }}><button className="bp">Print / Save as PDF</button></div>
  </PW>;
}

// ═══════════════════════════════════════════════════════════════
// ─── ADMIN PANEL ──────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
function AdminPage({ nav }) {
  const [tab, setTab] = useState("dashboard");
  const [sessionAdded, setSessionAdded] = useState(false);
  const [pubAdded, setPubAdded] = useState(false);
  const [memberApproved, setMemberApproved] = useState(null);
  const [editingMember, setEditingMember] = useState(null);
  const [memberSaved, setMemberSaved] = useState(false);
  const [exportReady, setExportReady] = useState(false);
  const [pendingView, setPendingView] = useState("pending");

  const aCard = { background: "#fff", border: "1px solid #ddd", borderRadius: 8, padding: 24, marginBottom: 16 };
  const aBtn = (primary) => ({ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 20px", background: primary ? "#2271b1" : "#f0f0f0", color: primary ? "#fff" : "#333", border: primary ? "1px solid #2271b1" : "1px solid #ccc", borderRadius: 4, fontFamily: font, fontWeight: 600, fontSize: 14, cursor: "pointer", marginRight: 8, transition: "all .15s" });
  const wpBg = "#F0F0F1";

  const PENDING_APPLICANTS = [
    { id: 99, name: "Dr. Rachel Kim", email: "r.kim@ubc.ca", applied: "April 14, 2026", degrees: "MD, FRCPC", specialty: "Nephrology", province: "British Columbia", institution: "UBC Hospital", bio: "Clinical focus on renovascular hypertension and CKD. Research interests include SGLT2 inhibitor effects on renal hemodynamics.", referral: "eReferral via BC renal program", directory: true },
    { id: 100, name: "Dr. Alexei Volkov", email: "a.volkov@dal.ca", applied: "April 12, 2026", degrees: "MD, PGY-4", specialty: "General Internal Medicine", province: "Nova Scotia", institution: "Dalhousie University / QEII HSC", bio: "PGY-4 trainee interested in secondary hypertension screening and ambulatory BP monitoring.", referral: "N/A — Trainee", directory: false },
  ];

  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: "📊" },
    { id: "addSession", label: "Add Session", icon: "➕" },
    { id: "academic", label: "Academic Work", icon: "📄" },
    { id: "members", label: "Manage Members", icon: "👥" },
    { id: "export", label: "Export Data", icon: "📦" },
  ];

  return (
    <div style={{ background: wpBg, minHeight: "80vh" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
        {/* Admin header bar */}
        <div style={{ background: "#1D2327", padding: "10px 20px", margin: "0 -24px", display: "flex", alignItems: "center", gap: 20 }}>
          <span style={{ fontFamily: font, fontSize: 14, color: "#fff", fontWeight: 600 }}>♥ CHeSS Admin</span>
          <div style={{ display: "flex", gap: 2 }}>
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{ background: tab === t.id ? "#2271b1" : "transparent", color: "#fff", border: "none", padding: "8px 16px", fontFamily: font, fontSize: 13, cursor: "pointer", borderRadius: 3, transition: "background .15s" }}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ padding: "32px 0" }}>
          {/* ─── ADMIN DASHBOARD ─── */}
          {tab === "dashboard" && <>
            <h1 style={{ fontFamily: font, fontSize: 24, fontWeight: 400, color: "#1D2327", marginBottom: 24 }}>CHeSS Portal Dashboard</h1>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
              {[{ n: "120+", l: "Active Members", c: C.crim }, { n: "3", l: "Upcoming Sessions", c: C.navy }, { n: "2", l: "Pending Applications", c: "#D97706" }].map(s => (
                <div key={s.l} style={{ ...aCard, textAlign: "center" }}><div style={{ fontFamily: font, fontWeight: 700, fontSize: 36, color: s.c }}>{s.n}</div><div style={{ fontFamily: font, fontSize: 14, color: "#666", marginTop: 4 }}>{s.l}</div></div>
              ))}
            </div>
            <div style={aCard}>
              <h2 style={{ fontFamily: font, fontSize: 18, fontWeight: 600, margin: "0 0 16px", color: "#1D2327" }}>Quick Actions</h2>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button style={aBtn(true)} onClick={() => setTab("addSession")}>➕ Add New Session</button>
                <button style={aBtn(true)} onClick={() => setTab("academic")}>📄 Academic Work</button>
                <button style={{ ...aBtn(true), background: "#D97706", borderColor: "#B45309" }} onClick={() => setTab("members")}>👥 Manage Members (2 pending)</button>
                <button style={aBtn(false)} onClick={() => nav("schedule")}>📊 Evaluation Reports</button>
                <button style={aBtn(false)} onClick={() => setTab("export")}>📦 Export All Data</button>
              </div>
            </div>
          </>}

          {/* ─── ADD SESSION ─── */}
          {tab === "addSession" && <>
            <h1 style={{ fontFamily: font, fontSize: 24, fontWeight: 400, color: "#1D2327", marginBottom: 8 }}>Add New Session</h1>
            <p style={{ fontFamily: font, fontSize: 14, color: "#666", marginBottom: 24 }}>Create a new session. It automatically appears on the schedule and in all calendar subscriptions.</p>

            {sessionAdded && <div style={{ background: "#D1FAE5", border: "1px solid #10B981", borderRadius: 4, padding: "12px 16px", marginBottom: 16, fontFamily: font, fontSize: 14, color: "#065F46" }}>Session created successfully! It now appears on the public schedule.{isDemoMode ? " (Demo mode — connect Supabase to persist data)" : ""}</div>}

            <div id="session-form" style={{ ...aCard, maxWidth: 700 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                <div><label>Session Title *</label><input name="title" placeholder="e.g. Aortic Coarctation: Diagnosis and Intervention" /></div>
                <div><label>Presenter(s)</label><input name="presenter" placeholder="e.g. Dr. Kevin O'Brien" /></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                <div><label>Date *</label><input name="session_date" type="date" /></div>
                <div><label>Time (ET)</label><input name="session_time" type="time" defaultValue="12:00" /></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                <div><label>Session Type</label><select name="session_type"><option value="Didactic">Didactic Lecture</option><option value="Case">Case Presentation</option><option value="Debate">Debate / Discussion</option></select></div>
                <div><label>CME Hours</label><input name="cme_hours" type="number" defaultValue="1.25" step="0.25" /></div>
              </div>
              <div style={{ marginBottom: 20 }}><label>Description (optional)</label><textarea name="description" rows={3} placeholder="Brief description of session content..." /></div>
              <button style={aBtn(true)} onClick={async () => {
                const f = document.getElementById('session-form');
                const get = (n) => f.querySelector(`[name="${n}"]`)?.value || '';
                if (!get('title') || !get('session_date')) { alert('Title and date are required.'); return; }
                const result = await adminActions.addSession({ title: get('title'), session_date: get('session_date'), session_time: get('session_time'), session_type: get('session_type'), presenter: get('presenter'), cme_hours: parseFloat(get('cme_hours')) || 1.25, description: get('description') });
                if (result.success) { setSessionAdded(true); f.querySelectorAll('input,textarea').forEach(el => el.value = ''); }
                else alert('Error: ' + (result.error?.message || 'Failed to save'));
              }}>Create Session</button>
            </div>

            <div style={{ ...aCard, maxWidth: 700 }}>
              <h3 style={{ fontFamily: font, fontSize: 16, fontWeight: 600, margin: "0 0 12px" }}>Recent Sessions</h3>
              <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: font, fontSize: 14 }}>
                <thead><tr style={{ borderBottom: "2px solid #ddd" }}>{["Title", "Date", "Type", "Edit"].map(h => <th key={h} style={{ textAlign: "left", padding: "8px 12px", color: "#1D2327", fontWeight: 600 }}>{h}</th>)}</tr></thead>
                <tbody>
                  {EVENTS.slice(0, 6).map(e => <tr key={e.title} style={{ borderBottom: "1px solid #eee" }}><td style={{ padding: "10px 12px" }}>{e.title}</td><td style={{ padding: "10px 12px" }}>{new Date(e.date+"T12:00:00").toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" })}</td><td style={{ padding: "10px 12px" }}>{e.type}</td><td style={{ padding: "10px 12px" }}><a href="#" style={{ color: "#2271b1" }}>Edit</a></td></tr>)}
                </tbody>
              </table>
            </div>
          </>}

          {/* ─── ACADEMIC WORK ─── */}
          {tab === "academic" && <>
            <h1 style={{ fontFamily: font, fontSize: 24, fontWeight: 400, color: "#1D2327", marginBottom: 8 }}>Academic Work</h1>
            <p style={{ fontFamily: font, fontSize: 14, color: "#666", marginBottom: 24 }}>Add and manage CHeSS publications, position statements, abstracts, and ongoing research projects.</p>

            {pubAdded && <div style={{ background: "#D1FAE5", border: "1px solid #10B981", borderRadius: 4, padding: "12px 16px", marginBottom: 16, fontFamily: font, fontSize: 14, color: "#065F46" }}>Publication added successfully!{isDemoMode ? " (Demo mode — connect Supabase to persist)" : ""}</div>}

            <div id="pub-form" style={{ ...aCard, maxWidth: 750 }}>
              <h3 style={{ fontFamily: font, fontSize: 16, fontWeight: 600, margin: "0 0 16px" }}>Add New Publication</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                <div><label>Title *</label><input name="title" placeholder="e.g. Canadian Hypertension Specialist Referral Patterns" /></div>
                <div><label>Type</label><select name="pub_type"><option value="published">Published Article</option><option value="position_statement">Position Statement / Consensus</option><option value="abstract">Conference Abstract</option><option value="ongoing">Ongoing Research Project</option></select></div>
              </div>
              <div style={{ marginBottom: 16 }}><label>Authors</label><input name="authors" placeholder="e.g. Bhatt A, Fournier C, El-Amin N, et al." /></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                <div><label>Journal / Venue</label><input name="journal" placeholder="e.g. Canadian Journal of Cardiology" /></div>
                <div><label>Year</label><input name="year" defaultValue="2026" /></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                <div><label>DOI</label><input name="doi" placeholder="e.g. 10.1016/j.cjca.2026.01.012" /></div>
                <div><label>Status</label><input name="status" placeholder="e.g. Published, In press, Data collection" /></div>
              </div>
              <button style={aBtn(true)} onClick={async () => {
                const f = document.getElementById('pub-form');
                const get = (n) => f.querySelector(`[name="${n}"]`)?.value || '';
                if (!get('title')) { alert('Title is required.'); return; }
                const result = await adminActions.addPublication({ title: get('title'), authors: get('authors'), journal: get('journal'), year: get('year'), doi: get('doi'), pub_type: get('pub_type'), status: get('status') });
                if (result.success) { setPubAdded(true); f.querySelectorAll('input,textarea').forEach(el => el.value = ''); }
                else alert('Error: ' + (result.error?.message || 'Failed to save'));
              }}>Add Publication</button>
            </div>

            {/* Published work table */}
            <div style={{ ...aCard, maxWidth: 750 }}>
              <h3 style={{ fontFamily: font, fontSize: 16, fontWeight: 600, margin: "0 0 12px" }}>Published Work (3)</h3>
              <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: font, fontSize: 14 }}>
                <thead><tr style={{ borderBottom: "2px solid #ddd" }}>{["Title", "Authors", "Journal", "Year", "Type", "Actions"].map(h => <th key={h} style={{ textAlign: "left", padding: "8px 10px", fontWeight: 600, fontSize: 13 }}>{h}</th>)}</tr></thead>
                <tbody>
                  {PUBLICATIONS.map(p => <tr key={p.title} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "10px", maxWidth: 220 }}><strong>{p.title}</strong></td>
                    <td style={{ padding: "10px", fontSize: 13, color: "#666" }}>{p.authors}</td>
                    <td style={{ padding: "10px", fontSize: 13, fontStyle: "italic" }}>{p.journal}</td>
                    <td style={{ padding: "10px" }}>{p.year}</td>
                    <td style={{ padding: "10px" }}><span style={{ background: "#f0f0f0", padding: "2px 8px", borderRadius: 10, fontSize: 12 }}>Published</span></td>
                    <td style={{ padding: "10px" }}><a href="#" style={{ color: "#2271b1" }}>Edit</a> | <a href="#" style={{ color: "#dc3232" }}>Delete</a></td>
                  </tr>)}
                </tbody>
              </table>
            </div>

            {/* Ongoing research */}
            <div style={{ ...aCard, maxWidth: 750 }}>
              <h3 style={{ fontFamily: font, fontSize: 16, fontWeight: 600, margin: "0 0 12px" }}>Ongoing Research Projects (3)</h3>
              <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: font, fontSize: 14 }}>
                <thead><tr style={{ borderBottom: "2px solid #ddd" }}>{["Project", "Team", "Status", "Actions"].map(h => <th key={h} style={{ textAlign: "left", padding: "8px 10px", fontWeight: 600, fontSize: 13 }}>{h}</th>)}</tr></thead>
                <tbody>
                  {[
                    { title: "National Registry of Renal Denervation Outcomes", team: "Walsh C, Chen R, Bhatt A", status: "Data collection" },
                    { title: "PA Screening Yields: Prospective Multicentre Study", team: "Whitfield J, Patel A, Bouchard D", status: "Enrollment open" },
                    { title: "Canadian Consensus on Secondary HTN Evaluation", team: "Bhatt A, Fournier C, El-Amin N, et al.", status: "Drafting" },
                  ].map(r => <tr key={r.title} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "10px" }}><strong>{r.title}</strong></td>
                    <td style={{ padding: "10px", fontSize: 13, color: "#666" }}>{r.team}</td>
                    <td style={{ padding: "10px" }}><span style={{ background: "#FEF3C7", color: "#92400E", padding: "2px 8px", borderRadius: 10, fontSize: 12, fontWeight: 600 }}>{r.status}</span></td>
                    <td style={{ padding: "10px" }}><a href="#" style={{ color: "#2271b1" }}>Edit</a> | <a href="#" style={{ color: "#dc3232" }}>Delete</a></td>
                  </tr>)}
                </tbody>
              </table>
            </div>
          </>}

          {/* ─── MANAGE MEMBERS ─── */}
          {tab === "members" && <>
            <h1 style={{ fontFamily: font, fontSize: 24, fontWeight: 400, color: "#1D2327", marginBottom: 16 }}>Manage Members</h1>

            {memberApproved && <div style={{ background: "#D1FAE5", border: "1px solid #10B981", borderRadius: 4, padding: "12px 16px", marginBottom: 16, fontFamily: font, fontSize: 14, color: "#065F46" }}>Member "{memberApproved}" approved and welcome email sent.</div>}
            {memberSaved && <div style={{ background: "#D1FAE5", border: "1px solid #10B981", borderRadius: 4, padding: "12px 16px", marginBottom: 16, fontFamily: font, fontSize: 14, color: "#065F46" }}>Member profile updated successfully.</div>}

            {/* Tabs */}
            <div style={{ display: "flex", borderBottom: "1px solid #ccc", marginBottom: 24 }}>
              <button onClick={() => { setPendingView("pending"); setEditingMember(null); }} style={{ padding: "10px 20px", fontFamily: font, fontSize: 14, fontWeight: 600, border: "none", borderBottom: pendingView === "pending" ? "3px solid #2271b1" : "3px solid transparent", background: "none", cursor: "pointer", color: pendingView === "pending" ? "#2271b1" : "#666" }}>Pending Applications <span style={{ background: "#FEF3C7", color: "#92400E", padding: "2px 8px", borderRadius: 10, fontSize: 12, marginLeft: 6 }}>2</span></button>
              <button onClick={() => { setPendingView("active"); setEditingMember(null); }} style={{ padding: "10px 20px", fontFamily: font, fontSize: 14, fontWeight: 600, border: "none", borderBottom: pendingView === "active" ? "3px solid #2271b1" : "3px solid transparent", background: "none", cursor: "pointer", color: pendingView === "active" ? "#2271b1" : "#666" }}>Active Members</button>
            </div>

            {/* Editing a member */}
            {editingMember !== null ? (() => {
              const m = MEMBERS[editingMember];
              return <div style={{ ...aCard, maxWidth: 700 }}>
                <h3 style={{ fontFamily: font, fontSize: 16, fontWeight: 600, margin: "0 0 16px" }}>Editing: {m.name}</h3>
                <div><label>Display Name</label><input defaultValue={m.name} /></div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, margin: "16px 0" }}>
                  <div><label>Degrees</label><input defaultValue={m.degrees} /></div>
                  <div><label>Specialty</label><input defaultValue={m.specialty} /></div>
                  <div><label>Province</label><input defaultValue={m.province} /></div>
                  <div><label>Institution</label><input defaultValue="University Hospital" /></div>
                  <div><label>Referral Info</label><input defaultValue={m.referral} /></div>
                  <div><label>Research</label><input defaultValue={m.research} /></div>
                </div>
                <div style={{ marginBottom: 16 }}><label>Bio / Clinical Interests</label><textarea rows={3} defaultValue={m.interests} /></div>
                <div style={{ marginBottom: 16 }}><label style={{ fontWeight: 400 }}><input type="checkbox" defaultChecked style={{ width: "auto", marginRight: 8 }} />Listed in public directory</label></div>
                <button style={aBtn(true)} onClick={() => { setEditingMember(null); setMemberSaved(true); }}>Save Changes</button>
                <button style={aBtn(false)} onClick={() => setEditingMember(null)}>Cancel</button>
              </div>;
            })()

            : pendingView === "pending" ? <>
              {PENDING_APPLICANTS.filter(a => a.name !== memberApproved).map(a => (
                <div key={a.id} style={aCard}>
                  <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
                    <div>
                      <h3 style={{ fontFamily: font, fontSize: 16, fontWeight: 600, margin: "0 0 4px", color: "#1D2327" }}>{a.name} <span style={{ background: "#FEF3C7", color: "#92400E", padding: "2px 10px", borderRadius: 10, fontSize: 12, fontWeight: 600, marginLeft: 8 }}>Pending</span></h3>
                      <div style={{ fontFamily: font, fontSize: 13, color: "#666" }}>{a.email} · Applied {a.applied}</div>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                    <div><label>Degrees</label><input defaultValue={a.degrees} /></div>
                    <div><label>Specialty</label><input defaultValue={a.specialty} /></div>
                    <div><label>Province</label><input defaultValue={a.province} /></div>
                    <div><label>Institution</label><input defaultValue={a.institution} /></div>
                  </div>
                  <div style={{ marginBottom: 16 }}><label>Bio / Clinical Interests</label><textarea rows={3} defaultValue={a.bio} /></div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                    <div><label>Referral Info</label><input defaultValue={a.referral} /></div>
                    <div><label>Approve as</label><select><option>Full Member</option><option>Trainee Member</option></select></div>
                  </div>
                  <div style={{ marginBottom: 16 }}><label style={{ fontWeight: 400 }}><input type="checkbox" defaultChecked={a.directory} style={{ width: "auto", marginRight: 8 }} />List in public directory</label></div>
                  <button style={aBtn(true)} onClick={async () => { await adminActions.approveMember(a.id, 'full'); setMemberApproved(a.name); }}>✓ Approve</button>
                  <button style={aBtn(false)}>✕ Decline</button>
                </div>
              ))}
            </>

            : <>
              <div style={aCard}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: font, fontSize: 14 }}>
                  <thead><tr style={{ borderBottom: "2px solid #ddd" }}>{["Name", "Specialty", "Province", "Status", "Directory", "Actions"].map(h => <th key={h} style={{ textAlign: "left", padding: "8px 12px", fontWeight: 600 }}>{h}</th>)}</tr></thead>
                  <tbody>
                    {MEMBERS.map((m, i) => <tr key={m.name} style={{ borderBottom: "1px solid #eee" }}>
                      <td style={{ padding: "10px 12px" }}><strong>{m.name}</strong><br /><span style={{ color: "#999", fontSize: 12 }}>{m.degrees}</span></td>
                      <td style={{ padding: "10px 12px" }}>{m.specialty}</td>
                      <td style={{ padding: "10px 12px" }}>{m.province}</td>
                      <td style={{ padding: "10px 12px" }}><span style={{ background: m.status === "Trainee Member" ? "#FEF3C7" : "#E0E7FF", color: m.status === "Trainee Member" ? "#92400E" : "#3730A3", padding: "2px 8px", borderRadius: 10, fontSize: 12, fontWeight: 600 }}>{m.status === "Trainee Member" ? "Trainee" : "Full"}</span></td>
                      <td style={{ padding: "10px 12px" }}>✓</td>
                      <td style={{ padding: "10px 12px" }}><a href="#" style={{ color: "#2271b1" }} onClick={(e) => { e.preventDefault(); setEditingMember(i); }}>Edit</a></td>
                    </tr>)}
                  </tbody>
                </table>
              </div>
            </>}
          </>}

          {/* ─── EXPORT DATA ─── */}
          {tab === "export" && <>
            <h1 style={{ fontFamily: font, fontSize: 24, fontWeight: 400, color: "#1D2327", marginBottom: 8 }}>Export CHeSS Data</h1>
            <p style={{ fontFamily: font, fontSize: 14, color: "#666", marginBottom: 24 }}>Download a ZIP with all CHeSS data as CSV files for record-keeping and reporting.</p>

            <div style={{ ...aCard, maxWidth: 600 }}>
              <h3 style={{ fontFamily: font, fontSize: 18, fontWeight: 600, margin: "0 0 16px" }}>📦 Full Data Export</h3>
              <p style={{ fontFamily: font, fontSize: 14, color: "#444", marginBottom: 16 }}>The ZIP file will contain:</p>
              <div style={{ background: "#F8F8F8", borderRadius: 6, padding: 20, marginBottom: 20 }}>
                {[
                  ["membership_directory.csv", "All members with specialty, province, institution, bio, research, directory status"],
                  ["sessions_history.csv", "All past and upcoming sessions with dates, types, presenters, CME hours"],
                  ["cme_attendance.csv", "Every CME attendance record: member name, session, date, hours earned, certificate ID"],
                  ["evaluation_results.csv", "All evaluation responses: session, ratings, comments, suggestions (anonymized)"],
                  ["academic_work.csv", "All publications, position statements, and ongoing research projects"],
                ].map(([file, desc]) => (
                  <div key={file} style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "flex-start" }}>
                    <span style={{ fontFamily: "monospace", fontSize: 13, background: "#E8E4DD", padding: "2px 8px", borderRadius: 4, flexShrink: 0, color: C.navy, fontWeight: 600 }}>{file}</span>
                    <span style={{ fontFamily: font, fontSize: 13, color: "#666" }}>{desc}</span>
                  </div>
                ))}
              </div>

              <button style={{ ...aBtn(true), fontSize: 16, padding: "14px 28px" }} onClick={async () => { if (!isDemoMode) await adminActions.exportAllAsZip(); setExportReady(true); }}>Download ZIP Export</button>

              {exportReady && <div style={{ background: "#D1FAE5", border: "1px solid #10B981", borderRadius: 4, padding: "12px 16px", marginTop: 16, fontFamily: font, fontSize: 14, color: "#065F46" }}>
                ✓ Export generated! Your download of <strong>chess-export-2026-04-20.zip</strong> (5 CSV files, 158 KB) has started.
              </div>}

              <p style={{ fontFamily: font, fontSize: 13, color: "#999", marginTop: 16 }}>Data is current as of the moment you click download. Evaluation responses are anonymized — member names are not included in evaluation exports.</p>
            </div>
          </>}
        </div>
      </div>
    </div>
  );
}
