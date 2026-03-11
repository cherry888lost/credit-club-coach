"use client";

import Link from "next/link";
import { BarChart3 } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      {/* Navigation */}
      <nav className="border-b border-zinc-800/50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <span className="font-semibold text-white text-lg">Credit Club</span>
          </div>
        </div>
      </nav>

      {/* Centered Content */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-10">
            Credit Club 2.0 Sales Tracker
          </h1>

          <Link
            href="/sign-in"
            className="inline-flex items-center px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-colors text-lg"
          >
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
