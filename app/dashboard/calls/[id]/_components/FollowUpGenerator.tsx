"use client";

import { useState } from "react";
import { MessageSquare, Mail, Phone, Copy, Check, Loader2, RefreshCw } from "lucide-react";

interface FollowUpMessages {
  whatsapp: string;
  sms: string;
  email_subject: string;
  email_body: string;
  key_pain_points: string[];
  discussed_topics: string[];
  next_steps: string;
  cta: string;
}

export function FollowUpGenerator({ callId }: { callId: string }) {
  const [prospectName, setProspectName] = useState("");
  const [messages, setMessages] = useState<FollowUpMessages | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/calls/${callId}/follow-up`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prospect_name: prospectName || undefined,
          format: "all",
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to generate");
      }

      const data = await res.json();
      setMessages(data.messages);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-2">
        <MessageSquare className="w-5 h-5 text-indigo-600" />
        <h3 className="font-semibold">Follow-Up Messages</h3>
      </div>

      <div className="p-4 space-y-4">
        {/* Input */}
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Prospect name (optional)"
            value={prospectName}
            onChange={(e) => setProspectName(e.target.value)}
            className="flex-1 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            onClick={generate}
            disabled={loading}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Generating...
              </>
            ) : messages ? (
              <>
                <RefreshCw className="w-4 h-4" /> Regenerate
              </>
            ) : (
              "Generate Follow-Ups"
            )}
          </button>
        </div>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        {/* Generated Messages */}
        {messages && (
          <div className="space-y-4">
            {/* WhatsApp */}
            <MessageCard
              icon={<MessageSquare className="w-4 h-4" />}
              label="WhatsApp"
              color="text-green-600"
              content={messages.whatsapp}
              onCopy={() => copyToClipboard(messages.whatsapp, "whatsapp")}
              isCopied={copied === "whatsapp"}
            />

            {/* SMS */}
            <MessageCard
              icon={<Phone className="w-4 h-4" />}
              label="SMS"
              color="text-blue-600"
              content={messages.sms}
              onCopy={() => copyToClipboard(messages.sms, "sms")}
              isCopied={copied === "sms"}
            />

            {/* Email */}
            <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-zinc-50 dark:bg-zinc-800">
                <div className="flex items-center gap-2 text-sm font-medium text-purple-600 dark:text-purple-400">
                  <Mail className="w-4 h-4" />
                  Email
                </div>
                <button
                  onClick={() =>
                    copyToClipboard(
                      `Subject: ${messages.email_subject}\n\n${messages.email_body}`,
                      "email"
                    )
                  }
                  className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 flex items-center gap-1"
                >
                  {copied === "email" ? (
                    <Check className="w-3 h-3 text-green-500" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                  Copy
                </button>
              </div>
              <div className="p-3">
                <p className="text-xs text-zinc-500 mb-1">Subject:</p>
                <p className="text-sm font-medium text-zinc-900 dark:text-white mb-3">
                  {messages.email_subject}
                </p>
                <p className="text-xs text-zinc-500 mb-1">Body:</p>
                <div className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
                  {messages.email_body}
                </div>
              </div>
            </div>

            {/* Context Used */}
            {(messages.key_pain_points?.length > 0 || messages.discussed_topics?.length > 0) && (
              <div className="text-xs text-zinc-500 dark:text-zinc-400 space-y-1">
                {messages.key_pain_points?.length > 0 && (
                  <p>
                    <span className="font-medium">Pain points referenced:</span>{" "}
                    {messages.key_pain_points.join(", ")}
                  </p>
                )}
                {messages.discussed_topics?.length > 0 && (
                  <p>
                    <span className="font-medium">Topics referenced:</span>{" "}
                    {messages.discussed_topics.join(", ")}
                  </p>
                )}
                {messages.cta && (
                  <p>
                    <span className="font-medium">CTA:</span> {messages.cta}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MessageCard({
  icon,
  label,
  color,
  content,
  onCopy,
  isCopied,
}: {
  icon: React.ReactNode;
  label: string;
  color: string;
  content: string;
  onCopy: () => void;
  isCopied: boolean;
}) {
  return (
    <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-zinc-50 dark:bg-zinc-800">
        <div className={`flex items-center gap-2 text-sm font-medium ${color}`}>
          {icon}
          {label}
        </div>
        <button
          onClick={onCopy}
          className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 flex items-center gap-1"
        >
          {isCopied ? (
            <Check className="w-3 h-3 text-green-500" />
          ) : (
            <Copy className="w-3 h-3" />
          )}
          Copy
        </button>
      </div>
      <p className="p-3 text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
        {content}
      </p>
    </div>
  );
}
