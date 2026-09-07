const fs = require('fs');

const agentDashboardComponent = `
function AgentDashboard({ userProfile, onLogout, columnsMap }: { userProfile: any, onLogout: () => void, columnsMap: any }) {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<any[]>([]);
  const [selectedYear, setSelectedYear] = useState("2026");

  const teamCols = columnsMap[userProfile.team] || [];
  const tableName =
    userProfile.team === 'Younis Kamal Team' ? 'younis_metrics' :
    userProfile.team === 'Ankido Buya Team' ? 'ankido_metrics' :
    'mohammed_metrics';

  useEffect(() => {
    const fetchMyData = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, tableName), where('agent_name', '==', userProfile.agent_name), where('year', '==', selectedYear));
        const snap = await getDocs(q);
        setMetrics(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    };
    fetchMyData();
  }, [selectedYear, userProfile, tableName]);

  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

  return (
    <div className="min-h-screen p-6 md:p-10 font-sans bg-[#F9F8F4] dark:bg-gray-900 transition-colors">
      <div className="max-w-[1000px] mx-auto">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-4">
          <div>
            <p className="text-gray-400 dark:text-gray-500 text-xs font-semibold tracking-widest mb-1 uppercase">{userProfile.team}</p>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Welcome, {userProfile.agent_name}</h1>
          </div>
          <button onClick={onLogout} className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-800 rounded-md transition border border-gray-200 dark:border-gray-700 shadow-sm bg-white dark:bg-gray-800">
            <LogOut size={16} /> Logout
          </button>
        </div>

        {/* Filters */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 tracking-tight">Your Performance</h2>
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

        {/* Stats Grid */}
        {loading ? (
          <div className="p-12 text-center text-gray-500">Loading your performance data...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {months.map(m => {
              const monthData = metrics.find(r => r.month === m);
              if (!monthData) return null;
              
              return (
                <div key={m} className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition">
                  <div className="text-xs font-bold text-[#1C6B53] dark:text-emerald-400 tracking-widest uppercase mb-4">{m}</div>
                  <div className="space-y-3">
                    {teamCols.map((col: any) => (
                      <div key={col.id} className="flex justify-between items-center">
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider">{col.label}</span>
                        <span className="text-sm font-bold text-gray-900 dark:text-white">
                          {monthData[col.id] ? monthData[col.id] : '-'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            
            {metrics.length === 0 && (
              <div className="col-span-full p-12 text-center bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm text-gray-500">
                No performance data recorded for {selectedYear} yet.
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
`;

let code = fs.readFileSync('src/app/page.tsx', 'utf-8');

// Inject the agent dashboard component just before export default function Dashboard
code = code.replace('export default function Dashboard() {', agentDashboardComponent + '\nexport default function Dashboard() {');

// Add userProfile state to Dashboard
code = code.replace(
  'const [session, setSession] = useState<any>(null);', 
  'const [session, setSession] = useState<any>(null);\n  const [userProfile, setUserProfile] = useState<any>(null);'
);

// Update Auth State Listener to fetch user profile
const authListenerOld = `  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setSession(user);
      setAuthLoading(false);
      if (user) fetchColumns();
    });`;

const authListenerNew = `  useEffect(() => {
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
    });`;
code = code.replace(authListenerOld, authListenerNew);

// Add condition to render Agent Dashboard
const renderLogicOld = `  const activeCols = columnsMap[selectedTeam] || [];
  const manageCols = columnsMap[manageColsTeam] || [];

  return (
    <div className="min-h-screen p-6`;

const renderLogicNew = `  if (userProfile?.role === 'agent') {
    return <AgentDashboard userProfile={userProfile} onLogout={handleLogout} columnsMap={columnsMap} />;
  }

  const activeCols = columnsMap[selectedTeam] || [];
  const manageCols = columnsMap[manageColsTeam] || [];

  return (
    <div className="min-h-screen p-6`;
code = code.replace(renderLogicOld, renderLogicNew);

// Fix getDoc import
if(!code.includes('getDoc,')) {
    code = code.replace('import { collection, query, where, getDocs, updateDoc, addDoc, deleteDoc, doc, setDoc }', 'import { collection, query, where, getDocs, updateDoc, addDoc, deleteDoc, doc, setDoc, getDoc }');
}

fs.writeFileSync('src/app/page.tsx', code, 'utf-8');
console.log('Successfully updated page.tsx with AgentDashboard');
