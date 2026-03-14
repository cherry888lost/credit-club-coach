"use client";

import { useState } from "react";
import { Trash2, AlertTriangle, X } from "lucide-react";

interface DeleteConfirmModalProps {
  isOpen: boolean;
  callCount: number;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting?: boolean;
}

export function DeleteConfirmModal({
  isOpen,
  callCount,
  onConfirm,
  onCancel,
  isDeleting = false,
}: DeleteConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={!isDeleting ? onCancel : undefined}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
                Delete Call{callCount !== 1 ? "s" : ""}
              </h3>
              <p className="text-sm text-zinc-500">
                {callCount} item{callCount !== 1 ? "s" : ""} selected
              </p>
            </div>
          </div>
          {!isDeleting && (
            <button
              onClick={onCancel}
              className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-zinc-400" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
            <p className="text-sm text-amber-800 dark:text-amber-300 leading-relaxed">
              Are you sure you want to delete these {callCount} call
              {callCount !== 1 ? "s" : ""}? This will hide them from the dashboard,
              analysis, metrics, and review queues. This action can be restored
              later if needed.
            </p>
          </div>

          <div className="flex items-start gap-3 text-sm text-zinc-600 dark:text-zinc-400">
            <div className="w-1.5 h-1.5 rounded-full bg-zinc-400 mt-2 flex-shrink-0" />
            <p>Deleted calls will not appear in any reports or analytics</p>
          </div>
          <div className="flex items-start gap-3 text-sm text-zinc-600 dark:text-zinc-400">
            <div className="w-1.5 h-1.5 rounded-full bg-zinc-400 mt-2 flex-shrink-0" />
            <p>Call data is preserved and can be restored later</p>
          </div>
          <div className="flex items-start gap-3 text-sm text-zinc-600 dark:text-zinc-400">
            <div className="w-1.5 h-1.5 rounded-full bg-zinc-400 mt-2 flex-shrink-0" />
            <p>Re-importing the same call from Fathom will undelete it</p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-5 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-w-[100px] justify-center"
          >
            {isDeleting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                <span>Delete</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
