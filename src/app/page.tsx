"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebaseClient";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged, updatePassword } from "firebase/auth";
import { collection, query, where, getDocs, updateDoc, addDoc, deleteDoc, doc, setDoc, onSnapshot } from "firebase/firestore";
import { Search, Trash2, UserPlus, UserMinus, Users, Moon, Sun, LogOut, Settings, Plus, X, Edit2, Briefcase, Columns, ChevronDown, Save } from "lucide-react";

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


function AgentDashboard({ userProfile, onLogout, columnsMap }: { userProfile: any, onLogout: () => void, columnsMap: any }) {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<any[]>([]);
  const [selectedYear, setSelectedYear] = useState("2026");
  const [selectedMonth, setSelectedMonth] = useState("AUG");
  
  const [memberDoc, setMemberDoc] = useState<any>(null);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editPhotoUrl, setEditPhotoUrl] = useState("");
  const [forcePasswordChange, setForcePasswordChange] = useState(userProfile.mustChangePassword || false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const handleChangePassword = async (e: any) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) return setPasswordError("Passwords do not match");
    if (newPassword.length < 6) return setPasswordError("Password must be at least 6 characters");
    
    try {
      if (auth.currentUser) {
        await updatePassword(auth.currentUser, newPassword);
        await updateDoc(doc(db, 'users', auth.currentUser.uid), { mustChangePassword: false });
        setForcePasswordChange(false);
      }
    } catch(err: any) {
      setPasswordError(err.message);
    }
  };

  
  const teamCols = columnsMap[userProfile.team] || [];
  const tableName =
    userProfile.team === 'Younis Kamal Team' ? 'younis_metrics' :
    userProfile.team === 'Ankido Buya Team' ? 'ankido_metrics' :
    'mohammed_metrics';

  useEffect(() => {
    if (showEditProfile) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showEditProfile]);

  useEffect(() => {
    setLoading(true);
    const q = query(
      collection(db, tableName),
      where('agent_name', '==', userProfile.agent_name),
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
      where('agent_name', '==', userProfile.agent_name),
      where('team', '==', userProfile.team)
    );
    const unsubMember = onSnapshot(mQ, (mSnap) => {
      if (!mSnap.empty) {
        const mData: any = { id: mSnap.docs[0].id, ...mSnap.docs[0].data() };
        setMemberDoc(mData);
        setEditDisplayName(mData.display_name || mData.agent_name);
        setEditPhotoUrl(mData.photo_url || "");
      }
    }, (err) => {
      console.error(err);
    });

    return () => {
      unsubMetrics();
      unsubMember();
    };
  }, [selectedYear, userProfile, tableName]);

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
    { label: 'Q1 - AVG', months: ['JAN','FEB','MAR'] },
    { label: 'Q2 - AVG', months: ['APR','MAY','JUN'] },
    { label: 'Q3 - AVG', months: ['JUL','AUG','SEP'] },
    { label: 'Q4 - AVG', months: ['OCT','NOV','DEC'] },
    { label: 'H1 - AVG', months: ['JAN','FEB','MAR','APR','MAY','JUN'] },
    { label: 'H2 - AVG', months: ['JUL','AUG','SEP','OCT','NOV','DEC'] },
    { label: 'YEAR - AVG', months: months },
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

  return (
    <div className="min-h-screen p-6 md:p-10 font-sans bg-[#F9F8F4] dark:bg-gray-900 transition-colors">
      <div className="max-w-[1400px] mx-auto">
        
        {/* Header with Profile */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-4 bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-6">
            <div className="relative group">
              <div className="w-20 h-20 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden border-4 border-white dark:border-gray-800 shadow-md flex items-center justify-center">
                {memberDoc?.photo_url ? (
                  <img src={memberDoc.photo_url} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <Users size={32} className="text-gray-400" />
                )}
              </div>
              <button onClick={() => setShowEditProfile(true)} className="absolute bottom-0 right-0 p-1.5 bg-[#1C6B53] text-white rounded-full shadow-md hover:bg-emerald-700 transition">
                <Edit2 size={12} />
              </button>
            </div>
            <div>
              <p className="text-gray-400 dark:text-gray-500 text-xs font-semibold tracking-widest mb-1 uppercase">Welcome</p>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
                {memberDoc?.display_name || userProfile.agent_name}
              </h1>
            </div>
          </div>
          <button onClick={onLogout} className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 rounded-md transition bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
            <LogOut size={16} /> Logout
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-500">Loading your performance data...</div>
        ) : (
          <div className="space-y-5">

            {/* Year Performance — refined dark card */}
            <div className="bg-[#0f2d24] rounded-2xl p-6 shadow-md">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="text-[#4ade80]/70 text-[10px] font-semibold tracking-[0.2em] uppercase mb-1">Year Performance</p>
                  <p className="text-white text-2xl font-bold tracking-tight">{selectedYear} Overview</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                  <Users size={18} className="text-white/60" />
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {teamCols.map((col: any) => {
                  const yearAvg = avgCols(months, col);
                  return (
                    <div key={col.id} className="bg-white/5 hover:bg-white/8 border border-white/10 rounded-xl p-4 transition">
                      <p className="text-white/40 text-[9px] font-semibold tracking-[0.15em] uppercase mb-2">{col.label}</p>
                      <p className="text-white text-2xl font-bold leading-none">{yearAvg}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Month / Period Selector */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
              <div className="flex items-center px-4 overflow-x-auto scrollbar-hide">
                {/* Year */}
                <div className="relative mr-4 shrink-0">
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="appearance-none pr-6 pl-2 py-3 text-xs font-bold uppercase tracking-widest bg-transparent text-gray-700 dark:text-gray-300 border-0 outline-none cursor-pointer"
                  >
                    <option value="2026">2026</option>
                    <option value="2027">2027</option>
                    <option value="2028">2028</option>
                    <option value="2029">2029</option>
                    <option value="2030">2030</option>
                  </select>
                  <ChevronDown size={11} className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
                </div>

                <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 mr-2 shrink-0" />

                {/* Month tabs */}
                {months.map(m => (
                  <button
                    key={m}
                    onClick={() => setSelectedMonth(m)}
                    className={`shrink-0 px-3 py-3 text-xs font-semibold tracking-widest transition border-b-2 ${
                      selectedMonth === m
                        ? 'text-[#1C6B53] border-[#1C6B53]'
                        : 'text-gray-400 border-transparent hover:text-gray-600 dark:hover:text-gray-200'
                    }`}
                  >
                    {m}
                  </button>
                ))}

                <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-2 shrink-0" />

                {/* Period tabs */}
                {PERIODS.map(p => (
                  <button
                    key={p.label}
                    onClick={() => setSelectedMonth(p.label)}
                    className={`shrink-0 px-3 py-3 text-[10px] font-semibold tracking-widest transition border-b-2 whitespace-nowrap ${
                      selectedMonth === p.label
                        ? 'text-[#1C6B53] border-[#1C6B53]'
                        : 'text-gray-400 border-transparent hover:text-gray-600 dark:hover:text-gray-200'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* KPI Cards — clean white with colored accents */}
            {(() => {
              const accents = [
                { border: 'border-l-[#1C6B53]', label: 'text-[#1C6B53]', val: 'text-gray-900 dark:text-white', dot: 'bg-[#1C6B53]' },
                { border: 'border-l-[#2563eb]', label: 'text-[#2563eb]', val: 'text-gray-900 dark:text-white', dot: 'bg-[#2563eb]' },
                { border: 'border-l-[#7c3aed]', label: 'text-[#7c3aed]', val: 'text-gray-900 dark:text-white', dot: 'bg-[#7c3aed]' },
                { border: 'border-l-[#db2777]', label: 'text-[#db2777]', val: 'text-gray-900 dark:text-white', dot: 'bg-[#db2777]' },
                { border: 'border-l-[#0891b2]', label: 'text-[#0891b2]', val: 'text-gray-900 dark:text-white', dot: 'bg-[#0891b2]' },
                { border: 'border-l-[#d97706]', label: 'text-[#d97706]', val: 'text-gray-900 dark:text-white', dot: 'bg-[#d97706]' },
                { border: 'border-l-[#059669]', label: 'text-[#059669]', val: 'text-gray-900 dark:text-white', dot: 'bg-[#059669]' },
                { border: 'border-l-[#dc2626]', label: 'text-[#dc2626]', val: 'text-gray-900 dark:text-white', dot: 'bg-[#dc2626]' },
              ];
              return (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {teamCols.map((col: any, i: number) => {
                    const a = accents[i % accents.length];
                    const val = getDisplayVal(col);
                    return (
                      <div key={col.id} className={`bg-white dark:bg-gray-800 border-l-4 ${a.border} rounded-xl p-5 shadow-sm hover:shadow-md transition flex flex-col gap-3`}>
                        <div className="flex items-center gap-2">
                          <div className={`w-1.5 h-1.5 rounded-full ${a.dot}`} />
                          <span className={`text-[10px] font-bold tracking-[0.15em] uppercase ${a.label}`}>{col.label}</span>
                        </div>
                        <div>
                          <span className={`text-3xl font-black ${a.val} leading-none`}>{val}</span>
                          <p className="text-[10px] text-gray-400 mt-1 font-medium">{selectedMonth} · {selectedYear}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

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

    </div>
  );
}

export default function Dashboard() {
  const [session, setSession] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(false);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("JAN");
  const [selectedYear, setSelectedYear] = useState("2026");
  const [selectedTeam, setSelectedTeam] = useState<TeamName>('Younis Kamal Team');
  const [rows, setRows] = useState<any[]>([]);

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
        if (newProfilePassword.length < 6) {
          setProfileError("Password must be at least 6 characters");
          setSavingProfile(false);
          return;
        }
        if (auth.currentUser) {
          await updatePassword(auth.currentUser, newProfilePassword);
        }
      }

      if (session?.uid) {
        await updateDoc(doc(db, 'users', session.uid), {
          name: profileName,
          photo_url: profilePhoto,
          ...(newProfilePassword ? { mustChangePassword: false } : {})
        });
        setUserProfile((prev: any) => ({
          ...prev,
          name: profileName,
          photo_url: profilePhoto,
          ...(newProfilePassword ? { mustChangePassword: false } : {})
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
    if (showManageMembers || showProfileModal || deleteTarget) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showManageMembers, showProfileModal, deleteTarget]);

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
        // Fetch user profile to check role
        import('firebase/firestore').then(async ({ getDoc, doc }) => {
           try {
             const userDoc = await getDoc(doc(db, 'users', user.uid));
             if (userDoc.exists()) {
               setUserProfile(userDoc.data());
             } else {
               setUserProfile({ role: 'tl' }); // Default to TL if no record
             }
           } catch(e) { console.error(e); setUserProfile({ role: 'tl' }); }
           setAuthLoading(false);
        });
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
    setAuthError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      setAuthError(err.message);
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
      const allYearData = metricsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
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
    const targetTeam = (userProfile?.role === 'tl' && userProfile?.team) ? userProfile.team : selectedTeam;
    setManageColsTeam(userProfile?.role === 'manager' ? 'ALL' : targetTeam);
    setNewMemberTeam(targetTeam);
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

      if (!session) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4 transition-colors bg-gradient-to-br from-[#E8F3EF] to-[#F9F8F4] dark:from-gray-900 dark:to-gray-800">
          <div className="w-full max-w-md p-8 sm:p-10 bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] border border-white/50 dark:border-gray-700/50 relative overflow-hidden">
            <div className="absolute top-6 right-6">
               <button onClick={toggleDarkMode} className="p-2.5 rounded-full bg-white/50 dark:bg-gray-700/50 hover:bg-white dark:hover:bg-gray-600 text-gray-500 dark:text-gray-300 transition-all shadow-sm backdrop-blur-sm">
                 {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
               </button>
            </div>
            
            <div className="flex flex-col items-center mb-8 mt-4">
              <div className="h-16 mb-6 flex items-center justify-center">
                <img src="/logo.webp" alt="FIB Logo" className="w-full h-full object-contain" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-center tracking-tight text-gray-900 dark:text-white leading-tight">
                Team Leader & <br /> Agent Dashboard
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-3 font-medium text-center">
                Welcome back. Please sign in to continue.
              </p>
            </div>
            
            {authError && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 text-red-600 dark:text-red-400 text-sm font-medium rounded-r-lg">
                {authError}
              </div>
            )}
            
            <form onSubmit={handleLogin} className="space-y-5">
               <div>
                 <label className="block text-[11px] font-bold uppercase tracking-wider mb-2 text-gray-500 dark:text-gray-400 ml-1">Email Address</label>
                 <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full px-5 py-3.5 bg-gray-50/50 dark:bg-gray-900/50 border border-gray-200/80 dark:border-gray-700 rounded-xl focus:outline-none transition-all text-gray-900 dark:text-white focus:bg-white dark:focus:bg-gray-800 focus:border-[#1C6B53] dark:focus:border-[#1C6B53] focus:ring-4 focus:ring-[#1C6B53]/10" placeholder="name@agent.com" />
               </div>
               <div>
                 <label className="block text-[11px] font-bold uppercase tracking-wider mb-2 text-gray-500 dark:text-gray-400 ml-1">Password</label>
                 <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="w-full px-5 py-3.5 bg-gray-50/50 dark:bg-gray-900/50 border border-gray-200/80 dark:border-gray-700 rounded-xl focus:outline-none transition-all text-gray-900 dark:text-white focus:bg-white dark:focus:bg-gray-800 focus:border-[#1C6B53] dark:focus:border-[#1C6B53] focus:ring-4 focus:ring-[#1C6B53]/10" placeholder="••••••••" />
               </div>
               <button type="submit" className="w-full py-4 rounded-xl text-sm font-bold text-white transition-all mt-6 bg-[#1C6B53] hover:bg-[#155a45] shadow-lg shadow-[#1C6B53]/20 hover:shadow-[#1C6B53]/40 transform hover:-translate-y-0.5 active:translate-y-0">
                 Sign In
               </button>
            </form>
          </div>
        </div>
      );
    }

    if (userProfile?.role === 'agent') {
    return <AgentDashboard userProfile={userProfile} onLogout={handleLogout} columnsMap={columnsMap} />;
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

  return (
    <div className="min-h-screen p-6 md:p-10 font-sans transition-colors dark:bg-gray-900 dark:text-gray-100">
      <div className="max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center w-full mb-8 gap-4 pb-6 border-b border-gray-200/60 dark:border-gray-800">
          <div className="flex items-center gap-3.5 sm:gap-5">
            <div className="flex items-center gap-2">
              <img src="/logo.webp" alt="FIB Logo" className="h-11 sm:h-12 w-auto object-contain" />
            </div>
            <div className="h-10 w-[1.5px] bg-gray-200 dark:bg-gray-700" />
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-gray-900 dark:text-white leading-none">
                Team Leader Dashboard
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">
                Performance & Quality Analytics
              </p>
            </div>
          </div>
          
          <div className="flex gap-2.5 items-center flex-wrap">
            {/* Dark Mode Toggle */}
            <button 
              onClick={toggleDarkMode} 
              className="p-2.5 rounded-xl hover:bg-gray-200/70 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm" 
              title="Toggle dark mode"
            >
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {/* Manage Team / System Config Button - Beside Profile */}
            <button
              onClick={openManageModal}
              className="flex items-center gap-2 px-3.5 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition rounded-xl text-xs sm:text-sm font-bold shadow-sm"
              title={userProfile?.role === 'manager' ? 'System Configuration' : 'Manage Team'}
            >
              {userProfile?.role === 'manager' ? <Settings size={15} className="text-[#1C6B53] dark:text-emerald-400" /> : <Users size={15} className="text-[#1C6B53] dark:text-emerald-400" />}
              <span>{userProfile?.role === 'manager' ? 'System Config' : 'Manage Team'}</span>
            </button>

            {/* Profile Button - Pencil icon removed */}
            <button 
              onClick={openProfileModal}
              className="flex items-center gap-2.5 px-3.5 py-2 text-xs sm:text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition border border-gray-200 dark:border-gray-700 shadow-sm bg-white dark:bg-gray-800 group"
              title="Profile"
            >
              <div className="w-7 h-7 rounded-full bg-[#1C6B53]/15 dark:bg-emerald-950 flex items-center justify-center overflow-hidden border border-[#1C6B53]/30 text-[#1C6B53] dark:text-emerald-400 font-black text-xs">
                {userProfile?.photo_url ? (
                  <img src={userProfile.photo_url} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  userProfile?.name ? userProfile.name.charAt(0).toUpperCase() : <Users size={14} />
                )}
              </div>
              <span className="max-w-[130px] truncate">{userProfile?.name || (userProfile?.role === 'manager' ? 'Jalal Burghol' : 'Team Lead')}</span>
            </button>

            {/* Logout Button */}
            <button 
              onClick={handleLogout} 
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition border border-red-200 dark:border-red-900/50 shadow-sm bg-white dark:bg-gray-800"
            >
              <LogOut size={15} /> Logout
            </button>
          </div>
        </div>

        {/* Team Cards */}
        {activeTeams.length === 1 ? (
          <div className="mb-8 bg-gradient-to-br from-[#1C6B53] via-[#165a46] to-[#104334] text-white rounded-3xl p-6 sm:p-8 shadow-xl shadow-[#1C6B53]/15 border border-emerald-500/30 relative overflow-hidden">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-4 border-b border-white/10">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner">
                  <Users size={24} className="text-emerald-200" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                    {activeTeams[0]}
                  </h2>
                  <p className="text-xs text-emerald-100/80 mt-1 font-medium">
                    {selectedYear} Annual Team Performance Summary • {rows.length} Active Agents
                  </p>
                </div>
              </div>
            </div>

            {/* Metrics Grid (Permanent Full Year Data) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              {(columnsMap[activeTeams[0]] || []).map((col) => {
                const annualVal = calcYearTeamStat(col);
                return (
                  <div key={col.id} className="bg-white/10 dark:bg-black/25 backdrop-blur-md rounded-2xl p-3.5 border border-white/10 flex flex-col justify-between hover:bg-white/15 transition shadow-sm">
                    <div className="text-[11px] font-bold tracking-wide text-emerald-100/90 truncate mb-2" title={col.label}>
                      {toTitleCase(col.label)}
                    </div>
                    <div className="text-xl sm:text-2xl font-black text-white tracking-tight">
                      {annualVal}
                    </div>
                    <div className="text-[10px] text-emerald-300/70 font-medium mt-1">
                      {toTitleCase(col.aggregation)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {activeTeams.map((teamName) => {
              const isActive = selectedTeam === teamName;
              const teamCols = columnsMap[teamName] || [];
              return (
                <button
                  key={teamName}
                  onClick={() => setSelectedTeam(teamName)}
                  className={`text-left p-6 rounded-3xl shadow-sm flex flex-col justify-between transition-all border cursor-pointer relative overflow-hidden
                    ${isActive 
                      ? 'bg-gradient-to-br from-[#1C6B53] to-[#155a45] text-white border-transparent shadow-lg shadow-[#1C6B53]/20 ring-2 ring-[#1C6B53]/50 scale-[1.01]' 
                      : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 border-gray-200/80 dark:border-gray-700/80 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-md'}`}
                >
                  <div className="flex justify-between items-start w-full mb-4">
                    <div>
                      <span className={`text-[10px] font-bold tracking-widest block mb-1 ${isActive ? 'text-emerald-200' : 'text-gray-400'}`}>
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

                  <div className="grid grid-cols-4 gap-2 w-full mt-2">
                    {teamCols.slice(0, 8).map(col => (
                      <div key={col.id} className={`p-2 rounded-xl text-center border ${isActive ? 'bg-white/10 border-white/10' : 'bg-gray-50 dark:bg-gray-700/50 border-gray-100 dark:border-gray-700'}`}>
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
        <div className="flex items-center gap-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md p-2 rounded-2xl border border-gray-200/80 dark:border-gray-700/80 w-full overflow-x-auto shadow-sm mb-5">
          {/* Year selector */}
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#1C6B53] text-white shadow-sm outline-none cursor-pointer border-0 flex-shrink-0"
          >
            <option value="2026">2026</option>
            <option value="2027">2027</option>
            <option value="2028">2028</option>
            <option value="2029">2029</option>
            <option value="2030">2030</option>
          </select>

          {/* Search Agent Input & Count next to Year */}
          <div className="relative flex-shrink-0">
            <Search size={13} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search agent..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50/80 dark:bg-gray-900/60 focus:outline-none focus:border-[#1C6B53] dark:focus:border-emerald-500 text-xs w-36 sm:w-44 transition dark:text-gray-200 font-medium"
            />
          </div>
          <span className="text-gray-500 dark:text-gray-400 text-xs font-semibold whitespace-nowrap px-1 flex-shrink-0">
            {filteredRows.length} Agents
          </span>

          {/* Separator */}
          <div className="h-5 w-[1.5px] bg-gray-300 dark:bg-gray-600 mx-1 flex-shrink-0" />

          {/* Months (Jan - Dec) */}
          {months.map(m => {
            const displayLabel = m.charAt(0) + m.slice(1).toLowerCase();
            const isSel = selectedMonth === m;
            return (
              <button
                key={m}
                onClick={() => setSelectedMonth(m)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex-shrink-0 ${
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
          <div className="h-5 w-[1.5px] bg-gray-300 dark:bg-gray-600 mx-1 flex-shrink-0" />

          {/* Quarters & Halves */}
          {periods.map(p => {
            const isSel = selectedMonth === p;
            return (
              <button
                key={p}
                onClick={() => setSelectedMonth(p)}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition flex-shrink-0 ${
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

        {/* Data Table */}
        <div className="bg-[#F9F8F4] dark:bg-gray-900 border border-gray-200/80 dark:border-gray-700/80 rounded-2xl shadow-sm overflow-x-auto">
          {errorMsg && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm border-b border-red-100 dark:border-red-800">
              {errorMsg}
              <button onClick={() => setErrorMsg(null)} className="ml-4 underline text-red-400 dark:text-red-300">dismiss</button>
            </div>
          )}

          <div className="min-w-[1100px]">
            {/* Table Header */}
            <div className="grid gap-2 px-5 py-3.5 bg-gray-50/90 dark:bg-gray-800/90 text-xs font-bold text-gray-600 dark:text-gray-300 border-b border-gray-200/70 dark:border-gray-700"
                 style={{ gridTemplateColumns: `2.5fr repeat(${activeCols.length}, 1fr)` }}>
              <div className="pl-1">Agent</div>
              {activeCols.map(col => <div key={col.id} className="text-right">{toTitleCase(col.label)}</div>)}
            </div>

            {/* Table Body */}
            <div className="divide-y divide-gray-100 dark:divide-gray-800 bg-[#FDFCFB] dark:bg-gray-900">
              {loading ? (
                <div className="p-8 text-center text-sm text-gray-400 dark:text-gray-500">Loading data...</div>
              ) : filteredRows.length === 0 ? (
                <div className="p-8 text-center text-sm text-gray-400 dark:text-gray-500">No team members found. Click "Manage Agents" to add members.</div>
              ) : (
                filteredRows.map((row, index) => {
                  const actualIndex = rows.findIndex(r => r === row);
                  const disabled = isAggregate || !!row._readonly;

                  return (
                    <div key={row._memberId || index} className="grid gap-2 px-5 py-2.5 items-center hover:bg-emerald-50/30 dark:hover:bg-gray-800/60 transition group"
                         style={{ gridTemplateColumns: `2.5fr repeat(${activeCols.length}, 1fr)` }}>
                      
                      <div className="pl-1 text-sm font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-3">
                        {row.photo_url ? (
                          <img src={row.photo_url} alt={row.agent_name} className="w-8 h-8 rounded-full object-cover shadow-sm border border-emerald-500/20 flex-shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#1C6B53]/20 to-emerald-100 dark:from-[#1C6B53]/40 dark:to-emerald-950 text-[#1C6B53] dark:text-emerald-300 font-bold text-xs flex items-center justify-center shadow-sm border border-emerald-500/15 flex-shrink-0">
                            {row.agent_name ? row.agent_name.charAt(0).toUpperCase() : <Users size={14} />}
                          </div>
                        )}
                        <span className="font-semibold truncate">{row.display_name || row.agent_name}</span>
                      </div>
                      {activeCols.map(col => (
                        <div key={col.id} className="text-right">
                          <input 
                            disabled={disabled}
                            type="text"
                            placeholder={col.type === 'time' ? 'm:ss' : (col.aggregation === 'average' ? '%' : '#')}
                            value={row[col.id] || ''}
                            onChange={(e) => handleChange(actualIndex, col.id, e.target.value)}
                            onBlur={() => handleBlur(actualIndex)}
                            className="w-20 text-right bg-white dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-xl px-2.5 py-1.5 text-xs text-gray-700 dark:text-gray-200 focus:border-[#1C6B53] dark:focus:border-emerald-500 focus:ring-2 focus:ring-[#1C6B53]/15 outline-none transition shadow-sm font-medium disabled:bg-gray-50 dark:disabled:bg-gray-800/50 disabled:border-transparent disabled:text-gray-700 dark:disabled:text-gray-300"
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
               <div className="grid gap-2 px-5 py-4 bg-gray-50 dark:bg-gray-800 border-t-2 border-gray-200/80 dark:border-gray-700 items-center font-bold"
                    style={{ gridTemplateColumns: `2.5fr repeat(${activeCols.length}, 1fr)` }}>
                 <div className="text-xs font-bold text-gray-700 dark:text-gray-300 pl-1">Team Average</div>
                 {activeCols.map(col => (
                   <div key={col.id} className="text-right text-xs font-extrabold text-[#1C6B53] dark:text-emerald-400 pr-2">
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
      {showManageMembers && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-10 overflow-y-auto overscroll-contain">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowManageMembers(false)} />
          <div className={`relative bg-[#F9F8F4] dark:bg-gray-900 rounded-3xl shadow-2xl p-6 sm:p-8 w-full border border-transparent dark:border-gray-700 mb-10 transition-all overscroll-contain ${userProfile?.role === 'manager' ? 'max-w-5xl' : 'max-w-2xl'}`}>
            
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                  {userProfile?.role === 'manager' ? 'System Configuration' : 'Manage Team Agents'}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {userProfile?.role === 'manager' 
                    ? 'Add or remove agents and table columns across the system.' 
                    : `Manage agent roster for ${userProfile?.team || 'your team'}.`}
                </p>
              </div>
              <button onClick={() => setShowManageMembers(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1">
                 <X size={24} />
              </button>
            </div>

            <div className={`grid gap-6 ${userProfile?.role === 'manager' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
              
              {/* Agents Card */}
              <div className="bg-[#F1EFE8] dark:bg-gray-800/50 rounded-2xl p-6 flex flex-col h-[550px] border border-gray-200 dark:border-gray-700 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Users size={18} className="text-gray-600 dark:text-gray-300" />
                    <h3 className="font-bold text-gray-800 dark:text-gray-100">
                      {userProfile?.role === 'tl' ? `${userProfile?.team?.replace(' Team', '') || 'My Team'} Agents` : 'Agents'}
                    </h3>
                  </div>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                    {displayedMembers.length} Agents
                  </span>
                </div>
                
                <input
                  type="text"
                  placeholder="Agent Name"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddMember()}
                  className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl text-sm mb-3 bg-white dark:bg-gray-700 focus:outline-none focus:border-[#1C6B53] font-medium"
                />
                
                {userProfile?.role === 'tl' ? (
                  <div className="flex items-center gap-2 mb-3 px-3.5 py-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-[#1C6B53] dark:text-emerald-400 rounded-xl text-xs font-bold">
                    <Briefcase size={14} />
                    <span>Assigned Team: {userProfile.team}</span>
                  </div>
                ) : (
                  <div className="relative mb-3">
                     <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                       <Briefcase size={14} className="text-white" />
                     </div>
                     <select
                       value={newMemberTeam}
                       onChange={(e) => setNewMemberTeam(e.target.value as TeamName)}
                       className="w-full pl-9 pr-8 py-2.5 bg-[#1C6B53] text-white text-sm font-medium rounded-xl appearance-none cursor-pointer outline-none"
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
                  className="w-full bg-[#1C6B53] hover:bg-[#155a45] text-white py-2.5 rounded-xl text-sm font-bold transition shadow-sm mb-5 flex items-center justify-center gap-2"
                >
                  <UserPlus size={16}/> Add Agent
                </button>

                <div className="flex-1 overflow-y-auto overscroll-contain flex flex-col gap-2 pr-1">
                  {displayedMembers.length === 0 && <div className="text-xs text-gray-400 text-center mt-6">No agents found in this team.</div>}
                  {displayedMembers.map((member) => (
                    <div key={member.id} className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-3 flex justify-between items-center shadow-sm">
                      
                      {editingMemberId === member.id ? (
                        <div className="flex-1 flex gap-2 items-center">
                          <input 
                            type="text" 
                            value={editMemberName} 
                            onChange={(e) => setEditMemberName(e.target.value)} 
                            className="flex-1 px-2 py-1 text-sm border rounded outline-none focus:border-[#1C6B53] dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                          />
                          {userProfile?.role === 'manager' && (
                            <select 
                              value={editMemberTeam} 
                              onChange={(e: any) => setEditMemberTeam(e.target.value)} 
                              className="w-32 px-2 py-1 text-[10px] border rounded outline-none focus:border-[#1C6B53] dark:bg-gray-700 dark:border-gray-600 dark:text-white"
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
                          <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{member.agent_name}</span>
                          <div className="flex items-center gap-3">
                            <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider whitespace-nowrap">
                              {member.team.replace(' Team', '')}
                            </span>
                            <div className="flex gap-2">
                              <button onClick={() => handleEditMemberStart(member)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition" title="Edit">
                                <Edit2 size={14} />
                              </button>
                              <button onClick={() => setDeleteTarget({ memberId: member.id, name: member.agent_name, team: member.team })} className="text-red-400 hover:text-red-600 transition" title="Delete">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Columns Card - ONLY FOR MANAGER */}
              {userProfile?.role === 'manager' && (
                <div className="bg-[#F1EFE8] dark:bg-gray-800/50 rounded-2xl p-6 flex flex-col h-[550px] border border-gray-200 dark:border-gray-700 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Columns size={18} className="text-gray-600 dark:text-gray-300" />
                      <h3 className="font-bold text-gray-800 dark:text-gray-100">Table Columns & KPIs</h3>
                    </div>
                    <select 
                      value={manageColsTeam} 
                      onChange={(e: any) => setManageColsTeam(e.target.value)}
                      className="text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-2.5 py-1 text-gray-700 dark:text-gray-300 outline-none focus:border-[#1C6B53] font-semibold"
                    >
                      <option value="ALL">🌐 All Teams (Global / الجميع)</option>
                      {activeTeams.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>

                  {manageColsTeam === 'ALL' && (
                    <div className="mb-3 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/50 rounded-xl text-[11px] text-[#1C6B53] dark:text-emerald-300 font-semibold flex items-center gap-1.5">
                      <span>✓ Syncs across all Team Leaders & Agent dashboards automatically</span>
                    </div>
                  )}
                  
                  <input
                    type="text"
                    placeholder="e.g. QUALITY"
                    value={newColLabel}
                    onChange={(e) => setNewColLabel(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl text-sm mb-3 bg-white dark:bg-gray-700 focus:outline-none focus:border-[#1C6B53]"
                  />

                  <div className="flex gap-3 mb-3">
                    <div className="flex-1 flex flex-col">
                      <label className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400 mb-1">Data Type</label>
                      <div className="relative">
                        <select value={newColType} onChange={(e: any) => setNewColType(e.target.value)} className="w-full px-3 py-2 bg-[#1C6B53] text-white text-sm font-medium rounded-xl appearance-none cursor-pointer outline-none">
                          <option value="number" className="bg-white text-gray-800">Number</option>
                          <option value="time" className="bg-white text-gray-800">Time (mm:ss)</option>
                        </select>
                        <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none">
                          <ChevronDown size={14} className="text-white" />
                        </div>
                      </div>
                    </div>
                    <div className="flex-1 flex flex-col">
                      <label className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400 mb-1">Aggregation</label>
                      <div className="relative">
                        <select value={newColAgg} onChange={(e: any) => setNewColAgg(e.target.value)} className="w-full px-3 py-2 bg-[#1C6B53] text-white text-sm font-medium rounded-xl appearance-none cursor-pointer outline-none">
                          <option value="average" className="bg-white text-gray-800">Average</option>
                          <option value="sum" className="bg-white text-gray-800">Sum</option>
                        </select>
                        <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none">
                          <ChevronDown size={14} className="text-white" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleAddColumn}
                    className="w-full flex justify-center items-center gap-1.5 bg-[#1C6B53] hover:bg-[#155a45] text-white py-2.5 rounded-xl text-sm font-bold transition shadow-sm mb-5"
                  >
                    <Plus size={16} /> Add Column
                  </button>

                  <div className="flex-1 overflow-y-auto overscroll-contain flex flex-col gap-2 pr-1">
                    {manageCols.length === 0 && <div className="text-xs text-gray-400 text-center mt-4">No columns configured.</div>}
                    {manageCols.map((col) => (
                      <div key={col.id} className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-3 flex justify-between items-center shadow-sm">
                        
                        {editingColId === col.id ? (
                          <div className="flex-1 flex gap-2 items-center">
                            <input 
                              type="text" 
                              value={editColLabel} 
                              onChange={(e) => setEditColLabel(e.target.value)} 
                              className="flex-1 px-2 py-1 text-[11px] border rounded outline-none focus:border-[#1C6B53] dark:bg-gray-700 dark:border-gray-600 dark:text-white w-20"
                            />
                            <select 
                              value={editColType} 
                              onChange={(e: any) => setEditColType(e.target.value)} 
                              className="w-16 px-1 py-1 text-[9px] border rounded outline-none focus:border-[#1C6B53] dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            >
                              <option value="number">Num</option>
                              <option value="time">Time</option>
                            </select>
                            <select 
                              value={editColAgg} 
                              onChange={(e: any) => setEditColAgg(e.target.value)} 
                              className="w-16 px-1 py-1 text-[9px] border rounded outline-none focus:border-[#1C6B53] dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            >
                              <option value="average">Avg</option>
                              <option value="sum">Sum</option>
                            </select>
                            <button onClick={handleSaveColumn} className="text-[#1C6B53] hover:text-emerald-700">
                              <Save size={14}/>
                            </button>
                          </div>
                        ) : (
                          <>
                            <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{col.label}</span>
                            <div className="flex items-center gap-3">
                              <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-[9px] font-bold px-2 py-1 rounded-md uppercase tracking-wider">
                                {col.type} • {col.aggregation}
                              </span>
                              <div className="flex gap-2">
                                <button onClick={() => handleEditColumnStart(col)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition" title="Edit">
                                  <Edit2 size={14} />
                                </button>
                                <button onClick={() => handleRemoveColumn(col.id)} className="text-red-400 hover:text-red-600 transition" title="Delete">
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* TL & Manager Profile Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowProfileModal(false)} />
          <div className="relative bg-white dark:bg-gray-900 rounded-3xl shadow-2xl p-7 max-w-md w-full border border-gray-100 dark:border-gray-800">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-black text-gray-900 dark:text-white">Profile Settings</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Update your display name, picture & password</p>
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
                <span className="text-[11px] text-gray-400 font-medium">Click photo to upload new image</span>
              </div>

              {/* Display Name */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5 text-gray-500 dark:text-gray-400">Display Name / Username</label>
                <input
                  type="text"
                  required
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50/70 dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:border-[#1C6B53] text-sm font-medium"
                />
              </div>

              {/* Role & Team info */}
              <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-100 dark:border-gray-700 text-xs text-gray-500 space-y-1">
                <div><strong className="text-gray-700 dark:text-gray-300">Account Role:</strong> {userProfile?.role === 'manager' ? 'Executive Manager' : 'Team Leader'}</div>
                <div><strong className="text-gray-700 dark:text-gray-300">Assigned Team:</strong> {userProfile?.team || 'All Teams'}</div>
                <div><strong className="text-gray-700 dark:text-gray-300">Email:</strong> {session?.email}</div>
              </div>

              {/* Change Password */}
              <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                <span className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">Change Password (Optional)</span>
                <div className="space-y-2.5">
                  <input
                    type="password"
                    placeholder="New Password (min 6 chars)"
                    value={newProfilePassword}
                    onChange={(e) => setNewProfilePassword(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50/70 dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:border-[#1C6B53] text-sm"
                  />
                  <input
                    type="password"
                    placeholder="Confirm New Password"
                    value={confirmProfilePassword}
                    onChange={(e) => setConfirmProfilePassword(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50/70 dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:border-[#1C6B53] text-sm"
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
