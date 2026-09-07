import re

with open("src/app/page.tsx", "r", encoding="utf-8") as f:
    code = f.read()

# 1. Imports
code = code.replace('import { supabase } from "@/lib/supabaseClient";', 
'''import { auth, db } from "@/lib/firebaseClient";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { collection, query, where, getDocs, updateDoc, addDoc, deleteDoc, doc, orderBy } from "firebase/firestore";''')

# 2. Authentication hooks
auth_old = """    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });"""
auth_new = """    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setSession(user);
      setAuthLoading(false);
    });"""
code = code.replace(auth_old, auth_new)
code = code.replace("return () => subscription.unsubscribe();", "return () => unsubscribe();")

# 3. Login / Logout
code = code.replace("""    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setAuthError(error.message);""",
"""    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      setAuthError(err.message);
    }""")

code = code.replace("    await supabase.auth.signOut();", "    await signOut(auth);")

# 4. fetchData
fetchData_old = """    const { data: members, error: membersError } = await supabase
      .from('team_members').select('*').eq('team', selectedTeam).order('id');

    if (membersError) {
      setErrorMsg(membersError.message);
      setRows([]);
      setLoading(false);
      return;
    }

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
    const roster = members || [];"""

fetchData_new = """    try {
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
"""
code = code.replace(fetchData_old, fetchData_new)

# 5. Fixing the catch for fetchData
catch_old = """    }
    setLoading(false);
  };"""
catch_new = """    }
    } catch (err: any) {
      setErrorMsg(err.message);
      setRows([]);
    }
    setLoading(false);
  };"""
code = code.replace(catch_old, catch_new)

# 6. handleBlur
handleBlur_old = """      if (row.id) {
        const { error } = await supabase.from(tableName).update(payload).eq('id', row.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from(tableName).insert([payload]).select().single();
        if (error) throw error;
        const newRows = [...rows];
        newRows[index] = { ...data, _memberId: row._memberId };
        setRows(newRows);
      }"""
handleBlur_new = """      if (row.id) {
        await updateDoc(doc(db, tableName, row.id), payload);
      } else {
        const docRef = await addDoc(collection(db, tableName), payload);
        const newRows = [...rows];
        newRows[index] = { ...payload, id: docRef.id, _memberId: row._memberId };
        setRows(newRows);
      }"""
code = code.replace(handleBlur_old, handleBlur_new)

# 7. handleAddMember
addMember_old = """      const { error } = await supabase.from('team_members').insert([{ agent_name: newMemberName.trim(), team: selectedTeam }]);
      if (error) throw error;"""
addMember_new = """      await addDoc(collection(db, 'team_members'), { agent_name: newMemberName.trim(), team: selectedTeam });"""
code = code.replace(addMember_old, addMember_new)

# 8. confirmDelete
deleteTargetType = """const [deleteTarget, setDeleteTarget] = useState<{ memberId: number; name: string } | null>(null);"""
deleteTargetType_new = """const [deleteTarget, setDeleteTarget] = useState<{ memberId: string; name: string } | null>(null);"""
code = code.replace(deleteTargetType, deleteTargetType_new)

confirmDelete_old = """      const { error } = await supabase.from('team_members').delete().eq('id', deleteTarget.memberId);
      if (error) throw error;
      await supabase.from(tableName).delete().eq('agent_name', deleteTarget.name).eq('team', selectedTeam);"""
confirmDelete_new = """      await deleteDoc(doc(db, 'team_members', deleteTarget.memberId));
      
      const q = query(collection(db, tableName), where('agent_name', '==', deleteTarget.name), where('team', '==', selectedTeam));
      const snap = await getDocs(q);
      snap.forEach(d => deleteDoc(d.ref));"""
code = code.replace(confirmDelete_old, confirmDelete_new)


with open("src/app/page.tsx", "w", encoding="utf-8") as f:
    f.write(code)
