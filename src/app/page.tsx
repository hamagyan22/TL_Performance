"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Search, Trash2, UserPlus, UserMinus, Users } from "lucide-react";

type TeamName = 'Younis Kamal Team' | 'Ankido Buya Team' | 'Mohammed Dlshad Team';
const TEAMS: TeamName[] = ['Younis Kamal Team', 'Ankido Buya Team', 'Mohammed Dlshad Team'];

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("JAN");
  const [selectedYear, setSelectedYear] = useState("2026");
  const [selectedTeam, setSelectedTeam] = useState<TeamName>('Younis Kamal Team');
  const [rows, setRows] = useState<any[]>([]);

  // Manage members modal
  const [showManageMembers, setShowManageMembers] = useState(false);
  const [newMemberName, setNewMemberName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ memberId: number; name: string } | null>(null);

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
  const isChatTeam = selectedTeam === 'Mohammed Dlshad Team';

  const tableName =
    selectedTeam === 'Younis Kamal Team' ? 'younis_metrics' :
    selectedTeam === 'Ankido Buya Team' ? 'ankido_metrics' :
    'mohammed_metrics';

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
    setLoading(true);
    setErrorMsg(null);

    // 1. Fetch roster
    const { data: members, error: membersError } = await supabase
      .from('team_members').select('*').eq('team', selectedTeam).order('id');

    if (membersError) {
      setErrorMsg(membersError.message);
      setRows([]);
      setLoading(false);
      return;
    }

    // 2. Fetch metrics
    let query = supabase.from(tableName).select("*").eq("team", selectedTeam).eq("year", selectedYear);
    if (isAggregate) {
      query = query.in('month', aggregateMap[selectedMonth]);
    } else {
      query = query.eq('month', selectedMonth);
    }

    const { data: metricsData, error: metricsError } = await query;
    if (metricsError) {
      setErrorMsg(metricsError.message);
      setRows([]);
      setLoading(false);
      return;
    }

    const metrics = metricsData || [];
    const roster = members || [];

    if (isAggregate) {
      const agentGroups: Record<string, any[]> = {};
      metrics.forEach(row => {
        if (!agentGroups[row.agent_name]) agentGroups[row.agent_name] = [];
        agentGroups[row.agent_name].push(row);
      });

      const aggregatedRows = roster.map(member => {
        const agentRows = agentGroups[member.agent_name] || [];
        const avgRow: any = { _memberId: member.id, agent_name: member.agent_name, _readonly: true };

        if (isChatTeam) {
          ['exam', 'quality', 'productivity'].forEach(f => {
            const vals = agentRows.filter(r => r[f] && r[f].toString().trim() !== "");
            const sum = vals.reduce((acc, r) => acc + (parseFloat(r[f]) || 0), 0);
            avgRow[f] = vals.length > 0 ? (sum / vals.length).toFixed(1) : "";
          });
          // Inbound and Outbound should be SUMMED
          ['inbound', 'outbound'].forEach(f => {
            const vals = agentRows.filter(r => r[f] && r[f].toString().trim() !== "");
            const sum = vals.reduce((acc, r) => acc + (parseFloat(r[f]) || 0), 0);
            avgRow[f] = vals.length > 0 ? sum.toString() : "";
          });
          ['aht', 'art'].forEach(f => {
            const vals = agentRows.filter(r => r[f] && r[f].toString().trim() !== "");
            const sumSecs = vals.reduce((acc, r) => acc + timeToSec(r[f]), 0);
            avgRow[f] = vals.length > 0 ? secToTime(sumSecs / vals.length) : "";
          });
        } else {
          ['quality', 'productivity', 'exam'].forEach(f => {
            const vals = agentRows.filter(r => r[f] && r[f].toString().trim() !== "");
            const sum = vals.reduce((acc, r) => acc + (parseFloat(r[f]) || 0), 0);
            avgRow[f] = vals.length > 0 ? (sum / vals.length).toFixed(1) : "";
          });
          // Abandoned and Handled should be SUMMED
          ['abandoned', 'handled'].forEach(f => {
            const vals = agentRows.filter(r => r[f] && r[f].toString().trim() !== "");
            const sum = vals.reduce((acc, r) => acc + (parseFloat(r[f]) || 0), 0);
            avgRow[f] = vals.length > 0 ? sum.toString() : "";
          });
          ['aht', 'hold'].forEach(f => {
            const vals = agentRows.filter(r => r[f] && r[f].toString().trim() !== "");
            const sumSecs = vals.reduce((acc, r) => acc + timeToSec(r[f]), 0);
            avgRow[f] = vals.length > 0 ? secToTime(sumSecs / vals.length) : "";
          });
          // Wrapup should be SUMMED (time)
          ['wrapup'].forEach(f => {
            const vals = agentRows.filter(r => r[f] && r[f].toString().trim() !== "");
            const sumSecs = vals.reduce((acc, r) => acc + timeToSec(r[f]), 0);
            avgRow[f] = vals.length > 0 ? secToTime(sumSecs) : ""; // No division by length = SUM
          });
        }
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
        if (isChatTeam) {
          Object.assign(empty, { exam: "", quality: "", aht: "", art: "", productivity: "", inbound: "", outbound: "" });
        } else {
          Object.assign(empty, { quality: "", aht: "", productivity: "", wrapup: "", hold: "", abandoned: "", handled: "", exam: "" });
        }
        return empty;
      });
      setRows(mergedRows);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [selectedMonth, selectedTeam, selectedYear]);

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
        const { error } = await supabase.from(tableName).update(payload).eq('id', row.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from(tableName).insert([payload]).select().single();
        if (error) throw error;
        const newRows = [...rows];
        newRows[index] = { ...data, _memberId: row._memberId };
        setRows(newRows);
      }
    } catch (err: any) {
      setErrorMsg(`Failed to save: ${err.message}`);
    }
  };

  // Add member
  const handleAddMember = async () => {
    if (!newMemberName.trim()) return;
    try {
      const { error } = await supabase.from('team_members').insert([{ agent_name: newMemberName.trim(), team: selectedTeam }]);
      if (error) throw error;
      setNewMemberName("");
      fetchData();
    } catch (err: any) {
      setErrorMsg(`Failed to add: ${err.message}`);
    }
  };

  // Remove member
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      const { error } = await supabase.from('team_members').delete().eq('id', deleteTarget.memberId);
      if (error) throw error;
      await supabase.from(tableName).delete().eq('agent_name', deleteTarget.name).eq('team', selectedTeam);
      fetchData();
    } catch (err: any) {
      setErrorMsg(`Failed to remove: ${err.message}`);
    }
    setDeleteTarget(null);
  };

  const filteredRows = rows.filter(r =>
    r.agent_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const calcAvg = (field: string, isTime = false) => {
    const validRows = rows.filter(r => r[field] && r[field].toString().trim() !== "");
    if (validRows.length === 0) return "-";

    const sumFields = ['inbound', 'outbound', 'abandoned', 'handled', 'wrapup'];
    const shouldSum = sumFields.includes(field);

    if (isTime) {
      let totalSeconds = 0;
      validRows.forEach(r => {
        const parts = r[field].toString().split(':');
        if (parts.length === 2) totalSeconds += (parseInt(parts[0]) * 60) + parseInt(parts[1]);
        else totalSeconds += parseInt(parts[0]) || 0;
      });
      const resultSecs = shouldSum ? totalSeconds : Math.round(totalSeconds / validRows.length);
      return `${Math.floor(resultSecs / 60)}:${(resultSecs % 60).toString().padStart(2, '0')}`;
    } else {
      const sum = validRows.reduce((acc, r) => acc + parseFloat(r[field] || 0), 0);
      const result = shouldSum ? sum : sum / validRows.length;
      return Number.isInteger(result) ? result.toString() : result.toFixed(1);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9F8F4] p-6 md:p-10 font-sans text-gray-800">
      <div className="max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
          <div>
            <p className="text-gray-400 text-xs font-semibold tracking-widest mb-2 uppercase">TL Performance</p>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-gray-900">Team Lead Dashboard</h1>
          </div>
        </div>

        {/* Team Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {TEAMS.map((teamName) => {
            const isActive = selectedTeam === teamName;
            const isChat = teamName === 'Mohammed Dlshad Team';
            return (
              <button
                key={teamName}
                onClick={() => setSelectedTeam(teamName)}
                className={`text-left p-6 rounded-md shadow-sm flex flex-col justify-between h-44 transition border cursor-pointer
                  ${isActive ? 'bg-[#1C6B53] text-white border-transparent' : 'bg-white text-gray-800 border-gray-200 hover:border-gray-300'}`}
              >
                <h2 className={`text-xs font-semibold tracking-widest uppercase mb-4 ${isActive ? 'text-emerald-100' : 'text-gray-400'}`}>
                  {teamName}
                </h2>
                {isChat ? (
                  <div>
                    <div className={`flex justify-between text-[9px] tracking-widest uppercase mb-2 font-medium ${isActive ? 'text-emerald-200/80' : 'text-gray-400'}`}>
                      <span>Exam</span><span>Quality</span><span>AHT</span><span>ART</span><span>Prod</span><span>Inbound</span><span>Outbound</span>
                    </div>
                    <div className="flex justify-between font-semibold text-sm">
                      <span>{isActive ? calcAvg('exam') : '-'}</span>
                      <span>{isActive ? calcAvg('quality') : '-'}</span>
                      <span>{isActive ? calcAvg('aht', true) : '-'}</span>
                      <span>{isActive ? calcAvg('art', true) : '-'}</span>
                      <span>{isActive ? calcAvg('productivity') : '-'}</span>
                      <span>{isActive ? calcAvg('inbound') : '-'}</span>
                      <span>{isActive ? calcAvg('outbound') : '-'}</span>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className={`flex justify-between text-[9px] tracking-widest uppercase mb-2 font-medium ${isActive ? 'text-emerald-200/80' : 'text-gray-400'}`}>
                      <span>Quality</span><span>AHT</span><span>Prod</span><span>Wrapup</span><span>Hold</span><span>Abandoned</span><span>Handled</span><span>Exam</span>
                    </div>
                    <div className="flex justify-between font-semibold text-sm mb-4">
                      <span>{isActive ? calcAvg('quality') : '-'}</span>
                      <span>{isActive ? calcAvg('aht', true) : '-'}</span>
                      <span>{isActive ? calcAvg('productivity') : '-'}</span>
                      <span>{isActive ? calcAvg('wrapup', true) : '-'}</span>
                      <span>{isActive ? calcAvg('hold', true) : '-'}</span>
                      <span>{isActive ? calcAvg('abandoned') : '-'}</span>
                      <span>{isActive ? calcAvg('handled') : '-'}</span>
                      <span>{isActive ? calcAvg('exam') : '-'}</span>
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Month Tabs & Controls */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between mb-4 gap-4">
          <div className="flex flex-wrap gap-1 bg-[#F1EFE8] p-1 rounded-sm items-center">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="px-3 py-1.5 mr-2 rounded-sm text-[11px] font-bold tracking-wider uppercase bg-[#1a1a1a] text-white shadow-sm outline-none cursor-pointer"
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
                className={`px-3 py-1.5 rounded-sm text-[11px] font-bold tracking-wider transition uppercase ${
                  selectedMonth === m
                    ? 'bg-[#1a1a1a] text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-800 hover:bg-[#EAE7DF]'
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search agent..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-1.5 border border-gray-200 rounded-sm bg-white focus:outline-none focus:border-gray-400 text-sm w-48 transition"
              />
            </div>
            <span className="text-gray-500 text-xs font-medium tracking-wide whitespace-nowrap">
              {rows.length} agents
            </span>
            <button
              onClick={() => setShowManageMembers(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition rounded-sm text-xs font-bold tracking-wider uppercase shadow-sm"
            >
              <Users size={13} />
              Manage
            </button>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-[#F9F8F4] border border-gray-200 rounded-md shadow-sm overflow-x-auto">
          {errorMsg && (
            <div className="p-4 bg-red-50 text-red-600 text-sm border-b border-red-100">
              {errorMsg}
              <button onClick={() => setErrorMsg(null)} className="ml-4 underline text-red-400">dismiss</button>
            </div>
          )}

          <div className="min-w-[1100px]">
            {/* Table Header */}
            {isChatTeam ? (
              <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr] gap-2 px-4 py-3 bg-[#F4F2EC] text-[10px] font-bold tracking-widest text-gray-500 uppercase">
                <div className="pl-2">Agent</div>
                <div className="text-right">EXAM</div>
                <div className="text-right">QUALITY</div>
                <div className="text-right">AHT</div>
                <div className="text-right">ART</div>
                <div className="text-right">PRODUCTIVITY</div>
                <div className="text-right">INBOUND</div>
                <div className="text-right">OUTBOUND</div>
              </div>
            ) : (
              <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr] gap-2 px-4 py-3 bg-[#F4F2EC] text-[10px] font-bold tracking-widest text-gray-500 uppercase">
                <div className="pl-2">Agent</div>
                <div className="text-right">QUALITY %</div>
                <div className="text-right">AHT S</div>
                <div className="text-right">PROD %</div>
                <div className="text-right">WRAPUP</div>
                <div className="text-right">HOLD S</div>
                <div className="text-right">ABANDONED</div>
                <div className="text-right">HANDLED</div>
                <div className="text-right">EXAM %</div>
              </div>
            )}

            {/* Table Body */}
            <div className="divide-y divide-gray-100 bg-[#FDFCFB]">
              {loading ? (
                <div className="p-8 text-center text-sm text-gray-400">Loading data...</div>
              ) : filteredRows.length === 0 ? (
                <div className="p-8 text-center text-sm text-gray-400">No team members found. Click &quot;Manage&quot; to add members.</div>
              ) : (
                filteredRows.map((row, index) => {
                  const actualIndex = rows.findIndex(r => r === row);
                  const disabled = isAggregate || !!row._readonly;
                  const inputCls = `w-20 text-right bg-transparent border border-gray-200 rounded px-2 py-1 text-xs text-gray-600 focus:border-[#1C6B53] focus:bg-white outline-none transition ${disabled ? 'bg-gray-50 border-transparent !text-gray-800 font-medium' : ''}`;

                  return isChatTeam ? (
                    <div key={row._memberId || index} className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr] gap-2 px-4 py-1.5 items-center hover:bg-white transition">
                      <div className="pl-2 text-sm font-semibold text-gray-800">{row.agent_name}</div>
                      <div className="text-right"><input disabled={disabled} type="text" placeholder="%" value={row.exam || ''} onChange={(e) => handleChange(actualIndex, 'exam', e.target.value)} onBlur={() => handleBlur(actualIndex)} className={inputCls} /></div>
                      <div className="text-right"><input disabled={disabled} type="text" placeholder="%" value={row.quality || ''} onChange={(e) => handleChange(actualIndex, 'quality', e.target.value)} onBlur={() => handleBlur(actualIndex)} className={inputCls} /></div>
                      <div className="text-right"><input disabled={disabled} type="text" placeholder="m:ss" value={row.aht || ''} onChange={(e) => handleChange(actualIndex, 'aht', e.target.value)} onBlur={() => handleBlur(actualIndex)} className={inputCls} /></div>
                      <div className="text-right"><input disabled={disabled} type="text" placeholder="m:ss" value={row.art || ''} onChange={(e) => handleChange(actualIndex, 'art', e.target.value)} onBlur={() => handleBlur(actualIndex)} className={inputCls} /></div>
                      <div className="text-right"><input disabled={disabled} type="text" placeholder="%" value={row.productivity || ''} onChange={(e) => handleChange(actualIndex, 'productivity', e.target.value)} onBlur={() => handleBlur(actualIndex)} className={inputCls} /></div>
                      <div className="text-right"><input disabled={disabled} type="text" placeholder="#" value={row.inbound || ''} onChange={(e) => handleChange(actualIndex, 'inbound', e.target.value)} onBlur={() => handleBlur(actualIndex)} className={inputCls} /></div>
                      <div className="text-right"><input disabled={disabled} type="text" placeholder="#" value={row.outbound || ''} onChange={(e) => handleChange(actualIndex, 'outbound', e.target.value)} onBlur={() => handleBlur(actualIndex)} className={inputCls} /></div>
                    </div>
                  ) : (
                    <div key={row._memberId || index} className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr] gap-2 px-4 py-1.5 items-center hover:bg-white transition">
                      <div className="pl-2 text-sm font-semibold text-gray-800">{row.agent_name}</div>
                      <div className="text-right"><input disabled={disabled} type="text" placeholder="%" value={row.quality || ''} onChange={(e) => handleChange(actualIndex, 'quality', e.target.value)} onBlur={() => handleBlur(actualIndex)} className={inputCls} /></div>
                      <div className="text-right"><input disabled={disabled} type="text" placeholder="m:ss" value={row.aht || ''} onChange={(e) => handleChange(actualIndex, 'aht', e.target.value)} onBlur={() => handleBlur(actualIndex)} className={inputCls} /></div>
                      <div className="text-right"><input disabled={disabled} type="text" placeholder="%" value={row.productivity || ''} onChange={(e) => handleChange(actualIndex, 'productivity', e.target.value)} onBlur={() => handleBlur(actualIndex)} className={inputCls} /></div>
                      <div className="text-right"><input disabled={disabled} type="text" placeholder="#" value={row.wrapup || ''} onChange={(e) => handleChange(actualIndex, 'wrapup', e.target.value)} onBlur={() => handleBlur(actualIndex)} className={inputCls} /></div>
                      <div className="text-right"><input disabled={disabled} type="text" placeholder="m:ss" value={row.hold || ''} onChange={(e) => handleChange(actualIndex, 'hold', e.target.value)} onBlur={() => handleBlur(actualIndex)} className={inputCls} /></div>
                      <div className="text-right"><input disabled={disabled} type="text" placeholder="#" value={row.abandoned || ''} onChange={(e) => handleChange(actualIndex, 'abandoned', e.target.value)} onBlur={() => handleBlur(actualIndex)} className={inputCls} /></div>
                      <div className="text-right"><input disabled={disabled} type="text" placeholder="#" value={row.handled || ''} onChange={(e) => handleChange(actualIndex, 'handled', e.target.value)} onBlur={() => handleBlur(actualIndex)} className={inputCls} /></div>
                      <div className="text-right"><input disabled={disabled} type="text" placeholder="%" value={row.exam || ''} onChange={(e) => handleChange(actualIndex, 'exam', e.target.value)} onBlur={() => handleBlur(actualIndex)} className={inputCls} /></div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Team Average Row */}
            {!loading && (
              isChatTeam ? (
                <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr] gap-2 px-4 py-4 bg-[#F4F2EC] border-t border-gray-200 items-center">
                  <div className="text-[10px] font-bold tracking-widest text-gray-600 uppercase pl-2">TEAM AVERAGE</div>
                  <div className="text-right text-xs font-semibold text-gray-700 pr-4">{calcAvg('exam')}</div>
                  <div className="text-right text-xs font-semibold text-gray-700 pr-4">{calcAvg('quality')}</div>
                  <div className="text-right text-xs font-semibold text-gray-700 pr-4">{calcAvg('aht', true)}</div>
                  <div className="text-right text-xs font-semibold text-gray-700 pr-4">{calcAvg('art', true)}</div>
                  <div className="text-right text-xs font-semibold text-gray-700 pr-4">{calcAvg('productivity')}</div>
                  <div className="text-right text-xs font-semibold text-gray-700 pr-4">{calcAvg('inbound')}</div>
                  <div className="text-right text-xs font-semibold text-gray-700 pr-4">{calcAvg('outbound')}</div>
                </div>
              ) : (
                <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr] gap-2 px-4 py-4 bg-[#F4F2EC] border-t border-gray-200 items-center">
                  <div className="text-[10px] font-bold tracking-widest text-gray-600 uppercase pl-2">TEAM AVERAGE</div>
                  <div className="text-right text-xs font-semibold text-gray-700 pr-4">{calcAvg('quality')}</div>
                  <div className="text-right text-xs font-semibold text-gray-700 pr-4">{calcAvg('aht', true)}</div>
                  <div className="text-right text-xs font-semibold text-gray-700 pr-4">{calcAvg('productivity')}</div>
                  <div className="text-right text-xs font-semibold text-gray-700 pr-4">{calcAvg('wrapup', true)}</div>
                  <div className="text-right text-xs font-semibold text-gray-700 pr-4">{calcAvg('hold', true)}</div>
                  <div className="text-right text-xs font-semibold text-gray-700 pr-4">{calcAvg('abandoned')}</div>
                  <div className="text-right text-xs font-semibold text-gray-700 pr-4">{calcAvg('handled')}</div>
                  <div className="text-right text-xs font-semibold text-gray-700 pr-4">{calcAvg('exam')}</div>
                </div>
              )
            )}
          </div>
        </div>
        <div className="mt-4 text-[10px] text-gray-400 font-medium">
          Agent names are fixed from the roster. Use &quot;Manage&quot; to add or remove team members. Data auto-saves when you click out of a field.
        </div>
      </div>

      {/* Manage Team Members Modal */}
      {showManageMembers && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowManageMembers(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl p-8 max-w-md w-full mx-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-emerald-50">
                <Users size={20} className="text-[#1C6B53]" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Manage Team</h3>
                <p className="text-xs text-gray-400">{selectedTeam}</p>
              </div>
            </div>

            {/* Add new member */}
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                placeholder="New member name..."
                value={newMemberName}
                onChange={(e) => setNewMemberName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddMember()}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#1C6B53] transition"
              />
              <button
                onClick={handleAddMember}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#1C6B53] text-white rounded-lg text-sm font-medium hover:bg-[#155a45] transition"
              >
                <UserPlus size={14} />
                Add
              </button>
            </div>

            {/* Member list */}
            <div className="flex-1 overflow-y-auto divide-y divide-gray-100 border border-gray-100 rounded-lg">
              {rows.map((row) => (
                <div key={row._memberId} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition group">
                  <span className="text-sm font-medium text-gray-700">{row.agent_name}</span>
                  <button
                    onClick={() => setDeleteTarget({ memberId: row._memberId, name: row.agent_name })}
                    className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition p-1 rounded"
                    title="Remove member"
                  >
                    <UserMinus size={15} />
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowManageMembers(false)}
              className="mt-4 w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDeleteTarget(null)} />
          <div className="relative bg-white rounded-xl shadow-2xl p-8 max-w-sm w-full mx-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-50 mx-auto mb-4">
              <Trash2 size={22} className="text-red-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">Remove Member</h3>
            <p className="text-sm text-gray-500 text-center mb-6">
              Are you sure you want to remove <span className="font-semibold text-gray-700">{deleteTarget.name}</span> from the roster? All their metric data for this team will also be deleted.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
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
