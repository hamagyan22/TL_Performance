const fs = require('fs');

const newAgent = `import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
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
  const chartData = months.map(m => {
    const row = metrics.find(r => r.month === m);
    const dataObj: any = { month: m };
    teamCols.forEach((col: any) => {
       if (row && row[col.id]) {
         if (col.type === 'time') {
           const parts = row[col.id].toString().split(':');
           const secs = (parseInt(parts[0]) || 0) * 60 + (parseInt(parts[1]) || 0);
           dataObj[col.id] = parseFloat((secs / 60).toFixed(1)); 
         } else {
           dataObj[col.id] = parseFloat(row[col.id]);
         }
       } else {
         dataObj[col.id] = 0;
       }
    });
    return dataObj;
  });

  const selectedMonthData = metrics.find(r => r.month === selectedMonth) || {};

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
          <div className="space-y-8">
            
            {/* KPI Charts Grid */}
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 tracking-tight">Performance Trends</h2>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="px-4 py-2 rounded-md text-sm font-bold tracking-wider uppercase bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 shadow-sm outline-none cursor-pointer border border-gray-200 dark:border-gray-700"
                >
                  <option value="2026">2026</option>
                  <option value="2027">2027</option>
                  <option value="2028">2028</option>
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {teamCols.map((col: any) => (
                  <div key={col.id} className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm h-[250px] flex flex-col">
                    <h3 className="text-xs font-bold text-gray-500 tracking-widest uppercase mb-4">{col.label}</h3>
                    <div className="flex-1 w-full min-h-0">
                      <ResponsiveContainer width="100%" height="100%">
                        {col.aggregation === 'average' ? (
                          <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                            <XAxis dataKey="month" stroke="#888" fontSize={10} tickLine={false} axisLine={false} />
                            <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }} />
                            <Line type="monotone" dataKey={col.id} stroke="#1C6B53" strokeWidth={2} dot={{ r: 3, fill: '#1C6B53', strokeWidth: 1 }} />
                          </LineChart>
                        ) : (
                          <BarChart data={chartData} barSize={20}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                            <XAxis dataKey="month" stroke="#888" fontSize={10} tickLine={false} axisLine={false} />
                            <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }} cursor={{fill: 'transparent'}} />
                            <Bar dataKey={col.id} fill="#1C6B53" radius={[3, 3, 0, 0]} />
                          </BarChart>
                        )}
                      </ResponsiveContainer>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Monthly Details Grid */}
            <div>
              <div className="flex justify-between items-center mb-6 pt-4 border-t border-gray-200 dark:border-gray-800">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 tracking-tight">Monthly Summary</h2>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="px-4 py-2 rounded-md text-sm font-bold tracking-wider uppercase bg-[#1C6B53] text-white shadow-sm outline-none cursor-pointer border border-[#1C6B53]"
                >
                  {months.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {teamCols.map((col: any) => {
                  const val = selectedMonthData[col.id] ? selectedMonthData[col.id] : '-';
                  return (
                    <div key={col.id} className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col items-center justify-center gap-2 hover:shadow-md transition">
                      <span className="text-[10px] text-gray-500 font-bold tracking-widest uppercase text-center">{col.label}</span>
                      <span className="text-xl font-bold text-gray-900 dark:text-white">{val}</span>
                    </div>
                  );
                })}
              </div>
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

    </div>
  );
}
`;

let code = fs.readFileSync('src/app/page.tsx', 'utf-8');
const split1 = code.split('function AgentDashboard');
const split2 = split1[1].split('export default function Dashboard');
let newCode = split1[0] + newAgent + '\nexport default function Dashboard' + split2[1];

fs.writeFileSync('src/app/page.tsx', newCode, 'utf-8');
console.log('Done!');
