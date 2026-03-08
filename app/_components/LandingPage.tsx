"use client";

import Link from "next/link";
import { 
  BarChart3, 
  Trophy, 
  Lightbulb, 
  ArrowRight, 
  CheckCircle2,
  Phone,
  Users,
  TrendingUp
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Navigation */}
      <nav className="border-b border-zinc-800/50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <span className="font-semibold text-white text-lg">Credit Club Coach</span>
          </div>
          
          <div className="flex items-center gap-4">
            <Link 
              href="/sign-in"
              className="text-sm text-zinc-400 hover:text-white transition-colors"
            >
              Sign In
            </Link>
            <Link 
              href="/sign-up"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>
      
      {/* Hero Section */}
      <section className="pt-20 pb-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-white leading-tight mb-6">
            Review sales calls.{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">
              Score performance.
            </span>{" "}
            Coach your closers.
          </h1>
          
          <p className="text-xl text-zinc-400 max-w-2xl mx-auto mb-10">
            AI-powered call scoring for Credit Club sales teams. Automatically analyze Fathom recordings, 
            track rep performance, and identify coaching opportunities.
          </p>
          
          <div className="flex items-center justify-center gap-4">
            <Link 
              href="/sign-up"
              className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-all hover:scale-105"
            >
              Get Started
              <ArrowRight className="w-4 h-4" />
            </Link>
            
            <Link 
              href="/sign-in"
              className="inline-flex items-center gap-2 px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-xl transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>
      
      {/* Dashboard Preview */}
      <section className="py-12 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="relative rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-900/50 shadow-2xl">
            {/* Browser Chrome */}
            <div className="h-10 bg-zinc-900 border-b border-zinc-800 flex items-center px-4 gap-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <div className="w-3 h-3 rounded-full bg-green-500/80" />
              </div>
              <div className="flex-1 text-center">
                <span className="text-xs text-zinc-500">credit-club-coach.app/dashboard</span>
              </div>
            </div>
            
            {/* Preview Content */}
            <div className="p-6">
              <div className="grid grid-cols-4 gap-4 mb-6">
                {[
                  { label: "Total Calls", value: "24", color: "bg-zinc-800" },
                  { label: "Avg Score", value: "7.8", color: "bg-green-500/20 text-green-400" },
                  { label: "Team Members", value: "4", color: "bg-zinc-800" },
                  { label: "Flagged", value: "2", color: "bg-red-500/20 text-red-400" },
                ].map((stat) => (
                  <div key={stat.label} className={`p-4 rounded-xl ${stat.color}`}>
                    <p className="text-2xl font-bold">{stat.value}</p>
                    <p className="text-xs text-zinc-400 mt-1">{stat.label}</p>
                  </div>
                ))}
              </div>              
              <div className="space-y-3">
                {[
                  { name: "Sarah Johnson - Discovery Call", rep: "Test Closer", score: "8.2" },
                  { name: "Michael Chen - Follow-up", rep: "Test Manager", score: "7.5" },
                  { name: "Emily Davis - Cold Call", rep: "Test Closer", score: "6.8" },
                ].map((call, i) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-xl">
                    <div>
                      <p className="font-medium text-white">{call.name}</p>
                      <p className="text-sm text-zinc-500">{call.rep}</p>
                    </div>
                    <span className="px-3 py-1 bg-green-500/20 text-green-400 text-sm font-bold rounded-lg">
                      {call.score}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
      
      {/* Features */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white mb-4">Everything you need to coach your team</h2>
            <p className="text-zinc-400">Powerful features designed for sales managers</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6">
            <FeatureCard 
              icon={<BarChart3 className="w-6 h-6" />}
              title="AI Call Scoring"
              description="Automatic scoring across 7 dimensions: opening, discovery, rapport, objection handling, closing, structure, and product knowledge."
            />
            
            <FeatureCard 
              icon={<Trophy className="w-6 h-6" />}
              title="Rep Leaderboards"
              description="Track individual performance with call counts, average scores, and flagged calls. Identify your top performers and those who need coaching."
            />
            
            <FeatureCard 
              icon={<Lightbulb className="w-6 h-6" />}
              title="Coaching Insights"
              description="AI-generated strengths, improvements, and coaching recommendations for every call. Know exactly what to focus on in your 1:1s."
            />
          </div>
        </div>
      </section>
      
      {/* How It Works */}
      <section className="py-20 px-6 border-t border-zinc-800/50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white mb-4">How it works</h2>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: <Phone className="w-6 h-6" />,
                step: "1",
                title: "Connect Fathom",
                description: "Link your Fathom account to automatically import call recordings and transcripts."
              },
              {
                icon: <TrendingUp className="w-6 h-6" />,
                step: "2",
                title: "Auto-Score Calls",
                description: "Our AI analyzes every call and scores it across 7 key sales dimensions."
              },
              {
                icon: <Users className="w-6 h-6" />,
                step: "3",
                title: "Coach Your Team",
                description: "Use the insights and leaderboards to run data-driven coaching sessions."
              }
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-indigo-600 rounded-xl mb-4">
                  {item.icon}
                </div>
                <div className="text-sm font-bold text-indigo-400 mb-2">Step {item.step}</div>
                <h3 className="text-lg font-semibold text-white mb-2">{item.title}</h3>
                <p className="text-zinc-400 text-sm">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      
      {/* CTA Section */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="p-8 md:p-12 rounded-2xl bg-gradient-to-br from-indigo-900/50 to-purple-900/50 border border-indigo-800/50">
            <h2 className="text-3xl font-bold text-white mb-4">Ready to level up your sales team?</h2>
            <p className="text-zinc-300 mb-8">
              Start scoring calls and coaching your closers to higher conversion rates.
            </p>
            
            <div className="flex items-center justify-center gap-4">
              <Link 
                href="/sign-up"
                className="inline-flex items-center gap-2 px-6 py-3 bg-white text-indigo-900 font-semibold rounded-xl hover:bg-zinc-100 transition-colors"
              >
                Get Started Free
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            
            <div className="mt-6 flex items-center justify-center gap-6 text-sm text-zinc-400">
              <span className="flex items-center gap-1"><CheckCircle2 className="w-4 h-4 text-green-400" /> Fathom integration</span>
              <span className="flex items-center gap-1"><CheckCircle2 className="w-4 h-4 text-green-400" /> AI scoring</span>
              <span className="flex items-center gap-1"><CheckCircle2 className="w-4 h-4 text-green-400" /> Team analytics</span>
            </div>
          </div>
        </div>
      </section>
      
      {/* Footer */}
      <footer className="py-8 px-6 border-t border-zinc-800/50">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-indigo-600 rounded flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-medium text-zinc-400">Credit Club Coach</span>
          </div>
          
          <p className="text-sm text-zinc-500">© 2026 Credit Club. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="p-6 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors group">
      <div className="w-12 h-12 bg-indigo-600/20 rounded-xl flex items-center justify-center text-indigo-400 mb-4 group-hover:bg-indigo-600/30 transition-colors">
        {icon}
      </div>
      
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      
      <p className="text-zinc-400 text-sm leading-relaxed">{description}</p>
    </div>
  );
}
