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
  Check,
  Crown,
  PhoneCall,
  AlertTriangle
} from "lucide-react";

interface Member {
  id: string;
  name: string;
  email: string;
  fathom_email: string | null;
  role: 'admin' | 'closer' | 'sdr';
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
  const [filter, setFilter] = useState<'all' | 'closer' | 'sdr' | 'active' | 'inactive'>('all');
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Member | null>(null);
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
    if (filter === 'closer' || filter === 'sdr') return m.role === filter;
    if (filter === 'active' || filter === 'inactive') return m.status === filter;
    return true;
  }).filter(m => 
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.email.toLowerCase().includes(search.toLowerCase())
  );

  const closers = members.filter(m => m.role === 'closer' && m.status === 'active');
  const sdrs = members.filter(m => m.role === 'sdr' && m.status === 'active');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Team</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Manage your closers and SDRs</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Member
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Users className="w-5 h-5" />} label="Total" value={members.length} />
        <StatCard icon={<PhoneCall className="w-5 h-5" />} label="Closers" value={closers.length} color="blue" />
        <StatCard icon={<Phone className="w-5 h-5" />} label="SDRs" value={sdrs.length} color="purple" />
        <StatCard icon={<UserCheck className="w-5 h-5" />} label="Active" value={members.filter(m => m.status === 'active').length} color="green" />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Search members..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-zinc-400" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm"
          >
            <option value="all">All Members</option>
            <option value="closer">Closers</option>
            <option value="sdr">SDRs</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Members List */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
        {loading ? (
          <div className="p-12 text-center text-zinc-500">Loading...</div>
        ) : filteredMembers.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mx-auto mb-3" />
            <p className="text-zinc-500">No members found</p>
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
              />
            ))}
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <AddMemberModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            fetchMembers();
          }}
        />
      )}

      {/* Edit Modal */}
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

      {/* Delete Confirmation */}
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
    }
  }
}

function StatCard({ icon, label, value, color = "default" }: { icon: React.ReactNode; label: string; value: number; color?: "default" | "blue" | "purple" | "green" }) {
  const colors = {
    default: "bg-zinc-100 dark:bg-zinc-800",
    blue: "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400",
    purple: "bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400",
    green: "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400",
  };
  
  return (
    <div className={`p-4 rounded-xl ${colors[color]}`}>
      <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 mb-1">
        {icon}
        <span className="text-xs font-medium uppercase">{label}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

function MemberRow({ member, onEdit, onDelete, onToggleStatus }: { 
  member: Member; 
  onEdit: () => void; 
  onDelete: () => void;
  onToggleStatus: () => void;
}) {
  const roleColors = {
    admin: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    closer: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    sdr: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  };

  return (
    <div className="p-4 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center">
          <span className="text-sm font-bold text-zinc-600 dark:text-zinc-300">
            {member.name.split(' ').map(n => n[0]).join('').toUpperCase()}
          </span>
        </div>
        
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-zinc-900 dark:text-white">{member.name}</span>
            {member.role === 'admin' && <Crown className="w-4 h-4 text-purple-500" />}
            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${roleColors[member.role]}`}>
              {member.role.toUpperCase()}
            </span>
            {member.status === 'inactive' && (
              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400">
                INACTIVE
              </span>
            )}
          </div>          
          <div className="flex items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{member.email}</span>
            {member.fathom_email && (
              <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{member.fathom_email}</span>
            )}
          </div>
          
          <div className="flex items-center gap-4 text-sm mt-2">
            <span className="text-zinc-600 dark:text-zinc-400">{member.stats.call_count} calls</span>
            {member.stats.avg_score && (
              <span className={member.stats.avg_score >= 8 ? "text-green-600" : member.stats.avg_score < 7 ? "text-red-600" : "text-zinc-600"}>
                Avg: {member.stats.avg_score.toFixed(1)}
              </span>
            )}
          </div>
        </div>
      </div>      
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleStatus}
          className={`p-2 rounded-lg transition-colors ${
            member.status === 'active' 
              ? "text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20" 
              : "text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          }`}
          title={member.status === 'active' ? "Deactivate" : "Activate"}
        >
          {member.status === 'active' ? <UserCheck className="w-5 h-5" /> : <UserX className="w-5 h-5" />}
        </button>
        
        <button
          onClick={onEdit}
          className="p-2 text-zinc-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
        >
          <Edit2 className="w-5 h-5" />
        </button>
        
        <button
          onClick={onDelete}
          className="p-2 text-zinc-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

// Modals would be separate components - abbreviated for space
function AddMemberModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState<{ name: string; email: string; fathom_email: string; role: 'closer' | 'sdr' }>({ 
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
          <label className="block text-sm font-medium mb-1">Full Name</label>
          <input
            required
            type="text"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            required
            type="email"
            value={form.email}
            onChange={e => setForm({ ...form, email: e.target.value })}
            className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Fathom Email (optional)</label>
          <input
            type="email"
            value={form.fathom_email}
            onChange={e => setForm({ ...form, fathom_email: e.target.value })}
            className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Role</label>
          <select
            value={form.role}
            onChange={e => setForm({ ...form, role: e.target.value as 'closer' | 'sdr' })}
            className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg"
          >
            <option value="closer">Closer</option>
            <option value="sdr">SDR</option>
          </select>
        </div>
        
        <div className="flex gap-3 pt-4">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg">Cancel</button>
          <button 
            type="submit" 
            disabled={loading}
            className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create Member"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EditMemberModal({ member, onClose, onSuccess }: { member: Member; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState<{ name: string; email: string; fathom_email: string; role: 'closer' | 'sdr' }>({
    name: member.name,
    email: member.email,
    fathom_email: member.fathom_email || "",
    role: member.role === 'admin' ? 'closer' : member.role,
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
          <label className="block text-sm font-medium mb-1">Full Name</label>
          <input
            type="text"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            type="email"
            value={form.email}
            onChange={e => setForm({ ...form, email: e.target.value })}
            className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Fathom Email</label>
          <input
            type="email"
            value={form.fathom_email}
            onChange={e => setForm({ ...form, fathom_email: e.target.value })}
            className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Role</label>
          <select
            value={form.role}
            onChange={e => setForm({ ...form, role: e.target.value as 'closer' | 'sdr' })}
            className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg"
          >
            <option value="closer">Closer</option>
            <option value="sdr">SDR</option>
          </select>
        </div>
        
        <div className="flex gap-3 pt-4">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg">Cancel</button>
          <button 
            type="submit" 
            disabled={loading}
            className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg disabled:opacity-50"
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

  async function handleDelete() {
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
    <Modal onClose={onClose} title="Delete Member">
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-900 dark:text-amber-300">Are you sure?</p>
            <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
              {hardDelete 
                ? "This will permanently delete the member and unlink their calls. This cannot be undone."
                : "This will deactivate the member. Their call history will be preserved."
              }
            </p>
          </div>
        </div>
        
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={hardDelete}
            onChange={e => setHardDelete(e.target.checked)}
          />
          <span className="text-sm">Permanently delete (cannot be undone)</span>
        </label>
        
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg">Cancel</button>
          <button 
            onClick={handleDelete}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg disabled:opacity-50"
          >
            {loading ? "Deleting..." : hardDelete ? "Delete Permanently" : "Deactivate"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 w-full max-w-md max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
