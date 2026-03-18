"use client";

import { useState, useEffect } from "react";
import {
  Users,
  Plus,
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
  RefreshCw,
  Shield,
  Send,
  Copy,
  Check,
  Ban,
  Clock,
  UserPlus,
} from "lucide-react";

type RepStatus = "invited" | "active" | "disabled";

interface Member {
  id: string;
  name: string;
  email: string;
  fathom_email: string | null;
  role: "admin" | "member";
  sales_role: "closer" | "sdr" | null;
  status: RepStatus;
  clerk_user_id: string | null;
  invited_at: string | null;
  accepted_at: string | null;
  invite_token: string | null;
  created_at: string;
  stats: {
    call_count: number;
    avg_score: number | null;
  };
}

export default function TeamPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "invited" | "active" | "disabled">("all");
  const [search, setSearch] = useState("");
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);

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

  const filteredMembers = members
    .filter((m) => {
      if (filter === "all") return true;
      return m.status === filter;
    })
    .filter(
      (m) =>
        m.name.toLowerCase().includes(search.toLowerCase()) ||
        m.email.toLowerCase().includes(search.toLowerCase())
    );

  const invited = members.filter((m) => m.status === "invited");
  const active = members.filter((m) => m.status === "active");
  const disabled = members.filter((m) => m.status === "disabled");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Team Management</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            Invite-only team system. Members must be invited before they can access the dashboard.
          </p>
        </div>
        <button
          onClick={() => setShowInviteModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          Invite New Rep
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Users className="w-5 h-5" />} label="Total" value={members.length} />
        <StatCard icon={<Clock className="w-5 h-5" />} label="Invited" value={invited.length} color="amber" />
        <StatCard icon={<UserCheck className="w-5 h-5" />} label="Active" value={active.length} color="green" />
        <StatCard icon={<Ban className="w-5 h-5" />} label="Disabled" value={disabled.length} color="red" />
      </div>

      {/* Filter Tabs + Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1">
          {(["all", "invited", "active", "disabled"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                filter === f
                  ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-white placeholder:text-zinc-500"
          />
        </div>
      </div>

      {/* Members Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-300 dark:border-zinc-800">
        {loading ? (
          <div className="p-12 text-center">
            <RefreshCw className="w-8 h-8 text-zinc-400 animate-spin mx-auto mb-3" />
            <p className="text-zinc-600 dark:text-zinc-400">Loading team...</p>
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mx-auto mb-3" />
            <p className="text-zinc-600 dark:text-zinc-400 font-medium">No members found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Email</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Role</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Date</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {filteredMembers.map((m) => (
                  <MemberRow
                    key={m.id}
                    member={m}
                    onRefresh={fetchMembers}
                    onEdit={() => setEditingMember(m)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <InviteModal
          onClose={() => setShowInviteModal(false)}
          onSuccess={() => {
            setShowInviteModal(false);
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
    </div>
  );
}

// ── Stat Card ────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  color = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color?: "default" | "amber" | "green" | "red";
}) {
  const colors = {
    default: "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white",
    amber: "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400",
    green: "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400",
    red: "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400",
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

// ── Member Row ───────────────────────────────────────

function MemberRow({
  member,
  onRefresh,
  onEdit,
}: {
  member: Member;
  onRefresh: () => void;
  onEdit: () => void;
}) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const statusBadge: Record<RepStatus, { bg: string; text: string }> = {
    invited: { bg: "bg-amber-100 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800", text: "text-amber-800 dark:text-amber-400" },
    active: { bg: "bg-green-100 dark:bg-green-900/30 border-green-200 dark:border-green-800", text: "text-green-800 dark:text-green-400" },
    disabled: { bg: "bg-red-100 dark:bg-red-900/30 border-red-200 dark:border-red-800", text: "text-red-800 dark:text-red-400" },
  };

  async function handleAction(action: string) {
    setActionLoading(action);
    try {
      if (action === "resend") {
        await fetch("/api/resend-invite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rep_id: member.id }),
        });
      } else {
        await fetch("/api/toggle-rep-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rep_id: member.id, action }),
        });
      }
      onRefresh();
    } catch (err) {
      console.error("Action failed:", err);
    } finally {
      setActionLoading(null);
    }
  }

  async function copyInviteLink() {
    if (!member.invite_token) return;
    const url = `${window.location.origin}/accept-invite?token=${member.invite_token}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const badge = statusBadge[member.status];

  return (
    <tr className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
              {member.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
            </span>
          </div>
          <div>
            <span className="font-medium text-zinc-900 dark:text-white">{member.name}</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              {member.role === "admin" && (
                <span className="text-xs text-purple-600 dark:text-purple-400 font-medium flex items-center gap-0.5">
                  <Crown className="w-3 h-3" /> Admin
                </span>
              )}
              {member.sales_role && (
                <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                  {member.sales_role.toUpperCase()}
                </span>
              )}
            </div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">{member.email}</td>
      <td className="px-4 py-3">
        <span className="text-sm text-zinc-700 dark:text-zinc-300 capitalize">{member.role}</span>
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full border ${badge.bg} ${badge.text}`}>
          {member.status.toUpperCase()}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-zinc-500">
        {member.status === "invited" && member.invited_at
          ? new Date(member.invited_at).toLocaleDateString()
          : member.accepted_at
          ? new Date(member.accepted_at).toLocaleDateString()
          : new Date(member.created_at).toLocaleDateString()}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          {/* Invited actions */}
          {member.status === "invited" && (
            <>
              <button
                onClick={copyInviteLink}
                disabled={!member.invite_token}
                className="p-1.5 text-zinc-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-md transition-colors disabled:opacity-30"
                title="Copy invite link"
              >
                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </button>
              <button
                onClick={() => handleAction("resend")}
                disabled={!!actionLoading}
                className="p-1.5 text-zinc-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-md transition-colors"
                title="Resend invite"
              >
                <Send className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleAction("revoke_invite")}
                disabled={!!actionLoading}
                className="p-1.5 text-zinc-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                title="Revoke invite"
              >
                <Ban className="w-4 h-4" />
              </button>
            </>
          )}

          {/* Active actions */}
          {member.status === "active" && (
            <button
              onClick={() => handleAction("disable")}
              disabled={!!actionLoading}
              className="p-1.5 text-zinc-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
              title="Disable rep"
            >
              <UserX className="w-4 h-4" />
            </button>
          )}

          {/* Disabled actions */}
          {member.status === "disabled" && (
            <button
              onClick={() => handleAction("enable")}
              disabled={!!actionLoading}
              className="p-1.5 text-zinc-500 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-md transition-colors"
              title="Re-enable rep"
            >
              <UserCheck className="w-4 h-4" />
            </button>
          )}

          {/* Edit (always) */}
          <button
            onClick={onEdit}
            className="p-1.5 text-zinc-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-md transition-colors"
            title="Edit"
          >
            <Edit2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Modal Wrapper ────────────────────────────────────

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

// ── Invite Modal ─────────────────────────────────────

function InviteModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    fathom_email: "",
    role: "member" as "admin" | "member",
    sales_role: "closer" as "closer" | "sdr" | "",
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ invite_url: string } | null>(null);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/invite-rep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          sales_role: form.sales_role || null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult(data);
      } else {
        setError(data.error || "Failed to send invite");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <Modal onClose={onSuccess} title="Invite Sent!">
        <div className="space-y-4">
          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <p className="text-green-800 dark:text-green-300 font-medium mb-2">
              ✅ Invite created for {form.name}
            </p>
            <p className="text-sm text-green-700 dark:text-green-400">
              Share this link with them. It expires in 7 days.
            </p>
          </div>

          <div className="flex gap-2">
            <input
              readOnly
              value={result.invite_url}
              className="flex-1 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-white font-mono"
            />
            <button
              onClick={() => {
                navigator.clipboard.writeText(result.invite_url);
              }}
              className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              Copy
            </button>
          </div>

          <button
            onClick={onSuccess}
            className="w-full px-4 py-2.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-lg font-medium hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors"
          >
            Done
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal onClose={onClose} title="Invite New Rep">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
            <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
          </div>
        )}

        <div>
          <label className="block text-sm font-semibold text-zinc-900 dark:text-white mb-2">Full Name</label>
          <input
            required
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white placeholder:text-zinc-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="e.g., John Smith"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-zinc-900 dark:text-white mb-2">Email</label>
          <input
            required
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white placeholder:text-zinc-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="john@company.com"
          />
          <p className="text-xs text-zinc-500 mt-1">They must sign in with this exact email via Google/Clerk</p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-zinc-900 dark:text-white mb-2">Fathom Email (optional)</label>
          <input
            type="email"
            value={form.fathom_email}
            onChange={(e) => setForm({ ...form, fathom_email: e.target.value })}
            className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white placeholder:text-zinc-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="john@fathom.video"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-semibold text-zinc-900 dark:text-white mb-2">Account Role</label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as "admin" | "member" })}
              className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-zinc-900 dark:text-white mb-2">Sales Role</label>
            <select
              value={form.sales_role}
              onChange={(e) => setForm({ ...form, sales_role: e.target.value as "closer" | "sdr" | "" })}
              className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white"
            >
              <option value="closer">Closer</option>
              <option value="sdr">SDR</option>
              <option value="">None</option>
            </select>
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-700 dark:text-zinc-300 font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "Sending..." : "Send Invite"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Edit Member Modal ────────────────────────────────

function EditMemberModal({
  member,
  onClose,
  onSuccess,
}: {
  member: Member;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    name: member.name,
    email: member.email,
    fathom_email: member.fathom_email || "",
    role: member.role as "admin" | "member",
    sales_role: (member.sales_role || "") as "closer" | "sdr" | "",
  });
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/admin/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: member.id,
          ...form,
          sales_role: form.sales_role || null,
        }),
      });
      if (res.ok) {
        onSuccess();
      } else {
        alert("Failed to update member");
      }
    } catch {
      alert("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal onClose={onClose} title="Edit Member">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-zinc-900 dark:text-white mb-2">Name</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-zinc-900 dark:text-white mb-2">Email</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-zinc-900 dark:text-white mb-2">Fathom Email</label>
          <input
            type="email"
            value={form.fathom_email}
            onChange={(e) => setForm({ ...form, fathom_email: e.target.value })}
            className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white"
            placeholder="Optional"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-semibold text-zinc-900 dark:text-white mb-2">Role</label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as "admin" | "member" })}
              className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white"
            >
              <option value="admin">Admin</option>
              <option value="member">Member</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-zinc-900 dark:text-white mb-2">Sales Role</label>
            <select
              value={form.sales_role}
              onChange={(e) => setForm({ ...form, sales_role: e.target.value as "closer" | "sdr" | "" })}
              className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white"
            >
              <option value="closer">Closer</option>
              <option value="sdr">SDR</option>
              <option value="">None</option>
            </select>
          </div>
        </div>
        <div className="flex gap-3 pt-4">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-700 dark:text-zinc-300 font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
            {loading ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
