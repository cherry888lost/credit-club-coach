"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Phone, Trash2, CheckSquare, Square, X } from "lucide-react";
import { DeleteConfirmModal } from "./DeleteConfirmModal";

interface Rep {
  id: string;
  name?: string;
  email?: string;
  sales_role?: string;
}

interface Call {
  id: string;
  title: string | null;
  created_at: string;
  source?: string;
  rep_id?: string;
  fathom_call_id?: string | null;
  rep?: Rep;
  score: number | null;
  effectiveOutcome: string | null;
  hasFlag: boolean;
}

interface CallsListProps {
  calls: Call[];
  isAdmin: boolean;
  totalCount: number;
}

export function CallsList({ calls, isAdmin, totalCount }: CallsListProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Toggle selection for a single call
  const toggleSelection = useCallback((callId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(callId)) {
        next.delete(callId);
      } else {
        next.add(callId);
      }
      return next;
    });
  }, []);

  // Select/deselect all calls on current page
  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === calls.length) {
        return new Set();
      }
      return new Set(calls.map((c) => c.id));
    });
  }, [calls]);

  // Clear all selections
  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setDeleteError(null);
  }, []);

  // Open delete modal
  const handleDeleteClick = useCallback(() => {
    if (selectedIds.size === 0) return;
    setDeleteError(null);
    setIsDeleteModalOpen(true);
  }, [selectedIds.size]);

  // Perform bulk delete
  const handleConfirmDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const response = await fetch("/api/calls/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete calls");
      }

      // Success - close modal and reload page to show updated list
      setIsDeleteModalOpen(false);
      setSelectedIds(new Set());
      window.location.reload();
    } catch (err: any) {
      console.error("[BULK DELETE] Error:", err);
      setDeleteError(err.message || "An error occurred while deleting");
    } finally {
      setIsDeleting(false);
    }
  }, [selectedIds]);

  // Format date nicely
  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    return (
      d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }) +
      " · " +
      d.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
    );
  }

  // Get initials for avatar
  function getInitials(name?: string) {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }

  const selectedCount = selectedIds.size;
  const allSelected = calls.length > 0 && selectedCount === calls.length;

  return (
    <>
      {/* Selection Bar - Admin Only */}
      {isAdmin && (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 px-4 py-3">
          {selectedCount > 0 ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={clearSelection}
                  className="flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                  <span>Clear selection</span>
                </button>
                <span className="text-sm text-zinc-500 dark:text-zinc-400">
                  {selectedCount} selected
                </span>
              </div>
              <button
                onClick={handleDeleteClick}
                disabled={isDeleting}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete Selected</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <button
                onClick={toggleSelectAll}
                className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-colors"
              >
                {allSelected ? (
                  <>
                    <CheckSquare className="w-4 h-4 text-indigo-600" />
                    <span>Deselect all</span>
                  </>
                ) : (
                  <>
                    <Square className="w-4 h-4 text-zinc-400" />
                    <span>Select all</span>
                  </>
                )}
              </button>
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                {totalCount} call{totalCount !== 1 ? "s" : ""}
              </span>
            </div>
          )}
          {deleteError && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">{deleteError}</p>
          )}
        </div>
      )}

      {/* Calls List */}
      {calls.length > 0 ? (
        <div className="space-y-2.5">
          {calls.map((call: Call) => {
            const isSelected = selectedIds.has(call.id);

            return (
              <div
                key={call.id}
                className={`block bg-white dark:bg-zinc-900 rounded-xl border shadow-sm hover:shadow-md transition-all ${
                  isSelected
                    ? "border-indigo-300 dark:border-indigo-700 ring-1 ring-indigo-200 dark:ring-indigo-800"
                    : "border-zinc-200 dark:border-zinc-800"
                }`}
              >
                <div className="flex items-center gap-3 p-4">
                  {/* Checkbox - Admin Only */}
                  {isAdmin && (
                    <button
                      onClick={() => toggleSelection(call.id)}
                      className="flex-shrink-0 p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                      aria-label={isSelected ? "Deselect call" : "Select call"}
                    >
                      {isSelected ? (
                        <CheckSquare className="w-5 h-5 text-indigo-600" />
                      ) : (
                        <Square className="w-5 h-5 text-zinc-400" />
                      )}
                    </button>
                  )}

                  {/* Call Content - Clickable */}
                  <Link
                    href={`/dashboard/calls/${call.id}`}
                    className="flex-1 flex items-center gap-4 min-w-0"
                  >
                    {/* Left: Avatar + Rep info */}
                    <div className="flex items-center gap-3 min-w-0 flex-shrink-0">
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                          call.rep?.sales_role === "closer"
                            ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400"
                            : call.rep?.sales_role === "sdr"
                            ? "bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400"
                            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                        }`}
                      >
                        {getInitials(call.rep?.name)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium text-zinc-900 dark:text-white truncate">
                            {call.rep?.name || "Unassigned"}
                          </span>
                          {call.rep?.sales_role && (
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase flex-shrink-0 ${
                                call.rep.sales_role === "closer"
                                  ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400"
                                  : "bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400"
                              }`}
                            >
                              {call.rep.sales_role}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Center: Title + Date */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-zinc-900 dark:text-white truncate">
                        {call.title || "Untitled Call"}
                      </h3>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        {formatDate(call.created_at)}
                      </p>
                    </div>

                    {/* Right: Score / Status + Outcome */}
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      {call.score != null ? (
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-lg text-sm font-bold ${
                            call.score >= 8
                              ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800"
                              : call.score >= 6
                              ? "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800"
                              : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800"
                          }`}
                        >
                          {call.score.toFixed(1)}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                          Not Scored
                        </span>
                      )}

                      {call.effectiveOutcome && (
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                            call.effectiveOutcome === "closed"
                              ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400"
                              : call.effectiveOutcome === "follow_up"
                              ? "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400"
                              : call.effectiveOutcome === "no_sale"
                              ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400"
                              : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
                          }`}
                        >
                          {call.effectiveOutcome.replace("_", " ")}
                        </span>
                      )}
                    </div>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-12 text-center">
          <Phone className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">
            No calls found
          </h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Waiting for Fathom calls to come in.
          </p>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        callCount={selectedCount}
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setIsDeleteModalOpen(false);
          setDeleteError(null);
        }}
        isDeleting={isDeleting}
      />
    </>
  );
}
