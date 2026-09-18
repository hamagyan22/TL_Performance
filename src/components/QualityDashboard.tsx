"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { auth, db } from "@/lib/firebaseClient";
import { collection, query, where, getDocs, doc, setDoc, onSnapshot } from "firebase/firestore";
import { updatePassword } from "firebase/auth";
import { 
  Award, CheckCircle2, Calendar, TrendingUp, ArrowLeft, Search, Plus, 
  Trash2, Users, Check, Copy, Sparkles, ShieldCheck, Save, Download, 
  Sun, Moon, Filter, Layers, Eye, ChevronDown, CheckCheck, RefreshCw, 
  LogOut, PhoneIncoming, PhoneOutgoing, Camera, X, Lock
} from "lucide-react";

interface QualityDashboardProps {
  userProfile: any;
  onBack: () => void;
  onLogout?: () => void;
  onOpenProfile?: () => void;
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
  onOpenProfile,
  isDarkMode = false,
  toggleDarkMode
}: QualityDashboardProps) {
  const isQaUser = userProfile?.role === "qa";
  const isAdmin = userProfile?.role === "admin" || userProfile?.email?.toLowerCase() === "mohammed.dlshad0@gmail.com";
  const isManager = isAdmin || userProfile?.role === "manager" || userProfile?.email?.toLowerCase() === "jalal.burghol@agent.com";
  
  // Only Admin and Manager can view and switch other evaluators' data
  const canSwitchTeams = isAdmin || isManager;

  const [selectedYear, setSelectedYear] = useState("2026");
  const [selectedQuarter, setSelectedQuarter] = useState("Q1");
  
  // Automatically identify the assigned section based on user role & email/name
  const defaultSectionId = useMemo(() => {
    if (isQaUser) {
      const email = (userProfile?.email || "").toLowerCase();
      const name = (userProfile?.name || userProfile?.evaluator || "").toLowerCase();
      if (email.includes("lara") || name.includes("lara")) {
        return "lara_kamil";
      }
      return "mohammed_jihad";
    }
    return "mohammed_jihad";
  }, [isQaUser, userProfile]);

  const [activeSectionId, setActiveSectionId] = useState<string>(defaultSectionId);
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "idle">("idle");

  // Profile Modal State
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileName, setProfileName] = useState(userProfile?.name || "");
  const [profilePhoto, setProfilePhoto] = useState(userProfile?.photo_url || "");
  const [newProfilePassword, setNewProfilePassword] = useState("");
  const [confirmProfilePassword, setConfirmProfilePassword] = useState("");
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // Raw data from Firestore
  const [evalData, setEvalData] = useState<Record<string, any>>({});
  const [rosterMembers, setRosterMembers] = useState<any[]>([]);

  // Debounced save queue
  const saveTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});

  // Security enforcement: QA users are strictly locked to their assigned section
  const effectiveSectionId = canSwitchTeams ? activeSectionId : defaultSectionId;
  const currentSection = useMemo(() => {
    return DEFAULT_SECTIONS.find(s => s.id === effectiveSectionId) || DEFAULT_SECTIONS[0];
  }, [effectiveSectionId]);

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

  // Open profile modal
  const handleOpenProfile = () => {
    if (onOpenProfile) {
      onOpenProfile();
      return;
    }
    setProfileName(userProfile?.name || "");
    setProfilePhoto(userProfile?.photo_url || "");
    setNewProfilePassword("");
    setConfirmProfilePassword("");
    setProfileError("");
    setProfileSuccess("");
    setShowProfileModal(true);
  };

  const handleProfilePhotoUpload = (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setProfilePhoto(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async (e: any) => {
    e.preventDefault();
    setProfileError("");
    setProfileSuccess("");
    setSavingProfile(true);

    try {
      if (newProfilePassword) {
        if (newProfilePassword !== confirmProfilePassword) {
          setProfileError("Passwords do not match");
          setSavingProfile(false);
          return;
        }
        if (newProfilePassword.length < 6) {
          setProfileError("Password must be at least 6 characters");
          setSavingProfile(false);
          return;
        }
        if (auth.currentUser) {
          await updatePassword(auth.currentUser, newProfilePassword);
        }
      }

      if (auth.currentUser?.uid) {
        const payload: any = {
          name: profileName,
          photo_url: profilePhoto,
        };
        if (newProfilePassword) {
          payload.mustChangePassword = false;
          payload.passwordUpdated = true;
          payload.passwordChangedAt = new Date().toISOString();
        }
        await setDoc(doc(db, "users", auth.currentUser.uid), payload, { merge: true });
        if (userProfile) {
          userProfile.name = profileName;
          userProfile.photo_url = profilePhoto;
        }
      }

      setProfileSuccess("Profile updated successfully!");
      setTimeout(() => {
        setShowProfileModal(false);
        setProfileSuccess("");
      }, 900);
    } catch (err: any) {
      setProfileError(err.message || "Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <div className="min-h-screen p-3.5 sm:p-6 md:p-10 font-sans transition-colors bg-[#F9F8F4] dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <div className="max-w-[1700px] mx-auto space-y-6">

        {/* Top Header & Brand Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 sm:pb-6 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-3.5">
            {canSwitchTeams && (
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

            <div className="h-5 w-px bg-gray-200 dark:bg-gray-700 mx-0.5" />

            {/* Profile Button (Placed right next to Sign Out) */}
            <button 
              onClick={handleOpenProfile}
              className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-100/80 dark:hover:bg-gray-700/60 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 transition shadow-xs group cursor-pointer"
              title="Profile Settings"
            >
              <div className="w-6 sm:w-7 h-6 sm:h-7 rounded-full bg-gradient-to-tr from-[#1C6B53] to-emerald-400 flex items-center justify-center overflow-hidden ring-2 ring-[#1C6B53]/20 dark:ring-emerald-400/20 text-white font-black text-xs shadow-xs shrink-0">
                {userProfile?.photo_url ? (
                  <img src={userProfile.photo_url} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  userProfile?.name ? userProfile.name.charAt(0).toUpperCase() : <Users size={12} />
                )}
              </div>
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="max-w-[70px] sm:max-w-[120px] truncate group-hover:text-[#1C6B53] dark:group-hover:text-emerald-400 transition-colors">
                  {userProfile?.name || (isAdmin ? 'Mohammed Dlshad' : (isManager ? 'Jalal Burghol' : 'QA Evaluator'))}
                </span>
                <span className={`text-[8px] sm:text-[9px] font-black px-1.5 py-0.5 rounded-md border uppercase tracking-wider ${
                  isAdmin 
                    ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700/60' 
                    : isManager 
                    ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-700/60'
                    : 'bg-emerald-50 dark:bg-emerald-950/60 text-[#1C6B53] dark:text-emerald-400 border-emerald-300 dark:border-emerald-700/60'
                }`}>
                  {isAdmin ? 'Admin' : isManager ? 'Manager' : 'QA'}
                </span>
              </div>
            </button>

            {/* Sign Out (Logout) Button */}
            <button
              onClick={onLogout || onBack}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-gray-600 hover:text-red-600 dark:text-gray-300 dark:hover:text-red-400 bg-white hover:bg-red-50 dark:bg-gray-800 dark:hover:bg-red-950/40 border border-gray-200 dark:border-gray-700 transition shadow-xs cursor-pointer"
              title="Sign Out"
            >
              <LogOut size={14} />
              <span>Sign Out</span>
            </button>

            {canSwitchTeams && (
              <button
                onClick={onBack}
                className="px-3.5 py-1.5 bg-[#1C6B53] hover:bg-[#155a45] text-white text-xs font-bold rounded-xl shadow-md shadow-[#1C6B53]/20 transition flex items-center gap-1.5 active:scale-95 cursor-pointer ml-1"
              >
                <ArrowLeft size={14} />
                <span>Back to TL Dashboard</span>
              </button>
            )}
          </div>
        </div>

        {/* Top Annual Team Performance Card */}
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

            {/* Team/Evaluator Switcher: ONLY VISIBLE TO ADMIN & MANAGER */}
            {canSwitchTeams && (
              <div className="flex items-center gap-1.5 p-1 bg-white/10 backdrop-blur-md rounded-xl border border-white/15">
                {DEFAULT_SECTIONS.map(sec => (
                  <button
                    key={sec.id}
                    onClick={() => setActiveSectionId(sec.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      effectiveSectionId === sec.id
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

        {/* Toolbar: Week & Quarter Selection Bar (Only Focused Week View) */}
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

          {/* 12 Week Tabs: Week 1 to Week 12 */}
          <div className="flex items-center gap-1 shrink-0">
            {weeksList.map(w => {
              const isSel = selectedWeek === w;
              return (
                <button
                  key={w}
                  onClick={() => setSelectedWeek(w)}
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

          {/* Quarter Tabs (Q1, Q2, Q3, Q4) */}
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

        </div>

        {/* Quality Data Table: Focused Week View (6 Inbound + 1 Outbound + Week Score) */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/80 dark:border-gray-800 shadow-sm overflow-hidden">
          {/* Week Section Subheader */}
          <div className="px-5 py-3.5 bg-gray-50/90 dark:bg-gray-800/90 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center flex-wrap gap-2">
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
                  currentCsrs.map(csrName => {
                    const slug = csrName.toLowerCase().replace(/[^a-z0-9]/g, "_");
                    const sectionSlug = currentSection.evaluator.toLowerCase().replace(/[^a-z0-9]/g, "_");
                    const docId = `${selectedYear}_${selectedQuarter}_${sectionSlug}_${slug}`;
                    const currentScores = evalData[docId]?.scores || {};
                    const weekAvg = computeWeekAvg(currentScores, selectedWeek);

                    return (
                      <tr key={csrName} className="hover:bg-emerald-50/30 dark:hover:bg-gray-800/40 transition">
                        {/* Sticky CSR Name */}
                        <td className="sticky left-0 bg-white dark:bg-gray-900 z-10 px-5 py-3 font-bold text-xs shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)] border-r border-gray-100 dark:border-gray-800">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-[#1C6B53] dark:text-emerald-300 flex items-center justify-center font-bold text-[10px] shrink-0">
                              {csrName.charAt(0).toUpperCase()}
                            </div>
                            <span className="truncate max-w-[150px]" title={csrName}>{csrName}</span>
                          </div>
                        </td>

                        {/* 6 Inbound Call Inputs */}
                        {[1, 2, 3, 4, 5, 6].map(cNum => {
                          const callIndex = callBase + cNum;
                          const key = `w${selectedWeek}_call_${callIndex}`;
                          const val = currentScores[key] || "";
                          const isV = val.toUpperCase() === "V";
                          const isNA = val.toUpperCase().includes("N/A");

                          return (
                            <td key={cNum} className="p-1.5 text-center">
                              <input
                                type="text"
                                value={val}
                                onChange={(e) => handleScoreChange(currentSection, csrName, key, e.target.value)}
                                placeholder="-"
                                className={`w-14 h-8 text-center rounded-xl font-bold text-xs outline-none transition shadow-xs ${
                                  isV
                                    ? "bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700"
                                    : isNA
                                    ? "bg-gray-200/60 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                                    : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100 focus:border-[#1C6B53] dark:focus:border-emerald-500 focus:ring-2 focus:ring-[#1C6B53]/20"
                                }`}
                              />
                            </td>
                          );
                        })}

                        {/* 1 Outbound Call Input */}
                        <td className="p-1.5 text-center bg-amber-50/40 dark:bg-amber-950/20 border-x border-amber-200/60 dark:border-amber-900/40">
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

      </div>

      {/* Self-Contained Profile Modal for Quality Portal */}
      {showProfileModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowProfileModal(false)} />
          <div className="relative bg-white dark:bg-gray-900 rounded-2xl sm:rounded-3xl shadow-2xl p-5 sm:p-7 max-w-md w-full border border-gray-100 dark:border-gray-800 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">Profile Settings</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Update Your Display Name, Photo & Password</p>
              </div>
              <button onClick={() => setShowProfileModal(false)} className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400">
                <X size={20} />
              </button>
            </div>

            {profileError && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs font-semibold rounded-xl">
                {profileError}
              </div>
            )}

            {profileSuccess && (
              <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 text-[#1C6B53] dark:text-emerald-400 text-xs font-semibold rounded-xl">
                {profileSuccess}
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-4">
              {/* Photo Upload */}
              <div className="flex flex-col items-center justify-center mb-4">
                <div className="w-24 h-24 rounded-full bg-gray-100 dark:bg-gray-800 mb-2 overflow-hidden border-2 border-gray-200 dark:border-gray-700 relative group flex items-center justify-center shadow-inner">
                  {profilePhoto ? (
                    <img src={profilePhoto} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <Users size={32} className="text-gray-400" />
                  )}
                  <label className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 cursor-pointer transition rounded-full">
                    <Camera size={20} className="mb-1" />
                    <span className="text-[10px] font-bold">Change</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleProfilePhotoUpload} />
                  </label>
                </div>
                <span className="text-[11px] text-gray-400 font-medium">Click Photo To Upload New Image</span>
              </div>

              {/* Display Name */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5 text-gray-500 dark:text-gray-400">Display Name / Username</label>
                <input
                  type="text"
                  required
                  placeholder="Your Full Name"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50/70 dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:border-[#1C6B53] text-sm font-medium"
                />
              </div>

              {/* Role & Email info */}
              <div className="p-3.5 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-100 dark:border-gray-700 text-xs text-gray-500 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-600 dark:text-gray-300">Account Role</span>
                  <span className="font-bold text-gray-800 dark:text-white">
                    {isAdmin ? 'Administrator' : isManager ? 'Manager' : 'Quality Evaluator'}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-gray-700">
                  <span className="font-semibold text-gray-600 dark:text-gray-300">Email Address</span>
                  <span className="font-medium text-gray-700 dark:text-gray-200">{userProfile?.email}</span>
                </div>
              </div>

              {/* Change Password */}
              <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                <span className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">Change Password (Optional)</span>
                <div className="space-y-2.5">
                  <input
                    type="password"
                    placeholder="New Password (At least 6 characters)"
                    value={newProfilePassword}
                    onChange={(e) => setNewProfilePassword(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50/70 dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:border-[#1C6B53] text-sm font-medium"
                  />
                  <input
                    type="password"
                    placeholder="Confirm New Password"
                    value={confirmProfilePassword}
                    onChange={(e) => setConfirmProfilePassword(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50/70 dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:border-[#1C6B53] text-sm font-medium"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowProfileModal(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-[#1C6B53] hover:bg-[#155a45] transition shadow-md shadow-[#1C6B53]/20 disabled:opacity-50 cursor-pointer"
                >
                  {savingProfile ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
