"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { auth, db } from "@/lib/firebaseClient";
import { collection, query, where, doc, setDoc, onSnapshot } from "firebase/firestore";
import { updatePassword } from "firebase/auth";
import { 
  Award, ArrowLeft, Search, Users, Check, Save, Download, 
  Sun, Moon, ChevronDown, CheckCheck, RefreshCw, 
  LogOut, PhoneIncoming, PhoneOutgoing, Camera, X, Trash2, FileText
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
    evaluator: "Mohammed Dlshad",
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

  const isAllV = vals.every(v => v === "V");
  if (isAllV) return "V";

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
  
  const canSwitchTeams = isAdmin || isManager;

  const [selectedYear, setSelectedYear] = useState("2026");
  const [selectedQuarter, setSelectedQuarter] = useState("Q1");
  
  // Top Card Summary Period: affects only the top card
  const [cardPeriodMode, setCardPeriodMode] = useState<"quarter" | "h1" | "h2" | "year">("quarter");

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

  // Cell Note Modal State (Matching exact visual in user image 1)
  const [activeNoteModal, setActiveNoteModal] = useState<{
    csrName: string;
    key: string;
    callLabel: string;
    score: string;
    noteText: string;
  } | null>(null);
  const [savingNote, setSavingNote] = useState(false);

  // Raw data from Firestore
  const [evalData, setEvalData] = useState<Record<string, any>>({});
  const [rosterMembers, setRosterMembers] = useState<any[]>([]);
  const [memberPhotos, setMemberPhotos] = useState<Record<string, string>>({});

  const saveTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});

  const effectiveSectionId = canSwitchTeams ? activeSectionId : defaultSectionId;
  const currentSection = useMemo(() => {
    return DEFAULT_SECTIONS.find(s => s.id === effectiveSectionId) || DEFAULT_SECTIONS[0];
  }, [effectiveSectionId]);

  // 1. Live real-time listener for team_members & users to sync roster & profile photos
  useEffect(() => {
    const unsubTeam = onSnapshot(collection(db, "team_members"), (snap) => {
      const members: any[] = [];
      const photos: Record<string, string> = {};
      snap.forEach(d => {
        const data = d.data();
        members.push({ id: d.id, ...data });
        const name = (data.agent_name || data.name || "").trim().toLowerCase();
        if (name && data.photo_url) {
          photos[name] = data.photo_url;
        }
      });
      setRosterMembers(members);
      setMemberPhotos(prev => ({ ...prev, ...photos }));
    }, (err) => {
      console.error("Failed to fetch team members for QA:", err);
    });

    const unsubUsers = onSnapshot(collection(db, "users"), (snap) => {
      const photos: Record<string, string> = {};
      snap.forEach(d => {
        const data = d.data();
        const name = (data.name || data.display_name || data.agent_name || "").trim().toLowerCase();
        if (name && data.photo_url) {
          photos[name] = data.photo_url;
        }
      });
      setMemberPhotos(prev => ({ ...prev, ...photos }));
    }, (err) => {
      console.error("Failed to fetch users photos for QA:", err);
    });

    return () => {
      unsubTeam();
      unsubUsers();
    };
  }, []);

  // 2. Real-time listener for quality evaluations in selected year
  useEffect(() => {
    setLoading(true);
    const q = query(
      collection(db, "quality_evaluations"),
      where("year", "==", selectedYear)
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
  }, [selectedYear]);

  // Handle score change with debounced save
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
        scores: {},
        notes: {}
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

  // Section CSRs strictly pulled and deduplicated from live team_members
  const sectionCSRs = useMemo(() => {
    const result: Record<string, string[]> = {};

    DEFAULT_SECTIONS.forEach(sec => {
      const teamAgents = rosterMembers
        .filter(m => m.team === sec.team)
        .map(m => (m.agent_name || m.name || "").trim())
        .filter(Boolean);

      const uniqueSorted = Array.from(new Set(teamAgents)).sort((a, b) => a.localeCompare(b));
      result[sec.id] = uniqueSorted;
    });

    return result;
  }, [rosterMembers]);

  const currentCsrs = useMemo(() => {
    const list = sectionCSRs[currentSection.id] || [];
    if (!searchTerm.trim()) return list;
    return list.filter(name => name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [sectionCSRs, currentSection, searchTerm]);

  const weeksList = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => i + 1);
  }, []);

  // Compute team statistics for top card (Sentence case, no "Audit", only "Quality")
  const teamQualityStats = useMemo(() => {
    let totalCallsAudited = 0;
    let sumScores = 0;
    let inboundCount = 0;
    let outboundSum = 0;
    let outboundCount = 0;
    let passCount = 0;
    const weeksWithData = new Set<string>();
    const csrTotals: Record<string, { sum: number; count: number }> = {};

    const targetQuarters = 
      cardPeriodMode === "h1" ? ["Q1", "Q2"] :
      cardPeriodMode === "h2" ? ["Q3", "Q4"] :
      cardPeriodMode === "year" ? ["Q1", "Q2", "Q3", "Q4"] :
      [selectedQuarter];

    const totalWeeksInPeriod = 
      cardPeriodMode === "year" ? 48 :
      (cardPeriodMode === "h1" || cardPeriodMode === "h2") ? 24 : 12;

    const totalTargetCalls = currentCsrs.length * 7 * totalWeeksInPeriod;

    currentCsrs.forEach(csrName => {
      const slug = csrName.toLowerCase().replace(/[^a-z0-9]/g, "_");
      const sectionSlug = currentSection.evaluator.toLowerCase().replace(/[^a-z0-9]/g, "_");

      targetQuarters.forEach(qId => {
        const docId = `${selectedYear}_${qId}_${sectionSlug}_${slug}`;
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
              if (match) weeksWithData.add(`${qId}_w${match[1]}`);
            }
          }
        });
      });
    });

    const annualAvg = totalCallsAudited > 0 ? (sumScores / totalCallsAudited).toFixed(1) : "-";
    const outboundAvg = outboundCount > 0 ? (outboundSum / outboundCount).toFixed(1) : "-";
    const passRate = totalCallsAudited > 0 ? Math.round((passCount / totalCallsAudited) * 100) : 0;
    const auditProgressPercent = totalTargetCalls > 0 ? Math.round((totalCallsAudited / totalTargetCalls) * 100) : 0;

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
      totalTargetCalls,
      auditProgressPercent,
      weeksCount: weeksWithData.size,
      totalWeeksInPeriod,
      outboundAvg,
      inboundCount,
      passRate,
      topAgent,
      totalAgents: currentCsrs.length
    };
  }, [currentCsrs, currentSection, selectedYear, selectedQuarter, cardPeriodMode, evalData]);

  const callBase = (selectedWeek - 1) * 6;

  // Profile modal opening
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

  // Open note modal for a specific cell
  const handleOpenNote = (csrName: string, key: string, callLabel: string) => {
    const slug = csrName.toLowerCase().replace(/[^a-z0-9]/g, "_");
    const sectionSlug = currentSection.evaluator.toLowerCase().replace(/[^a-z0-9]/g, "_");
    const docId = `${selectedYear}_${selectedQuarter}_${sectionSlug}_${slug}`;
    const existingNote = (evalData[docId]?.notes || {})[key] || "";
    const scoreVal = (evalData[docId]?.scores || {})[key] || "";

    setActiveNoteModal({
      csrName,
      key,
      callLabel,
      score: scoreVal,
      noteText: existingNote
    });
  };

  // Save note to Firestore
  const handleSaveNote = async () => {
    if (!activeNoteModal) return;
    setSavingNote(true);
    const { csrName, key, noteText } = activeNoteModal;
    const slug = csrName.toLowerCase().replace(/[^a-z0-9]/g, "_");
    const sectionSlug = currentSection.evaluator.toLowerCase().replace(/[^a-z0-9]/g, "_");
    const docId = `${selectedYear}_${selectedQuarter}_${sectionSlug}_${slug}`;

    try {
      const updatedNotes = {
        ...((evalData[docId]?.notes) || {})
      };
      if (noteText.trim()) {
        updatedNotes[key] = noteText.trim();
      } else {
        delete updatedNotes[key];
      }

      setEvalData(prev => {
        const currentDoc = prev[docId] || {
          year: selectedYear,
          quarter: selectedQuarter,
          evaluator: currentSection.evaluator,
          team: currentSection.team,
          csr_name: csrName,
          scores: {},
          notes: {}
        };
        return {
          ...prev,
          [docId]: {
            ...currentDoc,
            notes: updatedNotes,
            updated_at: new Date().toISOString()
          }
        };
      });

      await setDoc(doc(db, "quality_evaluations", docId), {
        year: selectedYear,
        quarter: selectedQuarter,
        evaluator: currentSection.evaluator,
        team: currentSection.team,
        csr_name: csrName,
        notes: updatedNotes,
        updated_at: new Date().toISOString()
      }, { merge: true });

      setActiveNoteModal(null);
    } catch (e) {
      console.error("Error saving note:", e);
    } finally {
      setSavingNote(false);
    }
  };

  // Delete note from Firestore
  const handleDeleteNote = async () => {
    if (!activeNoteModal) return;
    setSavingNote(true);
    const { csrName, key } = activeNoteModal;
    const slug = csrName.toLowerCase().replace(/[^a-z0-9]/g, "_");
    const sectionSlug = currentSection.evaluator.toLowerCase().replace(/[^a-z0-9]/g, "_");
    const docId = `${selectedYear}_${selectedQuarter}_${sectionSlug}_${slug}`;

    try {
      const updatedNotes = { ...((evalData[docId]?.notes) || {}) };
      delete updatedNotes[key];

      setEvalData(prev => {
        const currentDoc = prev[docId];
        if (!currentDoc) return prev;
        return {
          ...prev,
          [docId]: {
            ...currentDoc,
            notes: updatedNotes,
            updated_at: new Date().toISOString()
          }
        };
      });

      await setDoc(doc(db, "quality_evaluations", docId), {
        notes: updatedNotes,
        updated_at: new Date().toISOString()
      }, { merge: true });

      setActiveNoteModal(null);
    } catch (e) {
      console.error("Error deleting note:", e);
    } finally {
      setSavingNote(false);
    }
  };

  // Export Week Data to PDF (Replacing Clear Week Data button)
  const handleExportPDF = () => {
    const rowsData = currentCsrs.map((csrName, idx) => {
      const slug = csrName.toLowerCase().replace(/[^a-z0-9]/g, "_");
      const sectionSlug = currentSection.evaluator.toLowerCase().replace(/[^a-z0-9]/g, "_");
      const docId = `${selectedYear}_${selectedQuarter}_${sectionSlug}_${slug}`;
      const scores = evalData[docId]?.scores || {};
      const notes = evalData[docId]?.notes || {};
      const weekAvg = computeWeekAvg(scores, selectedWeek);

      const callVals = [1, 2, 3, 4, 5, 6].map(cNum => {
        const key = `w${selectedWeek}_call_${callBase + cNum}`;
        return { val: scores[key] || "-", note: notes[key] || "" };
      });
      const outboundVal = { val: scores[`w${selectedWeek}_outbound`] || "-", note: notes[`w${selectedWeek}_outbound`] || "" };

      return {
        idx: idx + 1,
        csrName,
        callVals,
        outboundVal,
        weekAvg: weekAvg !== "-" && weekAvg !== "V" ? `${weekAvg}%` : weekAvg
      };
    });

    const colAverages = [1, 2, 3, 4, 5, 6].map(cNum => {
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
      return nums.length > 0 ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1) + "%" : "-";
    });

    const outboundNums: number[] = [];
    currentCsrs.forEach(csrName => {
      const slug = csrName.toLowerCase().replace(/[^a-z0-9]/g, "_");
      const sectionSlug = currentSection.evaluator.toLowerCase().replace(/[^a-z0-9]/g, "_");
      const docId = `${selectedYear}_${selectedQuarter}_${sectionSlug}_${slug}`;
      const val = (evalData[docId]?.scores || {})[`w${selectedWeek}_outbound`];
      if (val && val.toUpperCase() !== "V" && val.toUpperCase() !== "N/A") {
        const n = parseFloat(val);
        if (!isNaN(n)) outboundNums.push(n);
      }
    });
    const outboundColAvg = outboundNums.length > 0 ? (outboundNums.reduce((a, b) => a + b, 0) / outboundNums.length).toFixed(1) + "%" : "-";

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
    const totalWeekTeamAvg = weekAverages.length > 0 ? (weekAverages.reduce((a, b) => a + b, 0) / weekAverages.length).toFixed(1) + "%" : "-";

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>FIB_Quality_${selectedYear}_${selectedQuarter}_Week${selectedWeek}_${currentSection.team.replace(/\s+/g, '_')}</title>
          <style>
            @page {
              size: A4 landscape;
              margin: 10mm 12mm;
            }
            * {
              box-sizing: border-box;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", Helvetica, Arial, sans-serif;
            }
            body {
              color: #0f172a;
              background: #ffffff;
              margin: 0;
              padding: 6px;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .header-table {
              width: 100%;
              border-bottom: 1.5px solid #e2e8f0;
              padding-bottom: 12px;
              margin-bottom: 12px;
            }
            .logo {
              height: 42px;
              width: auto;
              object-fit: contain;
            }
            .title-area h1 {
              font-size: 22px;
              font-weight: 900;
              color: #0f172a;
              margin: 0 0 3px 0;
              letter-spacing: -0.3px;
            }
            .title-area p {
              font-size: 11px;
              color: #64748b;
              margin: 0;
              font-weight: 500;
            }
            .meta-badge-box {
              display: inline-block;
              text-align: right;
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              padding: 6px 12px;
            }
            .meta-badge-box .meta-line {
              font-size: 10px;
              color: #64748b;
              font-weight: 500;
            }
            .meta-badge-box .meta-line strong {
              color: #0f172a;
              font-weight: 700;
            }
            .meta-grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 10px;
              margin-bottom: 14px;
            }
            .meta-item {
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 10px;
              padding: 8px 14px;
            }
            .meta-item.highlight {
              background: #f0fdf4;
              border: 1.5px solid #86efac;
            }
            .meta-item .label {
              font-size: 9px;
              text-transform: uppercase;
              letter-spacing: 0.6px;
              font-weight: 700;
              color: #64748b;
            }
            .meta-item.highlight .label {
              color: #166534;
            }
            .meta-item .val {
              font-size: 13px;
              font-weight: 800;
              color: #0f172a;
              margin-top: 2px;
            }
            .meta-item.highlight .val {
              color: #166534;
              font-size: 15px;
              font-weight: 900;
            }
            table.data-table {
              width: 100%;
              border-collapse: separate;
              border-spacing: 0;
              font-size: 11px;
              border: 1px solid #e2e8f0;
              border-radius: 10px;
              overflow: hidden;
            }
            table.data-table th {
              background-color: #1C6B53;
              color: #ffffff;
              font-weight: 800;
              text-align: center;
              padding: 8px 5px;
              font-size: 11px;
              letter-spacing: 0.2px;
              border-bottom: 1px solid #165a46;
            }
            table.data-table th.agent-col {
              text-align: left;
              padding-left: 12px;
            }
            table.data-table th.outbound-header {
              background-color: #b45309 !important;
              color: #ffffff;
            }
            table.data-table th.score-header {
              background-color: #0f4c3a !important;
              color: #ffffff;
              font-weight: 900;
            }
            table.data-table td {
              padding: 5.5px 4px;
              text-align: center;
              border-bottom: 1px solid #f1f5f9;
              border-right: 1px solid #f8fafc;
              font-weight: 600;
            }
            table.data-table td.agent-cell {
              text-align: left;
              padding-left: 12px;
              font-weight: 700;
              color: #0f172a;
            }
            table.data-table tr:nth-child(even) td {
              background-color: #fbfcfd;
            }
            table.data-table tr:nth-child(odd) td {
              background-color: #ffffff;
            }
            .badge-v {
              background-color: #fef3c7;
              color: #92400e;
              padding: 1.5px 6px;
              border-radius: 4px;
              font-weight: 800;
              font-size: 10px;
              border: 1px solid #fde68a;
            }
            .badge-score {
              background-color: #ecfdf5;
              color: #166534;
              font-weight: 900;
              padding: 2.5px 7px;
              border-radius: 6px;
              border: 1px solid #a7f3d0;
              font-size: 11px;
              display: inline-block;
            }
            .muted-dash {
              color: #cbd5e1;
              font-weight: 400;
            }
            .note-tag {
              display: inline-block;
              font-size: 8px;
              font-weight: 800;
              color: #dc2626;
              background: #fef2f2;
              border: 1px solid #fecaca;
              border-radius: 3px;
              padding: 0.5px 3px;
              margin-top: 1px;
            }
            .outbound-col {
              background-color: #fffdf5 !important;
              color: #92400e;
            }
            tr.total-row td {
              background-color: #f0fdf4 !important;
              color: #166534 !important;
              font-weight: 900;
              font-size: 11px;
              border-top: 2px solid #1C6B53;
              border-bottom: 2px solid #1C6B53;
              padding: 8px 4px;
            }
            tr.total-row td.total-avg-cell {
              background-color: #1C6B53 !important;
              color: #ffffff !important;
              font-size: 12px;
              font-weight: 900;
            }
            .footer {
              margin-top: 14px;
              padding-top: 8px;
              border-top: 1px solid #e2e8f0;
              display: flex;
              justify-content: space-between;
              font-size: 9px;
              color: #94a3b8;
              font-weight: 500;
            }
          </style>
        </head>
        <body>
          <table class="header-table">
            <tr>
              <td style="width: 130px; vertical-align: middle;">
                <img src="${window.location.origin}/logo.webp" class="logo" alt="FIB Logo" />
              </td>
              <td class="title-area" style="vertical-align: middle;">
                <h1>Quality Assurance Report</h1>
                <p>Official Weekly Quality Evaluation Summary & Performance Metrics</p>
              </td>
              <td style="text-align: right; vertical-align: middle;">
                <div class="meta-badge-box">
                  <div class="meta-line">Export Date: <strong>${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</strong></div>
                  <div class="meta-line" style="margin-top: 2px;">Evaluator: <strong style="color: #1C6B53;">${currentSection.evaluator}</strong></div>
                </div>
              </td>
            </tr>
          </table>

          <div class="meta-grid">
            <div class="meta-item">
              <div class="label">Year & Quarter</div>
              <div class="val">${selectedYear} • ${selectedQuarter}</div>
            </div>
            <div class="meta-item">
              <div class="label">Week Number</div>
              <div class="val">Week ${selectedWeek} (Calls ${callBase + 1}–${callBase + 6})</div>
            </div>
            <div class="meta-item">
              <div class="label">QA Evaluator</div>
              <div class="val">${currentSection.evaluator}</div>
            </div>
            <div class="meta-item highlight">
              <div class="label">Team Week Avg</div>
              <div class="val">${totalWeekTeamAvg}</div>
            </div>
          </div>

          <table class="data-table">
            <thead>
              <tr>
                <th style="width: 32px;">#</th>
                <th class="agent-col" style="min-width: 170px;">Agent Name</th>
                <th style="width: 60px;">Call ${callBase + 1}</th>
                <th style="width: 60px;">Call ${callBase + 2}</th>
                <th style="width: 60px;">Call ${callBase + 3}</th>
                <th style="width: 60px;">Call ${callBase + 4}</th>
                <th style="width: 60px;">Call ${callBase + 5}</th>
                <th style="width: 60px;">Call ${callBase + 6}</th>
                <th class="outbound-header" style="width: 75px;">Outbound</th>
                <th class="score-header" style="width: 95px;">Week ${selectedWeek} Score</th>
              </tr>
            </thead>
            <tbody>
              ${rowsData.map(r => `
                <tr>
                  <td style="color: #94a3b8; font-size: 10px; font-weight: 600;">${r.idx}</td>
                  <td class="agent-cell">${r.csrName}</td>
                  ${r.callVals.map(c => `
                    <td>
                      ${c.val === 'V' 
                        ? '<span class="badge-v">V</span>' 
                        : c.val === '-' 
                        ? '<span class="muted-dash">—</span>' 
                        : `<span style="font-weight: 800; color: #0f172a;">${c.val}</span>`}
                      ${c.note ? `<br><span class="note-tag">Note</span>` : ''}
                    </td>
                  `).join('')}
                  <td class="outbound-col">
                    ${r.outboundVal.val === 'V' 
                      ? '<span class="badge-v">V</span>' 
                      : r.outboundVal.val === '-' 
                      ? '<span class="muted-dash">—</span>' 
                      : `<span style="font-weight: 800; color: #92400e;">${r.outboundVal.val}</span>`}
                    ${r.outboundVal.note ? `<br><span class="note-tag">Note</span>` : ''}
                  </td>
                  <td>
                    ${r.weekAvg !== '-' && r.weekAvg !== 'V' 
                      ? `<span class="badge-score">${r.weekAvg}</span>` 
                      : r.weekAvg === 'V' 
                      ? '<span class="badge-v">V</span>' 
                      : '<span class="muted-dash">—</span>'}
                  </td>
                </tr>
              `).join('')}

              <tr class="total-row">
                <td colspan="2" style="text-align: left; padding-left: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Team Average</td>
                ${colAverages.map(avg => `<td>${avg === '-' ? '<span class="muted-dash">—</span>' : avg}</td>`).join('')}
                <td class="outbound-col" style="font-weight: 900; color: #92400e;">${outboundColAvg === '-' ? '<span class="muted-dash">—</span>' : outboundColAvg}</td>
                <td class="total-avg-cell">${totalWeekTeamAvg}</td>
              </tr>
            </tbody>
          </table>

          <div class="footer">
            <div>Quality Assurance System • Official Confidential Report</div>
            <div>Week ${selectedWeek} Quality Performance Summary</div>
          </div>

          <script>
            window.onload = function() {
              setTimeout(() => {
                window.print();
              }, 250);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
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

        {/* Top Evaluator Performance Card (Clean, Title Case, No Subtitle Line from Image 3) */}
        <div className="bg-gradient-to-br from-[#1C6B53] via-[#165a46] to-[#104334] text-white rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-xl shadow-[#1C6B53]/15 border border-emerald-500/30 relative overflow-hidden">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-5 pb-4 border-b border-white/10">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner shrink-0">
                <Award size={24} className="text-emerald-200" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-emerald-200">
                    QA Evaluator Performance
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/15 text-white font-bold">
                    {currentSection.team}
                  </span>
                </div>
                {/* Main Evaluator Name Title */}
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white mt-1">
                  {currentSection.evaluator}
                </h2>
              </div>
            </div>

            {/* Top Card Controls: Period Toggle (Quarter, H1, H2, Full Year) & Team Switcher for Admin/Manager */}
            <div className="flex flex-wrap items-center gap-2">
              
              {/* Card Summary Period Selector */}
              <div className="flex items-center gap-1 p-1 bg-white/10 backdrop-blur-md rounded-xl border border-white/15 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setCardPeriodMode("quarter")}
                  className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                    cardPeriodMode === "quarter" 
                      ? "bg-white text-[#1C6B53] font-black shadow-xs" 
                      : "text-white/80 hover:text-white hover:bg-white/10"
                  }`}
                  title="Quarter Summary"
                >
                  {selectedQuarter}
                </button>
                <button
                  type="button"
                  onClick={() => setCardPeriodMode("h1")}
                  className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                    cardPeriodMode === "h1" 
                      ? "bg-white text-[#1C6B53] font-black shadow-xs" 
                      : "text-white/80 hover:text-white hover:bg-white/10"
                  }`}
                  title="Semi-Annual 1 (Q1 + Q2)"
                >
                  H1 (Semi)
                </button>
                <button
                  type="button"
                  onClick={() => setCardPeriodMode("h2")}
                  className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                    cardPeriodMode === "h2" 
                      ? "bg-white text-[#1C6B53] font-black shadow-xs" 
                      : "text-white/80 hover:text-white hover:bg-white/10"
                  }`}
                  title="Semi-Annual 2 (Q3 + Q4)"
                >
                  H2 (Semi)
                </button>
                <button
                  type="button"
                  onClick={() => setCardPeriodMode("year")}
                  className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                    cardPeriodMode === "year" 
                      ? "bg-white text-[#1C6B53] font-black shadow-xs" 
                      : "text-white/80 hover:text-white hover:bg-white/10"
                  }`}
                  title="Full Year Summary"
                >
                  Full Year
                </button>
              </div>

              {/* Evaluator/Team Switcher: ONLY VISIBLE TO ADMIN & MANAGER */}
              {canSwitchTeams && (
                <div className="flex items-center gap-1.5 p-1 bg-white/10 backdrop-blur-md rounded-xl border border-white/15">
                  {DEFAULT_SECTIONS.map(sec => (
                    <button
                      key={sec.id}
                      onClick={() => setActiveSectionId(sec.id)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                        effectiveSectionId === sec.id
                          ? "bg-white text-[#1C6B53] shadow-xs font-black"
                          : "text-white/80 hover:text-white hover:bg-white/10"
                      }`}
                    >
                      {sec.evaluator}
                    </button>
                  ))}
                </div>
              )}

            </div>
          </div>

          {/* Metric KPI Cards Grid: Title Case, No "Audit", Quality Focus, Top QA Agent at Far Right */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 sm:gap-3">
            {/* 1. Quality Avg */}
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10 flex flex-col justify-between">
              <div className="text-xs font-bold text-emerald-100/90 tracking-wide">Quality Avg</div>
              <div className="text-2xl font-black text-white tracking-tight my-1">
                {teamQualityStats.annualAvg !== "-" ? `${teamQualityStats.annualAvg}%` : "—"}
              </div>
              <div className="text-[9px] text-emerald-300 font-medium">Team Quality %</div>
            </div>

            {/* 2. Completed Weeks */}
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10 flex flex-col justify-between">
              <div className="text-xs font-bold text-emerald-100/90 tracking-wide">Completed Weeks</div>
              <div className="text-2xl font-black text-white tracking-tight my-1">
                {teamQualityStats.weeksCount} / {teamQualityStats.totalWeeksInPeriod}
              </div>
              <div className="text-[9px] text-emerald-300 font-medium">Weeks Logged</div>
            </div>

            {/* 3. Planned Quality */}
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10 flex flex-col justify-between">
              <div className="text-xs font-bold text-emerald-100/90 tracking-wide">Planned Quality</div>
              <div className="text-xl sm:text-2xl font-black text-white tracking-tight my-1">
                {teamQualityStats.totalCallsAudited} / {teamQualityStats.totalTargetCalls}
              </div>
              <div className="text-[9px] text-emerald-300 font-medium">{teamQualityStats.auditProgressPercent}% Completed</div>
            </div>

            {/* 4. Inbound Quality */}
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10 flex flex-col justify-between">
              <div className="text-xs font-bold text-emerald-100/90 tracking-wide">Inbound Quality</div>
              <div className="text-2xl font-black text-white tracking-tight my-1">
                {teamQualityStats.inboundCount}
              </div>
              <div className="text-[9px] text-emerald-300 font-medium">6 Calls/Week</div>
            </div>

            {/* 5. Outbound Avg */}
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10 flex flex-col justify-between">
              <div className="text-xs font-bold text-emerald-100/90 tracking-wide">Outbound Avg</div>
              <div className="text-2xl font-black text-white tracking-tight my-1">
                {teamQualityStats.outboundAvg !== "-" ? `${teamQualityStats.outboundAvg}%` : "—"}
              </div>
              <div className="text-[9px] text-emerald-300 font-medium">1 Call/Week</div>
            </div>

            {/* 6. Top QA Agent (Moved to the Far Right) */}
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10 flex flex-col justify-between col-span-2">
              <div className="text-xs font-bold text-emerald-100/90 tracking-wide">Top QA Agent</div>
              <div className="text-sm sm:text-base font-black text-white tracking-tight my-1 truncate" title={teamQualityStats.topAgent}>
                {teamQualityStats.topAgent}
              </div>
              <div className="text-[9px] text-emerald-300 font-medium">Highest Quarterly Score</div>
            </div>
          </div>
        </div>

        {/* Toolbar: Quarter & Week Selection Bar for Data Entry */}
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

          <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1 shrink-0" />

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

        </div>

        {/* Quality Data Table: Focused Week View */}
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

            {/* Export PDF Button (Replacing Clear Week Data button) */}
            <button
              type="button"
              onClick={handleExportPDF}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-[#1C6B53] dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800/60 transition shadow-2xs cursor-pointer active:scale-95"
              title={`Export Week ${selectedWeek} Report as PDF`}
            >
              <Download size={13} />
              <span>Export PDF</span>
            </button>
          </div>

          <div 
            className="overflow-x-auto scrollbar-hide overscroll-x-contain touch-pan-x"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            <table className="w-full text-xs text-left border-collapse border-spacing-0">
              <thead>
                <tr className="bg-gray-100/95 dark:bg-gray-800/95 border-b border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 font-black text-xs">
                  <th className="sticky left-0 bg-gray-100 dark:bg-gray-800 z-20 px-5 py-3.5 min-w-[210px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)]">
                    Agent
                  </th>
                  <th className="px-2.5 py-3 text-center min-w-[100px]">
                    <div className="flex items-center justify-center gap-1 text-emerald-800 dark:text-emerald-300 font-bold">
                      <PhoneIncoming size={12} />
                      <span>Call {callBase + 1}</span>
                    </div>
                  </th>
                  <th className="px-2.5 py-3 text-center min-w-[100px]">
                    <div className="flex items-center justify-center gap-1 text-emerald-800 dark:text-emerald-300 font-bold">
                      <PhoneIncoming size={12} />
                      <span>Call {callBase + 2}</span>
                    </div>
                  </th>
                  <th className="px-2.5 py-3 text-center min-w-[100px]">
                    <div className="flex items-center justify-center gap-1 text-emerald-800 dark:text-emerald-300 font-bold">
                      <PhoneIncoming size={12} />
                      <span>Call {callBase + 3}</span>
                    </div>
                  </th>
                  <th className="px-2.5 py-3 text-center min-w-[100px]">
                    <div className="flex items-center justify-center gap-1 text-emerald-800 dark:text-emerald-300 font-bold">
                      <PhoneIncoming size={12} />
                      <span>Call {callBase + 4}</span>
                    </div>
                  </th>
                  <th className="px-2.5 py-3 text-center min-w-[100px]">
                    <div className="flex items-center justify-center gap-1 text-emerald-800 dark:text-emerald-300 font-bold">
                      <PhoneIncoming size={12} />
                      <span>Call {callBase + 5}</span>
                    </div>
                  </th>
                  <th className="px-2.5 py-3 text-center min-w-[100px]">
                    <div className="flex items-center justify-center gap-1 text-emerald-800 dark:text-emerald-300 font-bold">
                      <PhoneIncoming size={12} />
                      <span>Call {callBase + 6}</span>
                    </div>
                  </th>
                  <th className="px-3 py-3 text-center min-w-[110px] bg-amber-100/70 dark:bg-amber-950/50 text-amber-900 dark:text-amber-300 border-x border-amber-200 dark:border-amber-900/60 font-bold">
                    <div className="flex items-center justify-center gap-1">
                      <PhoneOutgoing size={12} />
                      <span>Outbound</span>
                    </div>
                  </th>
                  <th className="px-4 py-3 text-center min-w-[120px] bg-[#1C6B53] text-white font-black">
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
                    const currentDoc = evalData[docId] || {};
                    const currentScores = currentDoc.scores || {};
                    const currentNotes = currentDoc.notes || {};
                    const weekAvg = computeWeekAvg(currentScores, selectedWeek);
                    const agentPhoto = memberPhotos[csrName.trim().toLowerCase()] || "";

                    return (
                      <tr key={csrName} className="hover:bg-emerald-50/30 dark:hover:bg-gray-800/40 transition">
                        {/* Sticky CSR Name with Real Profile Photo if uploaded */}
                        <td className="sticky left-0 bg-white dark:bg-gray-900 z-10 px-5 py-3 font-bold text-xs shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)] border-r border-gray-100 dark:border-gray-800">
                          <div className="flex items-center gap-2.5">
                            {agentPhoto ? (
                              <img
                                src={agentPhoto}
                                alt={csrName}
                                className="w-7 h-7 rounded-full object-cover shadow-xs border border-emerald-500/20 ring-1 ring-emerald-500/20 shrink-0"
                              />
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-[#1C6B53] dark:text-emerald-300 flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                                {csrName.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <span className="truncate max-w-[150px]" title={csrName}>{csrName}</span>
                          </div>
                        </td>

                        {/* 6 Inbound Call Inputs with Modern Larger Styling & Visible Note Spot */}
                        {[1, 2, 3, 4, 5, 6].map(cNum => {
                          const callIndex = callBase + cNum;
                          const key = `w${selectedWeek}_call_${callIndex}`;
                          const val = currentScores[key] || "";
                          const note = currentNotes[key] || "";
                          const hasNote = Boolean(note.trim());
                          const isV = val.toUpperCase() === "V";
                          const isNA = val.toUpperCase().includes("N/A");

                          return (
                            <td key={cNum} className="p-2 text-center">
                              <div className="relative inline-block group">
                                {/* Red Corner Triangle Mark (Visible when note exists) */}
                                {hasNote && (
                                  <div 
                                    onClick={() => handleOpenNote(csrName, key, `Call ${callIndex}`)}
                                    className="absolute top-0 left-0 w-0 h-0 border-t-[9px] border-r-[9px] border-r-transparent border-t-red-500 rounded-tl-xl cursor-pointer z-10" 
                                    title={`Note: ${note}`}
                                  />
                                )}

                                <input
                                  type="text"
                                  value={val}
                                  onChange={(e) => handleScoreChange(currentSection, csrName, key, e.target.value)}
                                  onDoubleClick={() => handleOpenNote(csrName, key, `Call ${callIndex}`)}
                                  placeholder="-"
                                  className={`w-18 sm:w-20 h-10 text-center rounded-xl font-black text-sm outline-none transition-all shadow-2xs ${
                                    isV
                                      ? "bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700"
                                      : isNA
                                      ? "bg-gray-100 dark:bg-gray-800/80 text-gray-400 dark:text-gray-500 border border-gray-200 dark:border-gray-700"
                                      : "bg-white dark:bg-gray-800/90 border border-gray-200/90 dark:border-gray-700 text-gray-900 dark:text-gray-100 hover:border-emerald-400 dark:hover:border-emerald-500/70 focus:border-[#1C6B53] dark:focus:border-emerald-400 focus:ring-2 focus:ring-[#1C6B53]/20 dark:focus:ring-emerald-400/20"
                                  }`}
                                />

                                {/* Visible Note Spot on Cell */}
                                <button
                                  type="button"
                                  onClick={() => handleOpenNote(csrName, key, `Call ${callIndex}`)}
                                  className={`absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-xs ${
                                    hasNote
                                      ? "bg-red-500 text-white ring-2 ring-white dark:ring-gray-900 hover:bg-red-600 scale-100 z-10"
                                      : "bg-gray-100 hover:bg-[#1C6B53] dark:bg-gray-700 text-gray-400 hover:text-white dark:text-gray-400 ring-1 ring-gray-200/90 dark:ring-gray-600/70 hover:scale-110 opacity-70 group-hover:opacity-100 z-10"
                                  }`}
                                  title={hasNote ? `Note: ${note}` : "Add Note"}
                                >
                                  <FileText size={8} />
                                </button>
                              </div>
                            </td>
                          );
                        })}

                        {/* 1 Outbound Call Input with Modern Larger Styling & Visible Note Spot */}
                        <td className="p-2 text-center bg-amber-50/40 dark:bg-amber-950/20 border-x border-amber-200/60 dark:border-amber-900/40">
                          {(() => {
                            const key = `w${selectedWeek}_outbound`;
                            const val = currentScores[key] || "";
                            const note = currentNotes[key] || "";
                            const hasNote = Boolean(note.trim());
                            const isV = val.toUpperCase() === "V";
                            const isNA = val.toUpperCase().includes("N/A");

                            return (
                              <div className="relative inline-block group">
                                {hasNote && (
                                  <div 
                                    onClick={() => handleOpenNote(csrName, key, "Outbound Call")}
                                    className="absolute top-0 left-0 w-0 h-0 border-t-[9px] border-r-[9px] border-r-transparent border-t-red-500 rounded-tl-xl cursor-pointer z-10" 
                                    title={`Note: ${note}`}
                                  />
                                )}

                                <input
                                  type="text"
                                  value={val}
                                  onChange={(e) => handleScoreChange(currentSection, csrName, key, e.target.value)}
                                  onDoubleClick={() => handleOpenNote(csrName, key, "Outbound Call")}
                                  placeholder="-"
                                  className={`w-20 sm:w-22 h-10 text-center rounded-xl font-black text-sm outline-none transition-all shadow-2xs ${
                                    isV
                                      ? "bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700"
                                      : isNA
                                      ? "bg-gray-100 dark:bg-gray-800/80 text-gray-400 dark:text-gray-500 border border-gray-200 dark:border-gray-700"
                                      : "bg-white dark:bg-gray-800/90 border border-amber-200/90 dark:border-amber-900/50 text-gray-900 dark:text-gray-100 hover:border-amber-400 focus:border-[#1C6B53] dark:focus:border-emerald-400 focus:ring-2 focus:ring-[#1C6B53]/20"
                                  }`}
                                />

                                <button
                                  type="button"
                                  onClick={() => handleOpenNote(csrName, key, "Outbound Call")}
                                  className={`absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-xs ${
                                    hasNote
                                      ? "bg-red-500 text-white ring-2 ring-white dark:ring-gray-900 hover:bg-red-600 scale-100 z-10"
                                      : "bg-amber-100 hover:bg-[#1C6B53] dark:bg-gray-700 text-amber-700 hover:text-white dark:text-gray-400 ring-1 ring-amber-200 dark:ring-gray-600 hover:scale-110 opacity-70 group-hover:opacity-100 z-10"
                                  }`}
                                  title={hasNote ? `Note: ${note}` : "Add Note"}
                                >
                                  <FileText size={8} />
                                </button>
                              </div>
                            );
                          })()}
                        </td>

                        {/* Auto-calculated Week Score */}
                        <td className="p-2 text-center font-black text-sm bg-emerald-50/50 dark:bg-emerald-950/30">
                          <span className={`inline-block px-3 py-1.5 rounded-xl text-xs font-black shadow-2xs ${
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

      {/* Note Popover (Matching exact design of Image 1: media_1789757871116.png) */}
      {activeNoteModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-3">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-2xs" onClick={() => setActiveNoteModal(null)} />
          <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-4 w-72 sm:w-80 border border-gray-100 dark:border-gray-800 animate-in fade-in zoom-in-95 duration-100">
            
            {/* Header: Green document icon + Call Note + Red trash icon */}
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-[#1C6B53] dark:text-emerald-400" />
                <h4 className="text-sm font-black text-gray-900 dark:text-white">Call Note</h4>
              </div>
              {activeNoteModal.noteText.trim() && (
                <button
                  type="button"
                  onClick={handleDeleteNote}
                  disabled={savingNote}
                  className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/50 cursor-pointer disabled:opacity-50"
                  title="Delete Note"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>

            {/* Textarea with green border */}
            <div className="mb-3">
              <textarea
                rows={3}
                value={activeNoteModal.noteText}
                onChange={(e) => setActiveNoteModal({ ...activeNoteModal, noteText: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSaveNote();
                  }
                }}
                placeholder="Enter note (e.g. -2, Missing greeting)..."
                className="w-full p-2.5 border border-[#1C6B53] dark:border-emerald-500 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-[#1C6B53]/20 resize-none font-medium"
                autoFocus
              />
            </div>

            {/* Footer: Press Enter to save + Save Note Button */}
            <div className="flex justify-between items-center">
              <span className="text-[11px] text-gray-400 font-medium">
                Press Enter to save
              </span>
              <button
                type="button"
                onClick={handleSaveNote}
                disabled={savingNote}
                className="bg-[#1C6B53] hover:bg-[#155a45] text-white text-xs font-bold px-3.5 py-1.5 rounded-lg transition shadow-xs disabled:opacity-50 cursor-pointer flex items-center gap-1"
              >
                {savingNote ? <RefreshCw size={11} className="animate-spin" /> : null}
                <span>Save Note</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Self-Contained Profile Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowProfileModal(false)} />
          <div className="relative bg-white dark:bg-gray-900 rounded-2xl sm:rounded-3xl shadow-2xl p-5 sm:p-7 max-w-md w-full border border-gray-100 dark:border-gray-800 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">Profile Settings</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Update Your Display Name, Photo & Password</p>
              </div>
              <button onClick={() => setShowProfileModal(false)} className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 cursor-pointer">
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
