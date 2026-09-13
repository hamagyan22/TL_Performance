"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebaseClient";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged, updatePassword, sendPasswordResetEmail } from "firebase/auth";
import { collection, query, where, getDocs, getDoc, updateDoc, addDoc, deleteDoc, doc, setDoc, onSnapshot } from "firebase/firestore";
import { Search, Trash2, UserPlus, UserMinus, Users, Moon, Sun, LogOut, Settings, Plus, X, Edit2, Briefcase, Columns, ChevronDown, Save, ShieldCheck, Mail, Lock, ArrowLeft, ArrowRight, Eye, EyeOff, LayoutDashboard, Sparkles, Check, Calendar, Award, CheckCircle2, TrendingUp, Clock, PhoneOff, Activity, PhoneCall, PhoneMissed } from "lucide-react";

type TeamName = 'Younis Kamal Team' | 'Ankido Buya Team' | 'Mohammed Dlshad Team';
const TEAMS: TeamName[] = ['Younis Kamal Team', 'Ankido Buya Team', 'Mohammed Dlshad Team'];

type ColumnConfig = {
  id: string;
  label: string;
  type: 'time' | 'number';
  aggregation: 'sum' | 'average';
};

const DEFAULT_CHAT_COLUMNS: ColumnConfig[] = [
  { id: 'exam', label: 'EXAM', type: 'number', aggregation: 'average' },
  { id: 'quality', label: 'QUALITY', type: 'number', aggregation: 'average' },
  { id: 'aht', label: 'AHT', type: 'time', aggregation: 'average' },
  { id: 'art', label: 'ART', type: 'time', aggregation: 'average' },
  { id: 'productivity', label: 'PROD', type: 'number', aggregation: 'average' },
  { id: 'inbound', label: 'INBOUND', type: 'number', aggregation: 'sum' },
  { id: 'outbound', label: 'OUTBOUND', type: 'number', aggregation: 'sum' },
];

const DEFAULT_OTHER_COLUMNS: ColumnConfig[] = [
  { id: 'quality', label: 'Quality %', type: 'number', aggregation: 'average' },
  { id: 'exam', label: 'Exam %', type: 'number', aggregation: 'average' },
  { id: 'productivity', label: 'Prod %', type: 'number', aggregation: 'average' },
  { id: 'aht', label: 'Aht S', type: 'time', aggregation: 'average' },
  { id: 'hold', label: 'Hold S', type: 'time', aggregation: 'average' },
  { id: 'wrapup', label: 'Wrapup', type: 'time', aggregation: 'sum' },
  { id: 'handled', label: 'Handled', type: 'number', aggregation: 'sum' },
  { id: 'abandoned', label: 'Abandoned', type: 'number', aggregation: 'sum' },
];

const DESIRED_COLUMN_ORDER = ['quality', 'exam', 'productivity', 'aht', 'hold', 'wrapup', 'handled', 'abandoned'];

function sortColumnsByOrder(cols: ColumnConfig[]) {
  if (!cols) return [];
  return [...cols].sort((a, b) => {
    const idxA = DESIRED_COLUMN_ORDER.indexOf(a.id);
    const idxB = DESIRED_COLUMN_ORDER.indexOf(b.id);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return 0;
  });
}


import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Camera } from "lucide-react";

function toTitleCase(str: string) {
  if (!str) return '';
  return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase());
}

function validatePasswordSecurity(password: string): { isValid: boolean; error: string } {
  if (!password || password.length < 8) {
    return { isValid: false, error: "Password must be at least 8 characters long." };
  }
  if (!/[A-Z]/.test(password)) {
    return { isValid: false, error: "Password must include at least one uppercase letter (A-Z)." };
  }
  if (!/[a-z]/.test(password)) {
    return { isValid: false, error: "Password must include at least one lowercase letter (a-z)." };
  }
  if (!/[0-9]/.test(password) && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return { isValid: false, error: "Password must include at least one number or special symbol." };
  }
  const lower = password.toLowerCase();
  if (lower === 'password123' || lower === 'password' || lower === '12345678') {
    return { isValid: false, error: "This password is too common or matches the initial default password. Please choose a unique password." };
  }
  return { isValid: true, error: "" };
}

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

const KPI_META: Record<string, { icon: any; color: string; bgLight: string; bgDark: string; border: string; label: string }> = {
  quality: { 
    icon: Award, 
    color: 'text-emerald-600 dark:text-emerald-400', 
    bgLight: 'bg-emerald-500/10', 
    bgDark: 'dark:bg-emerald-500/15',
    border: 'bg-emerald-500',
    label: 'Quality Score'
  },
  exam: { 
    icon: CheckCircle2, 
    color: 'text-blue-600 dark:text-blue-400', 
    bgLight: 'bg-blue-500/10', 
    bgDark: 'dark:bg-blue-500/15',
    border: 'bg-blue-500',
    label: 'Assessment Exam'
  },
  productivity: { 
    icon: TrendingUp, 
    color: 'text-purple-600 dark:text-purple-400', 
    bgLight: 'bg-purple-500/10', 
    bgDark: 'dark:bg-purple-500/15',
    border: 'bg-purple-500',
    label: 'Productivity Rate'
  },
  aht: { 
    icon: Clock, 
    color: 'text-rose-600 dark:text-rose-400', 
    bgLight: 'bg-rose-500/10', 
    bgDark: 'dark:bg-rose-500/15',
    border: 'bg-rose-500',
    label: 'Average Handling Time'
  },
  hold: { 
    icon: PhoneOff, 
    color: 'text-cyan-600 dark:text-cyan-400', 
    bgLight: 'bg-cyan-500/10', 
    bgDark: 'dark:bg-cyan-500/15',
    border: 'bg-cyan-500',
    label: 'Hold Duration'
  },
  wrapup: { 
    icon: Activity, 
    color: 'text-amber-600 dark:text-amber-400', 
    bgLight: 'bg-amber-500/10', 
    bgDark: 'dark:bg-amber-500/15',
    border: 'bg-amber-500',
    label: 'Wrap-Up Time'
  },
  handled: { 
    icon: PhoneCall, 
    color: 'text-teal-600 dark:text-teal-400', 
    bgLight: 'bg-teal-500/10', 
    bgDark: 'dark:bg-teal-500/15',
    border: 'bg-teal-500',
    label: 'Handled Interactions'
  },
  abandoned: { 
    icon: PhoneMissed, 
    color: 'text-red-600 dark:text-red-400', 
    bgLight: 'bg-red-500/10', 
    bgDark: 'dark:bg-red-500/15',
    border: 'bg-red-500',
    label: 'Abandoned Calls'
  },
};

function AgentDashboard({ 
  userProfile, 
  onLogout, 
  columnsMap, 
  previewMode = false, 
  allMembers = [], 
  onExitPreview,
  isDarkMode = false,
  toggleDarkMode
}: { 
  userProfile: any; 
  onLogout: () => void; 
  columnsMap: any; 
  previewMode?: boolean; 
  allMembers?: any[]; 
  onExitPreview?: () => void; 
  isDarkMode?: boolean;
  toggleDarkMode?: () => void;
}) {
  const currentMonth = MONTHS[new Date().getMonth()];
  const currentYear = new Date().getFullYear().toString();

  const initialAgent = (previewMode && allMembers && allMembers.length > 0)
    ? allMembers[0]
    : userProfile;
  const [currentAgent, setCurrentAgent] = useState<any>(initialAgent);
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<any[]>([]);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  
  const [memberDoc, setMemberDoc] = useState<any>(null);
  const [agentDropdownOpen, setAgentDropdownOpen] = useState(false);
  const [agentSearchTerm, setAgentSearchTerm] = useState("");
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editPhotoUrl, setEditPhotoUrl] = useState("");
  const [forcePasswordChange, setForcePasswordChange] = useState(
    previewMode ? false : (userProfile?.passwordUpdated !== true || userProfile?.mustChangePassword === true)
  );
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  useEffect(() => {
    if (previewMode && allMembers && allMembers.length > 0 && !currentAgent?.agent_name) {
      setCurrentAgent(allMembers[0]);
    } else if (userProfile && !previewMode) {
      setCurrentAgent(userProfile);
    }
  }, [userProfile, previewMode, allMembers]);

  const handleChangePassword = async (e: any) => {
    e.preventDefault();
    setPasswordError("");
    if (newPassword !== confirmPassword) {
      return setPasswordError("Passwords do not match");
    }
    const check = validatePasswordSecurity(newPassword);
    if (!check.isValid) {
      return setPasswordError(check.error);
    }
    
    try {
      if (auth.currentUser) {
        await updatePassword(auth.currentUser, newPassword);
        await setDoc(doc(db, 'users', auth.currentUser.uid), { 
          mustChangePassword: false, 
          passwordUpdated: true,
          passwordChangedAt: new Date().toISOString() 
        }, { merge: true });
        if (userProfile) {
          userProfile.mustChangePassword = false;
          userProfile.passwordUpdated = true;
        }
        setForcePasswordChange(false);
      }
    } catch(err: any) {
      if (err.code === 'auth/requires-recent-login') {
        setPasswordError("Security session expired. Please log out and sign back in to change your password.");
      } else {
        setPasswordError(err.message || "Failed to update password");
      }
    }
  };

  const teamCols = columnsMap[currentAgent?.team] || [];
  const tableName =
    currentAgent?.team === 'Younis Kamal Team' ? 'younis_metrics' :
    currentAgent?.team === 'Ankido Buya Team' ? 'ankido_metrics' :
    'mohammed_metrics';

  useEffect(() => {
    if (showEditProfile || forcePasswordChange) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showEditProfile, forcePasswordChange]);

  useEffect(() => {
    if (!currentAgent?.agent_name) return;
    setLoading(true);
    const q = query(
      collection(db, tableName),
      where('agent_name', '==', currentAgent.agent_name),
      where('year', '==', selectedYear)
    );
    const unsubMetrics = onSnapshot(q, (snap) => {
      setMetrics(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });

    const mQ = query(
      collection(db, 'team_members'),
      where('agent_name', '==', currentAgent.agent_name),
      where('team', '==', currentAgent.team)
    );
    const unsubMember = onSnapshot(mQ, (mSnap) => {
      if (!mSnap.empty) {
        const mData: any = { id: mSnap.docs[0].id, ...mSnap.docs[0].data() };
        setMemberDoc(mData);
        setEditDisplayName(mData.display_name || mData.agent_name);
        setEditPhotoUrl(mData.photo_url || "");
      } else {
        setMemberDoc(null);
        setEditDisplayName(currentAgent.name || currentAgent.agent_name);
        setEditPhotoUrl("");
      }
    }, (err) => {
      console.error(err);
    });

    return () => {
      unsubMetrics();
      unsubMember();
    };
  }, [selectedYear, currentAgent, tableName]);

  const handleSaveProfile = async () => {
    if(!memberDoc) return;
    try {
       await updateDoc(doc(db, 'team_members', memberDoc.id), {
         display_name: editDisplayName,
         photo_url: editPhotoUrl
       });
       setMemberDoc({ ...memberDoc, display_name: editDisplayName, photo_url: editPhotoUrl });
       setShowEditProfile(false);
    } catch(e) {
       console.error(e);
    }
  };
  
  const handlePhotoUpload = (e: any) => {
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
       setEditPhotoUrl(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

  // Helper to parse a stored value to a numeric (seconds if mm:ss, else as-is)
  const parseVal = (col: any, row: any) => {
    if (!row || !row[col.id]) return 0;
    const rawVal = row[col.id].toString();
    if (col.type === 'time' && rawVal.includes(':')) {
      const parts = rawVal.split(':');
      return (parseInt(parts[0]) || 0) * 60 + (parseInt(parts[1]) || 0); // → seconds
    }
    return parseFloat(rawVal) || 0; // plain number
  };

  const chartData = months.map(m => {
    const row = metrics.find(r => r.month === m);
    const dataObj: any = { month: m };
    teamCols.forEach((col: any) => { dataObj[col.id] = parseVal(col, row); });
    return dataObj;
  });

  // Smart aggregation — respects format (mm:ss vs plain) and aggregation type (sum vs average)
  const avgCols = (monthList: string[], col: any) => {
    const rows = monthList
      .map(m => metrics.find(r => r.month === m))
      .filter((r): r is any => !!r && r[col.id] != null && r[col.id] !== '');

    if (!rows.length) return '-';

    // Detect if values are stored as mm:ss
    const isTimeFormatted = col.type === 'time' && rows.some(r => r[col.id]?.toString().includes(':'));

    const nums = rows.map(r => {
      const v = r[col.id]?.toString() || '0';
      if (isTimeFormatted && v.includes(':')) {
        const parts = v.split(':');
        return (parseInt(parts[0]) || 0) * 60 + (parseInt(parts[1]) || 0);
      }
      return parseFloat(v) || 0;
    });

    const total = nums.reduce((a, b) => a + b, 0);
    const result = col.aggregation === 'sum' ? total : total / nums.length;

    if (isTimeFormatted) {
      return `${Math.floor(result / 60)}:${String(Math.round(result % 60)).padStart(2, '0')}`;
    }
    return col.aggregation === 'sum'
      ? Math.round(result).toString()
      : result.toFixed(1);
  };

  const PERIODS = [
    { label: 'Q1', months: ['JAN','FEB','MAR'] },
    { label: 'Q2', months: ['APR','MAY','JUN'] },
    { label: 'Q3', months: ['JUL','AUG','SEP'] },
    { label: 'Q4', months: ['OCT','NOV','DEC'] },
    { label: 'H1', months: ['JAN','FEB','MAR','APR','MAY','JUN'] },
    { label: 'H2', months: ['JUL','AUG','SEP','OCT','NOV','DEC'] },
  ];

  // selectedPeriod: either a month name or a period label
  const isMonthSelected = months.includes(selectedMonth);
  const selectedMonthData: any = isMonthSelected
    ? (metrics.find(r => r.month === selectedMonth) || {})
    : {};

  const getDisplayVal = (col: any) => {
    if (isMonthSelected) {
      return selectedMonthData[col.id] || '-';
    }
    const period = PERIODS.find(p => p.label === selectedMonth);
    if (!period) return '-';
    return avgCols(period.months, col);
  };

  const getAgentColLabel = (col: any) => {
    const id = (col.id || '').toLowerCase();
    const lbl = (col.label || '').toLowerCase();
    if (id === 'aht' || lbl === 'aht') return 'AHT';
    if (id === 'wrapup' || lbl === 'wrapup' || id.includes('wrapup') || lbl.includes('wrapup')) return 'Wrapup Not Selected';
    return toTitleCase(col.label);
  };

  return (
    <div className="min-h-screen p-3.5 sm:p-6 md:p-10 font-sans bg-[#F9F8F4] dark:bg-gray-900 transition-colors">
      <div className="max-w-[1400px] mx-auto">

        {/* Top Brand Header (FIB Logo & Portal Controls) */}
        <div className="relative z-50 flex flex-col sm:flex-row justify-between items-start sm:items-center w-full mb-6 sm:mb-8 gap-3 sm:gap-4 pb-4 sm:pb-6 border-b border-gray-200/70 dark:border-gray-800">
          <div className="flex items-center gap-3 sm:gap-5 w-full sm:w-auto justify-between sm:justify-start">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <img src="/logo.webp" alt="FIB Logo" className="h-9 sm:h-12 w-auto object-contain drop-shadow-xs" />
              <div className="h-8 sm:h-10 w-[1.5px] bg-gray-200 dark:bg-gray-700" />
              <div>
                <h1 className="text-lg sm:text-2xl font-black tracking-tight text-gray-900 dark:text-white leading-none">
                  Agent Dashboard
                </h1>
                <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">
                  Performance & Scorecards Portal
                </p>
              </div>
            </div>
          </div>

          <div className="relative z-50 flex items-center gap-1.5 sm:gap-2 p-1.5 bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl border border-gray-200/80 dark:border-gray-700/80 rounded-2xl shadow-xs flex-wrap w-full sm:w-auto justify-between sm:justify-end">
            {/* Agent Selector Dropdown in Preview Mode */}
            {previewMode && (
              <div className="relative flex-1 sm:flex-initial min-w-[130px]">
                <button
                  type="button"
                  onClick={() => setAgentDropdownOpen(!agentDropdownOpen)}
                  className="w-full sm:w-auto flex items-center justify-between sm:justify-start gap-2 px-2.5 sm:px-3 py-1.5 bg-gray-50 hover:bg-gray-100 dark:bg-gray-700/60 dark:hover:bg-gray-700 border border-gray-200/80 dark:border-gray-600/80 rounded-xl text-xs font-bold text-gray-800 dark:text-gray-200 transition shadow-xs cursor-pointer"
                >
                  <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-[#1C6B53] dark:text-emerald-300 flex items-center justify-center text-[10px] font-black shrink-0">
                    {currentAgent?.agent_name ? currentAgent.agent_name.charAt(0).toUpperCase() : <Users size={11} />}
                  </div>
                  <span className="truncate max-w-[90px] sm:max-w-[160px]">{currentAgent?.agent_name || "Select Agent"}</span>
                  <span className="text-[9px] sm:text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-200/70 dark:bg-gray-600 text-gray-600 dark:text-gray-300 shrink-0">
                    {currentAgent?.team?.replace(' Team', '') || ''}
                  </span>
                  <ChevronDown size={12} className={`text-gray-400 dark:text-gray-400 transition-transform duration-200 ${agentDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {agentDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setAgentDropdownOpen(false)} />
                    <div className="absolute right-0 top-full mt-2 w-[calc(100vw-32px)] sm:w-72 max-w-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl p-2 z-50 max-h-80 flex flex-col">
                      <div className="relative mb-2">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Filter agents..."
                          value={agentSearchTerm}
                          onChange={(e) => setAgentSearchTerm(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:border-[#1C6B53] text-gray-800 dark:text-gray-200 font-medium"
                          autoFocus
                        />
                      </div>
                      <div className="overflow-y-auto space-y-1 flex-1 pr-1 overscroll-contain">
                        {allMembers
                          .filter(m => 
                            (m.agent_name || "").toLowerCase().includes(agentSearchTerm.toLowerCase()) ||
                            (m.team || "").toLowerCase().includes(agentSearchTerm.toLowerCase())
                          )
                          .map(m => {
                            const isSelected = m.agent_name === currentAgent?.agent_name;
                            return (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => {
                                  setCurrentAgent({
                                    role: 'agent',
                                    agent_name: m.agent_name,
                                    team: m.team,
                                    name: m.agent_name,
                                    photo_url: m.photo_url || ""
                                  });
                                  setAgentDropdownOpen(false);
                                  setAgentSearchTerm("");
                                }}
                                className={`w-full flex items-center justify-between p-2 rounded-xl text-left text-xs transition ${
                                  isSelected
                                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-[#1C6B53] dark:text-emerald-300 font-bold'
                                    : 'hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 font-medium'
                                }`}
                              >
                                <div className="flex items-center gap-2 truncate">
                                  <div className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[10px] font-bold text-gray-600 dark:text-gray-300 shrink-0">
                                    {m.agent_name?.charAt(0).toUpperCase()}
                                  </div>
                                  <span className="truncate">{m.agent_name}</span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                                    {m.team?.replace(' Team', '')}
                                  </span>
                                  {isSelected && <Check size={13} className="text-[#1C6B53] dark:text-emerald-400" />}
                                </div>
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Back to Dashboard Button in Preview Mode */}
            {previewMode && onExitPreview && (
              <button
                onClick={onExitPreview}
                className="flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-xl text-xs font-bold text-[#1C6B53] dark:text-emerald-300 bg-emerald-50 hover:bg-emerald-100/70 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 border border-emerald-200/60 dark:border-emerald-800/60 shadow-xs transition active:scale-95 shrink-0"
              >
                <ArrowLeft size={13} />
                <span>Back</span>
              </button>
            )}

            {(previewMode || toggleDarkMode) && (
              <div className="h-4 w-px bg-gray-200 dark:bg-gray-700 mx-0.5 shrink-0" />
            )}

            {/* Dark Mode Toggle */}
            {toggleDarkMode && (
              <button 
                onClick={toggleDarkMode} 
                className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700/60 transition-colors shrink-0"
                title="Toggle Dark Mode"
              >
                {isDarkMode ? <Sun size={16} className="text-amber-500" /> : <Moon size={16} />}
              </button>
            )}

            {!previewMode && (
              <>
                <div className="h-4 w-px bg-gray-200 dark:bg-gray-700 mx-0.5 shrink-0" />
                <button 
                  onClick={onLogout} 
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-gray-600 hover:text-red-600 dark:text-gray-300 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition shrink-0"
                >
                  <LogOut size={14} /> <span>Logout</span>
                </button>
              </>
            )}
          </div>
        </div>
        
        {/* Header with Profile */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 sm:mb-8 gap-4 bg-white dark:bg-gray-800 p-4 sm:p-7 rounded-2xl sm:rounded-3xl shadow-sm border border-gray-200/70 dark:border-gray-700/80">
          <div className="flex items-center gap-3.5 sm:gap-5 w-full sm:w-auto">
            <div className="relative group shrink-0">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden border-3 sm:border-4 border-white dark:border-gray-800 shadow-md flex items-center justify-center">
                {memberDoc?.photo_url ? (
                  <img src={memberDoc.photo_url} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <Users size={28} className="text-gray-400 sm:w-8 sm:h-8" />
                )}
              </div>
              {!previewMode && (
                <button 
                  onClick={() => setShowEditProfile(true)} 
                  className="absolute bottom-0 right-0 p-1.5 bg-[#1C6B53] text-white rounded-full shadow-md hover:bg-emerald-700 transition"
                  title="Change Profile Photo"
                >
                  <Edit2 size={12} />
                </button>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/60 dark:border-emerald-800/60 text-[#1C6B53] dark:text-emerald-300 text-[11px] sm:text-xs font-bold tracking-wide">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="truncate max-w-[140px] sm:max-w-none">{currentAgent?.team || 'Team Member'}</span>
                </div>
                <span className="text-gray-400 dark:text-gray-500 text-[11px] sm:text-xs font-medium hidden sm:inline">
                  {previewMode ? '• Agent Performance Scorecard' : '• Performance Scorecard'}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-gray-900 dark:text-white truncate">
                {memberDoc?.display_name || currentAgent?.agent_name || currentAgent?.name}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-auto">
            {!previewMode && (
              <button 
                onClick={() => setShowEditProfile(true)}
                className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-gray-700 dark:text-gray-200 bg-gray-50 hover:bg-gray-100 dark:bg-gray-700/60 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-600/80 rounded-2xl transition shadow-xs active:scale-95"
              >
                <Edit2 size={13} className="text-[#1C6B53] dark:text-emerald-400" />
                <span>Edit Profile</span>
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-500 font-medium">Loading performance data...</div>
        ) : (
          <div className="space-y-4 sm:space-y-5">

            {/* Year Performance Overview (FIB Emerald Theme - Modern & Ultra-Sleek) */}
            <div className="bg-gradient-to-br from-[#0C3227] via-[#124235] to-[#0A281F] rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 shadow-xl shadow-[#0C3227]/20 border border-emerald-500/25 relative overflow-hidden text-white">
              {/* Subtle ambient brand glow in background */}
              <div className="absolute -top-24 -right-24 w-72 h-72 bg-[#1C6B53]/25 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-[#00A887]/15 rounded-full blur-3xl pointer-events-none" />

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pb-4 sm:pb-6 border-b border-white/10 relative z-10">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-xl bg-emerald-400/15 border border-emerald-400/25 text-emerald-300 text-[10px] sm:text-[11px] font-bold tracking-widest uppercase mb-1.5">
                    <Sparkles size={11} className="text-emerald-300" />
                    <span>Year Performance</span>
                  </div>
                  <h2 className="text-xl sm:text-3xl font-black text-white tracking-tight leading-tight">
                    {selectedYear} Overview
                  </h2>
                  <p className="text-[11px] sm:text-xs text-emerald-100/70 mt-0.5 sm:mt-1 font-medium">
                    Consolidated annual metrics across all 12 months
                  </p>
                </div>
                
                <div className="flex items-center gap-2 self-start sm:self-auto px-3 py-1.5 sm:px-4 sm:py-2.5 rounded-xl sm:rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 shadow-inner">
                  <div className="w-1.5 sm:w-2 h-1.5 sm:h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[11px] sm:text-xs font-bold text-emerald-100 tracking-wide">12 Months Consolidated</span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4 mt-4 sm:mt-6 relative z-10">
                {teamCols.map((col: any) => {
                  const yearAvg = avgCols(months, col);
                  return (
                    <div 
                      key={col.id} 
                      className="relative overflow-hidden bg-white/[0.08] hover:bg-white/[0.14] backdrop-blur-md border border-white/15 hover:border-emerald-400/40 rounded-xl sm:rounded-2xl p-3 sm:p-4 transition-all duration-200 group shadow-sm hover:shadow-md flex flex-col justify-between"
                    >
                      <span className="text-[11px] sm:text-xs font-semibold text-emerald-100/80 group-hover:text-white transition-colors truncate block">
                        {getAgentColLabel(col)}
                      </span>
                      
                      <div className="mt-2 flex items-baseline">
                        <span className="text-xl sm:text-2xl font-black text-white tracking-tight leading-none">
                          {yearAvg}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Month / Period Selector Toolbar with Year Dropdown beside months */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200/80 dark:border-gray-700 shadow-sm p-1.5 sm:p-2">
              <div className="flex items-center px-1 overflow-x-auto scrollbar-hide gap-1 sm:gap-1.5">
                {/* Modern Year Select Dropdown beside months */}
                <div className="relative shrink-0 mr-0.5 sm:mr-1">
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="appearance-none pl-3 pr-7 py-1.5 sm:pl-3.5 sm:pr-8 sm:py-2 text-[11px] sm:text-xs font-black rounded-xl bg-emerald-50 dark:bg-emerald-950/70 text-[#1C6B53] dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/80 outline-none cursor-pointer shadow-xs hover:bg-emerald-100/60 transition-all"
                  >
                    <option value="2026">2026</option>
                    <option value="2027">2027</option>
                    <option value="2028">2028</option>
                    <option value="2029">2029</option>
                    <option value="2030">2030</option>
                  </select>
                  <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-[#1C6B53] dark:text-emerald-400 font-bold" />
                </div>

                <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-0.5 sm:mx-1 shrink-0" />

                {/* Month tabs */}
                {months.map(m => {
                  const displayLabel = m.charAt(0) + m.slice(1).toLowerCase();
                  return (
                    <button
                      key={m}
                      onClick={() => setSelectedMonth(m)}
                      className={`shrink-0 px-2.5 sm:px-3.5 py-1.5 text-[11px] sm:text-xs font-bold rounded-xl transition-all duration-150 ${
                        selectedMonth === m
                          ? 'bg-[#1C6B53] text-white shadow-md shadow-[#1C6B53]/25 scale-[1.02]'
                          : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700/50'
                      }`}
                    >
                      {displayLabel}
                    </button>
                  );
                })}

                <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-0.5 sm:mx-1 shrink-0" />

                {/* Period tabs - Styled in Green like Team Leader Dashboard */}
                {PERIODS.map(p => {
                  const isSel = selectedMonth === p.label;
                  return (
                    <button
                      key={p.label}
                      onClick={() => setSelectedMonth(p.label)}
                      className={`shrink-0 px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-extrabold rounded-xl transition-all duration-150 whitespace-nowrap ${
                        isSel
                          ? 'bg-[#00A991] text-white shadow-md shadow-[#00A991]/30 scale-[1.02]'
                          : 'text-emerald-700 dark:text-emerald-400 bg-emerald-50/70 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/40'
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* KPI Cards — Grand, High-Impact Modern Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-5">
              {teamCols.map((col: any) => {
                const cardLabel = getAgentColLabel(col);
                const meta = KPI_META[col.id] || {
                  icon: Activity,
                  color: 'text-[#1C6B53] dark:text-emerald-400',
                  bgLight: 'bg-emerald-500/10',
                  bgDark: 'dark:bg-emerald-500/15',
                  border: 'bg-[#1C6B53]',
                  label: cardLabel
                };
                const IconComp = meta.icon;
                const val = getDisplayVal(col);

                const isWrapup = col.id?.toLowerCase().includes('wrapup') || col.label?.toLowerCase().includes('wrapup');
                const isTime = col.type === 'time' && !isWrapup;
                const isPercent = !isTime && !isWrapup && (
                  col.aggregation === 'average' || 
                  col.id.toLowerCase().includes('quality') || 
                  col.id.toLowerCase().includes('exam') || 
                  col.id.toLowerCase().includes('prod') || 
                  col.label.includes('%')
                );
                const strVal = String(val ?? '-').trim();
                const hasPercentSign = strVal.endsWith('%');
                const cleanVal = hasPercentSign ? strVal.slice(0, -1).trim() : strVal;

                return (
                  <div 
                    key={col.id} 
                    className="group relative overflow-hidden bg-white dark:bg-gray-800/90 rounded-2xl sm:rounded-3xl p-4 sm:p-7 border border-gray-200/80 dark:border-gray-700/80 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-200 flex flex-col justify-between min-h-[145px] sm:min-h-[190px]"
                  >
                    {/* Top colored accent indicator line */}
                    <div className={`absolute top-0 left-0 right-0 h-1 sm:h-1.5 ${meta.border}`} />

                    {/* Subtle ambient colored radial glow in background */}
                    <div className={`absolute -right-6 -bottom-6 w-24 h-24 sm:w-32 sm:h-32 rounded-full ${meta.bgLight} ${meta.bgDark} blur-2xl pointer-events-none opacity-40 group-hover:opacity-80 transition-opacity`} />

                    <div className="relative z-10">
                      {/* Header: Icon + Metric Title (clean without secondary subtitle) */}
                      <div className="flex items-center justify-between gap-2 sm:gap-3 mb-2 sm:mb-4">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 ${meta.bgLight} ${meta.bgDark} ${meta.color} shadow-xs group-hover:scale-110 transition-transform`}>
                            <IconComp size={16} strokeWidth={2.5} className="sm:w-5 sm:h-5" />
                          </div>
                          <span className="text-xs sm:text-base font-black text-gray-800 dark:text-gray-100 tracking-tight block truncate group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                            {cardLabel}
                          </span>
                        </div>
                      </div>

                      {/* Hero Big Value — Modern, High-Impact & Beautiful */}
                      <div className="my-2 sm:my-3.5">
                        {cleanVal === '-' || cleanVal === '' ? (
                          <span className="text-2xl sm:text-4xl font-bold text-gray-300 dark:text-gray-600 select-none">
                            —
                          </span>
                        ) : (
                          <div className="flex items-baseline gap-1 flex-wrap">
                            <span className="text-3xl sm:text-4xl lg:text-[46px] font-black tracking-tight tabular-nums text-gray-900 dark:text-white leading-none drop-shadow-xs">
                              {cleanVal}
                            </span>
                            
                            {(isPercent || hasPercentSign) && (
                              <span className={`text-base sm:text-xl lg:text-2xl font-black ${meta.color} opacity-90 select-none ml-0.5`}>
                                %
                              </span>
                            )}

                            {isTime && cleanVal !== '-' && (
                              <span className="text-[10px] sm:text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider ml-1 select-none bg-gray-100 dark:bg-gray-700/60 px-1.5 py-0.5 rounded-md self-center">
                                min
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Card Footer */}
                    <div className="relative z-10 mt-2.5 sm:mt-4 pt-2 sm:pt-3 border-t border-gray-100 dark:border-gray-700/70 flex items-center justify-between text-[10px] sm:text-[11px] text-gray-400 dark:text-gray-500 font-medium">
                      <span className="flex items-center gap-1 sm:gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span className="hidden xs:inline sm:inline">Active</span>
                      </span>
                      <span className="font-bold text-gray-600 dark:text-gray-300">{selectedMonth} {selectedYear}</span>
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        )}

      </div>

      {/* Edit Profile Modal */}
      {showEditProfile && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowEditProfile(false)} />
          <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-2xl p-6 max-w-sm w-full border border-gray-100 dark:border-gray-800">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Edit Profile</h3>
            
            <div className="flex flex-col items-center mb-6">
               <div className="w-24 h-24 rounded-full bg-gray-100 dark:bg-gray-800 mb-3 overflow-hidden border-2 border-gray-200 dark:border-gray-700 relative group flex items-center justify-center">
                  {editPhotoUrl ? <img src={editPhotoUrl} className="w-full h-full object-cover" /> : <Users size={32} className="text-gray-300" />}
                  <label className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 cursor-pointer transition">
                    <Camera size={18} className="mb-1" />
                    <span className="text-[10px] font-medium">Upload</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                  </label>
               </div>
            </div>

            <div className="mb-6">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Display Name</label>
              <input type="text" value={editDisplayName} onChange={e => setEditDisplayName(e.target.value)} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:border-[#1C6B53]" />
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowEditProfile(false)} className="flex-1 py-2 rounded-lg text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 transition">Cancel</button>
              <button onClick={handleSaveProfile} className="flex-1 py-2 rounded-lg text-sm font-semibold text-white bg-[#1C6B53] hover:bg-emerald-700 transition shadow-sm">Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Force Change Password Modal for First-Time Login */}
      {forcePasswordChange && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md overscroll-contain">
          <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl p-7 sm:p-8 max-w-md w-full border border-gray-100 dark:border-gray-800 relative">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-16 h-16 rounded-2xl bg-[#1C6B53]/10 dark:bg-emerald-950 flex items-center justify-center text-[#1C6B53] dark:text-emerald-400 mb-4 shadow-inner">
                <ShieldCheck size={32} />
              </div>
              <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">
                First Time Login Security
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">
                Welcome, <strong className="text-gray-800 dark:text-gray-200">{userProfile.agent_name || userProfile.name}</strong>! As this is your first time signing in, you must set your private personal password before accessing the dashboard.
              </p>
            </div>

            {passwordError && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs font-semibold rounded-xl">
                {passwordError}
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5 text-gray-500 dark:text-gray-400">
                  New Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="Min. 8 characters with letters & numbers"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50/70 dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:border-[#1C6B53] text-sm font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5 text-gray-500 dark:text-gray-400">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50/70 dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:border-[#1C6B53] text-sm font-medium"
                />
              </div>

              {/* Password Requirements Checklist */}
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/80 border border-gray-200/60 dark:border-gray-700/60 space-y-1 text-[11px] text-gray-500 dark:text-gray-400">
                <p className="font-bold text-gray-700 dark:text-gray-300 mb-1">Security Requirements:</p>
                <div className="flex items-center gap-1.5">
                  <span className={newPassword.length >= 8 ? "text-emerald-500 font-bold" : "text-gray-400"}>•</span>
                  <span>Minimum 8 characters</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={/[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword) ? "text-emerald-500 font-bold" : "text-gray-400"}>•</span>
                  <span>Uppercase & lowercase letters</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={/[0-9]/.test(newPassword) || /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword) ? "text-emerald-500 font-bold" : "text-gray-400"}>•</span>
                  <span>At least one number or special character</span>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3.5 mt-2 rounded-xl text-sm font-bold text-white bg-[#1C6B53] hover:bg-[#155a45] shadow-lg shadow-[#1C6B53]/25 transition-all active:scale-[0.99]"
              >
                Set New Password & Access Dashboard
              </button>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={onLogout}
                  className="text-xs text-gray-400 hover:text-red-500 font-semibold transition"
                >
                  Cancel and Sign Out
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default function Dashboard() {
  const [session, setSession] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const isAdmin = session?.email?.toLowerCase() === 'mohammed.dlshad0@gmail.com' || userProfile?.role === 'admin';
  const isManager = isAdmin || session?.email?.toLowerCase() === 'jalal.burghol@agent.com' || userProfile?.role === 'manager';
  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [lockoutTimer, setLockoutTimer] = useState(0);

  // Mandatory first-login password change for TL/Manager users
  const [tlNewPassword, setTlNewPassword] = useState('');
  const [tlConfirmPassword, setTlConfirmPassword] = useState('');
  const [tlPasswordError, setTlPasswordError] = useState('');
  const [tlPasswordLoading, setTlPasswordLoading] = useState(false);

  useEffect(() => {
    if (lockoutTimer <= 0) return;
    const interval = setInterval(() => {
      setLockoutTimer(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutTimer]);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const currentMonth = MONTHS[new Date().getMonth()];
  const currentYear = new Date().getFullYear().toString();
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedTeam, setSelectedTeam] = useState<TeamName>('Younis Kamal Team');
  const [rows, setRows] = useState<any[]>([]);
  const [showAgentPreview, setShowAgentPreview] = useState(false);

  const [columnsMap, setColumnsMap] = useState<Record<string, ColumnConfig[]>>({});

  // TL & Manager Profile Modal State
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profilePhoto, setProfilePhoto] = useState("");
  const [newProfilePassword, setNewProfilePassword] = useState("");
  const [confirmProfilePassword, setConfirmProfilePassword] = useState("");
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // Forgot Password Modal State
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState("");
  const [forgotError, setForgotError] = useState("");

  const handleTLPasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setTlPasswordError('');
    if (tlNewPassword !== tlConfirmPassword) {
      setTlPasswordError('Passwords do not match');
      return;
    }
    const check = validatePasswordSecurity(tlNewPassword);
    if (!check.isValid) {
      setTlPasswordError(check.error);
      return;
    }
    setTlPasswordLoading(true);
    try {
      if (auth.currentUser) {
        await updatePassword(auth.currentUser, tlNewPassword);
        await setDoc(doc(db, 'users', auth.currentUser.uid), {
          mustChangePassword: false,
          passwordUpdated: true,
          passwordChangedAt: new Date().toISOString(),
        }, { merge: true });
        setUserProfile((prev: any) => ({
          ...prev,
          mustChangePassword: false,
          passwordUpdated: true,
        }));
      }
    } catch (err: any) {
      if (err.code === 'auth/requires-recent-login') {
        setTlPasswordError('Security session expired. Please log out and sign back in to change your password.');
      } else {
        setTlPasswordError(err.message || 'Failed to update password');
      }
    } finally {
      setTlPasswordLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError("");
    setForgotSuccess("");
    const cleanForgotEmail = forgotEmail.trim().toLowerCase();
    if (!cleanForgotEmail) {
      setForgotError("Please enter your email address");
      return;
    }
    setForgotLoading(true);
    try {
      await sendPasswordResetEmail(auth, cleanForgotEmail);
    } catch (err: any) {
      if (err.code === 'auth/too-many-requests') {
        setForgotError("Too many password reset requests. Please wait a few minutes before trying again.");
        setForgotLoading(false);
        return;
      }
      console.warn("Password reset notice:", err.code);
    } finally {
      setForgotLoading(false);
      setForgotSuccess("If an account exists with this email address, password reset instructions have been sent. Please check your inbox and spam folder.");
    }
  };

  const openProfileModal = () => {
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

  const handleSaveTLProfile = async (e: any) => {
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
        const check = validatePasswordSecurity(newProfilePassword);
        if (!check.isValid) {
          setProfileError(check.error);
          setSavingProfile(false);
          return;
        }
        if (auth.currentUser) {
          await updatePassword(auth.currentUser, newProfilePassword);
        }
      }

      if (session?.uid) {
        const payload: any = {
          name: profileName,
          photo_url: profilePhoto,
        };
        if (newProfilePassword) {
          payload.mustChangePassword = false;
          payload.passwordUpdated = true;
          payload.passwordChangedAt = new Date().toISOString();
        }
        await setDoc(doc(db, 'users', session.uid), payload, { merge: true });
        setUserProfile((prev: any) => ({
          ...prev,
          ...payload
        }));
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

  // Manage members modal
  const [showManageMembers, setShowManageMembers] = useState(false);
  const [allMembers, setAllMembers] = useState<any[]>([]);
  
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberTeam, setNewMemberTeam] = useState<TeamName>('Younis Kamal Team');
  const [deleteTarget, setDeleteTarget] = useState<{ memberId: string; name: string; team: string } | null>(null);

  // Edit Agents
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editMemberName, setEditMemberName] = useState("");
  const [editMemberTeam, setEditMemberTeam] = useState<TeamName>('Younis Kamal Team');

  // New/Edit Column state
  const [manageColsTeam, setManageColsTeam] = useState<string>('ALL');
  const [newColLabel, setNewColLabel] = useState("");
  const [newColType, setNewColType] = useState<'number'|'time'>('number');
  const [newColAgg, setNewColAgg] = useState<'sum'|'average'>('average');

  const [editingColId, setEditingColId] = useState<string | null>(null);
  const [editColLabel, setEditColLabel] = useState("");
  const [editColType, setEditColType] = useState<'number'|'time'>('number');
  const [editColAgg, setEditColAgg] = useState<'sum'|'average'>('average');

  const [yearMetrics, setYearMetrics] = useState<any[]>([]);

  // Prevent background scroll when modal is open
  useEffect(() => {
    if (showManageMembers || showProfileModal || deleteTarget || showForgotModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showManageMembers, showProfileModal, deleteTarget, showForgotModal]);

  // Real-time columns synchronization across all teams, TLs, and Agents
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'columns_config'), (snap) => {
      const map: Record<string, ColumnConfig[]> = {};
      snap.docs.forEach(d => {
        map[d.id] = d.data().columns;
      });
      for (const t of TEAMS) {
        if (!map[t] || map[t].length === 0) {
          map[t] = t === 'Mohammed Dlshad Team' ? DEFAULT_CHAT_COLUMNS : DEFAULT_OTHER_COLUMNS;
          setDoc(doc(db, 'columns_config', t), { columns: map[t] }).catch(console.error);
        }
      }
      setColumnsMap(map);
    }, (err) => {
      console.error("Columns listener error:", err);
    });
    return () => unsub();
  }, []);

  // Real-time team members sync across all accounts
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'team_members'), (snap) => {
      const members = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      members.sort((a, b) => (a.agent_name > b.agent_name ? 1 : -1));
      setAllMembers(members);
    }, (err) => {
      console.error("Members listener error:", err);
    });
    return () => unsub();
  }, []);

  const months = [
    "JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"
  ];
  const periods = ["Q1", "Q2", "Q3", "Q4", "H1", "H2"];

  const aggregateMap: Record<string, string[]> = {
    "Q1": ["JAN", "FEB", "MAR"],
    "Q2": ["APR", "MAY", "JUN"],
    "Q3": ["JUL", "AUG", "SEP"],
    "Q4": ["OCT", "NOV", "DEC"],
    "H1": ["JAN", "FEB", "MAR", "APR", "MAY", "JUN"],
    "H2": ["JUL", "AUG", "SEP", "OCT", "NOV", "DEC"],
    "Q1 - AVG": ["JAN", "FEB", "MAR"],
    "Q2 - AVG": ["APR", "MAY", "JUN"],
    "Q3 - AVG": ["JUL", "AUG", "SEP"],
    "Q4 - AVG": ["OCT", "NOV", "DEC"],
    "H1 - AVG": ["JAN", "FEB", "MAR", "APR", "MAY", "JUN"],
    "H2 - AVG": ["JUL", "AUG", "SEP", "OCT", "NOV", "DEC"],
    "YEAR - AVG": ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
  };

  const isAggregate = Object.keys(aggregateMap).includes(selectedMonth);

  const tableName =
    selectedTeam === 'Younis Kamal Team' ? 'younis_metrics' :
    selectedTeam === 'Ankido Buya Team' ? 'ankido_metrics' :
    'mohammed_metrics';

  const calcYearTeamStat = (col: ColumnConfig) => {
    const validMetrics = yearMetrics.filter(r => r[col.id] && r[col.id].toString().trim() !== "");
    if (validMetrics.length === 0) return "-";

    if (col.type === 'time') {
      let totalSeconds = 0;
      validMetrics.forEach(r => {
        const parts = r[col.id].toString().split(':');
        if (parts.length === 2) totalSeconds += (parseInt(parts[0]) * 60) + parseInt(parts[1]);
        else totalSeconds += parseInt(parts[0]) || 0;
      });
      const resultSecs = col.aggregation === 'sum' ? totalSeconds : Math.round(totalSeconds / validMetrics.length);
      return `${Math.floor(resultSecs / 60)}:${(resultSecs % 60).toString().padStart(2, '0')}`;
    } else {
      const sum = validMetrics.reduce((acc, r) => acc + parseFloat(r[col.id] || 0), 0);
      const result = col.aggregation === 'sum' ? sum : sum / validMetrics.length;
      return Number.isInteger(result) ? result.toString() : result.toFixed(1);
    }
  };

  const fetchAllMembers = async () => {
    try {
      const snap = await getDocs(collection(db, 'team_members'));
      const members = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      members.sort((a, b) => (a.agent_name > b.agent_name ? 1 : -1));
      setAllMembers(members);
    } catch(e) {
      console.error(e);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setSession(user);
      if (user) {
        const emailLower = user.email?.toLowerCase().trim() || '';
        const isMohammed = emailLower === 'mohammed.dlshad0@gmail.com';
        const isJalal = emailLower === 'jalal.burghol@agent.com';
        const isYounis = emailLower === 'younis.kamal@agent.com';
        const isAnkido = emailLower === 'ankido.buya@agent.com';
        const isAgent = emailLower.endsWith('@agent.com');

        // Instant optimistic role identification: Mohammed Dlshad (The Admin) is EXEMPT
        if (isMohammed) {
          const adminProfile: any = {
            role: 'admin',
            isAdmin: true,
            team: 'Mohammed Dlshad Team',
            name: 'Mohammed Dlshad',
            email: user.email,
            mustChangePassword: false,
            passwordUpdated: true,
          };
          setUserProfile(adminProfile);
          setSelectedTeam('Mohammed Dlshad Team');
          setAuthLoading(false);
          setDoc(doc(db, 'users', user.uid), adminProfile, { merge: true }).catch(console.error);
          return;
        }

        // For ALL other users (Manager Jalal Burghol, Team Leaders Younis & Ankido, Agents):
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          const existingData = userDoc.exists() ? userDoc.data() : {};

          let role = existingData.role;
          let name = existingData.name;
          let team = existingData.team;

          if (isJalal) {
            role = 'manager';
            name = name || 'Jalal Burghol';
            team = 'All';
          } else if (isYounis) {
            role = 'tl';
            name = name || 'Younis Kamal';
            team = 'Younis Kamal Team';
            setSelectedTeam('Younis Kamal Team');
          } else if (isAnkido) {
            role = 'tl';
            name = name || 'Ankido Buya';
            team = 'Ankido Buya Team';
            setSelectedTeam('Ankido Buya Team');
          } else if (!role) {
            role = isAgent ? 'agent' : 'tl';
          }

          if (role === 'tl' && team) {
            setSelectedTeam(team as TeamName);
          }

          // Mandatory password change for everyone except Mohammed:
          // User must have explicitly completed the password change process (passwordUpdated === true)
          const hasUpdatedPassword = existingData.passwordUpdated === true;

          const updatedProfile = {
            ...existingData,
            role,
            name: name || user.displayName || user.email?.split('@')[0],
            team: team || (isJalal ? 'All' : undefined),
            email: user.email,
            isAdmin: false,
            passwordUpdated: hasUpdatedPassword,
            mustChangePassword: !hasUpdatedPassword,
          };

          setUserProfile(updatedProfile);

          // Update Firestore
          setDoc(doc(db, 'users', user.uid), {
            role,
            name: updatedProfile.name,
            team: updatedProfile.team || null,
            email: user.email,
            isAdmin: false,
            passwordUpdated: hasUpdatedPassword,
            mustChangePassword: !hasUpdatedPassword,
          }, { merge: true }).catch(console.error);

        } catch (e) {
          console.error("Error fetching user profile:", e);
          const fallbackRole = isJalal ? 'manager' : (isYounis || isAnkido ? 'tl' : (isAgent ? 'agent' : 'tl'));
          setUserProfile({
            role: fallbackRole,
            name: isJalal ? 'Jalal Burghol' : (isYounis ? 'Younis Kamal' : (isAnkido ? 'Ankido Buya' : user.email?.split('@')[0])),
            team: isYounis ? 'Younis Kamal Team' : (isAnkido ? 'Ankido Buya Team' : (isJalal ? 'All' : undefined)),
            email: user.email,
            isAdmin: false,
            passwordUpdated: false,
            mustChangePassword: true,
          });
        }
        setAuthLoading(false);
      } else {
        setUserProfile(null);
        setAuthLoading(false);
      }
    });

    const theme = localStorage.getItem('theme');
    if (theme === 'dark') {
      setIsDarkMode(true);
      document.body.classList.add('dark');
    }

    return () => unsubscribe();
  }, []);

  const toggleDarkMode = () => {
    if (isDarkMode) {
      document.body.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      setIsDarkMode(false);
    } else {
      document.body.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      setIsDarkMode(true);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutTimer > 0) {
      setAuthError(`Too many failed attempts. Please wait ${lockoutTimer} seconds before trying again.`);
      return;
    }
    setAuthError('');
    setLoginLoading(true);
    const cleanEmail = email.trim().toLowerCase();

    try {
      await signInWithEmailAndPassword(auth, cleanEmail, password);
      setLoginAttempts(0);
    } catch (err: any) {
      const nextAttempts = loginAttempts + 1;
      setLoginAttempts(nextAttempts);

      if (nextAttempts >= 5) {
        setLockoutTimer(30);
        setAuthError("Too many failed login attempts. Access temporarily locked for 30 seconds for security.");
      } else {
        const code = err.code || '';
        if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential' || code === 'auth/invalid-email') {
          setAuthError("Invalid email or password. Please verify your credentials and try again.");
        } else if (code === 'auth/too-many-requests') {
          setLockoutTimer(60);
          setAuthError("Unusual activity detected. Access temporarily restricted. Please reset your password or try again in a few minutes.");
        } else if (code === 'auth/user-disabled') {
          setAuthError("This user account has been deactivated. Please contact your system administrator.");
        } else if (code === 'auth/network-request-failed') {
          setAuthError("Network connection failed. Please check your internet connection.");
        } else {
          setAuthError("Sign in failed. Please verify your email and password.");
        }
      }
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  const timeToSec = (timeStr: string) => {
    if (!timeStr) return 0;
    const parts = timeStr.toString().split(':');
    if (parts.length === 2) return (parseInt(parts[0]) || 0) * 60 + (parseInt(parts[1]) || 0);
    return parseInt(parts[0]) || 0;
  };

  const secToTime = (secs: number) => {
    if (isNaN(secs) || secs === 0) return "";
    const m = Math.floor(secs / 60);
    const s = Math.round(secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const fetchData = async () => {
    if (!session || Object.keys(columnsMap).length === 0) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      const membersSnap = await getDocs(query(collection(db, 'team_members'), where('team', '==', selectedTeam)));
      const roster = membersSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      roster.sort((a, b) => (a.agent_name > b.agent_name ? 1 : -1));

      const metricsSnap = await getDocs(query(collection(db, tableName), where('team', '==', selectedTeam), where('year', '==', selectedYear)));
      const rosterNames = new Set(roster.map(d => d.agent_name));
      const allYearData = metricsSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter((d: any) => rosterNames.has(d.agent_name)) as any[];
      setYearMetrics(allYearData);
      
      let metrics = [...allYearData];
      if (isAggregate) {
        metrics = metrics.filter(m => aggregateMap[selectedMonth]?.includes(m.month));
      } else {
        metrics = metrics.filter(m => m.month === selectedMonth);
      }

      const teamCols = columnsMap[selectedTeam] || [];

      if (isAggregate) {
        const agentGroups: Record<string, any[]> = {};
        metrics.forEach(row => {
          if (!agentGroups[row.agent_name]) agentGroups[row.agent_name] = [];
          agentGroups[row.agent_name].push(row);
        });

        const aggregatedRows = roster.map(member => {
          const agentRows = agentGroups[member.agent_name] || [];
          const avgRow: any = { 
            _memberId: member.id, 
            agent_name: member.agent_name, 
            photo_url: member.photo_url || "", 
            display_name: member.display_name || member.agent_name, 
            _readonly: true 
          };

          teamCols.forEach(col => {
            const vals = agentRows.filter(r => r[col.id] && r[col.id].toString().trim() !== "");
            if (col.type === 'time') {
              const sumSecs = vals.reduce((acc, r) => acc + timeToSec(r[col.id]), 0);
              const resultSecs = col.aggregation === 'sum' ? sumSecs : (vals.length > 0 ? sumSecs / vals.length : 0);
              avgRow[col.id] = vals.length > 0 ? secToTime(resultSecs) : "";
            } else {
              const sum = vals.reduce((acc, r) => acc + (parseFloat(r[col.id]) || 0), 0);
              const result = col.aggregation === 'sum' ? sum : (vals.length > 0 ? sum / vals.length : 0);
              avgRow[col.id] = vals.length > 0 ? (Number.isInteger(result) ? result.toString() : result.toFixed(1)) : "";
            }
          });
          return avgRow;
        });
        setRows(aggregatedRows);
      } else {
        const metricsByAgent: Record<string, any> = {};
        metrics.forEach(row => { metricsByAgent[row.agent_name] = row; });

        const mergedRows = roster.map(member => {
          const existing = metricsByAgent[member.agent_name];
          if (existing) {
            return { 
              ...existing, 
              _memberId: member.id, 
              photo_url: member.photo_url || "", 
              display_name: member.display_name || member.agent_name 
            };
          }
          const empty: any = { 
            _memberId: member.id, 
            agent_name: member.agent_name, 
            photo_url: member.photo_url || "", 
            display_name: member.display_name || member.agent_name 
          };
          teamCols.forEach(col => empty[col.id] = "");
          return empty;
        });
        setRows(mergedRows);
      }
    } catch (err: any) {
      setErrorMsg(err.message);
      setRows([]);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [selectedMonth, selectedTeam, selectedYear, session, columnsMap]);

  const handleChange = (index: number, field: string, value: string) => {
    const newRows = [...rows];
    newRows[index][field] = value;
    setRows(newRows);
  };

  const handleBlur = async (index: number) => {
    if (isAggregate) return;
    const row = rows[index];
    if (!row.agent_name) return;

    try {
      const { _memberId, _readonly, ...cleanRow } = row;
      const payload = { ...cleanRow, team: selectedTeam, month: selectedMonth, year: selectedYear };

      if (row.id) {
        await updateDoc(doc(db, tableName, row.id), payload);
      } else {
        const docRef = await addDoc(collection(db, tableName), payload);
        const newRows = [...rows];
        newRows[index] = { ...payload, id: docRef.id, _memberId: row._memberId };
        setRows(newRows);
      }
    } catch (err: any) {
      setErrorMsg(`Failed to save: ${err.message}`);
    }
  };

  const openManageModal = () => {
    if (!isAdmin) return;
    setManageColsTeam('ALL');
    setNewMemberTeam(selectedTeam);
    fetchAllMembers();
    setShowManageMembers(true);
  };

  const handleAddMember = async () => {
    if (!newMemberName.trim()) return;
    const targetTeam = (userProfile?.role === 'tl' && userProfile?.team) ? userProfile.team : newMemberTeam;
    try {
      await addDoc(collection(db, 'team_members'), { agent_name: newMemberName.trim(), team: targetTeam });
      setNewMemberName("");
      fetchAllMembers();
      fetchData();
    } catch (err: any) {
      setErrorMsg(`Failed to add: ${err.message}`);
    }
  };

  const handleEditMemberStart = (member: any) => {
    setEditingMemberId(member.id);
    setEditMemberName(member.agent_name);
    setEditMemberTeam(member.team);
  };

  const handleSaveMember = async (id: string) => {
    const targetTeam = (userProfile?.role === 'tl' && userProfile?.team) ? userProfile.team : editMemberTeam;
    try {
      await updateDoc(doc(db, 'team_members', id), {
        agent_name: editMemberName.trim(),
        team: targetTeam
      });
      setEditingMemberId(null);
      fetchAllMembers();
      fetchData();
    } catch (err: any) {
      setErrorMsg(`Failed to save: ${err.message}`);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteDoc(doc(db, 'team_members', deleteTarget.memberId));
      
      const tName = deleteTarget.team === 'Younis Kamal Team' ? 'younis_metrics' :
                    deleteTarget.team === 'Ankido Buya Team' ? 'ankido_metrics' :
                    'mohammed_metrics';
      const q = query(collection(db, tName), where('agent_name', '==', deleteTarget.name));
      const snap = await getDocs(q);
      snap.forEach(d => deleteDoc(d.ref));
      
      fetchAllMembers();
      fetchData();
    } catch (err: any) {
      setErrorMsg(`Failed to remove: ${err.message}`);
    }
    setDeleteTarget(null);
  };

  const handleAddColumn = async () => {
    if (!newColLabel.trim()) return;
    const newId = newColLabel.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const newCol: ColumnConfig = { id: newId, label: newColLabel.trim(), type: newColType, aggregation: newColAgg };
    
    try {
      const targetTeams = manageColsTeam === 'ALL' ? TEAMS : [manageColsTeam as TeamName];
      const newMap = { ...columnsMap };
      for (const t of targetTeams) {
        const currentCols = newMap[t] || [];
        if (!currentCols.some(c => c.id === newId)) {
          const updatedCols = [...currentCols, newCol];
          newMap[t] = updatedCols;
          await setDoc(doc(db, 'columns_config', t), { columns: updatedCols }, { merge: true });
        }
      }
      setColumnsMap(newMap);
      setNewColLabel("");
    } catch (err: any) {
      setErrorMsg(`Failed to add column: ${err.message}`);
    }
  };

  const handleEditColumnStart = (col: ColumnConfig) => {
    setEditingColId(col.id);
    setEditColLabel(col.label);
    setEditColType(col.type);
    setEditColAgg(col.aggregation);
  };

  const handleSaveColumn = async () => {
    if (!editingColId || !editColLabel.trim()) return;
    try {
      const targetTeams = manageColsTeam === 'ALL' ? TEAMS : [manageColsTeam as TeamName];
      const newMap = { ...columnsMap };
      for (const t of targetTeams) {
        const currentCols = newMap[t] || [];
        const updatedCols = currentCols.map(c => 
          c.id === editingColId 
            ? { ...c, label: editColLabel.trim(), type: editColType, aggregation: editColAgg } 
            : c
        );
        newMap[t] = updatedCols;
        await setDoc(doc(db, 'columns_config', t), { columns: updatedCols }, { merge: true });
      }
      setColumnsMap(newMap);
      setEditingColId(null);
    } catch (err: any) {
      setErrorMsg(`Failed to edit column: ${err.message}`);
    }
  };

  const handleRemoveColumn = async (colId: string) => {
    try {
      const targetTeams = manageColsTeam === 'ALL' ? TEAMS : [manageColsTeam as TeamName];
      const newMap = { ...columnsMap };
      for (const t of targetTeams) {
        const currentCols = newMap[t] || [];
        const updatedCols = currentCols.filter(c => c.id !== colId);
        newMap[t] = updatedCols;
        await setDoc(doc(db, 'columns_config', t), { columns: updatedCols }, { merge: true });
      }
      setColumnsMap(newMap);
    } catch (err: any) {
      setErrorMsg(`Failed to remove column: ${err.message}`);
    }
  };

  const filteredRows = rows.filter(r =>
    r.agent_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const calcAvg = (col: ColumnConfig, teamRows: any[]) => {
    const validRows = teamRows.filter(r => r[col.id] && r[col.id].toString().trim() !== "");
    if (validRows.length === 0) return "-";

    if (col.type === 'time') {
      let totalSeconds = 0;
      validRows.forEach(r => {
        const parts = r[col.id].toString().split(':');
        if (parts.length === 2) totalSeconds += (parseInt(parts[0]) * 60) + parseInt(parts[1]);
        else totalSeconds += parseInt(parts[0]) || 0;
      });
      const resultSecs = col.aggregation === 'sum' ? totalSeconds : Math.round(totalSeconds / validRows.length);
      return `${Math.floor(resultSecs / 60)}:${(resultSecs % 60).toString().padStart(2, '0')}`;
    } else {
      const sum = validRows.reduce((acc, r) => acc + parseFloat(r[col.id] || 0), 0);
      const result = col.aggregation === 'sum' ? sum : sum / validRows.length;
      return Number.isInteger(result) ? result.toString() : result.toFixed(1);
    }
  };

  // Ensure selectedTeam is valid for TL
  useEffect(() => {
    if (userProfile?.role === 'tl' && userProfile?.team && selectedTeam !== userProfile.team) {
      setSelectedTeam(userProfile.team);
    }
  }, [userProfile, selectedTeam]);

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center transition-colors dark:bg-gray-900"><div className="text-gray-500 dark:text-gray-400 font-medium">Loading...</div></div>;
  }

  // Mandatory password change screen for TL / Manager / Agent who haven't set their personal password yet
  // Mohammed Dlshad (Admin) is EXEMPT — passwordUpdated is always true for him
  if (session && userProfile && userProfile.passwordUpdated !== true && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 transition-colors bg-[#F4F7F5] dark:bg-[#07130F] relative overflow-hidden font-sans">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-emerald-400/20 dark:bg-emerald-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-[#1C6B53]/25 dark:bg-[#1C6B53]/20 rounded-full blur-3xl pointer-events-none" />

        <div className="w-full max-w-[440px] bg-white/90 dark:bg-gray-900/90 backdrop-blur-2xl rounded-[2.5rem] shadow-[0_20px_50px_-10px_rgba(28,107,83,0.12)] dark:shadow-[0_20px_50px_-10px_rgba(0,0,0,0.7)] border border-white/80 dark:border-emerald-500/20 p-7 sm:p-9 relative z-10">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-[#1C6B53]/10 dark:bg-emerald-950 flex items-center justify-center text-[#1C6B53] dark:text-emerald-400 mb-4 shadow-inner">
              <ShieldCheck size={32} />
            </div>
            <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">
              Security: Set Your Password
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 leading-relaxed max-w-xs">
              Welcome, <strong className="text-gray-800 dark:text-gray-200">{userProfile?.name || userProfile?.email}</strong>! For your account security, you must set a personal password before accessing the dashboard.
            </p>
          </div>

          {tlPasswordError && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs font-semibold rounded-xl">
              {tlPasswordError}
            </div>
          )}

          <form onSubmit={handleTLPasswordChange} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5 text-gray-500 dark:text-gray-400">
                New Password
              </label>
              <input
                type="password"
                required
                placeholder="Min. 8 characters with uppercase & number"
                value={tlNewPassword}
                onChange={(e) => setTlNewPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50/70 dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:border-[#1C6B53] text-sm font-medium"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5 text-gray-500 dark:text-gray-400">
                Confirm New Password
              </label>
              <input
                type="password"
                required
                placeholder="Re-enter new password"
                value={tlConfirmPassword}
                onChange={(e) => setTlConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50/70 dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:border-[#1C6B53] text-sm font-medium"
              />
            </div>

            {/* Password Requirements Checklist */}
            <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/80 border border-gray-200/60 dark:border-gray-700/60 space-y-1 text-[11px] text-gray-500 dark:text-gray-400">
              <p className="font-bold text-gray-700 dark:text-gray-300 mb-1">Security Requirements:</p>
              <div className="flex items-center gap-1.5">
                <span className={tlNewPassword.length >= 8 ? "text-emerald-500 font-bold" : "text-gray-400"}>•</span>
                <span>Minimum 8 characters</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={/[A-Z]/.test(tlNewPassword) && /[a-z]/.test(tlNewPassword) ? "text-emerald-500 font-bold" : "text-gray-400"}>•</span>
                <span>Uppercase & lowercase letters</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={/[0-9]/.test(tlNewPassword) || /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(tlNewPassword) ? "text-emerald-500 font-bold" : "text-gray-400"}>•</span>
                <span>At least one number or special character</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={tlPasswordLoading}
              className="w-full py-3.5 mt-2 rounded-xl text-sm font-bold text-white bg-[#1C6B53] hover:bg-[#155a45] shadow-lg shadow-[#1C6B53]/25 transition-all active:scale-[0.99] disabled:opacity-60 flex items-center justify-center gap-2"
            >
              <ShieldCheck size={16} />
              {tlPasswordLoading ? 'Saving...' : 'Set Password & Access Dashboard'}
            </button>

            <div className="pt-1 text-center">
              <button
                type="button"
                onClick={handleLogout}
                className="text-xs text-gray-400 hover:text-red-500 font-semibold transition"
              >
                Cancel and Sign Out
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

    if (!session) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 transition-colors bg-[#F4F7F5] dark:bg-[#07130F] relative overflow-hidden font-sans">
          {/* Ambient glowing radial orbs */}
          <div className="absolute -top-32 -left-32 w-96 h-96 bg-emerald-400/20 dark:bg-emerald-600/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-[#1C6B53]/25 dark:bg-[#1C6B53]/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-emerald-500/10 dark:bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none" />

          <div className="w-full max-w-[440px] p-8 sm:p-10 bg-white/90 dark:bg-gray-900/90 backdrop-blur-2xl rounded-[2.5rem] shadow-[0_20px_50px_-10px_rgba(28,107,83,0.12)] dark:shadow-[0_20px_50px_-10px_rgba(0,0,0,0.7)] border border-white/80 dark:border-emerald-500/20 relative z-10">
            {/* Top Bar with Dark Mode Toggle */}
            <div className="flex justify-end items-center mb-6">
              <button 
                onClick={toggleDarkMode} 
                className="w-10 h-10 rounded-2xl bg-gray-100/80 dark:bg-gray-800/80 hover:bg-gray-200/80 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-all flex items-center justify-center border border-gray-200/50 dark:border-gray-700/50 shadow-sm"
                title="Toggle Dark Mode"
              >
                {isDarkMode ? <Sun size={17} className="text-amber-400" /> : <Moon size={17} />}
              </button>
            </div>
            
            {/* Logo & Heading */}
            <div className="flex flex-col items-center text-center mb-8">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/40 dark:to-gray-800 p-2.5 flex items-center justify-center border border-emerald-100/80 dark:border-emerald-900/50 shadow-sm mb-4">
                <img src="/logo.webp" alt="FIB Logo" className="w-full h-full object-contain drop-shadow-sm" />
              </div>
              <h2 className="text-xl sm:text-[22px] font-bold tracking-tight text-gray-900 dark:text-white leading-snug">
                Team Leader & Agent Dashboard
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 font-medium">
                Welcome back. Please sign in to access your scorecards.
              </p>
            </div>
            
            {authError && (
              <div className="mb-5 p-3.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs font-semibold rounded-2xl flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                <span>{authError}</span>
              </div>
            )}
            
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5 ml-1">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                    <Mail size={16} />
                  </div>
                  <input 
                    type="email" 
                    required 
                    value={email} 
                    onChange={e => setEmail(e.target.value)} 
                    className="w-full pl-10 pr-4 py-3.5 bg-gray-50/80 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-2xl focus:outline-none transition-all text-gray-900 dark:text-white focus:bg-white dark:focus:bg-gray-800 focus:border-[#1C6B53] dark:focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 text-sm font-medium placeholder:text-gray-400" 
                    placeholder="name@agent.com" 
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5 ml-1">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Password
                  </label>
                  <button 
                    type="button" 
                    onClick={() => { 
                      setForgotEmail(email); 
                      setForgotError(''); 
                      setForgotSuccess(''); 
                      setShowForgotModal(true); 
                    }} 
                    className="text-xs font-semibold text-[#1C6B53] dark:text-emerald-400 hover:underline transition"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                    <Lock size={16} />
                  </div>
                  <input 
                    type={showPassword ? "text" : "password"} 
                    required 
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    className="w-full pl-10 pr-11 py-3.5 bg-gray-50/80 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-2xl focus:outline-none transition-all text-gray-900 dark:text-white focus:bg-white dark:focus:bg-gray-800 focus:border-[#1C6B53] dark:focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 text-sm font-medium placeholder:text-gray-400" 
                    placeholder="••••••••" 
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {loginAttempts >= 3 && loginAttempts < 5 && lockoutTimer === 0 && (
                <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/80 text-amber-800 dark:text-amber-300 text-xs font-semibold text-center">
                  ⚠️ {5 - loginAttempts} attempt(s) remaining before temporary account lockout.
                </div>
              )}

              <button 
                type="submit" 
                disabled={loginLoading || lockoutTimer > 0}
                className="w-full py-4 rounded-2xl text-sm font-black text-white transition-all mt-6 bg-gradient-to-r from-[#1C6B53] via-[#165a46] to-[#0F3A2E] hover:from-[#155a45] hover:to-[#0D2D24] shadow-lg shadow-[#1C6B53]/25 hover:shadow-xl hover:shadow-[#1C6B53]/35 active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <span>
                  {lockoutTimer > 0 
                    ? `Locked (${lockoutTimer}s)` 
                    : (loginLoading ? 'Signing In...' : 'Sign In')}
                </span>
                <ArrowRight size={16} />
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-800/80 flex items-center justify-center gap-2 text-gray-400 dark:text-gray-500 text-[11px] font-medium">
              <ShieldCheck size={14} className="text-[#1C6B53] dark:text-emerald-400" />
              <span>Protected By FIB Enterprise Security</span>
            </div>
          </div>

          {/* Forgot Password Modal */}
          {showForgotModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
              <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl p-7 max-w-md w-full border border-gray-100 dark:border-gray-800 relative">
                <div className="flex justify-between items-start mb-5">
                  <div>
                    <h3 className="text-xl font-black text-gray-900 dark:text-white">Forgot Password</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Enter your email to receive a password reset link.</p>
                  </div>
                  <button onClick={() => setShowForgotModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1">
                    <X size={20} />
                  </button>
                </div>

                {forgotError && (
                  <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs font-semibold rounded-xl">
                    {forgotError}
                  </div>
                )}

                {forgotSuccess && (
                  <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 text-[#1C6B53] dark:text-emerald-400 text-xs font-semibold rounded-xl leading-relaxed">
                    {forgotSuccess}
                  </div>
                )}

                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5 text-gray-500 dark:text-gray-400">
                      Email Address
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="name@agent.com"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50/70 dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:border-[#1C6B53] text-sm font-medium"
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowForgotModal(false)}
                      className="flex-1 py-3 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={forgotLoading}
                      className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-[#1C6B53] hover:bg-[#155a45] transition shadow-md shadow-[#1C6B53]/20 disabled:opacity-50"
                    >
                      {forgotLoading ? 'Sending...' : 'Send Reset Link'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      );
    }

    if (userProfile?.role === 'agent') {
      return (
        <AgentDashboard 
          userProfile={userProfile} 
          onLogout={handleLogout} 
          columnsMap={columnsMap} 
          isDarkMode={isDarkMode}
          toggleDarkMode={toggleDarkMode}
        />
      );
    }

    if (showAgentPreview) {
      return (
        <AgentDashboard 
          userProfile={userProfile} 
          onLogout={handleLogout} 
          columnsMap={columnsMap} 
          previewMode={true} 
          allMembers={allMembers} 
          onExitPreview={() => setShowAgentPreview(false)} 
          isDarkMode={isDarkMode}
          toggleDarkMode={toggleDarkMode}
        />
      );
    }

    const activeTeams = userProfile?.role === 'tl' && userProfile?.team 
      ? TEAMS.filter(t => t === userProfile.team) 
      : TEAMS;

    const displayedMembers = userProfile?.role === 'tl' && userProfile?.team
      ? allMembers.filter(m => m.team === userProfile.team)
      : allMembers;

    const activeCols = columnsMap[selectedTeam] || [];
    const manageCols = manageColsTeam === 'ALL'
      ? (columnsMap['Ankido Buya Team'] || columnsMap['Younis Kamal Team'] || columnsMap[selectedTeam] || [])
      : (columnsMap[manageColsTeam] || []);

    const handleCellKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, rowIndex: number, colIndex: number) => {
      if (isAggregate) return;

      let targetRow = rowIndex;
      let targetCol = colIndex;

      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        e.preventDefault();
        targetRow = Math.min(filteredRows.length - 1, rowIndex + 1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        targetRow = Math.max(0, rowIndex - 1);
      } else if (e.key === 'ArrowRight') {
        const input = e.currentTarget;
        if (input.selectionStart === input.selectionEnd && input.selectionStart === input.value.length) {
          if (colIndex < activeCols.length - 1) {
            e.preventDefault();
            targetCol = colIndex + 1;
          }
        }
      } else if (e.key === 'ArrowLeft') {
        const input = e.currentTarget;
        if (input.selectionStart === input.selectionEnd && input.selectionStart === 0) {
          if (colIndex > 0) {
            e.preventDefault();
            targetCol = colIndex - 1;
          }
        }
      } else {
        return;
      }

      if (targetRow !== rowIndex || targetCol !== colIndex) {
        const targetElement = document.getElementById(`cell-${targetRow}-${targetCol}`) as HTMLInputElement | null;
        if (targetElement) {
          targetElement.focus();
          targetElement.select();
        }
      }
    };

    return (
      <div className="min-h-screen p-3.5 sm:p-6 md:p-10 font-sans transition-colors dark:bg-gray-900 dark:text-gray-100">
        <div className="max-w-[1400px] mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center w-full mb-6 sm:mb-8 gap-3 sm:gap-4 pb-4 sm:pb-6 border-b border-gray-200/60 dark:border-gray-800">
            <div className="flex items-center gap-3 sm:gap-5 w-full sm:w-auto justify-between sm:justify-start">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <img src="/logo.webp" alt="FIB Logo" className="h-9 sm:h-12 w-auto object-contain" />
                <div className="h-8 sm:h-10 w-[1.5px] bg-gray-200 dark:bg-gray-700" />
                <div>
                  <h1 className="text-lg sm:text-2xl font-black tracking-tight text-gray-900 dark:text-white leading-none">
                    {isAdmin ? 'Administrator Dashboard' : isManager ? 'Manager Dashboard' : 'Team Leader Dashboard'}
                  </h1>
                  <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">
                    {isAdmin ? 'System Administration & Performance Analytics' : isManager ? 'Executive Oversight & Analytics' : 'Performance & Quality Analytics'}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-1 sm:gap-1.5 p-1.5 bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl border border-gray-200/80 dark:border-gray-700/80 rounded-2xl shadow-sm flex-wrap w-full sm:w-auto justify-between sm:justify-end">
              {/* Dark Mode Toggle */}
              <button 
                onClick={toggleDarkMode} 
                className="w-8 sm:w-9 h-8 sm:h-9 rounded-xl flex items-center justify-center text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700/60 transition-colors"
                title="Toggle Dark Mode"
              >
                {isDarkMode ? <Sun size={16} className="text-amber-500" /> : <Moon size={16} />}
              </button>

              {/* Agent View Button (For Managers: Mohammed Dlshad & Jalal Burghol) */}
              {isManager && (
                <>
                  <div className="h-4 w-px bg-gray-200 dark:bg-gray-700/80 mx-0.5" />
                  <button
                    onClick={() => setShowAgentPreview(true)}
                    className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-200 hover:text-[#1C6B53] dark:hover:text-emerald-300 hover:bg-emerald-50/80 dark:hover:bg-emerald-950/40 transition-all group"
                    title="Agent View"
                  >
                    <div className="w-5 h-5 rounded-lg bg-[#1C6B53]/10 dark:bg-emerald-400/10 flex items-center justify-center text-[#1C6B53] dark:text-emerald-400 group-hover:scale-110 transition-transform">
                      <LayoutDashboard size={13} />
                    </div>
                    <span className="hidden xs:inline sm:inline">Agent View</span>
                  </button>
                </>
              )}

              {/* Manage Team / System Config (ONLY FOR ADMIN: Mohammed Dlshad) */}
              {isAdmin && (
                <>
                  <div className="h-4 w-px bg-gray-200 dark:bg-gray-700/80 mx-0.5" />
                  <button
                    onClick={openManageModal}
                    className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-200 hover:text-[#1C6B53] dark:hover:text-emerald-300 hover:bg-emerald-50/80 dark:hover:bg-emerald-950/40 transition-all group"
                    title="System Configuration"
                  >
                    <div className="w-5 h-5 rounded-lg bg-[#1C6B53]/10 dark:bg-emerald-400/10 flex items-center justify-center text-[#1C6B53] dark:text-emerald-400 group-hover:scale-110 transition-transform">
                      <Settings size={13} />
                    </div>
                    <span className="hidden xs:inline sm:inline">Config</span>
                  </button>
                </>
              )}

              <div className="h-4 w-px bg-gray-200 dark:bg-gray-700/80 mx-0.5" />

              {/* Profile Button */}
              <button 
                onClick={openProfileModal}
                className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-100/80 dark:hover:bg-gray-700/60 transition-all group"
                title="Profile Settings"
              >
                <div className="w-6 sm:w-7 h-6 sm:h-7 rounded-full bg-gradient-to-tr from-[#1C6B53] to-emerald-400 flex items-center justify-center overflow-hidden ring-2 ring-[#1C6B53]/20 dark:ring-emerald-400/20 text-white font-black text-xs shadow-sm flex-shrink-0">
                  {userProfile?.photo_url ? (
                    <img src={userProfile.photo_url} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    userProfile?.name ? userProfile.name.charAt(0).toUpperCase() : <Users size={12} />
                  )}
                </div>
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="max-w-[70px] sm:max-w-[120px] truncate group-hover:text-[#1C6B53] dark:group-hover:text-emerald-400 transition-colors">
                    {userProfile?.name || (isAdmin ? 'Mohammed Dlshad' : (isManager ? 'Jalal Burghol' : 'Team Lead'))}
                  </span>
                  <span className={`text-[8px] sm:text-[9px] font-black px-1.5 py-0.5 rounded-md border uppercase tracking-wider ${
                    isAdmin 
                      ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700/60' 
                      : isManager 
                      ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-700/60'
                      : 'bg-emerald-50 dark:bg-emerald-950/60 text-[#1C6B53] dark:text-emerald-400 border-emerald-300 dark:border-emerald-700/60'
                  }`}>
                    {isAdmin ? 'Admin' : isManager ? 'Manager' : 'TL'}
                  </span>
                </div>
              </button>

              <div className="h-4 w-px bg-gray-200 dark:bg-gray-700/80 mx-0.5" />

              {/* Logout Button */}
              <button 
                onClick={handleLogout} 
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-xs font-bold text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50/80 dark:hover:bg-red-950/40 transition-all"
                title="Logout"
              >
                <LogOut size={14} />
                <span className="hidden xs:inline sm:inline">Logout</span>
              </button>
            </div>
          </div>

        {/* Team Cards */}
        {activeTeams.length === 1 ? (
          <div className="mb-6 sm:mb-8 bg-gradient-to-br from-[#1C6B53] via-[#165a46] to-[#104334] text-white rounded-2xl sm:rounded-3xl p-4 sm:p-8 shadow-xl shadow-[#1C6B53]/15 border border-emerald-500/30 relative overflow-hidden">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 mb-4 sm:mb-6 pb-3 sm:pb-4 border-b border-white/10">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-10 sm:w-12 h-10 sm:h-12 rounded-xl sm:rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner shrink-0">
                  <Users size={20} className="text-emerald-200 sm:w-6 sm:h-6" />
                </div>
                <div>
                  <h2 className="text-lg sm:text-2xl font-black tracking-tight text-white">
                    {activeTeams[0]}
                  </h2>
                  <p className="text-[11px] sm:text-xs text-emerald-100/80 mt-0.5 sm:mt-1 font-medium">
                    {selectedYear} Annual Team Performance Summary • {rows.length} Active Agents
                  </p>
                </div>
              </div>
            </div>

            {/* Metrics Grid (Permanent Full Year Data) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 sm:gap-3">
              {(columnsMap[activeTeams[0]] || []).map((col) => {
                const annualVal = calcYearTeamStat(col);
                return (
                  <div key={col.id} className="bg-white/10 dark:bg-black/25 backdrop-blur-md rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 border border-white/10 flex flex-col justify-between hover:bg-white/15 transition shadow-sm">
                    <div className="text-[10px] sm:text-[11px] font-bold tracking-wide text-emerald-100/90 truncate mb-1.5 sm:mb-2" title={col.label}>
                      {toTitleCase(col.label)}
                    </div>
                    <div className="text-lg sm:text-2xl font-black text-white tracking-tight leading-none">
                      {annualVal}
                    </div>
                    <div className="text-[9px] sm:text-[10px] text-emerald-300/70 font-medium mt-1">
                      {toTitleCase(col.aggregation)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-6 mb-6 sm:mb-8">
            {activeTeams.map((teamName) => {
              const isActive = selectedTeam === teamName;
              const teamCols = columnsMap[teamName] || [];
              return (
                <button
                  key={teamName}
                  onClick={() => setSelectedTeam(teamName)}
                  className={`text-left p-4 sm:p-6 rounded-2xl sm:rounded-3xl shadow-sm flex flex-col justify-between transition-all border cursor-pointer relative overflow-hidden
                    ${isActive 
                      ? 'bg-gradient-to-br from-[#1C6B53] to-[#155a45] text-white border-transparent shadow-lg shadow-[#1C6B53]/20 ring-2 ring-[#1C6B53]/50 scale-[1.01]' 
                      : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 border-gray-200/80 dark:border-gray-700/80 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-md'}`}
                >
                  <div className="flex justify-between items-start w-full mb-3 sm:mb-4">
                    <div>
                      <span className={`text-[10px] font-bold tracking-widest block mb-0.5 sm:mb-1 ${isActive ? 'text-emerald-200' : 'text-gray-400'}`}>
                        Team Performance
                      </span>
                      <h2 className="text-base sm:text-lg font-bold tracking-tight">
                        {teamName}
                      </h2>
                    </div>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${isActive ? 'bg-white/20 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}>
                      {isActive ? 'Selected' : 'Select'}
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-1.5 sm:gap-2 w-full mt-2">
                    {teamCols.slice(0, 8).map(col => (
                      <div key={col.id} className={`p-1.5 sm:p-2 rounded-xl text-center border ${isActive ? 'bg-white/10 border-white/10' : 'bg-gray-50 dark:bg-gray-700/50 border-gray-100 dark:border-gray-700'}`}>
                        <div className={`text-[9px] font-bold truncate ${isActive ? 'text-emerald-100/80' : 'text-gray-400'}`} title={col.label}>
                          {toTitleCase(col.label)}
                        </div>
                        <div className="font-extrabold text-xs sm:text-sm mt-0.5">
                          {isActive ? calcYearTeamStat(col) : '-'}
                        </div>
                      </div>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Month Tabs & Controls Bar */}
        <div className="flex items-center gap-1.5 sm:gap-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md p-1.5 sm:p-2 rounded-2xl border border-gray-200/80 dark:border-gray-700/80 w-full overflow-x-auto scrollbar-hide shadow-sm mb-4 sm:mb-5">
          {/* Year selector */}
          <div className="relative flex-shrink-0">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="appearance-none pl-3 pr-7 py-1.5 rounded-xl text-xs font-bold bg-[#1C6B53] text-white shadow-sm outline-none cursor-pointer border-0"
            >
              <option value="2026">2026</option>
              <option value="2027">2027</option>
              <option value="2028">2028</option>
              <option value="2029">2029</option>
              <option value="2030">2030</option>
            </select>
            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-white/80" />
          </div>

          {/* Search Agent Input & Count next to Year */}
          <div className="relative flex-shrink-0">
            <Search size={12} className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-7 pr-2.5 py-1.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50/80 dark:bg-gray-900/60 focus:outline-none focus:border-[#1C6B53] dark:focus:border-emerald-500 text-xs w-28 sm:w-44 transition dark:text-gray-200 font-medium"
            />
          </div>
          <span className="text-gray-500 dark:text-gray-400 text-[11px] sm:text-xs font-semibold whitespace-nowrap px-1 flex-shrink-0">
            {filteredRows.length} Agents
          </span>

          {/* Separator */}
          <div className="h-5 w-[1.5px] bg-gray-300 dark:bg-gray-600 mx-0.5 sm:mx-1 flex-shrink-0" />

          {/* Months (Jan - Dec) */}
          {months.map(m => {
            const displayLabel = m.charAt(0) + m.slice(1).toLowerCase();
            const isSel = selectedMonth === m;
            return (
              <button
                key={m}
                onClick={() => setSelectedMonth(m)}
                className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition flex-shrink-0 ${
                  isSel
                    ? 'bg-[#1C6B53] text-white shadow-md shadow-[#1C6B53]/25'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700/60'
                }`}
              >
                {displayLabel}
              </button>
            );
          })}

          {/* Separator */}
          <div className="h-5 w-[1.5px] bg-gray-300 dark:bg-gray-600 mx-0.5 sm:mx-1 flex-shrink-0" />

          {/* Quarters & Halves */}
          {periods.map(p => {
            const isSel = selectedMonth === p;
            return (
              <button
                key={p}
                onClick={() => setSelectedMonth(p)}
                className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-extrabold transition flex-shrink-0 ${
                  isSel
                    ? 'bg-[#00A991] text-white shadow-md shadow-[#00A991]/30'
                    : 'text-emerald-700 dark:text-emerald-400 bg-emerald-50/70 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/40'
                }`}
              >
                {p}
              </button>
            );
          })}
        </div>

        {/* Mobile Swipe Hint */}
        <div className="flex sm:hidden items-center justify-between text-[11px] text-gray-400 dark:text-gray-500 mb-2 px-1 font-medium">
          <span>👈 Swipe horizontally to view all KPI columns 👉</span>
          <span>{activeCols.length} KPIs</span>
        </div>

        {/* Data Table */}
        <div className="bg-[#F9F8F4] dark:bg-gray-900 border border-gray-200/80 dark:border-gray-700/80 rounded-2xl shadow-sm overflow-x-auto scrollbar-hide">
          {errorMsg && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm border-b border-red-100 dark:border-red-800">
              {errorMsg}
              <button onClick={() => setErrorMsg(null)} className="ml-4 underline text-red-400 dark:text-red-300">dismiss</button>
            </div>
          )}

          <div className="min-w-[1000px] sm:min-w-[1150px]">
            {/* Table Header */}
            <div className="grid gap-2 px-3 sm:px-5 py-3.5 bg-gray-50/95 dark:bg-gray-800/95 backdrop-blur-md text-xs font-bold border-b border-gray-200/80 dark:border-gray-700/80 items-center"
                 style={{ gridTemplateColumns: `minmax(180px, 2.2fr) repeat(${activeCols.length}, minmax(105px, 1fr))` }}>
              <div className="pl-2 sticky left-0 bg-gray-50/95 dark:bg-gray-800/95 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)] text-[11px] sm:text-xs font-extrabold text-gray-600 dark:text-gray-300">
                Agent
              </div>
              {activeCols.map(col => (
                <div key={col.id} className="text-center font-extrabold text-[11px] sm:text-xs text-gray-600 dark:text-gray-300 px-1 truncate" title={toTitleCase(col.label)}>
                  {toTitleCase(col.label)}
                </div>
              ))}
            </div>

            {/* Table Body */}
            <div className="divide-y divide-gray-100 dark:divide-gray-800/70 bg-[#FDFCFB] dark:bg-gray-900">
              {loading ? (
                <div className="p-8 text-center text-sm text-gray-400 dark:text-gray-500">Loading data...</div>
              ) : filteredRows.length === 0 ? (
                <div className="p-8 text-center text-sm text-gray-400 dark:text-gray-500">No team members found. Click "Manage Agents" to add members.</div>
              ) : (
                filteredRows.map((row, index) => {
                  const actualIndex = rows.findIndex(r => r === row);
                  const disabled = isAggregate || !!row._readonly;

                  return (
                    <div key={row._memberId || index} className="grid gap-2 px-3 sm:px-5 py-2.5 sm:py-3 items-center hover:bg-emerald-50/40 dark:hover:bg-gray-800/60 transition-all duration-150 group"
                         style={{ gridTemplateColumns: `minmax(180px, 2.2fr) repeat(${activeCols.length}, minmax(105px, 1fr))` }}>
                      
                      <div className="pl-2 text-xs sm:text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2.5 sm:gap-3 sticky left-0 bg-[#FDFCFB] dark:bg-gray-900 group-hover:bg-[#f6fbf9] dark:group-hover:bg-gray-850 z-10 pr-3 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)]">
                        {row.photo_url ? (
                          <img src={row.photo_url} alt={row.agent_name} className="w-8 h-8 rounded-full object-cover shadow-xs border border-emerald-500/20 flex-shrink-0 ring-2 ring-emerald-500/10" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#1C6B53]/20 to-emerald-100 dark:from-[#1C6B53]/40 dark:to-emerald-950 text-[#1C6B53] dark:text-emerald-300 font-black text-xs flex items-center justify-center shadow-xs border border-emerald-500/20 flex-shrink-0 ring-1 ring-emerald-500/10">
                            {row.agent_name ? row.agent_name.charAt(0).toUpperCase() : <Users size={12} />}
                          </div>
                        )}
                        <span className="font-bold truncate max-w-[120px] sm:max-w-none text-gray-800 dark:text-gray-100">{row.display_name || row.agent_name}</span>
                      </div>
                      {activeCols.map((col, colIndex) => (
                        <div key={col.id} className="flex items-center justify-center px-1">
                          <input 
                            id={`cell-${index}-${colIndex}`}
                            disabled={disabled}
                            type="text"
                            placeholder={col.type === 'time' ? 'm:ss' : (col.aggregation === 'average' ? '%' : '#')}
                            value={row[col.id] || ''}
                            onChange={(e) => handleChange(actualIndex, col.id, e.target.value)}
                            onBlur={() => handleBlur(actualIndex)}
                            onKeyDown={(e) => handleCellKeyDown(e, index, colIndex)}
                            className="w-full max-w-[85px] sm:max-w-[100px] text-center bg-white dark:bg-gray-800/90 border border-gray-200 dark:border-gray-700/80 rounded-xl px-2.5 py-1.5 text-xs sm:text-[13px] font-bold text-gray-800 dark:text-gray-100 placeholder:text-gray-300 dark:placeholder:text-gray-600 placeholder:font-medium placeholder:text-[11px] focus:border-[#1C6B53] dark:focus:border-emerald-500 focus:bg-white dark:focus:bg-gray-800 focus:ring-2 focus:ring-[#1C6B53]/20 outline-none transition-all shadow-xs tabular-nums disabled:bg-gray-100/60 dark:disabled:bg-gray-800/40 disabled:border-transparent disabled:text-gray-500 dark:disabled:text-gray-400 cursor-text"
                          />
                        </div>
                      ))}
                    </div>
                  );
                })
              )}
            </div>

            {/* Team Average Row */}
            {!loading && (
               <div className="grid gap-2 px-3 sm:px-5 py-3 sm:py-3.5 bg-emerald-50/50 dark:bg-emerald-950/25 border-t-2 border-emerald-500/20 dark:border-emerald-500/30 items-center font-bold"
                    style={{ gridTemplateColumns: `minmax(180px, 2.2fr) repeat(${activeCols.length}, minmax(105px, 1fr))` }}>
                 <div className="text-xs font-black text-gray-800 dark:text-gray-200 pl-2 sticky left-0 bg-[#F4F9F6] dark:bg-gray-850 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)] flex items-center gap-2">
                   <span className="w-2 h-2 rounded-full bg-[#1C6B53] dark:bg-emerald-400" />
                   <span>Team Average</span>
                 </div>
                 {activeCols.map(col => (
                   <div key={col.id} className="text-center text-xs sm:text-[13px] font-black text-[#1C6B53] dark:text-emerald-400 tabular-nums px-1">
                     {calcAvg(col, rows)}
                   </div>
                 ))}
               </div>
            )}
          </div>
        </div>
        <div className="mt-4 text-[10px] text-gray-400 dark:text-gray-500 font-medium">
          Agent names are fixed from the roster. Use "System Config" to edit members or columns. Data auto-saves when you click out of a field.
        </div>
      </div>

      {/* Manage Settings Modal (System Configuration) */}
      {showManageMembers && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-3 sm:p-4 pt-6 sm:pt-10 overflow-y-auto overscroll-contain">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowManageMembers(false)} />
          <div className="relative bg-[#F9F8F4] dark:bg-gray-900 rounded-2xl sm:rounded-3xl shadow-2xl p-4 sm:p-8 w-full border border-transparent dark:border-gray-700 mb-10 transition-all overscroll-contain max-w-5xl">
            
            <div className="flex justify-between items-start mb-4 sm:mb-6">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                  System Configuration
                </h2>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5 sm:mt-1">
                  Add or remove agents and table columns across the system.
                </p>
              </div>
              <button onClick={() => setShowManageMembers(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1">
                 <X size={22} />
              </button>
            </div>

            <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2">
              
              {/* Agents Card */}
              <div className="bg-[#F1EFE8] dark:bg-gray-800/50 rounded-2xl p-4 sm:p-6 flex flex-col h-[460px] sm:h-[550px] border border-gray-200 dark:border-gray-700 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Users size={18} className="text-gray-600 dark:text-gray-300" />
                    <h3 className="font-bold text-gray-800 dark:text-gray-100 text-sm sm:text-base">
                      {userProfile?.role === 'tl' ? `${userProfile?.team?.replace(' Team', '') || 'My Team'} Agents` : 'Agents'}
                    </h3>
                  </div>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                    {displayedMembers.length} Agents
                  </span>
                </div>

                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    placeholder="New agent name"
                    value={newMemberName}
                    onChange={(e) => setNewMemberName(e.target.value)}
                    className="flex-1 px-3 py-2 text-xs sm:text-sm border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 outline-none focus:border-[#1C6B53] font-medium"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddMember()}
                  />
                </div>

                {(isAdmin || userProfile?.role === 'manager' || userProfile?.role === 'admin') && (
                  <div className="relative mb-3">
                     <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                       <Briefcase size={14} className="text-white" />
                     </div>
                     <select
                       value={newMemberTeam}
                       onChange={(e) => setNewMemberTeam(e.target.value as TeamName)}
                       className="w-full pl-9 pr-8 py-2.5 bg-[#1C6B53] text-white text-xs sm:text-sm font-medium rounded-xl appearance-none cursor-pointer outline-none"
                     >
                       {activeTeams.map(t => <option key={t} value={t} className="bg-white text-gray-800">{t}</option>)}
                     </select>
                     <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                       <ChevronDown size={14} className="text-white" />
                     </div>
                  </div>
                )}

                <button
                  onClick={handleAddMember}
                  className="w-full bg-[#1C6B53] hover:bg-[#155a45] text-white py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold transition shadow-sm mb-4 sm:mb-5 flex items-center justify-center gap-2"
                >
                  <UserPlus size={16}/> Add Agent
                </button>

                <div className="flex-1 overflow-y-auto overscroll-contain flex flex-col gap-2 pr-1">
                  {displayedMembers.length === 0 && <div className="text-xs text-gray-400 text-center mt-6">No agents found in this team.</div>}
                  {displayedMembers.map((member) => (
                    <div key={member.id} className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-2.5 sm:p-3 flex justify-between items-center shadow-sm">
                      
                      {editingMemberId === member.id ? (
                        <div className="flex-1 flex gap-2 items-center">
                          <input 
                            type="text" 
                            value={editMemberName} 
                            onChange={(e) => setEditMemberName(e.target.value)} 
                            className="flex-1 px-2 py-1 text-xs sm:text-sm border rounded outline-none focus:border-[#1C6B53] dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                          />
                          {(isAdmin || userProfile?.role === 'manager' || userProfile?.role === 'admin') && (
                            <select 
                              value={editMemberTeam} 
                              onChange={(e: any) => setEditMemberTeam(e.target.value)} 
                              className="w-28 sm:w-32 px-1.5 py-1 text-[10px] border rounded outline-none focus:border-[#1C6B53] dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            >
                              {activeTeams.map(t => <option key={t} value={t}>{t.replace(' Team', '')}</option>)}
                            </select>
                          )}
                          <button onClick={() => handleSaveMember(member.id)} className="text-[#1C6B53] hover:text-emerald-700 p-1">
                            <Save size={14}/>
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-200 truncate max-w-[130px] sm:max-w-none">{member.agent_name}</span>
                          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                            <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md uppercase tracking-wider whitespace-nowrap">
                              {member.team.replace(' Team', '')}
                            </span>
                            <div className="flex gap-1.5 sm:gap-2">
                              <button onClick={() => handleEditMemberStart(member)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition" title="Edit">
                                <Edit2 size={13} />
                              </button>
                              <button onClick={() => setDeleteTarget({ memberId: member.id, name: member.agent_name, team: member.team })} className="text-red-400 hover:text-red-600 transition" title="Delete">
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Columns Card - Admin Only */}
              <div className="bg-[#F1EFE8] dark:bg-gray-800/50 rounded-2xl p-4 sm:p-6 flex flex-col h-[460px] sm:h-[550px] border border-gray-200 dark:border-gray-700 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Columns size={18} className="text-gray-600 dark:text-gray-300" />
                    <h3 className="font-bold text-gray-800 dark:text-gray-100 text-sm sm:text-base">Table Columns & KPIs</h3>
                  </div>
                  <div className="relative">
                    <select 
                      value={manageColsTeam} 
                      onChange={(e: any) => setManageColsTeam(e.target.value)}
                      className="appearance-none pl-2.5 pr-7 py-1 text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-800 dark:text-gray-200 outline-none focus:border-[#1C6B53] font-semibold cursor-pointer shadow-xs"
                    >
                      <option value="ALL">🌐 All Teams</option>
                      {activeTeams.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
                  </div>
                </div>

                {manageColsTeam === 'ALL' && (
                  <div className="mb-3 px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/50 rounded-xl text-[10px] sm:text-[11px] text-[#1C6B53] dark:text-emerald-300 font-semibold flex items-center gap-1.5">
                    <span>✓ Syncs Across All Team Leaders & Agent Dashboards</span>
                  </div>
                )}
                
                <input
                  type="text"
                  placeholder="KPI Name (e.g. Quality, Exam, Prod)"
                  value={newColLabel}
                  onChange={(e) => setNewColLabel(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 outline-none focus:border-[#1C6B53] mb-2 font-medium"
                />

                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] sm:text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Format</label>
                    <div className="flex rounded-xl overflow-hidden border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-0.5">
                      <button
                        type="button"
                        onClick={() => setNewColType('number')}
                        className={`flex-1 py-1 text-[11px] sm:text-xs font-bold rounded-lg transition ${newColType === 'number' ? 'bg-[#1C6B53] text-white' : 'text-gray-600 dark:text-gray-400'}`}
                      >
                        Number / %
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewColType('time')}
                        className={`flex-1 py-1 text-[11px] sm:text-xs font-bold rounded-lg transition ${newColType === 'time' ? 'bg-[#1C6B53] text-white' : 'text-gray-600 dark:text-gray-400'}`}
                      >
                        Time (m:ss)
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] sm:text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Aggregation</label>
                    <div className="flex rounded-xl overflow-hidden border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-0.5">
                      <button
                        type="button"
                        onClick={() => setNewColAgg('average')}
                        className={`flex-1 py-1 text-[11px] sm:text-xs font-bold rounded-lg transition ${newColAgg === 'average' ? 'bg-[#1C6B53] text-white' : 'text-gray-600 dark:text-gray-400'}`}
                      >
                        Average
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewColAgg('sum')}
                        className={`flex-1 py-1 text-[11px] sm:text-xs font-bold rounded-lg transition ${newColAgg === 'sum' ? 'bg-[#1C6B53] text-white' : 'text-gray-600 dark:text-gray-400'}`}
                      >
                        Sum
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleAddColumn}
                  className="w-full bg-[#1C6B53] hover:bg-[#155a45] text-white py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold transition shadow-sm mb-4 sm:mb-5 flex items-center justify-center gap-2"
                >
                  <Plus size={16} /> Add KPI
                </button>

                <div className="flex-1 overflow-y-auto overscroll-contain flex flex-col gap-2 pr-1">
                  {manageCols.map((col) => (
                    <div key={col.id} className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-2.5 sm:p-3 flex justify-between items-center shadow-sm">
                      {editingColId === col.id ? (
                        <div className="flex-1 flex flex-col gap-2 p-1">
                          <div className="flex gap-2 items-center">
                            <input
                              type="text"
                              value={editColLabel}
                              onChange={(e) => setEditColLabel(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveColumn();
                                if (e.key === 'Escape') setEditingColId(null);
                              }}
                              placeholder="KPI Name"
                              className="flex-1 px-2.5 py-1 text-xs sm:text-sm border border-gray-300 dark:border-gray-600 rounded-lg outline-none focus:border-[#1C6B53] dark:bg-gray-700 dark:text-white font-medium"
                              autoFocus
                            />
                            <button 
                              onClick={handleSaveColumn} 
                              className="bg-[#1C6B53] hover:bg-[#155a45] text-white px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs transition"
                              title="Save Changes"
                            >
                              <Save size={13} />
                              <span>Save</span>
                            </button>
                            <button 
                              onClick={() => setEditingColId(null)} 
                              className="border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 p-1 rounded-lg text-xs transition"
                              title="Cancel"
                            >
                              <X size={14} />
                            </button>
                          </div>

                          {/* Format & Aggregation controls */}
                          <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-gray-100 dark:border-gray-700">
                            <div className="flex flex-col gap-1">
                              <label className="text-[9px] sm:text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Format</label>
                              <div className="flex rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 p-0.5">
                                <button
                                  type="button"
                                  onClick={() => setEditColType('number')}
                                  className={`flex-1 py-0.5 sm:py-1 text-[10px] sm:text-[11px] font-bold rounded transition ${editColType === 'number' ? 'bg-[#1C6B53] text-white shadow-xs' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'}`}
                                >
                                  Number / %
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditColType('time')}
                                  className={`flex-1 py-0.5 sm:py-1 text-[10px] sm:text-[11px] font-bold rounded transition ${editColType === 'time' ? 'bg-[#1C6B53] text-white shadow-xs' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'}`}
                                >
                                  Time (m:ss)
                                </button>
                              </div>
                            </div>

                            <div className="flex flex-col gap-1">
                              <label className="text-[9px] sm:text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Aggregation</label>
                              <div className="flex rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 p-0.5">
                                <button
                                  type="button"
                                  onClick={() => setEditColAgg('average')}
                                  className={`flex-1 py-0.5 sm:py-1 text-[10px] sm:text-[11px] font-bold rounded transition ${editColAgg === 'average' ? 'bg-[#1C6B53] text-white shadow-xs' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'}`}
                                >
                                  Average
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditColAgg('sum')}
                                  className={`flex-1 py-0.5 sm:py-1 text-[10px] sm:text-[11px] font-bold rounded transition ${editColAgg === 'sum' ? 'bg-[#1C6B53] text-white shadow-xs' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'}`}
                                >
                                  Sum
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <>
                          <span className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-200">{toTitleCase(col.label)}</span>
                          <div className="flex items-center gap-2 sm:gap-2.5">
                            <button
                              type="button"
                              onClick={() => handleEditColumnStart(col)}
                              className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-md transition cursor-pointer flex items-center gap-1"
                              title="Click to edit format and aggregation"
                            >
                              <span>{toTitleCase(col.type)} • {toTitleCase(col.aggregation)}</span>
                            </button>
                            <div className="flex gap-1 sm:gap-1.5">
                              <button onClick={() => handleEditColumnStart(col)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1" title="Edit KPI">
                                <Edit2 size={13} />
                              </button>
                              <button onClick={() => handleRemoveColumn(col.id)} className="text-red-400 hover:text-red-600 p-1" title="Delete KPI">
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* TL & Manager Profile Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowProfileModal(false)} />
          <div className="relative bg-white dark:bg-gray-900 rounded-2xl sm:rounded-3xl shadow-2xl p-5 sm:p-7 max-w-md w-full border border-gray-100 dark:border-gray-800 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">Profile Settings</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Update Your Display Name, Profile Photo & Password</p>
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

            <form onSubmit={handleSaveTLProfile} className="space-y-4">
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

              {/* Role & Email info (Assigned Team removed) */}
              <div className="p-3.5 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-100 dark:border-gray-700 text-xs text-gray-500 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-600 dark:text-gray-300">Account Role</span>
                  <span className="font-bold text-gray-800 dark:text-white">{isAdmin ? 'Administrator' : userProfile?.role === 'manager' ? 'Manager' : userProfile?.role === 'agent' ? 'Agent' : 'Team Leader'}</span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-gray-700">
                  <span className="font-semibold text-gray-600 dark:text-gray-300">Email Address</span>
                  <span className="font-medium text-gray-700 dark:text-gray-200">{session?.email}</span>
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
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-[#1C6B53] hover:bg-[#155a45] transition shadow-md shadow-[#1C6B53]/20 disabled:opacity-50"
                >
                  {savingProfile ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDeleteTarget(null)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-8 max-w-sm w-full mx-4 border border-transparent dark:border-gray-700">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-50 dark:bg-red-900/30 mx-auto mb-4">
              <Trash2 size={22} className="text-red-500 dark:text-red-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white text-center mb-2">Remove Member</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-6">
              Are you sure you want to remove <span className="font-semibold text-gray-700 dark:text-gray-200">{deleteTarget.name}</span> from the roster? All their metric data for this team will also be deleted.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 px-4 py-2.5 rounded-lg bg-red-500 text-sm font-medium text-white hover:bg-red-600 transition shadow-sm"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
