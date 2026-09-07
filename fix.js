const fs = require('fs');
let code = fs.readFileSync('src/app/page.tsx', 'utf-8');

const newModal = `      {/* Manage Settings Modal (System Configuration) */}
      {showManageMembers && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-10 overflow-y-auto">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowManageMembers(false)} />
          <div className="relative bg-[#F9F8F4] dark:bg-gray-900 rounded-xl shadow-2xl p-8 max-w-5xl w-full border border-transparent dark:border-gray-700 mb-10">
            
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">System Configuration</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Add or remove agents and table columns for <span className="font-semibold text-[#1C6B53] dark:text-emerald-400">{selectedTeam}</span>.</p>
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
                     {TEAMS.map(t => <option key={t} value={t} className="bg-white text-gray-800">{t}</option>)}
                   </select>
                   <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                     <ChevronDown size={14} className="text-white" />
                   </div>
                </div>

                <button
                  onClick={handleAddMember}
                  className="w-full bg-[#1C6B53] hover:bg-[#155a45] text-white py-2.5 rounded-sm text-sm font-bold transition shadow-sm mb-6"
                >
                  Add Agent
                </button>

                <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1">
                  {rows.length === 0 && <div className="text-xs text-gray-400 text-center mt-4">No agents in this team.</div>}
                  {rows.map((row) => (
                    <div key={row._memberId} className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-sm p-3 flex justify-between items-center shadow-sm">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{row.agent_name}</span>
                      <div className="flex items-center gap-3">
                        <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-[10px] font-bold px-2 py-1 rounded-sm uppercase tracking-wider">
                          {selectedTeam.replace(' Team', '')}
                        </span>
                        <div className="flex gap-2">
                          <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition" title="Edit">
                            <Edit2 size={14} />
                          </button>
                          <button onClick={() => setDeleteTarget({ memberId: row._memberId, name: row.agent_name })} className="text-red-400 hover:text-red-600 transition" title="Delete">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Columns Card */}
              <div className="bg-[#F1EFE8] dark:bg-gray-800/50 rounded-xl p-6 flex flex-col h-[550px] border border-gray-200 dark:border-gray-700 shadow-sm">
                <div className="flex items-center gap-2 mb-6">
                  <Columns size={18} className="text-gray-600 dark:text-gray-300" />
                  <h3 className="font-bold text-gray-800 dark:text-gray-100">Table Columns</h3>
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
                  {activeCols.length === 0 && <div className="text-xs text-gray-400 text-center mt-4">No columns configured.</div>}
                  {activeCols.map((col) => (
                    <div key={col.id} className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-sm p-3 flex justify-between items-center shadow-sm">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{col.label}</span>
                      <div className="flex items-center gap-3">
                        <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-[9px] font-bold px-2 py-1 rounded-sm uppercase tracking-wider">
                          {col.type} • {col.aggregation}
                        </span>
                        <div className="flex gap-2">
                          <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition" title="Edit">
                            <Edit2 size={14} />
                          </button>
                          <button onClick={() => handleRemoveColumn(col.id)} className="text-red-400 hover:text-red-600 transition" title="Delete">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}`;

code = code.replace(/\{\/\*\s*Manage Settings Modal[\s\S]*?\{\/\*\s*Delete Confirmation Modal\s*\*\/\}/, newModal + '\\n\\n      {/* Delete Confirmation Modal */}');

if (!code.includes('Briefcase')) {
  code = code.replace(
    'import { Search, Trash2, UserPlus, UserMinus, Users, Moon, Sun, LogOut, Settings, Plus, X } from "lucide-react";',
    'import { Search, Trash2, UserPlus, UserMinus, Users, Moon, Sun, LogOut, Settings, Plus, X, Edit2, Briefcase, Columns, ChevronDown } from "lucide-react";'
  );
}

fs.writeFileSync('src/app/page.tsx', code, 'utf-8');
console.log('Done fix.js script');
