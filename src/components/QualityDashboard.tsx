"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { db } from "@/lib/firebaseClient";
import { collection, query, where, getDocs, doc, setDoc, onSnapshot } from "firebase/firestore";
import { 
  Award, CheckCircle2, Calendar, TrendingUp, ArrowLeft, Search, Plus, 
  Trash2, Users, Check, Copy, Sparkles, ShieldCheck, Save, Download, 
  Sun, Moon, Filter, Layers, Eye, Grid, Columns, ChevronDown, CheckCheck, RefreshCw, LogOut, Activity, PhoneIncoming, PhoneOutgoing
} from "lucide-react";

interface QualityDashboardProps {
  userProfile: any;
  onBack: () => void;
  onLogout?: () => void;
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
    id: "mohammed_jihad",
    evaluator: "Mohammed Jihad",
    team: "Younis Kamal Team",
    colorBadge: "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 border-sky-200 dark:border-sky-800/60",
    headerBg: "from-sky-900/10 via-sky-800/5 to-transparent",
    borderColor: "border-sky-200/80 dark:border-sky-800/40",
    accentColor: "#0284c7"
  },
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
  onLogout,
  isDarkMode = false,
  toggleDarkMode
}: QualityDashboardProps) {
  const isQaUser = userProfile?.role === "qa";
  const isAdmin = userProfile?.role === "admin" || userProfile?.email?.toLowerCase() === "mohammed.dlshad0@gmail.com";

  const [selectedYear, setSelectedYear] = useState("2026");
  const [selectedQuarter, setSelectedQuarter] = useState("Q1");
  
  // Automatically identify the assigned section based on user role & name
  const defaultSectionId = useMemo(() => {
    if (isQaUser) {
      const email = (userProfile?.email || "").toLowerCase();
      const name = (userProfile?.name || userProfile?.evaluator || "").toLowerCase();
      if (email.includes("jihad") || name.includes("jihad") || name.includes("mohammed")) {
        return "mohammed_jihad";
      }
      if (email.includes("lara") || name.includes("lara")) {
        return "lara_kamil";
      }
    }
    return "mohammed_jihad";
  }, [isQaUser, userProfile]);

  const [activeSectionId, setActiveSectionId] = useState<string>(defaultSectionId);
  const [viewMode, setViewMode] = useState<"week_view" | "full_grid">("week_view");
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "idle">("idle");
  const [copyToast, setCopyToast] = useState<string | null>(null);

  // Raw data from Firestore
  const [evalData, setEvalData] = useState<Record<string, any>>({});
  const [rosterMembers, setRosterMembers] = useState<any[]>([]);

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

    let val = rawVal.trim();
    if (val.toUpperCase() === "V") val = "V";
    if (val.toUpperCase() === "N/A" || val.toUpperCase() === "NA") val = "N/A";

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

  // CSRs list for each evaluator section
  const sectionCSRs = useMemo(() => {
    const result: Record<string, string[]> = {};

    DEFAULT_SECTIONS.forEach(sec => {
      const existingInEval = Object.values(evalData)
        .filter(d => d.evaluator === sec.evaluator || d.team === sec.team)
        .map(d => d.csr_name);

      const rosterForTeam = rosterMembers
        .filter(m => m.team === sec.team)
        .map(m => m.agent_name || m.name);

      const combined = Array.from(new Set([...existingInEval, ...rosterForTeam])).filter(Boolean);
      result[sec.id] = combined;
    });

    return result;
  }, [evalData, rosterMembers]);

  // Active section object
  const currentSection = useMemo(() => {
    return DEFAULT_SECTIONS.find(s => s.id === activeSectionId) || DEFAULT_SECTIONS[0];
  }, [activeSectionId]);

  // CSRs for current section, filtered by search
  const currentCsrs = useMemo(() => {
    const list = sectionCSRs[currentSection.id] || [];
    if (!searchTerm.trim()) return list;
    return list.filter(name => name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [sectionCSRs, currentSection, searchTerm]);

  // 12 Weeks list
  const weeksList = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => i + 1);
  }, []);

  // Compute team annual and quarterly statistics for the green summary card at top
  const teamQualityStats = useMemo(() => {
    let totalCallsAudited = 0;
    let sumScores = 0;
    let inboundCount = 0;
    let outboundSum = 0;
    let outboundCount = 0;
    let passCount = 0;
    const weeksWithData = new Set<number>();
    const csrTotals: Record<string, { sum: number; count: number }> = {};

    currentCsrs.forEach(csrName => {
      const slug = csrName.toLowerCase().replace(/[^a-z0-9]/g, "_");
      const sectionSlug = currentSection.evaluator.toLowerCase().replace(/[^a-z0-9]/g, "_");
      const docId = `${selectedYear}_${selectedQuarter}_${sectionSlug}_${slug}`;
      const scores = evalData[docId]?.scores || {};

      Object.entries(scores).forEach(([k, v]) => {
        const valStr = String(v).trim().toUpperCase();
        if (valStr && valStr !== "V" && valStr !== "N/A") {
          const num = parseFloat(valStr);
          if (!isNaN(num)) {
            totalCallsAudited++;
            sumScores += num;
            if (num >= 90) passCount++;

            if (!csrTotals[csrName]) csrTotals[csrName] = { sum: 0, count: 0 };
            csrTotals[csrName].sum += num;
            csrTotals[csrName].count += 1;

            if (k.includes("outbound")) {
              outboundSum += num;
              outboundCount++;
            } else {
              inboundCount++;
            }

            const match = k.match(/^w(\d+)_/);
            if (match) weeksWithData.add(parseInt(match[1]));
          }
        }
      });
    });

    const annualAvg = totalCallsAudited > 0 ? (sumScores / totalCallsAudited).toFixed(1) : "-";
    const outboundAvg = outboundCount > 0 ? (outboundSum / outboundCount).toFixed(1) : "-";
    const passRate = totalCallsAudited > 0 ? Math.round((passCount / totalCallsAudited) * 100) : 0;

    let topAgent = "—";
    let topScore = -1;
    Object.entries(csrTotals).forEach(([name, stat]) => {
      if (stat.count > 0) {
        const avg = stat.sum / stat.count;
        if (avg > topScore) {
          topScore = avg;
          topAgent = `${name} (${avg.toFixed(1)}%)`;
        }
      }
    });

    return {
      annualAvg,
      totalCallsAudited,
      weeksCount: weeksWithData.size,
      outboundAvg,
      inboundCount,
      passRate,
      topAgent,
      totalAgents: currentCsrs.length
    };
  }, [currentCsrs, currentSection, selectedYear, selectedQuarter, evalData]);

  // Base call numbering for the selected week:
  // Week 1 -> Calls 1-6; Week 2 -> Calls 7-12; ... Week 12 -> Calls 67-72
  const callBase = (selectedWeek - 1) * 6;

  return (
    <div className="min-h-screen p-3.5 sm:p-6 md:p-10 font-sans transition-colors bg-[#F9F8F4] dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <div className="max-w-[1700px] mx-auto space-y-6">

        {/* Top Header & Brand Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 sm:pb-6 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-3.5">
            {isAdmin && (
              <button
                onClick={onBack}
                className="p-2 sm:p-2.5 rounded-xl bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 shadow-xs transition text-gray-600 dark:text-gray-300 hover:text-[#1C6B53] dark:hover:text-emerald-400 active:scale-95 cursor-pointer"
                title="Return to Main Dashboard"
              >
                <ArrowLeft size={18} />
              </button>
            )}

            <img src="/logo.webp" alt="FIB Logo" className="h-10 sm:h-12 w-auto object-contain" />
            <div className="h-8 sm:h-10 w-[1.5px] bg-gray-200 dark:bg-gray-700" />
            
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-gray-900 dark:text-white leading-none">
                  Quality Assurance Dashboard
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/70 text-[#1C6B53] dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/60 shadow-xs">
                  {isQaUser ? `Quality Evaluator • ${userProfile?.name || "QA"}` : "Admin Quality Portal"}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">
                {currentSection.team} Performance & Weekly Call Evaluations
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end flex-wrap">
            {/* Real-time Save Status */}
            {saveStatus !== "idle" && (
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-xs ${
                saveStatus === "saving" 
                  ? "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                  : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
              }`}>
                {saveStatus === "saving" ? (
                  <>
                    <RefreshCw size={12} className="animate-spin text-amber-600" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <CheckCheck size={13} className="text-emerald-600" />
                    <span>Saved</span>
                  </>
                )}
              </div>
            )}

            {/* Dark Mode Toggle */}
            {toggleDarkMode && (
              <button 
                onClick={toggleDarkMode} 
                className="w-9 h-9 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-300 transition shadow-xs cursor-pointer"
                title="Toggle Dark Mode"
              >
                {isDarkMode ? <Sun size={16} className="text-amber-400" /> : <Moon size={16} />}
              </button>
            )}

            {/* Logout Button */}
            <button
              onClick={onLogout || onBack}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-gray-600 hover:text-red-600 dark:text-gray-300 dark:hover:text-red-400 bg-white hover:bg-red-50 dark:bg-gray-800 dark:hover:bg-red-950/40 border border-gray-200 dark:border-gray-700 transition shadow-xs cursor-pointer"
              title="Sign Out"
            >
              <LogOut size={14} />
              <span>Logout</span>
            </button>

            {isAdmin && (
              <button
                onClick={onBack}
                className="px-3.5 py-2 bg-[#1C6B53] hover:bg-[#155a45] text-white text-xs font-bold rounded-xl shadow-md shadow-[#1C6B53]/20 transition flex items-center gap-1.5 active:scale-95 cursor-pointer"
              >
                <ArrowLeft size={14} />
                <span>Back to TL Dashboard</span>
              </button>
            )}
          </div>
        </div>

        {/* Top Annual Team Performance Card ("و فوك يظهر الداتا السنوي للتيم") */}
        <div className="bg-gradient-to-br from-[#1C6B53] via-[#165a46] to-[#104334] text-white rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-xl shadow-[#1C6B53]/15 border border-emerald-500/30 relative overflow-hidden">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-5 pb-4 border-b border-white/10">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner shrink-0">
                <Award size={24} className="text-emerald-200" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-200">
                    Team Quality Performance
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/15 text-white font-bold">
                    {currentSection.evaluator}
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white mt-0.5">
                  {currentSection.team}
                </h2>
                <p className="text-xs text-emerald-100/80 font-medium">
                  {selectedYear} {selectedQuarter} Consolidated Quality Performance Summary • {teamQualityStats.totalAgents} Active CSRs
                </p>
              </div>
            </div>

            {/* Admin Team Switcher (If Admin, can switch between all 3 teams) */}
            {isAdmin && (
              <div className="flex items-center gap-1.5 p-1 bg-white/10 backdrop-blur-md rounded-xl border border-white/15">
                {DEFAULT_SECTIONS.map(sec => (
                  <button
                    key={sec.id}
                    onClick={() => setActiveSectionId(sec.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      activeSectionId === sec.id
                        ? "bg-white text-[#1C6B53] shadow-xs font-black"
                        : "text-white/80 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    {sec.evaluator.replace(" Team QA", "")}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 8 Metric KPI Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 sm:gap-3">
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10 flex flex-col justify-between">
              <div className="text-[10px] font-bold text-emerald-100/80 uppercase tracking-wider">Quality %</div>
              <div className="text-2xl font-black text-white tracking-tight my-1">
                {teamQualityStats.annualAvg !== "-" ? `${teamQualityStats.annualAvg}%` : "-"}
              </div>
              <div className="text-[9px] text-emerald-300 font-medium">Consolidated</div>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10 flex flex-col justify-between">
              <div className="text-[10px] font-bold text-emerald-100/80 uppercase tracking-wider">Audited Calls</div>
              <div className="text-2xl font-black text-white tracking-tight my-1">
                {teamQualityStats.totalCallsAudited}
              </div>
              <div className="text-[9px] text-emerald-300 font-medium">Evaluations</div>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10 flex flex-col justify-between">
              <div className="text-[10px] font-bold text-emerald-100/80 uppercase tracking-wider">Active Weeks</div>
              <div className="text-2xl font-black text-white tracking-tight my-1">
                {teamQualityStats.weeksCount} / 12
              </div>
              <div className="text-[9px] text-emerald-300 font-medium">Weeks Logged</div>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10 flex flex-col justify-between">
              <div className="text-[10px] font-bold text-emerald-100/80 uppercase tracking-wider">Pass Rate</div>
              <div className="text-2xl font-black text-white tracking-tight my-1">
                {teamQualityStats.passRate}%
              </div>
              <div className="text-[9px] text-emerald-300 font-medium">&ge; 90% Score</div>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10 flex flex-col justify-between">
              <div className="text-[10px] font-bold text-emerald-100/80 uppercase tracking-wider">Inbound Audits</div>
              <div className="text-2xl font-black text-white tracking-tight my-1">
                {teamQualityStats.inboundCount}
              </div>
              <div className="text-[9px] text-emerald-300 font-medium">6 Calls/Week</div>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10 flex flex-col justify-between">
              <div className="text-[10px] font-bold text-emerald-100/80 uppercase tracking-wider">Outbound Avg</div>
              <div className="text-2xl font-black text-white tracking-tight my-1">
                {teamQualityStats.outboundAvg !== "-" ? `${teamQualityStats.outboundAvg}%` : "-"}
              </div>
              <div className="text-[9px] text-emerald-300 font-medium">1 Call/Week</div>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10 flex flex-col justify-between col-span-2">
              <div className="text-[10px] font-bold text-emerald-100/80 uppercase tracking-wider">Top QA Agent</div>
              <div className="text-sm sm:text-base font-black text-white tracking-tight my-1 truncate" title={teamQualityStats.topAgent}>
                {teamQualityStats.topAgent}
              </div>
              <div className="text-[9px] text-emerald-300 font-medium">Highest Quarterly Score</div>
            </div>
          </div>
        </div>

        {/* Toolbar: Week & Quarter Selection Bar ("و فوك يكون شريط تحدد خسب الويك و الكوارتر") */}
        <div className="flex items-center gap-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md p-2 rounded-2xl border border-gray-200/80 dark:border-gray-700/80 w-full overflow-x-auto scrollbar-hide shadow-xs">
          
          {/* Year Dropdown */}
          <div className="relative shrink-0">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="appearance-none pl-3 pr-7 py-2 text-xs font-black rounded-xl bg-[#1C6B53] text-white shadow-xs outline-none cursor-pointer border-0"
            >
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-white/80" />
          </div>

          {/* Search Agent Input */}
          <div className="relative shrink-0">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-7 pr-2.5 py-1.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50/80 dark:bg-gray-900/60 focus:outline-none focus:border-[#1C6B53] text-xs w-28 sm:w-40 font-medium"
            />
          </div>

          <span className="text-gray-500 dark:text-gray-400 text-xs font-semibold whitespace-nowrap px-1 shrink-0">
            {currentCsrs.length} Agents
          </span>

          <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1 shrink-0" />

          {/* 12 Week Tabs: Week 1 to Week 12 (Direct, Clean, Fast) */}
          <div className="flex items-center gap-1 shrink-0">
            {weeksList.map(w => {
              const isSel = viewMode === "week_view" && selectedWeek === w;
              return (
                <button
                  key={w}
                  onClick={() => {
                    setViewMode("week_view");
                    setSelectedWeek(w);
                  }}
                  className={`px-3 py-1.5 text-xs font-black rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                    isSel
                      ? "bg-[#1C6B53] text-white shadow-md shadow-[#1C6B53]/25 scale-[1.02]"
                      : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/60"
                  }`}
                >
                  Week {w}
                </button>
              );
            })}
          </div>

          <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1 shrink-0" />

          {/* Quarter Tabs (Q1, Q2, Q3, Q4) - Styled in Green like TL dashboard */}
          <div className="flex items-center gap-1 shrink-0">
            {QUARTERS.map(q => {
              const isSel = selectedQuarter === q.id;
              return (
                <button
                  key={q.id}
                  onClick={() => setSelectedQuarter(q.id)}
                  className={`px-3 py-1.5 text-xs font-extrabold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                    isSel
                      ? "bg-[#00A991] text-white shadow-md shadow-[#00A991]/30 scale-[1.02]"
                      : "text-emerald-700 dark:text-emerald-400 bg-emerald-50/70 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/40"
                  }`}
                >
                  {q.id}
                </button>
              );
            })}
          </div>

          <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1 shrink-0" />

          {/* Toggle to view Full 12-Week Grid */}
          <button
            onClick={() => setViewMode(viewMode === "full_grid" ? "week_view" : "full_grid")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all shrink-0 cursor-pointer ${
              viewMode === "full_grid"
                ? "bg-purple-600 text-white shadow-md"
                : "text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100"
            }`}
          >
            <Grid size={13} />
            <span>Full 12-Week Grid</span>
          </button>

        </div>

        {/* Quality Data Table ("يحطون داتا الكوالتي مال موظفين حسب الويكات كل ويك 6 انباوند و 1 اوتباوند") */}
        <div 
          className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/80 dark:border-gray-800 shadow-sm overflow-hidden"
        >
          {viewMode === "week_view" ? (
            /* =========================================================================
               DEFAULT VIEW: FOCUSED ON SELECTED WEEK (6 INBOUND + 1 OUTBOUND + SCORE)
               ========================================================================= */
            <div>
              {/* Week Section Subheader */}
              <div className="px-5 py-3.5 bg-gray-50/90 dark:bg-gray-800/90 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                <div className="flex items-center gap-2.5">
                  <div className="px-2.5 py-1 rounded-xl bg-[#1C6B53] text-white text-xs font-black">
                    Week {selectedWeek}
                  </div>
                  <span className="text-xs font-bold text-gray-700 dark:text-gray-200">
                    Calls {(selectedWeek - 1) * 6 + 1} to {(selectedWeek - 1) * 6 + 6} (6 Inbound) + Outbound Evaluation
                  </span>
                </div>
                <div className="text-[11px] text-gray-400 font-medium">
                  Type <span className="font-bold text-amber-600">V</span> for Vacation • Supports numbers 0-100 & N/A
                </div>
              </div>

              <div 
                className="overflow-x-auto scrollbar-hide overscroll-x-contain touch-pan-x"
                style={{ WebkitOverflowScrolling: "touch" }}
              >
                <table className="w-full text-xs text-left border-collapse border-spacing-0">
                  <thead>
                    <tr className="bg-gray-100/95 dark:bg-gray-800/95 border-b border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 font-black text-xs">
                      <th className="sticky left-0 bg-gray-100 dark:bg-gray-800 z-20 px-5 py-3.5 min-w-[200px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)]">
                        Agent
                      </th>
                      <th className="px-3 py-3 text-center min-w-[85px]">
                        <div className="flex items-center justify-center gap-1 text-emerald-800 dark:text-emerald-300">
                          <PhoneIncoming size={12} />
                          <span>Call {callBase + 1}</span>
                        </div>
                      </th>
                      <th className="px-3 py-3 text-center min-w-[85px]">
                        <div className="flex items-center justify-center gap-1 text-emerald-800 dark:text-emerald-300">
                          <PhoneIncoming size={12} />
                          <span>Call {callBase + 2}</span>
                        </div>
                      </th>
                      <th className="px-3 py-3 text-center min-w-[85px]">
                        <div className="flex items-center justify-center gap-1 text-emerald-800 dark:text-emerald-300">
                          <PhoneIncoming size={12} />
                          <span>Call {callBase + 3}</span>
                        </div>
                      </th>
                      <th className="px-3 py-3 text-center min-w-[85px]">
                        <div className="flex items-center justify-center gap-1 text-emerald-800 dark:text-emerald-300">
                          <PhoneIncoming size={12} />
                          <span>Call {callBase + 4}</span>
                        </div>
                      </th>
                      <th className="px-3 py-3 text-center min-w-[85px]">
                        <div className="flex items-center justify-center gap-1 text-emerald-800 dark:text-emerald-300">
                          <PhoneIncoming size={12} />
                          <span>Call {callBase + 5}</span>
                        </div>
                      </th>
                      <th className="px-3 py-3 text-center min-w-[85px]">
                        <div className="flex items-center justify-center gap-1 text-emerald-800 dark:text-emerald-300">
                          <PhoneIncoming size={12} />
                          <span>Call {callBase + 6}</span>
                        </div>
                      </th>
                      <th className="px-3 py-3 text-center min-w-[95px] bg-amber-100/70 dark:bg-amber-950/50 text-amber-900 dark:text-amber-300 border-x border-amber-200 dark:border-amber-900/60">
                        <div className="flex items-center justify-center gap-1">
                          <PhoneOutgoing size={12} />
                          <span>Outbound</span>
                        </div>
                      </th>
                      <th className="px-4 py-3 text-center min-w-[110px] bg-[#1C6B53] text-white">
                        Week {selectedWeek} Score
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-[#FDFCFB] dark:bg-gray-900">
                    {currentCsrs.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="p-8 text-center text-sm text-gray-400">
                          No agents found for this team.
                        </td>
                      </tr>
                    ) : (
                      currentCsrs.map((csrName, index) => {
                        const slug = csrName.toLowerCase().replace(/[^a-z0-9]/g, "_");
                        const sectionSlug = currentSection.evaluator.toLowerCase().replace(/[^a-z0-9]/g, "_");
                        const docId = `${selectedYear}_${selectedQuarter}_${sectionSlug}_${slug}`;
                        const currentScores = evalData[docId]?.scores || {};
                        const weekAvg = computeWeekAvg(currentScores, selectedWeek);

                        return (
                          <tr 
                            key={csrName}
                            className="hover:bg-emerald-50/40 dark:hover:bg-gray-800/60 transition-colors group"
                          >
                            {/* Sticky Agent Name Column */}
                            <td className="sticky left-0 bg-[#FDFCFB] dark:bg-gray-900 group-hover:bg-[#f6fbf9] dark:group-hover:bg-gray-850 z-10 px-5 py-2.5 font-bold text-sm text-gray-900 dark:text-gray-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)]">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#1C6B53]/20 to-emerald-100 dark:from-[#1C6B53]/40 dark:to-emerald-950 text-[#1C6B53] dark:text-emerald-300 flex items-center justify-center font-black text-xs shrink-0 ring-1 ring-emerald-500/15">
                                  {csrName.charAt(0).toUpperCase()}
                                </div>
                                <span className="truncate">{csrName}</span>
                              </div>
                            </td>

                            {/* 6 Inbound Calls */}
                            {[1, 2, 3, 4, 5, 6].map(cNum => {
                              const key = `w${selectedWeek}_call_${callBase + cNum}`;
                              const val = currentScores[key] || "";
                              const isV = val.toUpperCase() === "V";

                              return (
                                <td key={key} className="p-1.5 text-center">
                                  <input
                                    type="text"
                                    value={val}
                                    onChange={(e) => handleScoreChange(currentSection, csrName, key, e.target.value)}
                                    placeholder="-"
                                    className={`w-16 h-8 text-center rounded-xl font-black text-xs outline-none transition shadow-xs ${
                                      isV 
                                        ? "bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700" 
                                        : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100 focus:border-[#1C6B53] dark:focus:border-emerald-500 focus:ring-2 focus:ring-[#1C6B53]/20"
                                    }`}
                                  />
                                </td>
                              );
                            })}

                            {/* 1 Outbound Call */}
                            <td className="p-1.5 text-center bg-amber-50/30 dark:bg-amber-950/15 border-x border-amber-100 dark:border-amber-900/40">
                              <input
                                type="text"
                                value={currentScores[`w${selectedWeek}_outbound`] || ""}
                                onChange={(e) => handleScoreChange(currentSection, csrName, `w${selectedWeek}_outbound`, e.target.value)}
                                placeholder="-"
                                className={`w-16 h-8 text-center rounded-xl font-black text-xs outline-none transition shadow-xs ${
                                  (currentScores[`w${selectedWeek}_outbound`] || "").toUpperCase() === "V"
                                    ? "bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700"
                                    : (currentScores[`w${selectedWeek}_outbound`] || "").toUpperCase().includes("N/A")
                                    ? "bg-gray-200/60 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                                    : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100 focus:border-[#1C6B53] dark:focus:border-emerald-500 focus:ring-2 focus:ring-[#1C6B53]/20"
                                }`}
                              />
                            </td>

                            {/* Auto-calculated Week Score */}
                            <td className="p-2 text-center font-black text-sm bg-emerald-50/50 dark:bg-emerald-950/30">
                              <span className={`inline-block px-2.5 py-1 rounded-xl text-xs font-black shadow-2xs ${
                                weekAvg === "V"
                                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300"
                                  : weekAvg !== "-"
                                  ? "bg-white dark:bg-gray-800 text-[#1C6B53] dark:text-emerald-300 border border-emerald-500/20"
                                  : "text-gray-300 dark:text-gray-600 font-normal"
                              }`}>
                                {weekAvg !== "-" && weekAvg !== "V" ? `${weekAvg}%` : weekAvg}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}

                    {/* Bottom Team Average Row */}
                    {currentCsrs.length > 0 && (
                      <tr className="bg-emerald-50/80 dark:bg-emerald-950/60 border-t-2 border-[#1C6B53]/30 font-black text-xs">
                        <td className="sticky left-0 bg-emerald-50 dark:bg-emerald-950 z-10 px-5 py-3.5 font-black text-[#1C6B53] dark:text-emerald-300 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)]">
                          Team Average
                        </td>

                        {[1, 2, 3, 4, 5, 6].map(cNum => {
                          const key = `w${selectedWeek}_call_${callBase + cNum}`;
                          const nums: number[] = [];
                          currentCsrs.forEach(csrName => {
                            const slug = csrName.toLowerCase().replace(/[^a-z0-9]/g, "_");
                            const sectionSlug = currentSection.evaluator.toLowerCase().replace(/[^a-z0-9]/g, "_");
                            const docId = `${selectedYear}_${selectedQuarter}_${sectionSlug}_${slug}`;
                            const val = (evalData[docId]?.scores || {})[key];
                            if (val && val.toUpperCase() !== "V" && val.toUpperCase() !== "N/A") {
                              const n = parseFloat(val);
                              if (!isNaN(n)) nums.push(n);
                            }
                          });
                          const colAvg = nums.length > 0 ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1) : "-";
                          return (
                            <td key={cNum} className="p-2 text-center font-black text-[#1C6B53] dark:text-emerald-300">
                              {colAvg !== "-" ? `${colAvg}%` : "-"}
                            </td>
                          );
                        })}

                        {/* Outbound column avg */}
                        {(() => {
                          const nums: number[] = [];
                          currentCsrs.forEach(csrName => {
                            const slug = csrName.toLowerCase().replace(/[^a-z0-9]/g, "_");
                            const sectionSlug = currentSection.evaluator.toLowerCase().replace(/[^a-z0-9]/g, "_");
                            const docId = `${selectedYear}_${selectedQuarter}_${sectionSlug}_${slug}`;
                            const val = (evalData[docId]?.scores || {})[`w${selectedWeek}_outbound`];
                            if (val && val.toUpperCase() !== "V" && val.toUpperCase() !== "N/A") {
                              const n = parseFloat(val);
                              if (!isNaN(n)) nums.push(n);
                            }
                          });
                          const outAvg = nums.length > 0 ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1) : "-";
                          return (
                            <td className="p-2 text-center font-black text-amber-800 dark:text-amber-400 bg-amber-100/40 dark:bg-amber-950/30">
                              {outAvg !== "-" ? `${outAvg}%` : "-"}
                            </td>
                          );
                        })()}

                        {/* Total week team average */}
                        {(() => {
                          const weekAverages: number[] = [];
                          currentCsrs.forEach(csrName => {
                            const slug = csrName.toLowerCase().replace(/[^a-z0-9]/g, "_");
                            const sectionSlug = currentSection.evaluator.toLowerCase().replace(/[^a-z0-9]/g, "_");
                            const docId = `${selectedYear}_${selectedQuarter}_${sectionSlug}_${slug}`;
                            const scores = evalData[docId]?.scores || {};
                            const avgStr = computeWeekAvg(scores, selectedWeek);
                            if (avgStr !== "-" && avgStr !== "V") {
                              const n = parseFloat(avgStr);
                              if (!isNaN(n)) weekAverages.push(n);
                            }
                          });
                          const totalWeekAvg = weekAverages.length > 0
                            ? (weekAverages.reduce((a, b) => a + b, 0) / weekAverages.length).toFixed(1)
                            : "-";
                          return (
                            <td className="p-2 text-center font-black text-sm bg-emerald-200/60 dark:bg-emerald-900/60 text-[#1C6B53] dark:text-emerald-300">
                              {totalWeekAvg !== "-" ? `${totalWeekAvg}%` : "-"}
                            </td>
                          );
                        })()}
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* =========================================================================
               FULL 12-WEEK GRID (ALL WEEKS HORIZONTALLY, MATCHING EXCEL SPREADSHEET)
               ========================================================================= */
            <div 
              className="overflow-x-auto scrollbar-hide overscroll-x-contain touch-pan-x"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              <table className="w-full text-xs text-left border-collapse border-spacing-0">
                <thead>
                  <tr className="bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                    <th className="sticky left-0 bg-gray-100 dark:bg-gray-800 z-20 px-4 py-2.5 font-black text-xs min-w-[180px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] border-r border-gray-200 dark:border-gray-700">
                      CSR Name
                    </th>
                    {weeksList.map(w => (
                      <th 
                        key={w} 
                        colSpan={8} 
                        className="px-2 py-2 text-center font-black text-[11px] uppercase tracking-wider border-r border-gray-300 dark:border-gray-700 bg-emerald-50 dark:bg-emerald-950/40 text-[#1C6B53] dark:text-emerald-300"
                      >
                        Week {w}
                      </th>
                    ))}
                  </tr>

                  <tr className="bg-gray-50 dark:bg-gray-850 border-b border-gray-200 dark:border-gray-700 text-[10px] font-bold text-gray-500">
                    <th className="sticky left-0 bg-gray-50 dark:bg-gray-850 z-20 px-4 py-2 border-r border-gray-200 dark:border-gray-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                      Agent
                    </th>
                    {weeksList.map(w => {
                      const base = (w - 1) * 6;
                      return (
                        <React.Fragment key={w}>
                          <th className="px-1 py-1 text-center min-w-[48px]">C{base + 1}</th>
                          <th className="px-1 py-1 text-center min-w-[48px]">C{base + 2}</th>
                          <th className="px-1 py-1 text-center min-w-[48px]">C{base + 3}</th>
                          <th className="px-1 py-1 text-center min-w-[48px]">C{base + 4}</th>
                          <th className="px-1 py-1 text-center min-w-[48px]">C{base + 5}</th>
                          <th className="px-1 py-1 text-center min-w-[48px]">C{base + 6}</th>
                          <th className="px-1 py-1 text-center min-w-[54px] bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-400">Out</th>
                          <th className="px-1 py-1 text-center min-w-[60px] bg-[#1C6B53]/15 dark:bg-[#1C6B53]/30 text-[#1C6B53] dark:text-emerald-300 font-black border-r border-gray-300 dark:border-gray-700">
                            W{w}
                          </th>
                        </React.Fragment>
                      );
                    })}
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {currentCsrs.map(csrName => {
                    const slug = csrName.toLowerCase().replace(/[^a-z0-9]/g, "_");
                    const sectionSlug = currentSection.evaluator.toLowerCase().replace(/[^a-z0-9]/g, "_");
                    const docId = `${selectedYear}_${selectedQuarter}_${sectionSlug}_${slug}`;
                    const currentScores = evalData[docId]?.scores || {};

                    return (
                      <tr key={csrName} className="hover:bg-emerald-50/30 dark:hover:bg-gray-800/50 transition">
                        <td className="sticky left-0 bg-white dark:bg-gray-900 z-10 px-4 py-2 font-bold text-xs shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] border-r border-gray-200 dark:border-gray-700 truncate max-w-[180px]">
                          {csrName}
                        </td>

                        {weeksList.map(w => {
                          const base = (w - 1) * 6;
                          const weekAvg = computeWeekAvg(currentScores, w);

                          return (
                            <React.Fragment key={w}>
                              {[1, 2, 3, 4, 5, 6].map(cNum => {
                                const key = `w${w}_call_${base + cNum}`;
                                const val = currentScores[key] || "";
                                const isV = val.toUpperCase() === "V";
                                return (
                                  <td key={key} className="p-0.5 text-center">
                                    <input
                                      type="text"
                                      value={val}
                                      onChange={(e) => handleScoreChange(currentSection, csrName, key, e.target.value)}
                                      placeholder="-"
                                      className={`w-11 h-7 text-center rounded font-bold text-xs outline-none transition ${
                                        isV 
                                          ? "bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300"
                                          : "bg-transparent hover:bg-gray-50 dark:hover:bg-gray-800 focus:bg-white dark:focus:bg-gray-800 border border-transparent focus:border-[#1C6B53]"
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
                                  onChange={(e) => handleScoreChange(currentSection, csrName, `w${w}_outbound`, e.target.value)}
                                  placeholder="-"
                                  className="w-11 h-7 text-center rounded font-bold text-xs outline-none transition bg-transparent hover:bg-gray-50 focus:bg-white border border-transparent focus:border-[#1C6B53]"
                                />
                              </td>

                              {/* Week Avg */}
                              <td className="px-1.5 py-1 text-center font-black border-r border-gray-300 dark:border-gray-700 bg-emerald-50/30 dark:bg-emerald-950/20">
                                <span className={`text-[11px] font-black ${
                                  weekAvg === "V" 
                                    ? "text-amber-600 font-bold" 
                                    : weekAvg !== "-" 
                                    ? "text-[#1C6B53] dark:text-emerald-300" 
                                    : "text-gray-300"
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
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
