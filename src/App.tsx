import { App as CapacitorApp } from '@capacitor/app';
import React, { useState, useEffect, useMemo } from 'react';
import { Capacitor } from '@capacitor/core';
import { 
  Layers, ClipboardList, Inbox, RefreshCw, CheckCircle, 
  ArrowUp, MapPin, Clock, User as UserIcon, X, Plus,
  Search, Home, LayoutDashboard, FileText, Users, Settings,
  Bell, MessageSquare, AlertCircle, ShieldAlert,
  Lightbulb, TrendingUp, Wifi, Building, Briefcase, 
  UserCheck, ShieldCheck, Download, Trash2, Archive, Send,
  Image as ImageIcon, MessageCircle, Link2, Camera, Calendar, Unlink, LogOut
} from 'lucide-react';
import { supabase } from './supabaseClient';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "YOUR_API_KEY_HERE";

// --- TYPES ---
type Category = 'Infrastructure' | 'IT & Systems' | 'Operations' | 'HR & Admin' | 'Security' | 'General';
type Status = 'Under Review' | 'In Progress' | 'Resolved' | 'Reported' | 'Open' | 'Closed';

interface StatusUpdate {
  status: string;
  date: string;
}

interface Issue {
  id: string; ticketId: string; title: string; description: string;
  category: string; status: Status; location: string; authorName: string;
  authorEmail: string; isAnonymous: boolean; upvotesCount: number;
  upvotedBy: string[]; updatesCount: number; createdAt: string;
  adminResponse?: string; studentFeedback?: string;
  imageUrl?: string; statusHistory: StatusUpdate[]; 
  embedding?: any; parentId?: string | null;
}

// --- UTILS ---
const getCategoryIcon = (category: string) => {
  switch(category) {
    case 'Infrastructure': return <Building size={14} />;
    case 'IT & Systems': return <Wifi size={14} />;
    case 'Operations': return <Briefcase size={14} />;
    case 'HR & Admin': return <Users size={14} />;
    case 'Security': return <ShieldAlert size={14} />;
    default: return <AlertCircle size={14} />;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'Resolved': return 'bg-emerald-100 text-emerald-800';
    case 'In Progress': return 'bg-amber-100 text-amber-800';
    case 'Under Review': return 'bg-yellow-100 text-yellow-800';
    case 'Open': case 'Reported': return 'bg-blue-100 text-blue-800';
    case 'Closed': return 'bg-gray-200 text-gray-600';
    default: return 'bg-gray-100 text-gray-700';
  }
};

const getStatusDotColor = (status: string) => {
  switch (status) {
    case 'Resolved': return 'bg-emerald-500';
    case 'In Progress': return 'bg-amber-500';
    case 'Under Review': return 'bg-yellow-500';
    case 'Open': case 'Reported': return 'bg-blue-600';
    case 'Closed': return 'bg-gray-400';
    default: return 'bg-gray-300';
  }
};

const formatTimeAgo = (dateString: string) => {
  const days = Math.floor((new Date().getTime() - new Date(dateString).getTime()) / (1000 * 3600 * 24));
  if (days === 0) return 'Today';
  if (days === 1) return '1d ago';
  return `${days}d ago`;
};

const formatDateShort = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

export default function App() {
  const [role, setRole] = useState<'none' | 'student' | 'admin'>(() => (localStorage.getItem('tf_role') as any) || 'none');
  const [userProfile, setUserProfile] = useState<{name: string, email: string, picture: string} | null>(() => {
    const saved = localStorage.getItem('tf_user');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [currentView, setCurrentView] = useState<'dashboard' | 'triage' | 'actions' | 'closed' | 'users' | 'settings' | 'my-reports'>('dashboard');
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');

  const [issues, setIssues] = useState<Issue[]>([]);
  
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [selectedActionIssue, setSelectedActionIssue] = useState<Issue | null>(null);
  
  const [isReportOpen, setIsReportOpen] = useState(false);

  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formCategory, setFormCategory] = useState<Category>('Infrastructure');
  const [formLocation, setFormLocation] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [formImage, setFormImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- DATA FETCHING & REALTIME ---
  const fetchIssues = async () => {
    const { data, error } = await supabase.from('Issue').select('*').order('createdAt', { ascending: false });
    if (!error && data) setIssues(data as Issue[]);
  };

  useEffect(() => {
    if (role !== 'none') {
      fetchIssues();
      const subscription = supabase.channel('public:Issue')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'Issue' }, (payload) => {
          fetchIssues();
          if (payload.eventType === 'UPDATE' && payload.new) {
            const updated = payload.new as Issue;
            setSelectedIssue((prev) => (prev && prev.id === updated.id ? { ...prev, ...updated } : prev));
            setSelectedActionIssue((prev) => (prev && prev.id === updated.id ? { ...prev, ...updated } : prev));
          }
        })
        .subscribe();
      return () => { supabase.removeChannel(subscription); };
    }
  }, [role]);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      CapacitorApp.addListener('backButton', ({ canGoBack }) => {
        if (!canGoBack) {
          CapacitorApp.exitApp();
        } else {
          window.history.back();
        }
      });
    }
    return () => {
      if (Capacitor.isNativePlatform()) {
        CapacitorApp.removeAllListeners();
      }
    };
  }, []);

  // --- ACTIONS ---
  const handleIssueClick = (issue: Issue, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const targetIssue = issue.parentId ? (issues.find(i => i.id === issue.parentId) || issue) : issue;
    setSelectedIssue(targetIssue);
  };

  const handleActionIssueClick = (issue: Issue) => {
    const targetIssue = issue.parentId ? (issues.find(i => i.id === issue.parentId) || issue) : issue;
    setSelectedActionIssue(targetIssue);
  };

  const handleUpvote = async (issue: Issue, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!userProfile?.email) return;

    const targetIssue = issue.parentId ? (issues.find(i => i.id === issue.parentId) || issue) : issue;
    const currentVoters = targetIssue.upvotedBy || [];
    const hasVoted = currentVoters.includes(userProfile.email);
    
    let newVoters;
    let newCount;

    if (hasVoted) {
      newVoters = currentVoters.filter(email => email !== userProfile.email);
      newCount = Math.max(0, targetIssue.upvotesCount - 1);
    } else {
      newVoters = [...currentVoters, userProfile.email];
      newCount = targetIssue.upvotesCount + 1;
    }

    setIssues(issues.map(i => i.id === targetIssue.id ? { ...i, upvotesCount: newCount, upvotedBy: newVoters } : i));
    await supabase.from('Issue').update({ upvotesCount: newCount, upvotedBy: newVoters }).eq('id', targetIssue.id);
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    const targetIssue = issues.find(i => i.id === id);
    if (!targetIssue) return;

    const newHistoryEntry = { status: newStatus, date: new Date().toISOString() };
    const updatedHistory = [...(targetIssue.statusHistory || []), newHistoryEntry];

    setIssues(issues.map(i => i.id === id ? { ...i, status: newStatus as Status, statusHistory: updatedHistory } : i));
    await supabase.from('Issue').update({ status: newStatus, statusHistory: updatedHistory }).eq('id', id);
  };

  const handleDeleteIssue = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm("Are you sure you want to permanently delete this ticket?")) return;

    try {
      await supabase.from('Issue').update({ parentId: null }).eq('parentId', id);
      const { error } = await supabase.from('Issue').delete().eq('id', id);

      if (error) {
        alert("Failed to delete from database: " + error.message);
        return;
      }
      setIssues((prev) => prev.filter((issue) => issue.id !== id));
    } catch (err: any) {
      alert("Error deleting ticket: " + (err.message || err));
    }
  };

  const handleAdminUpdate = async (id: string, text: string) => {
    if (!text.trim()) return;
    setIssues(issues.map(i => i.id === id ? { ...i, adminResponse: text } : i));
    await supabase.from('Issue').update({ adminResponse: text }).eq('id', id);
    if(selectedIssue?.id === id) setSelectedIssue({...selectedIssue, adminResponse: text});
    if(selectedActionIssue?.id === id) setSelectedActionIssue({...selectedActionIssue, adminResponse: text});
    alert('Official update sent.');
  };

  const handleStudentFeedback = async (id: string, satisfied: boolean, text: string) => {
    const newStatus = satisfied ? 'Closed' : 'In Progress';
    const targetIssue = issues.find(i => i.id === id);
    const updatedHistory = [...(targetIssue?.statusHistory || []), { status: newStatus, date: new Date().toISOString() }];

    setIssues(issues.map(i => i.id === id ? { ...i, status: newStatus, studentFeedback: text, statusHistory: updatedHistory } : i));
    await supabase.from('Issue').update({ status: newStatus, studentFeedback: text, statusHistory: updatedHistory }).eq('id', id);
    if(selectedIssue?.id === id) setSelectedIssue({...selectedIssue, status: newStatus, studentFeedback: text, statusHistory: updatedHistory});
    alert(satisfied ? 'Thank you! The task is now closed.' : 'Feedback submitted. Task reopened.');
  };

  const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setFormImage(file);
      const reader = new FileReader();
      reader.onload = (event) => { setImagePreview(event.target?.result as string); };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmitIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle || !formDesc || !formLocation) {
      alert("Please fill in all required fields.");
      return;
    }
    setIsSubmitting(true);

    let finalImageUrl = '';
    let aiEmbedding = null;
    let assignedParentId = null;

    if (formImage) {
      try {
        const fileExt = formImage.name.split('.').pop();
        const filePath = `${userProfile?.email || 'user'}/${Math.random()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('issue-images').upload(filePath, formImage);
        if (!uploadError) {
          finalImageUrl = supabase.storage.from('issue-images').getPublicUrl(filePath).data.publicUrl;
        } else {
          finalImageUrl = imagePreview || '';
        }
      } catch (err) {
        finalImageUrl = imagePreview || '';
      }
    }

    try {
      const aiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'models/gemini-embedding-001',
          content: { parts: [{ text: `${formCategory} at ${formLocation}: ${formTitle}. ${formDesc}` }] }
        })
      });
      
      const aiData = await aiResponse.json();
      
      if (aiResponse.ok && aiData?.embedding?.values) {
        aiEmbedding = aiData.embedding.values;
        const { data: similarDocs } = await supabase.rpc('match_similar_issues', {
          query_embedding: aiEmbedding,
          match_threshold: 0.85, 
          match_count: 1 
        });
        
        if (similarDocs && similarDocs.length > 0) {
          const potentialParent = issues.find(i => i.id === similarDocs[0].id);
          assignedParentId = potentialParent?.parentId ? potentialParent.parentId : similarDocs[0].id;
        }
      }
    } catch (err) {
      console.warn("AI Grouping bypassed safely:", err);
    }

    const newTicketId = `TF-${Math.floor(1000 + Math.random() * 9000)}`;
    const now = new Date().toISOString();

    const newIssuePayload = {
      id: crypto.randomUUID(), 
      ticketId: newTicketId, 
      title: formTitle, 
      description: formDesc,
      category: formCategory, 
      status: 'Open', 
      location: formLocation,
      authorName: isAnonymous ? 'Anonymous' : (userProfile?.name || 'Member'),
      authorEmail: userProfile?.email || '', 
      isAnonymous, 
      upvotesCount: 0, 
      upvotedBy: [], 
      updatesCount: 0,
      createdAt: now,
      imageUrl: finalImageUrl,
      statusHistory: [{ status: 'Open', date: now }],
      embedding: aiEmbedding,
      parentId: assignedParentId || null
    };

    const { error } = await supabase.from('Issue').insert([newIssuePayload]);
    setIsSubmitting(false);
    
    if (error) {
      alert("Database failed to save ticket: " + error.message);
    } else {
      setIsReportOpen(false); 
      setFormTitle(''); 
      setFormDesc(''); 
      setFormLocation(''); 
      setFormImage(null); 
      setImagePreview(null); 
      fetchIssues();
    }
  };

  const exportToCSV = () => {
    const parentIssuesList = issues.filter(i => !i.parentId);
    const headers = ['Ticket ID', 'Title', 'Category', 'Location', 'Status', 'Upvotes', 'Date', 'Grouped Count'];
    const rows = parentIssuesList.map(i => [
        i.ticketId, `"${i.title.replace(/"/g, '""')}"`, i.category, `"${i.location.replace(/"/g, '""')}"`, 
        i.status, i.upvotesCount, new Date(i.createdAt).toLocaleDateString(), issues.filter(child => child.parentId === i.id).length
    ]);
    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }));
    link.download = `PulseGrid_Report_${new Date().toLocaleDateString()}.csv`;
    link.click();
  };

  const logout = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    localStorage.clear();
    setRole('none');
    setUserProfile(null);
    setCurrentView('dashboard');
  };

  // --- DERIVED DATA & FILTERS ---
  const parentIssues = useMemo(() => issues.filter(i => !i.parentId), [issues]);
  const activeParentIssues = useMemo(() => parentIssues.filter(i => i.status !== 'Closed'), [parentIssues]);
  
  const countByStatus = (status: string) => parentIssues.filter(i => i.status === status || (status === 'Open' && i.status === 'Reported')).length;
  
  const displayIssues = useMemo(() => {
    const filtered = issues.filter(issue => {
      const matchesCat = activeFilter === 'All' || issue.category === activeFilter;
      const matchesSearch = searchQuery === '' || issue.title.toLowerCase().includes(searchQuery.toLowerCase()) || issue.ticketId.toLowerCase().includes(searchQuery.toLowerCase());
      
      let matchesView = false;
      if (currentView === 'my-reports') {
         matchesView = issue.authorEmail === userProfile?.email;
      } else if (currentView === 'closed') {
         matchesView = issue.status === 'Closed' && !issue.parentId;
      } else {
         matchesView = issue.status !== 'Closed' && !issue.parentId;
      }
      return matchesCat && matchesSearch && matchesView;
    });

    return filtered.sort((a, b) => b.upvotesCount - a.upvotesCount);
  }, [issues, activeFilter, searchQuery, currentView, userProfile]);

  const totalIssues = activeParentIssues.length;

  const metrics = useMemo(() => {
    const total = totalIssues;
    const pending = parentIssues.filter(i => (i.status === 'Under Review' || i.status === 'Reported' || i.status === 'Open')).length;
    const inProgress = parentIssues.filter(i => i.status === 'In Progress').length;
    const resolved = parentIssues.filter(i => i.status === 'Resolved').length;

    const now = new Date().getTime();
    const oneWeek = 7 * 24 * 60 * 60 * 1000;
    const thisWeekTotal = parentIssues.filter(i => now - new Date(i.createdAt).getTime() <= oneWeek).length;
    const prevWeekTotal = parentIssues.filter(i => {
      const diff = now - new Date(i.createdAt).getTime();
      return diff > oneWeek && diff <= 2 * oneWeek;
    }).length;

    const growthPct = prevWeekTotal === 0 ? (thisWeekTotal > 0 ? 100 : 0) : Math.round(((thisWeekTotal - prevWeekTotal) / prevWeekTotal) * 100);
    const growthLabel = growthPct >= 0 ? `+${growthPct}% vs last week` : `${growthPct}% vs last week`;

    return { total, pending, inProgress, resolved, growthLabel };
  }, [parentIssues, totalIssues]);

  const chartData = useMemo(() => {
    const categories = [
      { label: 'Infra', key: 'Infrastructure', color: 'bg-blue-500', stroke: '#3B82F6' },
      { label: 'IT', key: 'IT & Systems', color: 'bg-indigo-500', stroke: '#6366F1' },
      { label: 'Ops', key: 'Operations', color: 'bg-emerald-500', stroke: '#10B981' },
      { label: 'HR', key: 'HR & Admin', color: 'bg-amber-500', stroke: '#F59E0B' },
      { label: 'Sec', key: 'Security', color: 'bg-red-500', stroke: '#EF4444' },
      { label: 'Gen', key: 'General', color: 'bg-gray-500', stroke: '#6B7280' }
    ];

    let maxBarValue = 1; 
    const stats = categories.map(cat => {
      const catIssues = activeParentIssues.filter(i => i.category === cat.key || (cat.key === 'General' && !categories.find(c => c.key === i.category && c.key !== 'General')));
      const openCount = catIssues.filter(i => ['Reported', 'Open', 'Under Review', 'In Progress'].includes(i.status)).length;
      const resolvedCount = catIssues.filter(i => i.status === 'Resolved').length;
      
      if (openCount > maxBarValue) maxBarValue = openCount;
      if (resolvedCount > maxBarValue) maxBarValue = resolvedCount;
      return { ...cat, openCount, resolvedCount, totalCat: catIssues.length };
    });

    const bars = stats.map(s => ({
      ...s,
      oHeight: maxBarValue > 0 ? (s.openCount / maxBarValue) * 100 : 0,
      rHeight: maxBarValue > 0 ? (s.resolvedCount / maxBarValue) * 100 : 0,
    }));

    const total = totalIssues || 1;
    let acc = 0;
    const doughnutSegments = stats.map(s => {
       const length = (s.totalCat / total) * 100;
       const offset = 100 - acc;
       acc += length;
       return { ...s, length, offset, pct: Math.round((s.totalCat / total) * 100) };
    }).filter(s => s.length > 0);

    return { bars, doughnutSegments };
  }, [parentIssues, totalIssues, activeParentIssues]);

  const pendingFeedbackCount = issues.filter(i => i.status === 'Resolved' && i.authorEmail === userProfile?.email).length;
  const unreadAdminCount = issues.filter(i => i.adminResponse && i.authorEmail === userProfile?.email && i.status !== 'Closed').length;
  const totalNotifs = pendingFeedbackCount + unreadAdminCount;

  // =========================================================================
  // ROLE SELECTOR SCREEN (Replaces Login Screen)
  // =========================================================================
  if (role === 'none') {
    const selectRole = (selectedRole: 'student' | 'admin') => {
      const profileData = {
        name: selectedRole === 'admin' ? 'Workspace Admin' : 'Team Member',
        email: selectedRole === 'admin' ? 'admin@PulseGrid.com' : 'member@PulseGrid.com',
        picture: `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedRole}`
      };
      setUserProfile(profileData);
      setRole(selectedRole);
      localStorage.setItem('tf_role', selectedRole);
      localStorage.setItem('tf_user', JSON.stringify(profileData));
      setCurrentView('dashboard');
    };

    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center items-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100 w-full max-w-md text-center">
          <div className="w-16 h-16 bg-[#104B3D] rounded-2xl flex items-center justify-center mx-auto mb-6 transform -rotate-3 shadow-lg shadow-slate-900/20">
            <Layers className="text-white" size={32} />
          </div>
          <h1 className="text-2xl font-black text-slate-900 mb-1 tracking-tight">PulseGrid</h1>
          <p className="text-xs text-slate-500 mb-8 font-medium">Select your workspace view to continue</p>
          
          <div className="space-y-3">
            <button 
              onClick={() => selectRole('admin')}
              className="w-full bg-[#104B3D] hover:bg-slate-800 text-white font-bold py-4 px-6 rounded-2xl transition-all shadow-md shadow-slate-900/20 flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <ShieldAlert size={20} className="text-slate-400 group-hover:text-white transition-colors" />
                <div className="text-left">
                  <p className="text-sm font-bold">Admin View</p>
                  <p className="text-[10px] text-slate-400 font-normal">Manage triage, analytics & responses</p>
                </div>
              </div>
              <span className="text-xs font-bold text-slate-400 group-hover:translate-x-1 transition-transform">→</span>
            </button>

            <button 
              onClick={() => selectRole('student')}
              className="w-full bg-slate-50 hover:bg-slate-100 text-slate-900 border border-slate-200 font-bold py-4 px-6 rounded-2xl transition-all flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <Users size={20} className="text-slate-500" />
                <div className="text-left">
                  <p className="text-sm font-bold">Member / User View</p>
                  <p className="text-[10px] text-slate-500 font-normal">Submit issues, upvote & track tasks</p>
                </div>
              </div>
              <span className="text-xs font-bold text-slate-400 group-hover:translate-x-1 transition-transform">→</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const NavButton = ({ view, icon: Icon, label, badge }: any) => (
    <button 
      onClick={() => { setCurrentView(view); setSearchQuery(''); setActiveFilter('All'); }} 
      className={`flex items-center justify-between w-full px-3 py-2.5 rounded-lg font-semibold transition-colors text-sm ${currentView === view ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'}`}
    >
      <div className="flex items-center gap-3"><Icon size={16} /> {label}</div>
      {badge > 0 && <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">{badge}</span>}
    </button>
  );
  
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex font-sans text-slate-900 text-sm w-full max-w-[100vw] overflow-x-hidden">
      {/* ========================================================================= */}
      {/* DESKTOP SIDEBAR */}
      {/* ========================================================================= */}
      <aside className="hidden md:flex flex-col w-56 bg-[#104B3D] text-white fixed h-full z-20 shadow-xl">
        <div className="p-5 flex items-center gap-3">
          <img src="/CampusVoice_logo.png" alt="Logo" className="w-7 h-7 rounded-lg object-contain" />
          <h1 className="text-lg font-bold tracking-wide">PulseGrid</h1>
        </div>
        <nav className="p-3 flex-1 flex flex-col gap-1.5 mt-2">
          {role === 'student' ? (
            <>
              <NavButton view="dashboard" icon={Home} label="Home" />
              <button onClick={() => { setCurrentView('dashboard'); document.getElementById('search')?.focus(); }} className="flex items-center gap-3 px-3 py-2.5 text-white/70 hover:bg-white/5 hover:text-white rounded-lg font-medium transition-colors text-sm w-full">
                <Search size={16} /> Browse Issues
              </button>
              <NavButton view="my-reports" icon={FileText} label="My Submissions" />
              <button onClick={() => setIsNotifOpen(true)} className="flex items-center justify-between px-3 py-2.5 text-white/70 hover:bg-white/5 hover:text-white rounded-lg font-medium transition-colors text-sm w-full">
                <div className="flex items-center gap-3"><Bell size={16} /> Notifications</div>
                {totalNotifs > 0 && <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">{totalNotifs}</span>}
              </button>
            </>
          ) : (
            <>
              <NavButton view="dashboard" icon={LayoutDashboard} label="Dashboard" />
              <NavButton view="triage" icon={CheckCircle} label="Triage & Mgmt" />
              <NavButton view="actions" icon={MessageSquare} label="Admin Actions" />
              <NavButton view="closed" icon={Archive} label="Closed Archive" />
              <NavButton view="users" icon={Users} label="Users" />
              <NavButton view="settings" icon={Settings} label="Settings" />
            </>
          )}
        </nav>
      </aside>

      {/* ========================================================================= */}
      {/* MOBILE BOTTOM NAVIGATION */}
      {/* ========================================================================= */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-40 flex justify-around items-end px-2 pb-5 pt-2 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        {role === 'student' ? (
          <>
            <button onClick={() => setCurrentView('dashboard')} className={`flex flex-col items-center p-2 rounded-xl transition-colors ${currentView === 'dashboard' ? 'text-indigo-600' : 'text-slate-400'}`}>
              <Home size={22} /><span className="text-[10px] font-bold mt-1">Home</span>
            </button>
            <button onClick={() => setCurrentView('my-reports')} className={`flex flex-col items-center p-2 rounded-xl transition-colors ${currentView === 'my-reports' ? 'text-indigo-600' : 'text-slate-400'}`}>
              <FileText size={22} /><span className="text-[10px] font-bold mt-1">Reports</span>
            </button>
            
            <div className="relative -top-5">
              <button onClick={() => setIsReportOpen(true)} className="flex items-center justify-center w-14 h-14 rounded-full bg-[#104B3D] text-white shadow-lg border-4 border-[#F8FAFC] active:scale-95 transition-transform">
                <Plus size={28} />
              </button>
            </div>

            <button onClick={() => setIsNotifOpen(true)} className="flex flex-col items-center p-2 rounded-xl text-slate-400 relative">
              <Bell size={22}/>
              {totalNotifs > 0 && <span className="absolute top-1 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>}
              <span className="text-[10px] font-bold mt-1">Alerts</span>
            </button>
            <button onClick={logout} className="flex flex-col items-center p-2 rounded-xl text-red-500">
              <LogOut size={22}/><span className="text-[10px] font-bold mt-1">Exit</span>
            </button>
          </>
        ) : (
          <>
            <button onClick={() => setCurrentView('dashboard')} className={`flex flex-col items-center p-3 rounded-xl transition-colors ${currentView === 'dashboard' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400'}`}><LayoutDashboard size={24}/></button>
            <button onClick={() => setCurrentView('triage')} className={`flex flex-col items-center p-3 rounded-xl transition-colors ${currentView === 'triage' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400'}`}><CheckCircle size={24}/></button>
            <button onClick={() => setCurrentView('actions')} className={`flex flex-col items-center p-3 rounded-xl transition-colors ${currentView === 'actions' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400'}`}><MessageSquare size={24}/></button>
            <button onClick={logout} className="flex flex-col items-center p-3 rounded-xl text-red-500"><LogOut size={24}/></button>
          </>
        )}
      </nav>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 md:ml-56 flex flex-col min-h-screen pb-24 md:pb-6 w-full max-w-[100vw] overflow-x-hidden">
        <header className="bg-[#F8FAFC] px-4 md:px-6 py-4 flex justify-between items-center sticky top-0 z-10 w-full max-w-[100vw]">
          <div className="relative w-full max-w-sm mr-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input id="search" type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search tickets..." className="w-full bg-white border border-slate-200 rounded-full py-2 pl-10 pr-4 text-xs shadow-sm outline-none focus:ring-2 focus:ring-indigo-500/20" />
          </div>
          <div className="flex items-center gap-3 md:gap-5 shrink-0">
            <div className="hidden md:flex items-center gap-2 text-xs font-semibold text-slate-600">
              <ShieldAlert size={14}/> {role === 'admin' ? 'Admin View' : 'Member View'}
            </div>
            <div className="flex items-center gap-2.5 cursor-pointer hover:opacity-80 transition-opacity" onClick={logout} title="Click to switch role">
              <div className="w-8 h-8 rounded-full bg-[#104B3D] text-white flex items-center justify-center font-bold text-xs overflow-hidden shadow-sm">
                {userProfile?.picture ? <img src={userProfile.picture} alt="Profile" /> : userProfile?.name.charAt(0)}
              </div>
              <div className="hidden md:block">
                <p className="font-bold text-xs leading-none text-slate-900">{userProfile?.name}</p>
                <p className="text-[10px] text-slate-500 font-medium hover:text-red-500 transition-colors">Switch View</p>
              </div>
            </div>
          </div>
        </header>

        <div className="p-4 md:p-6 flex-1 max-w-6xl mx-auto w-full">
          {/* ========================================================================= */}
          {/* ADMIN: ACTIONS TAB */}
          {/* ========================================================================= */}
          {currentView === 'actions' && role === 'admin' && (
            <div className="animate-fadeIn">
              <h2 className="text-2xl md:text-3xl font-black text-slate-900 mb-2">Admin Actions</h2>
              <p className="text-slate-500 text-xs mb-6">Select an active ticket to post an official response.</p>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden h-[400px] md:h-[600px] flex flex-col">
                  <div className="p-4 border-b border-slate-100 bg-slate-50"><h3 className="font-bold text-sm">Active Issues</h3></div>
                  <div className="overflow-y-auto flex-1 p-2 space-y-2">
                    {activeParentIssues.map(issue => (
                      <div key={issue.id} onClick={() => handleActionIssueClick(issue)} className={`p-4 rounded-xl border cursor-pointer transition-all ${selectedActionIssue?.id === issue.id ? 'border-indigo-600 bg-indigo-50/50' : 'border-slate-100 hover:border-slate-300 bg-white'}`}>
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-[9px] text-slate-400 font-mono">{issue.ticketId}</span>
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${getStatusColor(issue.status)}`}>{issue.status}</span>
                        </div>
                        <h4 className="font-bold text-sm text-slate-900 truncate">{issue.title}</h4>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 md:p-6 flex flex-col h-[500px] md:h-[600px]">
                  {selectedActionIssue ? (
                    <>
                      <h3 className="font-bold text-lg text-slate-900 mb-2">{selectedActionIssue.title}</h3>
                      <p className="text-xs text-slate-500 mb-4 md:mb-6 pb-4 md:pb-6 border-b border-slate-100">{selectedActionIssue.description}</p>
                      
                      <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
                        {selectedActionIssue.adminResponse && (
                          <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                            <p className="text-[9px] font-black text-blue-800 uppercase mb-1">Previous Official Update</p>
                            <p className="text-sm text-blue-900">{selectedActionIssue.adminResponse}</p>
                          </div>
                        )}
                      </div>

                      <div className="pt-4 border-t border-slate-100">
                        <label className="text-[10px] font-black text-slate-500 uppercase mb-2 block">Post New Update</label>
                        <textarea id="adminUpdateField" rows={3} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 mb-3 resize-none" placeholder="Provide an official response..."></textarea>
                        <button onClick={() => {
                          const el = document.getElementById('adminUpdateField') as HTMLInputElement;
                          handleAdminUpdate(selectedActionIssue.id, el.value);
                          el.value = '';
                        }} className="w-full bg-[#104B3D] hover:bg-slate-800 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all">
                          <Send size={14} /> Send Official Update
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                      <MessageSquare size={40} className="mb-4 text-slate-200" />
                      <p className="font-bold">Select an issue</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ADMIN: TRIAGE OR CLOSED ISSUES TABLE */}
          {/* ========================================================================= */}
          {(currentView === 'triage' || currentView === 'closed') && role === 'admin' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-fadeIn">
              <div className="p-4 md:p-5 border-b border-slate-100 flex flex-col md:flex-row md:justify-between md:items-center gap-3">
                <h3 className="font-bold text-sm flex items-center gap-2">
                  {currentView === 'triage' ? <ClipboardList size={16}/> : <Archive size={16}/>} 
                  {currentView === 'triage' ? 'Triage & Management' : 'Closed Archive'}
                </h3>
                <button onClick={exportToCSV} className="w-full md:w-auto px-4 py-2 md:py-1.5 bg-[#104B3D] hover:bg-slate-800 text-white rounded-md text-[11px] font-bold flex items-center justify-center gap-1.5">
                  <Download size={12}/> Export CSV
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr className="bg-slate-50 text-[9px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                      <th className="py-3 px-4 w-8"><input type="checkbox" className="rounded border-slate-300" /></th>
                      <th className="py-3 px-2">ID</th>
                      <th className="py-3 px-4">Issue</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Location</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Upvotes</th>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4 text-center">Delete</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {displayIssues.map(issue => (
                      <tr key={issue.id} className="hover:bg-slate-50/50 text-[11px] font-semibold text-slate-700 transition-colors">
                        <td className="py-3 px-4"><input type="checkbox" className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" /></td>
                        <td className="py-3 px-2 text-slate-400 font-mono text-[9px]">{issue.ticketId}</td>
                        <td className="py-3 px-4 flex items-center gap-2.5 cursor-pointer hover:text-indigo-600" onClick={(e) => handleIssueClick(issue, e as any)}>
                          <div className="w-7 h-7 rounded-md bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">{getCategoryIcon(issue.category)}</div>
                          <div className="max-w-[150px] md:max-w-[200px] truncate font-bold text-slate-900">{issue.title}</div>
                        </td>
                        <td className="py-3 px-4"><span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[9px] font-bold uppercase">{issue.category}</span></td>
                        <td className="py-3 px-4 text-slate-500 truncate max-w-[100px]">{issue.location}</td>
                        <td className="py-3 px-4">
                          {issue.status === 'Closed' ? (
                            <span className="px-2 py-1 rounded-full border text-[9px] font-bold uppercase bg-slate-200 text-slate-600 border-slate-300">Closed</span>
                          ) : (
                            <select value={issue.status} onChange={(e) => handleStatusChange(issue.id, e.target.value)} className={`px-2 py-1 rounded-full border text-[9px] font-bold uppercase outline-none cursor-pointer ${getStatusColor(issue.status)}`}>
                              <option value="Reported">Reported</option><option value="Open">Open</option><option value="Under Review">Under Review</option><option value="In Progress">In Progress</option><option value="Resolved">Resolved</option>
                            </select>
                          )}
                        </td>
                        <td className="py-3 px-4 font-bold flex items-center gap-1 text-slate-600"><ArrowUp size={10} className="text-slate-400"/> {issue.upvotesCount}</td>
                        <td className="py-3 px-4 text-slate-400">{new Date(issue.createdAt).toLocaleDateString()}</td>
                        <td className="py-3 px-4 text-center"><button onClick={(e) => handleDeleteIssue(issue.id, e)} className="p-1.5 hover:bg-red-50 text-red-500 rounded"><Trash2 size={14}/></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* USER & SETTINGS PLACEHOLDERS */}
          {/* ========================================================================= */}
          {currentView === 'users' && (
             <div className="max-w-6xl mx-auto bg-white rounded-2xl p-6 md:p-8 border border-slate-200 shadow-sm animate-fadeIn">
                <h2 className="text-2xl font-black text-slate-900 mb-4">Manage Users</h2>
                <div className="p-8 md:p-12 border-2 border-dashed border-slate-200 rounded-xl text-center text-slate-400 font-bold flex flex-col items-center gap-3">
                  <Users size={32} className="text-slate-300" /> User Database Module active in read-only sync
                </div>
             </div>
          )}
          {currentView === 'settings' && (
             <div className="max-w-6xl mx-auto bg-white rounded-2xl p-6 md:p-8 border border-slate-200 shadow-sm animate-fadeIn">
                <h2 className="text-2xl font-black text-slate-900 mb-4">Platform Settings</h2>
                <div className="p-8 md:p-12 border-2 border-dashed border-slate-200 rounded-xl text-center text-slate-400 font-bold flex flex-col items-center gap-3">
                  <Settings size={32} className="text-slate-300" /> Settings Module configured for Enterprise SaaS
                </div>
             </div>
          )}

          {/* ========================================================================= */}
          {/* STUDENT / MEMBER DASHBOARD & MY REPORTS */}
          {/* ========================================================================= */}
          {(currentView === 'dashboard' || currentView === 'my-reports') && role === 'student' && (
            <div className="max-w-5xl mx-auto animate-fadeIn">
              {currentView === 'my-reports' ? (
                <div className="mb-6 flex flex-col md:flex-row md:justify-between md:items-center gap-3">
                  <div>
                    <h2 className="text-2xl font-black text-slate-900">My Submissions</h2>
                    <p className="text-xs text-slate-500 mt-1 font-medium">Tracking issues submitted from {userProfile?.email}</p>
                  </div>
                  <button onClick={() => setCurrentView('dashboard')} className="text-xs font-bold text-indigo-600 bg-white px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 self-start md:self-auto">← Back to All Issues</button>
                </div>
              ) : (
<div className="bg-[#E9F3EB] rounded-2xl p-5 md:p-8 flex justify-between items-center mb-6 relative overflow-hidden shadow-sm">
  <div className="relative z-10 max-w-lg">
    <p className="text-[#104B3D] text-[10px] font-bold tracking-widest uppercase mb-2">WELCOME TO</p>
    <h2 className="text-2xl md:text-4xl font-black text-[#104B3D] mb-3 leading-tight">PulseGrid</h2>
    <p className="text-[#104B3D]/80 text-xs md:text-sm mb-6 font-medium">Raise requests. Upvote operations. Track resolutions seamlessly.</p>
    <button onClick={() => setIsReportOpen(true)} className="hidden md:flex bg-[#104B3D] hover:bg-[#0a3329] text-white font-bold py-2.5 px-5 rounded-full items-center gap-2 text-sm transition-transform hover:scale-105 shadow-md shadow-[#104B3D]/20">
      <Plus size={16} /> Submit New Task
    </button>
  </div>
  <div className="absolute right-0 bottom-0 opacity-20 pointer-events-none">
    <Building size={160} className="md:w-[220px] md:h-[220px] text-[#104B3D] translate-y-8 translate-x-8" />
  </div>
</div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 md:gap-4 mb-6 md:mb-8">
                <div className="bg-white rounded-xl p-3 md:p-5 shadow-sm border border-slate-200 flex flex-col md:flex-row items-center md:items-start gap-2 md:gap-4 text-center md:text-left"><div className="w-8 h-8 md:w-12 md:h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600"><AlertCircle className="w-4 h-4 md:w-5 md:h-5"/></div><div><p className="text-lg md:text-2xl font-black text-slate-900 leading-none">{countByStatus('Open')}</p><p className="text-[9px] md:text-xs font-semibold text-slate-500 mt-1">Open</p></div></div>
                <div className="bg-white rounded-xl p-3 md:p-5 shadow-sm border border-slate-200 flex flex-col md:flex-row items-center md:items-start gap-2 md:gap-4 text-center md:text-left"><div className="w-8 h-8 md:w-12 md:h-12 rounded-full bg-amber-50 flex items-center justify-center text-amber-600"><Clock className="w-4 h-4 md:w-5 md:h-5"/></div><div><p className="text-lg md:text-2xl font-black text-slate-900 leading-none">{countByStatus('In Progress')}</p><p className="text-[9px] md:text-xs font-semibold text-slate-500 mt-1">Progress</p></div></div>
                <div className="col-span-2 md:col-span-1 bg-white rounded-xl p-3 md:p-5 shadow-sm border border-slate-200 flex flex-row items-center justify-center md:justify-start gap-3 md:gap-4"><div className="w-8 h-8 md:w-12 md:h-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600"><CheckCircle className="w-4 h-4 md:w-5 md:h-5"/></div><div><p className="text-lg md:text-2xl font-black text-slate-900 leading-none">{countByStatus('Resolved')}</p><p className="text-[9px] md:text-xs font-semibold text-slate-500 mt-1">Resolved</p></div></div>
              </div>

              <div className="flex flex-col lg:flex-row gap-6">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                    <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">{currentView === 'my-reports' ? '📌 My Submissions' : '📢 Active Team Queue'}</h3>
                    {currentView === 'dashboard' && (<button onClick={() => setCurrentView('my-reports')} className="text-xs font-bold text-indigo-600 hover:underline self-start sm:self-auto">View my submissions →</button>)}
                  </div>
                  
                  <div className="flex flex-wrap pb-2 gap-2 mb-4">
                    {['All', 'Infrastructure', 'IT & Systems', 'Operations', 'HR & Admin', 'Security', 'General'].map(cat => (
                      <button key={cat} onClick={() => setActiveFilter(cat)} className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-bold border transition-colors ${activeFilter === cat ? 'bg-[#104B3D] text-white border-[#104B3D]' : 'bg-white text-slate-600 hover:border-slate-300'}`}>{cat}</button>
                    ))}
                  </div>

                  {displayIssues.length === 0 ? (
                    <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 p-8"><Inbox size={40} className="mx-auto text-slate-300 mb-3" /><h4 className="font-bold text-slate-800 text-sm">No items found</h4></div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      {displayIssues.map(issue => {
                        const isChild = !!issue.parentId;
                        const targetIssue = isChild ? (issues.find(i => i.id === issue.parentId) || issue) : issue;
                        
                        const hasVoted = targetIssue.upvotedBy?.includes(userProfile?.email || '');
                        const lastStatus = targetIssue.statusHistory && targetIssue.statusHistory.length > 0 
                          ? targetIssue.statusHistory[targetIssue.statusHistory.length - 1] 
                          : { status: targetIssue.status, date: targetIssue.createdAt };

                        const childCount = issues.filter(i => i.parentId === issue.id).length;

                        return (
                          <article 
                            key={issue.id} 
                            onClick={(e) => handleIssueClick(issue, e)} 
                            className={`bg-white rounded-2xl p-4 md:p-5 border border-slate-200 shadow-sm hover:shadow-md cursor-pointer flex flex-col gap-4 transition-shadow relative
                               ${targetIssue.status === 'Resolved' && issue.authorEmail === userProfile?.email ? 'ring-2 ring-emerald-400' : ''}`}
                          >
                            {isChild && (
                                <div className="absolute top-0 right-0 bg-indigo-50 text-indigo-700 px-3 py-1 rounded-bl-xl rounded-tr-2xl text-[9px] font-black uppercase tracking-wider flex items-center gap-1"><Link2 size={10}/> Merged Ticket</div>
                            )}

                            <div className="flex flex-row gap-3 md:gap-5 pt-2">
                              {/* Left: Vote Box */}
                              <div 
                                onClick={(e) => handleUpvote(issue, e)} 
                                className={`flex flex-col items-center justify-center rounded-2xl w-14 h-16 md:w-16 md:h-20 shrink-0 transition-colors ${hasVoted ? 'bg-[#104B3D] text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                              >
                                <ArrowUp size={18} strokeWidth={2.5} className="md:w-5 md:h-5" />
                                <span className="text-lg md:text-xl font-black mt-0.5 leading-none">{targetIssue.upvotesCount}</span>
                                <span className="text-[7px] md:text-[8px] font-bold uppercase tracking-widest mt-1 opacity-80">Votes</span>
                              </div>

                              {/* Middle: Content */}
                              <div className="flex-1 min-w-0 flex flex-col justify-center">
                                <div className="flex flex-wrap items-center gap-1.5 md:gap-2 mb-1 md:mb-2">
                                  <span className="bg-slate-100 text-slate-600 px-2 md:px-2.5 py-0.5 rounded-full text-[8px] md:text-[9px] font-black uppercase tracking-wider">{issue.category}</span>
                                  <span className={`px-2 md:px-2.5 py-0.5 rounded-full text-[8px] md:text-[9px] font-black uppercase tracking-wider ${getStatusColor(targetIssue.status)}`}>{targetIssue.status}</span>
                                </div>
                                <h4 className="text-sm md:text-[17px] font-bold text-slate-900 mb-1 leading-snug truncate pr-2">{issue.title}</h4>
                                <p className="text-xs md:text-sm text-slate-500 line-clamp-1">{issue.description}</p>
                              </div>

                              {/* Right: Actions / Image Thumbnail */}
                              <div className="flex flex-col items-end justify-start gap-2 shrink-0">
                                {issue.imageUrl && (
                                  <div className="relative w-10 h-10 md:w-12 md:h-12 rounded-xl overflow-hidden border border-slate-200 shadow-sm shrink-0">
                                    <img src={issue.imageUrl} alt="Attachment" className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                                      <ImageIcon size={14} className="text-white drop-shadow-md" />
                                    </div>
                                  </div>
                                )}
                                
                                {targetIssue.adminResponse && (
                                  <button 
                                    onClick={(e) => handleIssueClick(issue, e)} 
                                    className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-lg text-xs font-bold text-slate-700 transition-colors shadow-sm whitespace-nowrap"
                                  >
                                    <MessageCircle size={14} className="text-blue-600" /> Check Update
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Mobile only Update Banner */}
                            {targetIssue.adminResponse && (
                              <div className="md:hidden flex items-center gap-2 p-2.5 bg-blue-50 border border-blue-100 rounded-lg text-blue-900">
                                <MessageCircle size={14} className="text-blue-600 shrink-0"/>
                                <span className="text-[10px] font-bold truncate">Admin update available</span>
                              </div>
                            )}
                          {targetIssue.status === 'Resolved' && issue.authorEmail === userProfile?.email && (
  <div 
    onClick={(e) => handleIssueClick(issue, e)}
    className="mt-1 bg-emerald-50 text-emerald-700 p-3 rounded-xl border border-emerald-100 flex items-center justify-between cursor-pointer hover:bg-emerald-100 transition-colors"
  >
    <div className="flex items-center gap-2">
      <CheckCircle size={16}/> 
      <div>
        <p className="text-[10px] font-black uppercase tracking-wider">Resolution Pending</p>
        <p className="text-[10px] md:text-xs font-bold">Please provide feedback to close this ticket.</p>
      </div>
    </div>
    <span className="text-emerald-700 text-xs font-bold bg-white px-3 py-1 rounded-md border border-emerald-200 shadow-sm">Review</span>
  </div>
)}

                            {/* Bottom Footer Row */}
                            <div className="pt-3 md:pt-4 border-t border-slate-100 flex flex-col gap-2 text-[10px] md:text-xs font-medium text-slate-500">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                  <span className="flex items-center gap-1"><MapPin size={10} className="text-slate-400"/> {issue.location}</span>
                                  <span className="flex items-center gap-1"><Clock size={10} className="text-slate-400"/> {formatTimeAgo(issue.createdAt)}</span>
                                </div>
                                <span className="flex items-center gap-1.5 whitespace-nowrap">
                                  <div className={`w-2 h-2 md:w-2.5 md:h-2.5 rounded-full ${getStatusDotColor(lastStatus.status)}`}></div>
                                  {lastStatus.status} on {formatDateShort(lastStatus.date)}
                                </span>
                              </div>
                              {!isChild && childCount > 0 ? (
                                <div className="text-[9px] md:text-[10px] flex items-center gap-1.5 text-slate-400 pt-1">
                                  <Link2 size={10} className="opacity-70" /> 
                                  Grouped with {childCount} similar tickets
                                </div>
                              ) : null}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="w-full lg:w-64 space-y-4 hidden md:block">
                  <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-2.5 mb-5"><div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center text-white"><TrendingUp size={14}/></div><div><h4 className="font-bold text-sm text-slate-900">Task pulse</h4><p className="text-[10px] text-slate-500 font-medium">Live overview</p></div></div>
                    <div className="space-y-4">
                      {chartData.bars.slice(0,3).map(stat => (
                        <div key={stat.label}>
                          <div className="flex justify-between items-center mb-1.5 text-xs font-bold text-slate-700"><span className="flex items-center gap-1.5 text-slate-500">{getCategoryIcon(stat.key)} {stat.label}</span><span>{stat.totalCat} <span className="text-slate-400 font-medium text-[9px] ml-0.5">{totalIssues > 0 ? Math.round((stat.totalCat/totalIssues)*100) : 0}%</span></span></div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden"><div className={`${stat.color} h-1.5 rounded-full`} style={{ width: `${totalIssues > 0 ? (stat.totalCat/totalIssues)*100 : 0}%` }}></div></div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm text-center"><div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 mx-auto mb-3"><Lightbulb size={18}/></div><h4 className="font-bold text-sm text-slate-900 mb-1">Issue to log?</h4><p className="text-[10px] text-slate-500 font-medium mb-4 leading-relaxed">Keep your team synced.</p><button onClick={() => setIsReportOpen(true)} className="w-full bg-[#104B3D] hover:bg-slate-800 text-white font-bold py-2.5 rounded-lg flex items-center justify-center gap-2 text-xs transition-all"><Plus size={14}/> Submit Task</button></div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ADMIN DASHBOARD VIEW (MAIN) */}
          {/* ========================================================================= */}
          {currentView === 'dashboard' && role === 'admin' && (
            <div className="max-w-6xl mx-auto animate-fadeIn">
              <div className="bg-[#E9F3EB] text-[#104B3D] rounded-2xl p-6 md:p-8 flex justify-between items-center mb-6 relative overflow-hidden shadow-sm">
                <div className="relative z-10">
                  <p className="text-[#104B3D] text-[10px] font-bold tracking-widest uppercase mb-1">ADMIN DASHBOARD</p>
                  <h2 className="text-2xl md:text-3xl font-black mb-1.5">Welcome back, {userProfile?.name}!</h2>
                  <p className="text-[#104B3D]/80 text-xs md:text-sm font-medium">Here's your organization's issue telemetry today.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
                <div className="bg-white rounded-2xl p-4 md:p-5 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-start gap-3 h-auto md:h-28"><div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0"><FileText size={16} /></div><div><p className="text-[10px] md:text-xs font-bold text-slate-600 mb-0.5">Active Issues</p><p className="text-2xl md:text-3xl font-black text-slate-900 mb-1">{metrics.total}</p><p className="text-[9px] md:text-[10px] font-bold text-emerald-600 flex items-center gap-1"><TrendingUp size={10}/> {metrics.growthLabel}</p></div></div>
                <div className="bg-white rounded-2xl p-4 md:p-5 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-start gap-3 h-auto md:h-28"><div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0"><Inbox size={16} /></div><div><p className="text-[10px] md:text-xs font-bold text-slate-600 mb-0.5">Pending</p><p className="text-2xl md:text-3xl font-black text-slate-900 mb-1">{metrics.pending}</p></div></div>
                <div className="bg-white rounded-2xl p-4 md:p-5 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-start gap-3 h-auto md:h-28"><div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0"><RefreshCw size={16} /></div><div><p className="text-[10px] md:text-xs font-bold text-slate-600 mb-0.5">In Progress</p><p className="text-2xl md:text-3xl font-black text-slate-900 mb-1">{metrics.inProgress}</p></div></div>
                <div className="bg-white rounded-2xl p-4 md:p-5 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-start gap-3 h-auto md:h-28"><div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0"><CheckCircle size={16} /></div><div><p className="text-[10px] md:text-xs font-bold text-slate-600 mb-0.5">Resolved</p><p className="text-2xl md:text-3xl font-black text-emerald-700 mb-1">{metrics.resolved}</p></div></div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                  <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-sm text-slate-900">Issues Overview</h3><div className="flex gap-2 text-[9px] md:text-[10px] font-bold text-slate-500"><span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div> Open</span><span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-slate-900"></div> Resolved</span></div></div>
                  <div className="h-36 flex items-end justify-between px-1 gap-1 md:gap-2">
                    {chartData.bars.map(col => (
                      <div key={col.label} className="flex-1 flex flex-col items-center gap-1.5 group">
                        <div className="w-full flex items-end justify-center gap-0.5 h-28"><div className="w-full max-w-[8px] md:max-w-[10px] bg-blue-400 rounded-t-sm transition-all group-hover:opacity-80" style={{ height: `${col.oHeight}%` }}></div><div className="w-full max-w-[8px] md:max-w-[10px] bg-slate-900 rounded-t-sm transition-all group-hover:opacity-80" style={{ height: `${col.rHeight}%` }}></div></div>
                        <span className="text-[7px] md:text-[8px] font-bold text-slate-400 uppercase truncate w-full text-center">{col.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-center relative min-h-[200px]">
                  <h3 className="font-bold text-sm text-slate-900 absolute top-5 left-5">Categories</h3>
                  <div className="flex items-center justify-center gap-6 mt-4">
                    <div className="relative w-24 h-24 md:w-28 md:h-28">
                      <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                        <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#E2E8F0" strokeWidth="6"></circle>
                        {chartData.doughnutSegments.map((seg, i) => (<circle key={i} cx="18" cy="18" r="15.915" fill="transparent" stroke={seg.stroke} strokeWidth="6" strokeDasharray={`${seg.length} ${100 - seg.length}`} strokeDashoffset={seg.offset}></circle>))}
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-base md:text-lg font-black text-slate-900">{totalIssues}</span><span className="text-[6px] md:text-[7px] font-bold text-slate-400 uppercase">Total</span></div>
                    </div>
                    <div className="flex flex-col gap-1.5 text-[8px] md:text-[9px] font-bold text-slate-500">
                      {chartData.doughnutSegments.slice(0,4).map((seg, i) => (<div key={i} className="flex items-center gap-1.5"><div className={`w-1.5 h-1.5 rounded-full ${seg.color}`}></div>{seg.label} ({seg.pct}%)</div>))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* --- NOTIFICATIONS SLIDE-OVER --- */}
      {isNotifOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex justify-end z-[999]" onClick={() => setIsNotifOpen(false)}>
          <div className="bg-white w-full max-w-sm h-full shadow-2xl p-4 md:p-6 flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center pb-4 border-b border-slate-100 pt-4 md:pt-0">
              <h3 className="font-black text-lg text-slate-900 flex items-center gap-2"><Bell size={18} className="text-indigo-600"/> Notifications</h3>
              <button onClick={() => setIsNotifOpen(false)} className="p-1 hover:bg-slate-100 rounded-full text-slate-400"><X size={18}/></button>
            </div>
            <div className="flex-1 overflow-y-auto py-4 space-y-3">
              {totalNotifs === 0 && <div className="text-center py-10 text-slate-400 font-semibold text-sm">No new notifications</div>}
              {issues.filter(i => i.status === 'Resolved' && i.authorEmail === userProfile?.email).map(issue => (
                <div key={issue.id} className="p-4 rounded-xl bg-emerald-50 border border-emerald-100 cursor-pointer hover:bg-emerald-100" onClick={() => { handleIssueClick(issue as any); setIsNotifOpen(false); }}>
                  <p className="text-xs font-bold text-emerald-900 mb-1 flex items-center gap-1"><CheckCircle size={14}/> Action Required</p>
                  <p className="text-[10px] text-emerald-700">"{issue.title}" was marked resolved. Click to provide feedback.</p>
                </div>
              ))}
              {issues.filter(i => i.adminResponse && i.authorEmail === userProfile?.email && i.status !== 'Closed').map(issue => (
                <div key={issue.id} className="p-4 rounded-xl bg-blue-50 border border-blue-100 cursor-pointer hover:bg-blue-100" onClick={() => { handleIssueClick(issue as any); setIsNotifOpen(false); }}>
                  <p className="text-xs font-bold text-blue-900 mb-1 flex items-center gap-1"><ShieldAlert size={14}/> Official Update Received</p>
                  <p className="text-[10px] text-blue-700">Admin replied to "{issue.title}".</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* --- GLOBAL ISSUE DETAIL MODAL --- */}
      {selectedIssue && (
        <div className="fixed inset-0 bg-black/60 md:bg-black/40 backdrop-blur-sm flex items-end md:items-center justify-center md:p-4 z-[999]" onClick={() => setSelectedIssue(null)}>
          <div className="bg-white rounded-t-3xl md:rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh] md:max-h-[85vh]" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center px-4 md:px-6 py-4 border-b border-slate-100 bg-slate-50">
                <span className="font-bold text-slate-400 text-xs uppercase tracking-wider">{selectedIssue.ticketId}</span>
                <button onClick={() => setSelectedIssue(null)} className="p-1.5 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"><X size={18} /></button>
            </div>
            <div className="p-4 md:p-8 overflow-y-auto flex-1">
              <div className="flex flex-col md:flex-row gap-6 md:gap-8">
                <div className="flex-1">
                  <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4"><span className="bg-slate-100 text-slate-700 px-2 md:px-3 py-1 rounded text-[9px] md:text-[10px] font-bold uppercase tracking-wider">{selectedIssue.category}</span><span className={`px-2 md:px-3 py-1 rounded text-[9px] md:text-[10px] font-bold uppercase tracking-wider ${getStatusColor(selectedIssue.status)}`}>{selectedIssue.status}</span></div>
                  <h2 className="text-xl md:text-2xl font-black text-slate-900 mb-2 md:mb-3 leading-tight">{selectedIssue.title}</h2>
                  <p className="text-xs md:text-sm text-slate-600 leading-relaxed mb-6">{selectedIssue.description}</p>
                  
                  {selectedIssue.imageUrl && (
                    <div className="mb-6 rounded-xl overflow-hidden border border-slate-200 bg-slate-50 flex items-center justify-center max-h-48 md:max-h-64">
                      <img src={selectedIssue.imageUrl} alt="Attached Evidence" className="max-w-full max-h-full object-contain" />
                    </div>
                  )}

                  <div className="space-y-3 md:space-y-4 pt-5 md:pt-6 border-t border-slate-100 text-[11px] md:text-xs font-semibold text-slate-500">
                    <div className="flex items-center gap-3"><MapPin size={14} className="text-slate-400" /> <span className="text-slate-700">{selectedIssue.location}</span></div>
                    <div className="flex items-center gap-3"><Clock size={14} className="text-slate-400" /> <span>Reported {new Date(selectedIssue.createdAt).toLocaleDateString()}</span></div>
                    <div className="flex items-center gap-3"><UserIcon size={14} className="text-slate-400" /> <span>By {selectedIssue.isAnonymous ? 'Anonymous' : selectedIssue.authorName}</span></div>
                  </div>

                  {/* GROUPED COMPLAINTS */}
                  {issues.filter(i => i.parentId === selectedIssue.id).length > 0 && (
                    <div className="mt-6 md:mt-8 border-t border-slate-100 pt-5 md:pt-6">
                      <h4 className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 md:mb-4 flex items-center gap-1.5">
                        <Users size={12} /> Grouped Tickets ({issues.filter(i => i.parentId === selectedIssue.id).length})
                      </h4>
                      <div className="space-y-3">
                        {issues.filter(i => i.parentId === selectedIssue.id).map(child => (
                          <div key={child.id} className="p-3 md:p-4 bg-slate-50 rounded-xl border border-slate-100 relative overflow-hidden">
                            <h5 className="font-bold text-xs text-slate-800 mb-1">{child.title}</h5>
                            <p className="text-[11px] text-slate-600 line-clamp-2">{child.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedIssue.adminResponse && (
                    <div className="mt-5 md:mt-6 p-4 bg-blue-50 rounded-xl border border-blue-100">
                      <p className="text-[9px] md:text-[10px] font-black text-blue-800 uppercase tracking-widest mb-1 flex items-center gap-1"><ShieldAlert size={12}/> Official Admin Update</p>
                      <p className="text-xs md:text-sm text-blue-900 font-medium">{selectedIssue.adminResponse}</p>
                    </div>
                  )}

                  {selectedIssue.status === 'Resolved' && userProfile?.email === selectedIssue.authorEmail && (
  <div className="mt-6 bg-[#E9F3EB] rounded-2xl p-5 border border-emerald-100">
    <h4 className="font-black text-sm text-[#104B3D] mb-1">Is your issue resolved?</h4>
    <p className="text-[11px] text-gray-600 mb-3">Please provide feedback to close this ticket.</p>
    
    <input 
      id="modalFeedbackInput"
      type="text" 
      placeholder="Optional comments..." 
      className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-xs outline-none focus:ring-2 focus:ring-[#104B3D]/20 mb-3"
    />
    
    <div className="flex gap-3">
      <button 
        onClick={() => {
          const inputEl = document.getElementById('modalFeedbackInput') as HTMLInputElement;
          const comment = inputEl?.value || 'Resolved by user';
          handleStudentFeedback(selectedIssue.id, true, comment);
        }}
        className="flex-1 bg-[#047857] hover:bg-[#065F46] text-white font-bold py-2.5 rounded-xl text-xs shadow-sm transition-colors"
      >
        Yes, Close Ticket
      </button>
      <button 
        onClick={() => {
          const inputEl = document.getElementById('modalFeedbackInput') as HTMLInputElement;
          const comment = inputEl?.value || 'Reopened by user';
          handleStudentFeedback(selectedIssue.id, false, comment);
        }}
        className="flex-1 bg-white hover:bg-gray-50 text-red-600 border border-red-200 font-bold py-2.5 rounded-xl text-xs shadow-sm transition-colors"
      >
        No, Reopen
      </button>
    </div>
  </div>
)}
                  

                  {userProfile?.email === selectedIssue.authorEmail && (
                    <div className="mt-4 pt-4 border-t border-slate-100 flex justify-end">
                      <button onClick={() => handleDeleteIssue(selectedIssue.id)} className="flex items-center gap-1.5 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-bold text-xs transition-colors">
                        <Trash2 size={14} /> Delete Ticket
                      </button>
                    </div>
                  )}
                </div>

                {/* Vertical Timeline */}
                <div className="w-full md:w-56 bg-slate-50 rounded-2xl p-4 md:p-5 border border-slate-200 shrink-0">
                  <h4 className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-1.5"><Calendar size={12}/> Resolution Timeline</h4>
                  <div className="space-y-5">
                    {(selectedIssue.statusHistory || [{status: selectedIssue.status, date: selectedIssue.createdAt}]).map((hist, idx, arr) => {
                      const isLast = idx === arr.length - 1;
                      return (
                        <div key={idx} className="relative flex items-center justify-between">
                          <div className={`flex items-center justify-center w-3 h-3 rounded-full border-2 border-white shadow shrink-0 z-10 ${getStatusDotColor(hist.status)} ${!isLast ? 'opacity-50' : ''}`}></div>
                          <div className="w-[calc(100%-1.5rem)] ml-3 text-left">
                            <h4 className={`text-[10px] font-bold ${isLast ? 'text-slate-900' : 'text-slate-500'}`}>{hist.status}</h4>
                            <p className="text-[8px] text-slate-400 font-medium">{formatDateShort(hist.date)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- REPORT ISSUE MODAL --- */}
      {isReportOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center md:p-4 z-[999]" onClick={() => setIsReportOpen(false)}>
          <div className="bg-white rounded-t-3xl md:rounded-3xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-5 md:px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50"><h3 className="font-black text-slate-900 text-base">Submit New Task / Issue</h3><button onClick={() => setIsReportOpen(false)} className="text-slate-400 hover:text-slate-900 bg-white p-1.5 rounded-full shadow-sm"><X size={18}/></button></div>
            <form onSubmit={handleSubmitIssue} className="p-5 md:p-8 space-y-4 max-h-[80vh] overflow-y-auto">
              <div><label className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Title</label><input type="text" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="E.g. Server Latency Spike in Region US-East" required className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs md:text-sm font-semibold outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20" /></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Category</label><select value={formCategory} onChange={(e) => setFormCategory(e.target.value as Category)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs md:text-sm font-semibold outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20"><option value="Infrastructure">Infrastructure</option><option value="IT & Systems">IT & Systems</option><option value="Operations">Operations</option><option value="HR & Admin">HR & Admin</option><option value="Security">Security</option><option value="General">General</option></select></div>
                <div><label className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Location / Department</label><input type="text" value={formLocation} onChange={(e) => setFormLocation(e.target.value)} placeholder="E.g. Cloud Infrastructure" required className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs md:text-sm font-semibold outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20" /></div>
              </div>
              <div><label className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Description</label><textarea rows={3} value={formDesc} onChange={(e) => setFormDesc(e.target.value)} placeholder="Provide full context..." required className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs md:text-sm font-semibold outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 resize-none"></textarea></div>
              
              <div>
                <label className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Evidence Attachment (Optional)</label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center justify-center gap-2 bg-slate-50 border-2 border-dashed border-slate-200 hover:border-indigo-500 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-600 cursor-pointer w-full">
                    <Camera size={14} /> {formImage ? 'Change File' : 'Upload File'}
                    <input type="file" accept="image/*" onChange={handleImagePick} className="hidden" />
                  </label>
                  {imagePreview && (
                    <div className="w-10 h-10 rounded-lg overflow-hidden border border-slate-200 shrink-0 relative group">
                      <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                      <button type="button" onClick={(e) => { e.preventDefault(); setFormImage(null); setImagePreview(null); }} className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100"><X size={12}/></button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 pb-2"><input type="checkbox" id="anonCheck" checked={isAnonymous} onChange={(e) => setIsAnonymous(e.target.checked)} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer w-4 h-4" /><label htmlFor="anonCheck" className="text-xs font-bold text-slate-700 cursor-pointer select-none">Post anonymously</label></div>
              <button type="submit" disabled={isSubmitting} className="w-full bg-[#104B3D] text-white font-bold py-3.5 rounded-xl text-xs md:text-sm shadow-lg hover:bg-slate-800 disabled:opacity-50">{isSubmitting ? 'Syncing to Database...' : 'Submit Ticket'}</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}