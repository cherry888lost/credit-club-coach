"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { 
  Users, 
  Plus, 
  Trash2, 
  Edit2, 
  UserCheck, 
  UserX,
  Mail,
  Phone,
  Search,
  Filter,
  X,
  Crown,
  AlertTriangle,
  Key,
  RefreshCw
} from "lucide-react";

interface Member {
  id: string;
  name: string;
  email: string;
  fathom_email: string | null;
  role: 'admin' | 'closer' | 'sdr';
  sales_role: 'closer' | 'sdr' | null;
  status: 'active' | 'inactive';
  clerk_user_id: string | null;
  created_at: string;
  stats: {
    call_count: number;
    avg_score: number | null;
  };
}

export default function TeamPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'closer' | 'sdr' | 'admin' | 'active' | 'inactive'>('all');
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Member | null>(null);
  const [resetPasswordMember, setResetPasswordMember] = useState<Member | null>(null);
  const supabase = createClient();

  useEffect(() => {
    fetchMembers();
  }, []);

  async function fetchMembers() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/members");
      const data = await res.json();
      if (data.members) {
        setMembers(data.members);
      }
    } catch (err) {
      console.error("Failed to fetch members:", err);
    } finally {
      setLoading(false);
    }
  }

  const filteredMembers = members.filter(m => {
    if (filter === 'closer' || filter === 'sdr') return m.sales_role === filter;
    if (filter === 'admin') return m.role === 'admin';
    if (filter === 'active' || filter === 'inactive') return m.status === filter;
    return true;
  }).filter(m => 
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.email.toLowerCase().includes(search.toLowerCase())
  );

  const closers = members.filter(m => m.sales_role === 'closer' && m.status === 'active');
  const sdrs = members.filter(m => m.sales_role === 'sdr' && m.status === 'active');
  const admins = members.filter(m => m.role === 'admin' && m.status === 'active');

  return (
    <div className="space-y-6">
      {/* Header - Improved contrast */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Team Management</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">Manage your closers, SDRs, and administrators</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Member
        </button>
      </div>

      {/* Stats Cards - Better contrast */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard icon={<Users className="w-5 h-5" />} label="Total" value={members.length} />
        <StatCard icon={<Crown className="w-5 h-5" />} label="Admins" value={admins.length} color="purple" />
        <StatCard icon={<Phone className="w-5 h-5" />} label="Closers" value={closers.length} color="blue" />
        <StatCard icon={<Phone className="w-5 h-5" />} label="SDRs" value={sdrs.length} color="indigo" />
        <StatCard icon={<UserCheck className="w-5 h-5" />} label="Active" value={members.filter(m => m.status === 'active').length} color="green" />
      </div>

      {/* Filters - Improved contrast */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search members..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-white placeholder:text-zinc-500"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-zinc-600" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="px-3 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-white"
          >
            <option value="all">All Members</option>
            <option value="admin">Admins</option>
            <option value="closer">Closers</option>
            <option value="sdr">SDRs</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Members List - Improved contrast */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-300 dark:border-zinc-800">
        {loading ? (
          <div className="p-12 text-center">
            <RefreshCw className="w-8 h-8 text-zinc-400 animate-spin mx-auto mb-3" />
            <p className="text-zinc-600 dark:text-zinc-400">Loading team members...</p>
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mx-auto mb-3" />
            <p className="text-zinc-600 dark:text-zinc-400 font-medium">No members found</p>
            <p className="text-sm text-zinc-500 dark:text-zinc-500 mt-1">
              {search ? "Try a different search term" : "Add your first team member to get started"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {filteredMembers.map((member) => (
              <MemberRow
                key={member.id}
                member={member}
                onEdit={() => setEditingMember(member)}
                onDelete={() => setDeleteConfirm(member)}
                onToggleStatus={() => toggleStatus(member)}
                onResetPassword={() => setResetPasswordMember(member)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {showAddModal && (
        <AddMemberModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            fetchMembers();
          }}
        />
      )}

      {editingMember && (
        <EditMemberModal
          member={editingMember}
          onClose={() => setEditingMember(null)}
          onSuccess={() => {
            setEditingMember(null);
            fetchMembers();
          }}
        />
      )}

      {deleteConfirm && (
        <DeleteConfirmModal
          member={deleteConfirm}
          onClose={() => setDeleteConfirm(null)}
          onSuccess={() => {
            setDeleteConfirm(null);
            fetchMembers();
          }}
        />
      )}

      {resetPasswordMember && (
        <ResetPasswordModal
          member={resetPasswordMember}
          onClose={() => setResetPasswordMember(null)}
        />
      )}
    </div>
  );

  async function toggleStatus(member: Member) {
    const newStatus = member.status === 'active' ? 'inactive' : 'active';
    try {
      await fetch("/api/admin/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: member.id, status: newStatus }),
      });
      fetchMembers();
    } catch (err) {
      console.error("Failed to toggle status:", err);
      alert("Failed to update status");
    }
  }
}

function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  );
}

function StatCard({ icon, label, value, color = "default" }: { icon: React.ReactNode; label: string; value: number; color?: "default" | "blue" | "purple" | "green" | "indigo" }) {
  const colors = {
    default: "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white",
    blue: "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400",
    purple: "bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400",
    indigo: "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400",
    green: "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400",
  };
  
  return (
    <div className={`p-4 rounded-xl ${colors[color]}`}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wider opacity-70">{label}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

function MemberRow({ member, onEdit, onDelete, onToggleStatus, onResetPassword }: { 
  member: Member; 
  onEdit: () => void; 
  onDelete: () => void;
  onToggleStatus: () => void;
  onResetPassword: () => void;
}) {
  const salesRoleColors = {
    closer: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800",
    sdr: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800",
  };

  return (
    <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center flex-shrink-0">
          <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
            {member.name.split(' ').map(n => n[0]).join('').toUpperCase()}
          </span>
        </div>
        
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="font-semibold text-zinc-900 dark:text-white">{member.name}</span>
            
            {/* Admin badge */}
            {member.role === 'admin' && (
              <span className="px-2 py-0.5 text-xs font-semibold rounded-full border bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800">
                <Crown className="w-3 h-3 inline mr-1" />
                ADMIN
              </span>
            )}
            
            {/* Sales role badge */}
            {member.sales_role && (
              <span className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${salesRoleColors[member.sales_role]}`}>
                {member.sales_role.toUpperCase()}
              </span>
            )}
            
            {/* Status badges */}
            {member.status === 'inactive' && (
              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-600">
                INACTIVE
              </span>
            )}
            {!member.clerk_user_id && (
              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800" title="User hasn't logged in yet">
                Pending
              </span>
            )}
          </div>          
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-400">
              <Mail className="w-4 h-4 text-zinc-500" />
              {member.email}
            </span>
            {member.fathom_email && member.fathom_email !== member.email && (
              <span className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-400">
                <PhoneIcon className="w-4 h-4 text-zinc-500" />
                {member.fathom_email}
              </span>
            )}
          </div>
          
          <div className="flex flex-wrap items-center gap-4 text-sm mt-2">
            <span className="text-zinc-700 dark:text-zinc-400">
              <span className="font-medium">{member.stats.call_count}</span> calls
            </span>
            {member.stats.avg_score && (
              <span className={member.stats.avg_score >= 8 ? "text-green-700 dark:text-green-400 font-medium" : member.stats.avg_score < 7 ? "text-red-700 dark:text-red-400 font-medium" : "text-zinc-700 dark:text-zinc-400"}>
                Avg: <span className="font-semibold">{member.stats.avg_score.toFixed(1)}</span>
              </span>
            )}
          </div>
        </div>
      </div>      
      
      <div className="flex items-center gap-2">
        <button
          onClick={onResetPassword}
          className="p-2 text-zinc-600 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
          title="Send password reset"
        >
          <Key className="w-5 h-5" />
        </button>
        
        <button
          onClick={onToggleStatus}
          className={`p-2 rounded-lg transition-colors ${
            member.status === 'active' 
              ? "text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20" 
              : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          }`}
          title={member.status === 'active' ? "Deactivate" : "Activate"}
        >
          {member.status === 'active' ? <UserCheck className="w-5 h-5" /> : <UserX className="w-5 h-5" />}
        </button>
        
        <button
          onClick={onEdit}
          className="p-2 text-zinc-600 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
          title="Edit member"
        >
          <Edit2 className="w-5 h-5" />
        </button>
        
        <button
          onClick={onDelete}
          className="p-2 text-zinc-600 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
          title="Delete member"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-300 dark:border-zinc-800 w-full max-w-md max-h-[90vh] overflow-auto shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">{title}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors">
            <X className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

function AddMemberModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState<{ 
    name: string; 
    email: string; 
    fathom_email: string; 
    role: 'admin' | 'closer' | 'sdr' 
  }>({ 
    name: "", 
    email: "", 
    fathom_email: "", 
    role: "closer" 
  });
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/admin/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        onSuccess();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to create member");
      }
    } catch (err) {
      alert("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal onClose={onClose} title="Add Team Member">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-zinc-900 dark:text-white mb-2">Full Name</label>
          <input
            required
            type="text"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white placeholder:text-zinc-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="e.g., John Smith"
          />
        </div>
        
        <div>
          <label className="block text-sm font-semibold text-zinc-900 dark:text-white mb-2">Login Email</label>
          <input
            required
            type="email"
            value={form.email}
            onChange={e => setForm({ ...form, email: e.target.value })}
            className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white placeholder:text-zinc-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="john@company.com"
          />
          <p className="text-xs text-zinc-600 dark:text-zinc-500 mt-1">Used for login via Clerk</p>
        </div>
        
        <div>
          <label className="block text-sm font-semibold text-zinc-900 dark:text-white mb-2">Fathom Email</label>
          <input
            type="email"
            value={form.fathom_email}
            onChange={e => setForm({ ...form, fathom_email: e.target.value })}
            className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white placeholder:text-zinc-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="john@fathom.video (optional)"
          />
          <p className="text-xs text-zinc-600 dark:text-zinc-500 mt-1">If different from login email. Used to match Fathom calls.</p>
        </div>
        
        <div>
          <label className="block text-sm font-semibold text-zinc-900 dark:text-white mb-2">Role</label>
          <select
            value={form.role}
            onChange={e => setForm({ ...form, role: e.target.value as 'admin' | 'closer' | 'sdr' })}
            className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            <option value="admin">Admin (Full access)</option>
            <option value="closer">Closer (Sales closer)</option>
            <option value="sdr">SDR (Appointment setter)</option>
          </select>
        </div>
        
        <div className="flex gap-3 pt-4">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-700 dark:text-zinc-300 font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
            Cancel
          </button>
          <button 
            type="submit" 
            disabled={loading}
            className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Creating..." : "Create Member"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EditMemberModal({ member, onClose, onSuccess }: { member: Member; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({
    name: member.name,
    email: member.email,
    fathom_email: member.fathom_email || "",
    role: member.role,
  });
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/admin/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: member.id, ...form }),
      });
      if (res.ok) {
        onSuccess();
      } else {
        alert("Failed to update member");
      }
    } catch (err) {
      alert("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal onClose={onClose} title="Edit Member">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-zinc-900 dark:text-white mb-2">Full Name</label>
          <input
            type="text"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
        
        <div>
          <label className="block text-sm font-semibold text-zinc-900 dark:text-white mb-2">Login Email</label>
          <input
            type="email"
            value={form.email}
            onChange={e => setForm({ ...form, email: e.target.value })}
            className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
        
        <div>
          <label className="block text-sm font-semibold text-zinc-900 dark:text-white mb-2">Fathom Email</label>
          <input
            type="email"
            value={form.fathom_email}
            onChange={e => setForm({ ...form, fathom_email: e.target.value })}
            className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="Email used in Fathom"
          />
          <p className="text-xs text-zinc-600 dark:text-zinc-500 mt-1">This email is used to automatically match calls from Fathom</p>
        </div>
        
        <div>
          <label className="block text-sm font-semibold text-zinc-900 dark:text-white mb-2">Role</label>
          <select
            value={form.role}
            onChange={e => setForm({ ...form, role: e.target.value as 'admin' | 'closer' | 'sdr' })}
            className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            <option value="admin">Admin (Full access)</option>
            <option value="closer">Closer (Sales closer)</option>
            <option value="sdr">SDR (Appointment setter)</option>
          </select>
        </div>
        
        <div className="flex gap-3 pt-4">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-700 dark:text-zinc-300 font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
            Cancel
          </button>
          <button 
            type="submit" 
            disabled={loading}
            className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function DeleteConfirmModal({ member, onClose, onSuccess }: { member: Member; onClose: () => void; onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);
  const [hardDelete, setHardDelete] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  async function handleDelete() {
    if (hardDelete && confirmText !== member.name) {
      alert("Please type the member's name to confirm permanent deletion");
      return;
    }
    
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/members?id=${member.id}${hardDelete ? '&hard=true' : ''}`, {
        method: "DELETE",
      });
      if (res.ok) {
        onSuccess();
      } else {
        alert("Failed to delete member");
      }
    } catch (err) {
      alert("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal onClose={onClose} title={hardDelete ? "Permanently Delete Member" : "Deactivate Member"}>
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-900 dark:text-amber-300">
              {hardDelete ? "This action cannot be undone" : "Member will be deactivated"}
            </p>
            <p className="text-sm text-amber-800 dark:text-amber-400 mt-1">
              {hardDelete 
                ? `This will permanently delete ${member.name} and unlink their calls. Their Clerk account will also be deleted.`
                : `${member.name} will be deactivated. Their call history will be preserved and they can be reactivated later.`
              }
            </p>
          </div>
        </div>
        
        <label className="flex items-center gap-2 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg cursor-pointer">
          <input
            type="checkbox"
            checked={hardDelete}
            onChange={e => setHardDelete(e.target.checked)}
            className="w-4 h-4 text-red-600 rounded"
          />
          <span className="text-sm text-zinc-700 dark:text-zinc-300">Permanently delete this member</span>
        </label>
        
        {hardDelete && (
          <div>
            <label className="block text-sm font-semibold text-zinc-900 dark:text-white mb-2">
              Type "{member.name}" to confirm:
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
              placeholder={member.name}
            />
          </div>
        )}
        
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-700 dark:text-zinc-300 font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
            Cancel
          </button>
          <button 
            onClick={handleDelete}
            disabled={loading || (hardDelete && confirmText !== member.name)}
            className={`flex-1 px-4 py-2.5 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
              hardDelete ? "bg-red-600 hover:bg-red-700" : "bg-amber-600 hover:bg-amber-700"
            }`}
          >
            {loading ? "Processing..." : hardDelete ? "Delete Permanently" : "Deactivate"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ResetPasswordModal({ member, onClose }: { member: Member; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleReset() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/members/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: member.clerk_user_id, email: member.email }),
      });
      if (res.ok) {
        setSent(true);
      } else {
        alert("Failed to send password reset");
      }
    } catch (err) {
      alert("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal onClose={onClose} title="Reset Password">
      <div className="space-y-4">
        {sent ? (
          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <p className="text-green-800 dark:text-green-300 font-medium">Password reset email sent!</p>
            <p className="text-sm text-green-700 dark:text-green-400 mt-1">
              {member.name} will receive an email with instructions to reset their password.
            </p>
          </div>
        ) : (
          <>
            <p className="text-zinc-700 dark:text-zinc-300">
              Send a password reset email to <span className="font-semibold">{member.name}</span> at <span className="font-medium">{member.email}</span>?
            </p>
            
            {!member.clerk_user_id && (
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                <p className="text-sm text-amber-800 dark:text-amber-400">
                  <AlertTriangle className="w-4 h-4 inline mr-1" />
                  This user hasn't logged in yet. They should use the "Forgot password" link on the login page instead.
                </p>
              </div>
            )}
          </>
        )}
        
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-700 dark:text-zinc-300 font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
            {sent ? "Close" : "Cancel"}
          </button>
          {!sent && (
            <button 
              onClick={handleReset}
              disabled={loading || !member.clerk_user_id}
              className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Sending..." : "Send Reset Email"}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
