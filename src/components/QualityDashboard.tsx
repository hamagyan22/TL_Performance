"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { db } from "@/lib/firebaseClient";
import { collection, query, where, getDocs, doc, setDoc, onSnapshot } from "firebase/firestore";
import { 
  Award, CheckCircle2, Calendar, TrendingUp, ArrowLeft, Search, Plus, 
  Trash2, Users, Check, Copy, Sparkles, ShieldCheck, Save, Download, 
  Sun, Moon, Filter, Layers, Eye, Grid, Columns, ChevronDown, CheckCheck, RefreshCw
} from "lucide-react";

interface QualityDashboardProps {
  userProfile: any;
  onBack: () => void;
  isDarkMode?: boolean;
  toggleDarkMode?: () => void;
}

interface EvaluatorSection {
  id: string;
  evaluator: string;
  team: string;
  colorBadge: string;
  headerBg: string;
  borderColor: string;
  accentColor: string;
}

const DEFAULT_SECTIONS: EvaluatorSection[] = [
  {
    id: "lara_kamil",
    evaluator: "Lara Kamil",
    team: "Ankido Buya Team",
    colorBadge: "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800/60",
    headerBg: "from-purple-900/10 via-purple-800/5 to-transparent",
    borderColor: "border-purple-200/80 dark:border-purple-800/40",
    accentColor: "#9333ea"
  },
  {
    id: "mohammed_jihad",
    evaluator: "Mohammed Jihad",
    team: "Younis Kamal Team",
    colorBadge: "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 border-sky-200 dark:border-sky-800/60",
    headerBg: "from-sky-900/10 via-sky-800/5 to-transparent",
    borderColor: "border-sky-200/80 dark:border-sky-800/40",
    accentColor: "#0284c7"
  },
  {
    id: "mohammed_dlshad",
    evaluator: "Mohammed Dlshad Team QA",
    team: "Mohammed Dlshad Team",
    colorBadge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60",
    headerBg: "from-emerald-900/10 via-emerald-800/5 to-transparent",
    borderColor: "border-emerald-200/80 dark:border-emerald-800/40",
    accentColor: "#1C6B53"
  }
];

const QUARTERS = [
  { id: "Q1", label: "Q1", subtitle: "Weeks 1 – 12", startWeek: 1 },
  { id: "Q2", label: "Q2", subtitle: "Weeks 13 – 24", startWeek: 13 },
  { id: "Q3", label: "Q3", subtitle: "Weeks 25 – 36", startWeek: 25 },
  { id: "Q4", label: "Q4", subtitle: "Weeks 37 – 48", startWeek: 37 },
];

const YEARS = ["2026", "2027", "2028", "2029", "2030"];

// Helper to compute average from scores in a week
function computeWeekAvg(scores: Record<string, string>, weekNum: number): string {
  if (!scores) return "-";
  
  // A week has 6 calls and 1 outbound
  const keys = [
    `w${weekNum}_call_${(weekNum - 1) * 6 + 1}`,
    `w${weekNum}_call_${(weekNum - 1) * 6 + 2}`,
    `w${weekNum}_call_${(weekNum - 1) * 6 + 3}`,
    `w${weekNum}_call_${(weekNum - 1) * 6 + 4}`,
    `w${weekNum}_call_${(weekNum - 1) * 6 + 5}`,
    `w${weekNum}_call_${(weekNum - 1) * 6 + 6}`,
    `w${weekNum}_outbound`
  ];

  const vals = keys.map(k => (scores[k] || "").trim().toUpperCase()).filter(v => v !== "");
  if (vals.length === 0) return "-";

  // Check if all filled slots are 'V'
  const isAllV = vals.every(v => v === "V");
  if (isAllV) return "V";

  // Filter out 'V' and 'N/A'
  const numericVals: number[] = [];
  for (const v of vals) {
    if (v === "V" || v === "N/A" || v === "NA") continue;
    const num = parseFloat(v);
    if (!isNaN(num)) {
      numericVals.push(num);
    }
  }

  if (numericVals.length === 0) return "-";

  const sum = numericVals.reduce((acc, curr) => acc + curr, 0);
  const avg = sum / numericVals.length;
  return avg.toFixed(2);
}

export default function QualityDashboard({
  userProfile,
  onBack,
  isDarkMode = false,
  toggleDarkMode
}: QualityDashboardProps) {
  const [selectedYear, setSelectedYear] = useState("2026");
  const [selectedQuarter, setSelectedQuarter] = useState("Q1");
  const [activeSectionId, setActiveSectionId] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"all_weeks" | "single_week">("all_weeks");
  const [focusedWeek, setFocusedWeek] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "idle">("idle");
  const [copyToast, setCopyToast] = useState<string | null>(null);

  // Raw data from Firestore: Map<docId, documentData>
  const [evalData, setEvalData] = useState<Record<string, any>>({});
  // List of all known team members to populate CSR list if doc doesn't exist
  const [rosterMembers, setRosterMembers] = useState<any[]>([]);

  // Selection & keyboard navigation
  const [selectedCell, setSelectedCell] = useState<{ rowId: string; colKey: string } | null>(null);

  // Debounced save queue
  const saveTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});

  // 1. Fetch team members from Firestore
  useEffect(() => {
    async function fetchRoster() {
      try {
        const snap = await getDocs(collection(db, "team_members"));
        const members: any[] = [];
        snap.forEach(d => {
          members.push({ id: d.id, ...d.data() });
        });
        setRosterMembers(members);
      } catch (err) {
        console.error("Failed to fetch team members for QA", err);
      }
    }
    fetchRoster();
  }, []);

  // 2. Real-time listener for quality evaluations in selected year and quarter
  useEffect(() => {
    setLoading(true);
    const q = query(
      collection(db, "quality_evaluations"),
      where("year", "==", selectedYear),
      where("quarter", "==", selectedQuarter)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const dataMap: Record<string, any> = {};
      snapshot.forEach(d => {
        dataMap[d.id] = { id: d.id, ...d.data() };
      });
      setEvalData(dataMap);
      setLoading(false);
    }, (err) => {
      console.error("Firestore QA snapshot error:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [selectedYear, selectedQuarter]);

  // Handle cell value modification with real-time Firestore persistence
  const handleScoreChange = useCallback((
    section: EvaluatorSection,
    csrName: string,
    key: string,
    rawVal: string
  ) => {
    const slug = csrName.toLowerCase().replace(/[^a-z0-9]/g, "_");
    const sectionSlug = section.evaluator.toLowerCase().replace(/[^a-z0-9]/g, "_");
    const docId = `${selectedYear}_${selectedQuarter}_${sectionSlug}_${slug}`;

    // Clean value: Uppercase if V or N/A
    let val = rawVal.trim();
    if (val.toUpperCase() === "V") val = "V";
    if (val.toUpperCase() === "N/A" || val.toUpperCase() === "NA") val = "N/A";

    // Optimistic local state update
    setEvalData(prev => {
      const currentDoc = prev[docId] || {
        year: selectedYear,
        quarter: selectedQuarter,
        evaluator: section.evaluator,
        team: section.team,
        csr_name: csrName,
        scores: {}
      };
      const updatedScores = {
        ...(currentDoc.scores || {}),
        [key]: val
      };
      return {
        ...prev,
        [docId]: {
          ...currentDoc,
          scores: updatedScores,
          updated_at: new Date().toISOString()
        }
      };
    });

    // Debounce save to Firestore
    setSaveStatus("saving");
    if (saveTimeoutRef.current[docId]) {
      clearTimeout(saveTimeoutRef.current[docId]);
    }

    saveTimeoutRef.current[docId] = setTimeout(async () => {
      try {
        await setDoc(doc(db, "quality_evaluations", docId), {
          year: selectedYear,
          quarter: selectedQuarter,
          evaluator: section.evaluator,
          team: section.team,
          csr_name: csrName,
          scores: {
            ...((evalData[docId]?.scores) || {}),
            [key]: val
          },
          updated_at: new Date().toISOString()
        }, { merge: true });
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 1500);
      } catch (e) {
        console.error("Error saving score:", e);
        setSaveStatus("idle");
      }
    }, 450);
  }, [selectedYear, selectedQuarter, evalData]);

  // Compute CSRs list for each evaluator section
  const sectionCSRs = useMemo(() => {
    const result: Record<string, string[]> = {};

    DEFAULT_SECTIONS.forEach(sec => {
      // 1. CSRs already present in evalData for this section
      const existingInEval = Object.values(evalData)
        .filter(d => d.evaluator === sec.evaluator || d.team === sec.team)
        .map(d => d.csr_name);

      // 2. CSRs from roster belonging to this team
      const rosterForTeam = rosterMembers
        .filter(m => m.team === sec.team)
        .map(m => m.agent_name || m.name);

      // Merge and deduplicate, keeping order
      const combined = Array.from(new Set([...existingInEval, ...rosterForTeam])).filter(Boolean);
      result[sec.id] = combined;
    });

    return result;
  }, [evalData, rosterMembers]);

  // 12 Weeks list for the selected quarter
  const weeksList = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => i + 1);
  }, []);

  // Compute overall statistics for the quarter
  const overallStats = useMemo(() => {
    let totalAudits = 0;
    let totalScoreSum = 0;
    let totalScoreCount = 0;
    const csrAverages: { name: string; avg: number; team: string }[] = [];

    Object.values(evalData).forEach((item: any) => {
      const scores = item.scores || {};
      const validNumbers: number[] = [];
      Object.entries(scores).forEach(([k, v]) => {
        const valStr = String(v).trim().toUpperCase();
        if (valStr && valStr !== "V" && valStr !== "N/A") {
          const n = parseFloat(valStr);
          if (!isNaN(n)) {
            validNumbers.push(n);
            totalAudits++;
            totalScoreSum += n;
            totalScoreCount++;
          }
        }
      });
      if (validNumbers.length > 0) {
        const avg = validNumbers.reduce((a, b) => a + b, 0) / validNumbers.length;
        csrAverages.push({ name: item.csr_name, avg, team: item.team });
      }
    });

    const quarterAvg = totalScoreCount > 0 ? (totalScoreSum / totalScoreCount).toFixed(2) : "-";
    csrAverages.sort((a, b) => b.avg - a.avg);
    const topCsr = csrAverages[0] ? `${csrAverages[0].name} (${csrAverages[0].avg.toFixed(1)}%)` : "—";

    return {
      quarterAvg,
      totalAudits,
      topCsr,
      totalCsrs: Object.keys(evalData).length
    };
  }, [evalData]);

  // Filter sections based on activeSectionId
  const displayedSections = useMemo(() => {
    if (activeSectionId === "all") return DEFAULT_SECTIONS;
    return DEFAULT_SECTIONS.filter(s => s.id === activeSectionId);
  }, [activeSectionId]);

  return (
    <div className="min-h-screen p-3.5 sm:p-6 md:p-10 font-sans transition-colors bg-[#F9F8F4] dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <div className="max-w-[1700px] mx-auto space-y-6">

        {/* Top Header & Brand Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 sm:pb-6 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-3.5">
            <button
              onClick={onBack}
              className="p-2 sm:p-2.5 rounded-xl bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 shadow-xs transition text-gray-600 dark:text-gray-300 hover:text-[#1C6B53] dark:hover:text-emerald-400 active:scale-95 cursor-pointer"
              title="Return to Main Dashboard"
            >
              <ArrowLeft size={18} />
            </button>

            <img src="/logo.webp" alt="FIB Logo" className="h-10 sm:h-12 w-auto object-contain" />
            <div className="h-8 sm:h-10 w-[1.5px] bg-gray-200 dark:bg-gray-700" />
            
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-gray-900 dark:text-white leading-none">
                  Quality Assurance Scorecards
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60 shadow-xs">
                  Admin Exclusive
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">
                12-Week Quality Evaluation Matrix & Performance Tracking
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end flex-wrap">
            {/* Save Status Indicator */}
            {saveStatus !== "idle" && (
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-xs ${
                saveStatus === "saving" 
                  ? "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                  : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
              }`}>
                {saveStatus === "saving" ? (
                  <>
                    <RefreshCw size={12} className="animate-spin text-amber-600" />
                    <span>Saving changes...</span>
                  </>
                ) : (
                  <>
                    <CheckCheck size={13} className="text-emerald-600" />
                    <span>Saved to Cloud</span>
                  </>
                )}
              </div>
            )}

            {/* Dark Mode Toggle */}
            {toggleDarkMode && (
              <button 
                onClick={toggleDarkMode} 
                className="w-9 h-9 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-300 transition shadow-xs"
                title="Toggle Dark Mode"
              >
                {isDarkMode ? <Sun size={16} className="text-amber-400" /> : <Moon size={16} />}
              </button>
            )}

            <button
              onClick={onBack}
              className="px-3.5 py-1.5 bg-[#1C6B53] hover:bg-[#155a45] text-white text-xs font-bold rounded-xl shadow-md shadow-[#1C6B53]/20 transition flex items-center gap-1.5 active:scale-95 cursor-pointer"
            >
              <ArrowLeft size={14} />
              <span>Back to Dashboard</span>
            </button>
          </div>
        </div>

        {/* Executive KPI Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-gradient-to-br from-[#1C6B53] to-[#124235] rounded-2xl p-4 sm:p-5 text-white shadow-lg shadow-[#1C6B53]/15 border border-emerald-500/25 relative overflow-hidden">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-bold text-emerald-100/80 uppercase tracking-wider">Quarter QA Score</span>
              <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center text-emerald-200">
                <Award size={16} />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black tracking-tight">{overallStats.quarterAvg}%</div>
            <p className="text-[10px] sm:text-[11px] text-emerald-200/80 mt-1 font-medium">{selectedQuarter} {selectedYear} Consolidated</p>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 sm:p-5 border border-gray-200 dark:border-gray-800 shadow-xs">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Audited Calls</span>
              <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <CheckCircle2 size={16} />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tight">{overallStats.totalAudits}</div>
            <p className="text-[10px] sm:text-[11px] text-gray-500 dark:text-gray-400 mt-1 font-medium">Evaluations Logged</p>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 sm:p-5 border border-gray-200 dark:border-gray-800 shadow-xs">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Top QA Agent</span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <Sparkles size={16} />
              </div>
            </div>
            <div className="text-base sm:text-lg font-black text-gray-900 dark:text-white truncate" title={overallStats.topCsr}>
              {overallStats.topCsr}
            </div>
            <p className="text-[10px] sm:text-[11px] text-gray-500 dark:text-gray-400 mt-1 font-medium">Highest Quarterly Score</p>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 sm:p-5 border border-gray-200 dark:border-gray-800 shadow-xs">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Timeline</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-[#1C6B53] dark:text-emerald-400">
                <Calendar size={16} />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tight">12 Weeks</div>
            <p className="text-[10px] sm:text-[11px] text-gray-500 dark:text-gray-400 mt-1 font-medium">72 Inbound + 12 Outbound per Agent</p>
          </div>
        </div>

        {/* Toolbar: Year & Quarter Tabs + Section Filter + View Mode Switcher */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-3 sm:p-4 shadow-xs space-y-3">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
            
            {/* Year & Quarter Selectors */}
            <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
              <div className="relative">
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="appearance-none pl-3 pr-7 py-2 text-xs font-black rounded-xl bg-emerald-50 dark:bg-emerald-950/70 text-[#1C6B53] dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80 outline-none cursor-pointer shadow-xs"
                >
                  {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-[#1C6B53] dark:text-emerald-400" />
              </div>

              <div className="flex items-center bg-gray-100 dark:bg-gray-800 p-1 rounded-xl border border-gray-200 dark:border-gray-700">
                {QUARTERS.map(q => {
                  const isActive = selectedQuarter === q.id;
                  return (
                    <button
                      key={q.id}
                      onClick={() => setSelectedQuarter(q.id)}
                      className={`px-3 py-1.5 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${
                        isActive
                          ? "bg-[#1C6B53] text-white shadow-xs"
                          : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                      }`}
                    >
                      <span>{q.label}</span>
                      <span className="hidden sm:inline text-[10px] opacity-75 ml-1 font-normal">({q.subtitle})</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* View Mode Switcher (Full Grid vs Single Week) */}
            <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
              <div className="flex items-center bg-gray-100 dark:bg-gray-800 p-1 rounded-xl border border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setViewMode("all_weeks")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                    viewMode === "all_weeks"
                      ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-xs"
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-900"
                  }`}
                  title="Full 12-Week Excel Grid"
                >
                  <Grid size={13} />
                  <span>Full Quarter Grid</span>
                </button>
                <button
                  onClick={() => setViewMode("single_week")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                    viewMode === "single_week"
                      ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-xs"
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-900"
                  }`}
                  title="Focus on a single week"
                >
                  <Columns size={13} />
                  <span>Focus Week</span>
                </button>
              </div>

              {/* Search input */}
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Filter agents..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-7 pr-3 py-1.5 text-xs rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white outline-none focus:border-[#1C6B53] w-32 sm:w-44 font-medium"
                />
              </div>
            </div>

          </div>

          {/* Section Selector / Evaluator Filter Pills */}
          <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-800 overflow-x-auto pb-1">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider shrink-0 mr-1">Evaluators:</span>
            <button
              onClick={() => setActiveSectionId("all")}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer ${
                activeSectionId === "all"
                  ? "bg-[#1C6B53] text-white shadow-xs"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200"
              }`}
            >
              All Sections
            </button>
            {DEFAULT_SECTIONS.map(sec => {
              const isActive = activeSectionId === sec.id;
              return (
                <button
                  key={sec.id}
                  onClick={() => setActiveSectionId(sec.id)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition shrink-0 border cursor-pointer ${
                    isActive
                      ? sec.colorBadge + " shadow-xs font-black ring-2 ring-emerald-500/30"
                      : "bg-gray-50 dark:bg-gray-800/80 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100"
                  }`}
                >
                  {sec.evaluator} ({sec.team.replace(" Team", "")})
                </button>
              );
            })}

            {/* If single week mode, show week selector pills */}
            {viewMode === "single_week" && (
              <div className="flex items-center gap-1 ml-auto shrink-0 pl-2 border-l border-gray-200 dark:border-gray-700">
                <span className="text-[11px] font-bold text-gray-400 mr-1">Week:</span>
                {weeksList.map(w => (
                  <button
                    key={w}
                    onClick={() => setFocusedWeek(w)}
                    className={`w-7 h-7 rounded-lg text-xs font-black transition cursor-pointer flex items-center justify-center ${
                      focusedWeek === w
                        ? "bg-[#1C6B53] text-white shadow-xs"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200"
                    }`}
                  >
                    {w}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Evaluator Tables */}
        {displayedSections.map(section => {
          const rawCsrs = sectionCSRs[section.id] || [];
          const csrs = rawCsrs.filter(name => 
            name.toLowerCase().includes(searchTerm.toLowerCase())
          );

          return (
            <div 
              key={section.id} 
              className={`bg-white dark:bg-gray-900 rounded-2xl border ${section.borderColor} shadow-sm overflow-hidden`}
            >
              {/* Evaluator Section Header */}
              <div className={`p-4 bg-gradient-to-r ${section.headerBg} border-b ${section.borderColor} flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2`}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-white dark:bg-gray-800 shadow-xs border border-gray-200/80 dark:border-gray-700 flex items-center justify-center font-black text-base" style={{ color: section.accentColor }}>
                    {section.evaluator.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base sm:text-lg font-black text-gray-900 dark:text-white tracking-tight">
                        {section.evaluator}
                      </h2>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg border uppercase ${section.colorBadge}`}>
                        {section.team}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">
                      {csrs.length} Active CSRs • 12-Week QA Evaluations
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400 self-end sm:self-auto">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Auto-calculating Week Average (Exempts 'V' & 'N/A')</span>
                </div>
              </div>

              {/* Data Table */}
              <div 
                className="overflow-x-auto scrollbar-hide overscroll-x-contain touch-pan-x"
                style={{ WebkitOverflowScrolling: "touch" }}
              >
                {viewMode === "all_weeks" ? (
                  /* ============================================================
                     FULL QUARTER GRID: ALL 12 WEEKS HORIZONTALLY (EXCEL STYLE)
                     ============================================================ */
                  <table className="w-full text-xs text-left border-collapse border-spacing-0">
                    <thead>
                      {/* Top Super Header: Week groupings */}
                      <tr className="bg-gray-100/90 dark:bg-gray-800/90 border-b border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300">
                        <th className="sticky left-0 bg-gray-100 dark:bg-gray-800 z-30 px-4 py-2 font-black text-xs min-w-[170px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] border-r border-gray-200 dark:border-gray-700">
                          CSR Name
                        </th>
                        {weeksList.map(w => (
                          <th 
                            key={w} 
                            colSpan={8} 
                            className="px-2 py-2 text-center font-black text-[11px] uppercase tracking-wider border-r border-gray-300 dark:border-gray-700 bg-emerald-50/60 dark:bg-emerald-950/30 text-[#1C6B53] dark:text-emerald-400"
                          >
                            Week {w} (Calls {(w - 1) * 6 + 1}–{(w - 1) * 6 + 6} + Outbound)
                          </th>
                        ))}
                      </tr>

                      {/* Sub-Header: Call 1-6, Outbound, Week Avg */}
                      <tr className="bg-gray-50 dark:bg-gray-850 border-b border-gray-200 dark:border-gray-700 text-[10px] font-bold text-gray-500 dark:text-gray-400">
                        <th className="sticky left-0 bg-gray-50 dark:bg-gray-850 z-30 px-4 py-2 border-r border-gray-200 dark:border-gray-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                          Agent
                        </th>
                        {weeksList.map(w => {
                          const callBase = (w - 1) * 6;
                          return (
                            <React.Fragment key={w}>
                              <th className="px-1 py-1.5 text-center min-w-[50px]">Call {callBase + 1}</th>
                              <th className="px-1 py-1.5 text-center min-w-[50px]">Call {callBase + 2}</th>
                              <th className="px-1 py-1.5 text-center min-w-[50px]">Call {callBase + 3}</th>
                              <th className="px-1 py-1.5 text-center min-w-[50px]">Call {callBase + 4}</th>
                              <th className="px-1 py-1.5 text-center min-w-[50px]">Call {callBase + 5}</th>
                              <th className="px-1 py-1.5 text-center min-w-[50px]">Call {callBase + 6}</th>
                              <th className="px-1 py-1.5 text-center min-w-[58px] bg-amber-50/60 dark:bg-amber-950/30 text-amber-800 dark:text-amber-400">Outbound</th>
                              <th className="px-1 py-1.5 text-center min-w-[65px] bg-[#1C6B53]/15 dark:bg-[#1C6B53]/30 text-[#1C6B53] dark:text-emerald-300 font-black border-r border-gray-300 dark:border-gray-700">
                                Week {w}
                              </th>
                            </React.Fragment>
                          );
                        })}
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {csrs.map(csrName => {
                        const slug = csrName.toLowerCase().replace(/[^a-z0-9]/g, "_");
                        const sectionSlug = section.evaluator.toLowerCase().replace(/[^a-z0-9]/g, "_");
                        const docId = `${selectedYear}_${selectedQuarter}_${sectionSlug}_${slug}`;
                        const currentScores = evalData[docId]?.scores || {};

                        return (
                          <tr 
                            key={csrName}
                            className="hover:bg-emerald-50/30 dark:hover:bg-gray-800/50 transition-colors group"
                          >
                            {/* Sticky CSR Name Column */}
                            <td className="sticky left-0 bg-white dark:bg-gray-900 group-hover:bg-[#f6fbf9] dark:group-hover:bg-gray-850 z-20 px-4 py-2 font-bold text-gray-900 dark:text-gray-100 border-r border-gray-200 dark:border-gray-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] truncate max-w-[190px]">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 flex items-center justify-center text-[10px] font-black shrink-0 border border-gray-200 dark:border-gray-700">
                                  {csrName.charAt(0)}
                                </div>
                                <span className="truncate">{csrName}</span>
                              </div>
                            </td>

                            {/* 12 Weeks evaluation inputs */}
                            {weeksList.map(w => {
                              const callBase = (w - 1) * 6;
                              const weekAvg = computeWeekAvg(currentScores, w);

                              return (
                                <React.Fragment key={w}>
                                  {[1, 2, 3, 4, 5, 6].map(cNum => {
                                    const key = `w${w}_call_${callBase + cNum}`;
                                    const val = currentScores[key] || "";
                                    const isV = val.toUpperCase() === "V";
                                    return (
                                      <td key={key} className="p-0.5 text-center">
                                        <input
                                          type="text"
                                          value={val}
                                          onChange={(e) => handleScoreChange(section, csrName, key, e.target.value)}
                                          placeholder="-"
                                          className={`w-11 h-7 text-center rounded-md font-bold text-xs outline-none transition ${
                                            isV 
                                              ? "bg-amber-100/70 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700" 
                                              : "bg-transparent hover:bg-gray-50 dark:hover:bg-gray-800 focus:bg-white dark:focus:bg-gray-800 border border-transparent focus:border-[#1C6B53] dark:focus:border-emerald-500"
                                          }`}
                                        />
                                      </td>
                                    );
                                  })}

                                  {/* Outbound */}
                                  <td className="p-0.5 text-center bg-amber-50/20 dark:bg-amber-950/10">
                                    <input
                                      type="text"
                                      value={currentScores[`w${w}_outbound`] || ""}
                                      onChange={(e) => handleScoreChange(section, csrName, `w${w}_outbound`, e.target.value)}
                                      placeholder="-"
                                      className={`w-11 h-7 text-center rounded-md font-bold text-xs outline-none transition ${
                                        (currentScores[`w${w}_outbound`] || "").toUpperCase() === "V" 
                                          ? "bg-amber-100/70 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700"
                                          : (currentScores[`w${w}_outbound`] || "").toUpperCase().includes("N/A")
                                          ? "bg-gray-200/60 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                                          : "bg-transparent hover:bg-gray-50 dark:hover:bg-gray-800 focus:bg-white dark:focus:bg-gray-800 border border-transparent focus:border-[#1C6B53] dark:focus:border-emerald-500"
                                      }`}
                                    />
                                  </td>

                                  {/* Calculated Week Average */}
                                  <td className="px-2 py-1 text-center font-black border-r border-gray-300 dark:border-gray-700 bg-emerald-50/40 dark:bg-emerald-950/20">
                                    <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-black ${
                                      weekAvg === "V"
                                        ? "bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300"
                                        : weekAvg !== "-"
                                        ? "text-[#1C6B53] dark:text-emerald-300"
                                        : "text-gray-300 dark:text-gray-600"
                                    }`}>
                                      {weekAvg}
                                    </span>
                                  </td>
                                </React.Fragment>
                              );
                            })}
                          </tr>
                        );
                      })}

                      {/* Bottom Evaluator Average Row (Excel-matched) */}
                      <tr className="bg-emerald-50/80 dark:bg-emerald-950/50 border-t-2 border-emerald-500/30 font-black text-xs">
                        <td className="sticky left-0 bg-emerald-50 dark:bg-emerald-950 z-20 px-4 py-3 font-black text-[#1C6B53] dark:text-emerald-300 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] border-r border-emerald-500/20">
                          Average
                        </td>
                        {weeksList.map(w => {
                          // Compute team average for this week
                          const weekAverages: number[] = [];
                          csrs.forEach(csrName => {
                            const slug = csrName.toLowerCase().replace(/[^a-z0-9]/g, "_");
                            const sectionSlug = section.evaluator.toLowerCase().replace(/[^a-z0-9]/g, "_");
                            const docId = `${selectedYear}_${selectedQuarter}_${sectionSlug}_${slug}`;
                            const scores = evalData[docId]?.scores || {};
                            const avgStr = computeWeekAvg(scores, w);
                            if (avgStr !== "-" && avgStr !== "V") {
                              const n = parseFloat(avgStr);
                              if (!isNaN(n)) weekAverages.push(n);
                            }
                          });

                          const teamWeekAvg = weekAverages.length > 0
                            ? (weekAverages.reduce((a, b) => a + b, 0) / weekAverages.length).toFixed(1)
                            : "-";

                          return (
                            <React.Fragment key={w}>
                              <td colSpan={7} className="px-1 py-2 text-right text-[10px] font-bold text-gray-500 dark:text-gray-400">
                                Week {w} Team Avg:
                              </td>
                              <td className="px-2 py-2 text-center font-black text-[#1C6B53] dark:text-emerald-300 border-r border-gray-300 dark:border-gray-700 bg-emerald-200/50 dark:bg-emerald-900/40">
                                {teamWeekAvg !== "-" ? `${teamWeekAvg}%` : "-"}
                              </td>
                            </React.Fragment>
                          );
                        })}
                      </tr>
                    </tbody>
                  </table>
                ) : (
                  /* ============================================================
                     SINGLE WEEK FOCUS MODE: ZOOMED-IN VIEW OF FOCUSED WEEK
                     ============================================================ */
                  <table className="w-full text-xs text-left border-collapse border-spacing-0">
                    <thead>
                      <tr className="bg-gray-100/90 dark:bg-gray-800/90 border-b border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300">
                        <th className="sticky left-0 bg-gray-100 dark:bg-gray-800 z-30 px-4 py-3 font-black text-sm min-w-[200px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                          CSR Name
                        </th>
                        <th className="px-3 py-3 text-center font-black min-w-[80px]">Call {(focusedWeek - 1) * 6 + 1}</th>
                        <th className="px-3 py-3 text-center font-black min-w-[80px]">Call {(focusedWeek - 1) * 6 + 2}</th>
                        <th className="px-3 py-3 text-center font-black min-w-[80px]">Call {(focusedWeek - 1) * 6 + 3}</th>
                        <th className="px-3 py-3 text-center font-black min-w-[80px]">Call {(focusedWeek - 1) * 6 + 4}</th>
                        <th className="px-3 py-3 text-center font-black min-w-[80px]">Call {(focusedWeek - 1) * 6 + 5}</th>
                        <th className="px-3 py-3 text-center font-black min-w-[80px]">Call {(focusedWeek - 1) * 6 + 6}</th>
                        <th className="px-3 py-3 text-center font-black min-w-[90px] bg-amber-50/60 dark:bg-amber-950/30 text-amber-800 dark:text-amber-400">Outbound</th>
                        <th className="px-4 py-3 text-center font-black min-w-[100px] bg-[#1C6B53] text-white">
                          Week {focusedWeek} Score
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {csrs.map(csrName => {
                        const slug = csrName.toLowerCase().replace(/[^a-z0-9]/g, "_");
                        const sectionSlug = section.evaluator.toLowerCase().replace(/[^a-z0-9]/g, "_");
                        const docId = `${selectedYear}_${selectedQuarter}_${sectionSlug}_${slug}`;
                        const currentScores = evalData[docId]?.scores || {};
                        const callBase = (focusedWeek - 1) * 6;
                        const weekAvg = computeWeekAvg(currentScores, focusedWeek);

                        return (
                          <tr key={csrName} className="hover:bg-emerald-50/30 dark:hover:bg-gray-800/50 transition">
                            <td className="sticky left-0 bg-white dark:bg-gray-900 z-20 px-4 py-3 font-bold text-sm text-gray-900 dark:text-gray-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#1C6B53]/20 to-emerald-100 dark:from-[#1C6B53]/40 dark:to-emerald-950 text-[#1C6B53] dark:text-emerald-300 flex items-center justify-center font-black text-xs shrink-0">
                                  {csrName.charAt(0)}
                                </div>
                                <span>{csrName}</span>
                              </div>
                            </td>

                            {[1, 2, 3, 4, 5, 6].map(cNum => {
                              const key = `w${focusedWeek}_call_${callBase + cNum}`;
                              const val = currentScores[key] || "";
                              const isV = val.toUpperCase() === "V";

                              return (
                                <td key={key} className="p-2 text-center">
                                  <input
                                    type="text"
                                    value={val}
                                    onChange={(e) => handleScoreChange(section, csrName, key, e.target.value)}
                                    placeholder="Score"
                                    className={`w-16 py-1.5 text-center rounded-xl font-black text-sm outline-none transition ${
                                      isV 
                                        ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300"
                                        : "bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:border-[#1C6B53] dark:focus:border-emerald-500"
                                    }`}
                                  />
                                </td>
                              );
                            })}

                            {/* Outbound in focus mode */}
                            <td className="p-2 text-center bg-amber-50/20 dark:bg-amber-950/10">
                              <input
                                type="text"
                                value={currentScores[`w${focusedWeek}_outbound`] || ""}
                                onChange={(e) => handleScoreChange(section, csrName, `w${focusedWeek}_outbound`, e.target.value)}
                                placeholder="Outbound"
                                className="w-16 py-1.5 text-center rounded-xl font-black text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:border-[#1C6B53] outline-none"
                              />
                            </td>

                            {/* Week score in focus mode */}
                            <td className="p-2 text-center font-black text-base bg-emerald-50 dark:bg-emerald-950/40 text-[#1C6B53] dark:text-emerald-300">
                              {weekAvg !== "-" ? `${weekAvg}%` : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

            </div>
          );
        })}

      </div>
    </div>
  );
}
