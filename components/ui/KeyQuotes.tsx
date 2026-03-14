"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Copy, Check, MessageSquare, Quote } from "lucide-react";

interface KeyQuote {
  quote: string;
  context?: string;
  type?: string;
  timestamp?: string;
}

interface KeyQuotesProps {
  quotes: (string | KeyQuote)[];
  className?: string;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md transition-colors"
      title="Copy to clipboard"
    >
      {copied ? (
        <>
          <Check className="w-3 h-3 text-green-500" />
          <span className="text-green-600 dark:text-green-400">Copied</span>
        </>
      ) : (
        <>
          <Copy className="w-3 h-3" />
          <span>Copy</span>
        </>
      )}
    </button>
  );
}

const TYPE_STYLES: Record<string, { bg: string; border: string; label: string }> = {
  technique: { bg: "bg-indigo-50 dark:bg-indigo-900/10", border: "border-indigo-400 dark:border-indigo-600", label: "Technique" },
  objection: { bg: "bg-red-50 dark:bg-red-900/10", border: "border-red-400 dark:border-red-600", label: "Objection" },
  close: { bg: "bg-green-50 dark:bg-green-900/10", border: "border-green-400 dark:border-green-600", label: "Close" },
  rapport: { bg: "bg-purple-50 dark:bg-purple-900/10", border: "border-purple-400 dark:border-purple-600", label: "Rapport" },
  value: { bg: "bg-emerald-50 dark:bg-emerald-900/10", border: "border-emerald-400 dark:border-emerald-600", label: "Value" },
};

export function KeyQuotes({ quotes, className }: KeyQuotesProps) {
  if (!quotes || quotes.length === 0) return null;

  return (
    <div className={cn("space-y-3", className)}>
      {quotes.map((kq, i) => {
        const isString = typeof kq === "string";
        const quoteText = isString ? kq : kq.quote;
        const context = isString ? undefined : kq.context;
        const type = isString ? undefined : kq.type;
        const timestamp = isString ? undefined : kq.timestamp;
        const typeStyle = type ? TYPE_STYLES[type] || TYPE_STYLES.technique : TYPE_STYLES.technique;

        return (
          <div
            key={i}
            className={cn(
              "rounded-lg border p-4 transition-colors",
              typeStyle.bg,
              "border-zinc-200 dark:border-zinc-700"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <Quote className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                  {type && (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-zinc-200/50 dark:bg-zinc-700/50 text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
                      {typeStyle.label}
                    </span>
                  )}
                  {timestamp && (
                    <span className="text-xs font-mono text-zinc-400">[{timestamp}]</span>
                  )}
                </div>
                <blockquote className={cn("border-l-3 pl-4 py-1", typeStyle.border)}>
                  <p className="text-sm text-zinc-700 dark:text-zinc-300 italic leading-relaxed">
                    &ldquo;{quoteText}&rdquo;
                  </p>
                </blockquote>
                {context && (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2 ml-4">
                    {context}
                  </p>
                )}
              </div>
              <CopyButton text={quoteText} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
