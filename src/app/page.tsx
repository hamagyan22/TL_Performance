"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebaseClient";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged, updatePassword } from "firebase/auth";
import { collection, query, where, getDocs, updateDoc, addDoc, deleteDoc, doc, setDoc } from "firebase/firestore";
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
  { id: 'quality', label: 'QUALITY %', type: 'number', aggregation: 'average' },
  { id: 'aht', label: 'AHT S', type: 'time', aggregation: 'average' },
  { id: 'productivity', label: 'PROD %', type: 'number', aggregation: 'average' },
  { id: 'wrapup', label: 'WRAPUP', type: 'time', aggregation: 'sum' },
  { id: 'hold', label: 'HOLD S', type: 'time', aggregation: 'average' },
  { id: 'abandoned', label: 'ABANDONED', type: 'number', aggregation: 'sum' },
  { id: 'handled', label: 'HANDLED', type: 'number', aggregation: 'sum' },
  { id: 'exam', label: 'EXAM %', type: 'number', aggregation: 'average' },
];


import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Camera } from "lucide-react";


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

  const fetchMyData = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, tableName), where('agent_name', '==', userProfile.agent_name), where('year', '==', selectedYear));
      const snap = await getDocs(q);
      setMetrics(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      
      const mQ = query(collection(db, 'team_members'), where('agent_name', '==', userProfile.agent_name), where('team', '==', userProfile.team));
      const mSnap = await getDocs(mQ);
      if(!mSnap.empty) {
        const mData: any = { id: mSnap.docs[0].id, ...mSnap.docs[0].data() };
        setMemberDoc(mData);
        setEditDisplayName(mData.display_name || mData.agent_name);
        setEditPhotoUrl(mData.photo_url || "");
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchMyData();
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
  const [manageColsTeam, setManageColsTeam] = useState<TeamName>('Younis Kamal Team');
  const [newColLabel, setNewColLabel] = useState("");
  const [newColType, setNewColType] = useState<'number'|'time'>('number');
  const [newColAgg, setNewColAgg] = useState<'sum'|'average'>('average');

  const [editingColId, setEditingColId] = useState<string | null>(null);
  const [editColLabel, setEditColLabel] = useState("");
  const [editColType, setEditColType] = useState<'number'|'time'>('number');
  const [editColAgg, setEditColAgg] = useState<'sum'|'average'>('average');

  const months = [
    "JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
    "Q1 - AVG", "Q2 - AVG", "Q3 - AVG", "Q4 - AVG", "H1 - AVG", "H2 - AVG", "YEAR - AVG"
  ];

  const aggregateMap: Record<string, string[]> = {
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

  const fetchColumns = async () => {
    try {
      const snap = await getDocs(collection(db, 'columns_config'));
      const map: Record<string, ColumnConfig[]> = {};
      snap.docs.forEach(d => {
        map[d.id] = d.data().columns;
      });
      
      let updated = false;
      for (const t of TEAMS) {
        if (!map[t] || map[t].length === 0) {
          map[t] = t === 'Mohammed Dlshad Team' ? DEFAULT_CHAT_COLUMNS : DEFAULT_OTHER_COLUMNS;
          await setDoc(doc(db, 'columns_config', t), { columns: map[t] });
          updated = true;
        }
      }
      setColumnsMap(map);
    } catch (err) {
      console.error(err);
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
           fetchColumns();
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
      let metrics = metricsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      
      if (isAggregate) {
        metrics = metrics.filter(m => aggregateMap[selectedMonth].includes(m.month));
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
          const avgRow: any = { _memberId: member.id, agent_name: member.agent_name, _readonly: true };

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
          if (existing) return { ...existing, _memberId: member.id };
          const empty: any = { _memberId: member.id, agent_name: member.agent_name };
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
    setManageColsTeam(selectedTeam);
    setNewMemberTeam(selectedTeam);
    fetchAllMembers();
    setShowManageMembers(true);
  };

  const handleAddMember = async () => {
    if (!newMemberName.trim()) return;
    try {
      await addDoc(collection(db, 'team_members'), { agent_name: newMemberName.trim(), team: newMemberTeam });
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
    try {
      await updateDoc(doc(db, 'team_members', id), {
        agent_name: editMemberName.trim(),
        team: editMemberTeam
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
    
    const currentCols = columnsMap[manageColsTeam] || [];
    const updatedCols = [...currentCols, newCol];
    
    try {
      await updateDoc(doc(db, 'columns_config', manageColsTeam), { columns: updatedCols });
      setColumnsMap({ ...columnsMap, [manageColsTeam]: updatedCols });
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
    const currentCols = columnsMap[manageColsTeam] || [];
    const updatedCols = currentCols.map(c => 
      c.id === editingColId 
        ? { ...c, label: editColLabel.trim(), type: editColType, aggregation: editColAgg } 
        : c
    );
    try {
      await updateDoc(doc(db, 'columns_config', manageColsTeam), { columns: updatedCols });
      setColumnsMap({ ...columnsMap, [manageColsTeam]: updatedCols });
      setEditingColId(null);
    } catch (err: any) {
      setErrorMsg(`Failed to edit column: ${err.message}`);
    }
  };

  const handleRemoveColumn = async (colId: string) => {
    const currentCols = columnsMap[manageColsTeam] || [];
    const updatedCols = currentCols.filter(c => c.id !== colId);
    try {
      await updateDoc(doc(db, 'columns_config', manageColsTeam), { columns: updatedCols });
      setColumnsMap({ ...columnsMap, [manageColsTeam]: updatedCols });
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

  // Ensure selectedTeam is valid for TL
  useEffect(() => {
    if (userProfile?.role === 'tl' && userProfile?.team && selectedTeam !== userProfile.team) {
      setSelectedTeam(userProfile.team);
    }
  }, [userProfile, selectedTeam]);

const activeCols = columnsMap[selectedTeam] || [];
  const manageCols = columnsMap[manageColsTeam] || [];

  return (
    <div className="min-h-screen p-6 md:p-10 font-sans transition-colors dark:bg-gray-900 dark:text-gray-100">
      <div className="max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start w-full mb-8 gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-gray-900 dark:text-white">Team Lead Dashboard</h1>
          </div>
          
          <div className="flex gap-2 items-center">
            <button onClick={toggleDarkMode} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition" title="Toggle dark mode">
               {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button onClick={handleLogout} className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-800 rounded-md transition border border-gray-200 dark:border-gray-700 shadow-sm ml-2">
              <LogOut size={16} /> Logout
            </button>
          </div>
        </div>

        {/* Team Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {activeTeams.map((teamName) => {
            const isActive = selectedTeam === teamName;
            const teamCols = columnsMap[teamName] || [];
            return (
              <button
                key={teamName}
                onClick={() => setSelectedTeam(teamName)}
                className={`text-left p-6 rounded-md shadow-sm flex flex-col justify-between h-44 transition border cursor-pointer
                  ${isActive 
                    ? 'bg-[#1C6B53] dark:bg-emerald-800 text-white border-transparent'
                    : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-500'}`}
              >
                <h2 className={`text-xs font-semibold tracking-widest uppercase mb-4 ${isActive ? 'text-emerald-100 dark:text-emerald-200' : 'text-gray-400 dark:text-gray-500'}`}>
                  {teamName}
                </h2>
                <div>
                  <div className={`flex justify-between text-[9px] tracking-widest uppercase mb-2 font-medium ${isActive ? 'text-emerald-200/80 dark:text-emerald-300/80' : 'text-gray-400 dark:text-gray-500'}`}>
                    {teamCols.map(col => <span key={col.id}>{col.label}</span>)}
                  </div>
                  <div className="flex justify-between font-semibold text-sm mb-4">
                    {teamCols.map(col => <span key={col.id}>{isActive ? calcAvg(col, rows) : '-'}</span>)}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Month Tabs & Controls */}
        <div className="flex flex-col mb-4 gap-4">
          
          {/* Top Row: Search and Manage */}
          <div className="flex flex-row items-center gap-3 w-full justify-start">
            <div className="relative flex-grow sm:flex-grow-0">
              <Search size={14} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search agent..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-1.5 border border-gray-200 dark:border-gray-700 rounded-sm bg-white dark:bg-gray-800 focus:outline-none focus:border-gray-400 dark:focus:border-gray-500 text-sm w-full sm:w-48 transition dark:text-gray-200"
              />
            </div>
            <span className="text-gray-500 dark:text-gray-400 text-xs font-medium tracking-wide whitespace-nowrap">
              {rows.length} agents
            </span>
            <button
              onClick={openManageModal}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition rounded-sm text-xs font-bold tracking-wider uppercase shadow-sm"
            >
              <Settings size={13} />
              System Config
            </button>
          </div>

          {/* Bottom Row: Month Tabs (One Line, No Scroll) */}
          <div className="flex flex-nowrap gap-1 bg-[#F1EFE8] dark:bg-gray-800 p-1 rounded-sm items-center border border-transparent dark:border-gray-700 w-full overflow-hidden">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="px-3 py-1.5 mr-2 rounded-sm text-[11px] font-bold tracking-wider uppercase bg-[#1a1a1a] dark:bg-gray-900 text-white shadow-sm outline-none cursor-pointer border border-transparent dark:border-gray-700 flex-shrink-0"
            >
              <option value="2026">2026</option>
              <option value="2027">2027</option>
              <option value="2028">2028</option>
              <option value="2029">2029</option>
              <option value="2030">2030</option>
            </select>
            {months.map(m => (
              <button
                key={m}
                onClick={() => setSelectedMonth(m)}
                className={`px-3 py-1.5 rounded-sm text-[11px] font-bold tracking-wider transition uppercase whitespace-nowrap flex-shrink-1 min-w-0 ${
                  selectedMonth === m
                    ? 'bg-[#1a1a1a] dark:bg-gray-700 text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-[#EAE7DF] dark:hover:bg-gray-700'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-[#F9F8F4] dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md shadow-sm overflow-x-auto">
          {errorMsg && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm border-b border-red-100 dark:border-red-800">
              {errorMsg}
              <button onClick={() => setErrorMsg(null)} className="ml-4 underline text-red-400 dark:text-red-300">dismiss</button>
            </div>
          )}

          <div className="min-w-[1100px]">
            {/* Table Header */}
            <div className="grid gap-2 px-4 py-3 bg-[#F4F2EC] dark:bg-gray-800 text-[10px] font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase border-b border-transparent dark:border-gray-700"
                 style={{ gridTemplateColumns: `2fr repeat(${activeCols.length}, 1fr)` }}>
              <div className="pl-2">Agent</div>
              {activeCols.map(col => <div key={col.id} className="text-right">{col.label}</div>)}
            </div>

            {/* Table Body */}
            <div className="divide-y divide-gray-100 dark:divide-gray-800 bg-[#FDFCFB] dark:bg-gray-900">
              {loading ? (
                <div className="p-8 text-center text-sm text-gray-400 dark:text-gray-500">Loading data...</div>
              ) : filteredRows.length === 0 ? (
                <div className="p-8 text-center text-sm text-gray-400 dark:text-gray-500">No team members found. Click "System Config" to add members.</div>
              ) : (
                filteredRows.map((row, index) => {
                  const actualIndex = rows.findIndex(r => r === row);
                  const disabled = isAggregate || !!row._readonly;
                  const inputCls = `w-20 text-right bg-transparent border border-gray-200 dark:border-gray-700 rounded px-2 py-1 text-xs text-gray-600 dark:text-gray-300 focus:border-[#1C6B53] dark:focus:border-emerald-500 focus:bg-white dark:focus:bg-gray-800 outline-none transition ${disabled ? 'bg-gray-50 dark:bg-gray-800 border-transparent !text-gray-800 dark:!text-gray-200 font-medium' : ''}`;

                  return (
                    <div key={row._memberId || index} className="grid gap-2 px-4 py-1.5 items-center hover:bg-white dark:hover:bg-gray-800 transition"
                         style={{ gridTemplateColumns: `2fr repeat(${activeCols.length}, 1fr)` }}>
                      
                      <div className="pl-2 text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                        {row.photo_url ? (
                          <img src={row.photo_url} className="w-6 h-6 rounded-full object-cover shadow-sm" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center"><Users size={12} className="text-gray-400" /></div>
                        )}
                        {row.display_name || row.agent_name}
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
                            className={inputCls}
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
               <div className="grid gap-2 px-4 py-4 bg-[#F4F2EC] dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 items-center"
                    style={{ gridTemplateColumns: `2fr repeat(${activeCols.length}, 1fr)` }}>
                 <div className="text-[10px] font-bold tracking-widest text-gray-600 dark:text-gray-400 uppercase pl-2">TEAM AVERAGE</div>
                 {activeCols.map(col => (
                   <div key={col.id} className="text-right text-xs font-semibold text-gray-700 dark:text-gray-300 pr-4">
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
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-10 overflow-y-auto">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowManageMembers(false)} />
          <div className="relative bg-[#F9F8F4] dark:bg-gray-900 rounded-xl shadow-2xl p-8 max-w-5xl w-full border border-transparent dark:border-gray-700 mb-10">
            
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">System Configuration</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Add or remove agents and table columns across the system.</p>
              </div>
              <button onClick={() => setShowManageMembers(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                 <X size={24} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Agents Card */}
              <div className="bg-[#F1EFE8] dark:bg-gray-800/50 rounded-xl p-6 flex flex-col h-[550px] border border-gray-200 dark:border-gray-700 shadow-sm">
                <div className="flex items-center gap-2 mb-6">
                  <Users size={18} className="text-gray-600 dark:text-gray-300" />
                  <h3 className="font-bold text-gray-800 dark:text-gray-100">Agents</h3>
                </div>
                
                <input
                  type="text"
                  placeholder="Agent Name"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddMember()}
                  className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-sm text-sm mb-3 bg-white dark:bg-gray-700 focus:outline-none focus:border-[#1C6B53]"
                />
                
                <div className="relative mb-3">
                   <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                     <Briefcase size={14} className="text-white" />
                   </div>
                   <select
                     value={newMemberTeam}
                     onChange={(e) => setNewMemberTeam(e.target.value as TeamName)}
                     className="w-full pl-9 pr-8 py-2.5 bg-[#1C6B53] text-white text-sm font-medium rounded-sm appearance-none cursor-pointer outline-none"
                   >
                     {activeTeams.map(t => <option key={t} value={t} className="bg-white text-gray-800">{t}</option>)}
                   </select>
                   <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                     <ChevronDown size={14} className="text-white" />
                   </div>
                </div>

                <button
                  onClick={handleAddMember}
                  className="w-full bg-[#1C6B53] hover:bg-[#155a45] text-white py-2.5 rounded-sm text-sm font-bold transition shadow-sm mb-6 flex items-center justify-center gap-2"
                >
                  <UserPlus size={16}/> Add Agent
                </button>

                <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1">
                  {allMembers.length === 0 && <div className="text-xs text-gray-400 text-center mt-4">No agents found in system.</div>}
                  {allMembers.map((member) => (
                    <div key={member.id} className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-sm p-3 flex justify-between items-center shadow-sm">
                      
                      {editingMemberId === member.id ? (
                        <div className="flex-1 flex gap-2 items-center">
                          <input 
                            type="text" 
                            value={editMemberName} 
                            onChange={(e) => setEditMemberName(e.target.value)} 
                            className="flex-1 px-2 py-1 text-sm border rounded outline-none focus:border-[#1C6B53] dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                          />
                          <select 
                            value={editMemberTeam} 
                            onChange={(e: any) => setEditMemberTeam(e.target.value)} 
                            className="w-32 px-2 py-1 text-[10px] border rounded outline-none focus:border-[#1C6B53] dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                          >
                            {activeTeams.map(t => <option key={t} value={t}>{t.replace(' Team', '')}</option>)}
                          </select>
                          <button onClick={() => handleSaveMember(member.id)} className="text-[#1C6B53] hover:text-emerald-700">
                            <Save size={14}/>
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{member.agent_name}</span>
                          <div className="flex items-center gap-3">
                            <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-[10px] font-bold px-2 py-1 rounded-sm uppercase tracking-wider whitespace-nowrap">
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

              {/* Columns Card */}
              <div className="bg-[#F1EFE8] dark:bg-gray-800/50 rounded-xl p-6 flex flex-col h-[550px] border border-gray-200 dark:border-gray-700 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <Columns size={18} className="text-gray-600 dark:text-gray-300" />
                    <h3 className="font-bold text-gray-800 dark:text-gray-100">Table Columns</h3>
                  </div>
                  <select 
                    value={manageColsTeam} 
                    onChange={(e: any) => setManageColsTeam(e.target.value)}
                    className="text-xs bg-transparent border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-gray-700 dark:text-gray-300 outline-none focus:border-[#1C6B53]"
                  >
                    {activeTeams.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                
                <input
                  type="text"
                  placeholder="e.g. QUALITY"
                  value={newColLabel}
                  onChange={(e) => setNewColLabel(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-sm text-sm mb-3 bg-white dark:bg-gray-700 focus:outline-none focus:border-[#1C6B53]"
                />

                <div className="flex gap-3 mb-3">
                  <div className="flex-1 flex flex-col">
                    <label className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400 mb-1">Data Type</label>
                    <div className="relative">
                      <select value={newColType} onChange={(e: any) => setNewColType(e.target.value)} className="w-full px-3 py-2 bg-[#1C6B53] text-white text-sm font-medium rounded-sm appearance-none cursor-pointer outline-none">
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
                      <select value={newColAgg} onChange={(e: any) => setNewColAgg(e.target.value)} className="w-full px-3 py-2 bg-[#1C6B53] text-white text-sm font-medium rounded-sm appearance-none cursor-pointer outline-none">
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
                  className="w-full flex justify-center items-center gap-1.5 bg-[#1C6B53] hover:bg-[#155a45] text-white py-2.5 rounded-sm text-sm font-bold transition shadow-sm mb-6"
                >
                  <Plus size={16} /> Add Column
                </button>

                <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1">
                  {manageCols.length === 0 && <div className="text-xs text-gray-400 text-center mt-4">No columns configured.</div>}
                  {manageCols.map((col) => (
                    <div key={col.id} className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-sm p-3 flex justify-between items-center shadow-sm">
                      
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
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{col.label}</span>
                          <div className="flex items-center gap-3">
                            <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-[9px] font-bold px-2 py-1 rounded-sm uppercase tracking-wider">
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

            </div>
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
