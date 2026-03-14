"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { 
  LayoutDashboard, 
  Phone, 
  Users, 
  BarChart3, 
  Settings,
  Menu,
  X,
  Brain,
  Upload,
  BookOpen
} from "lucide-react";
import { useState, useCallback } from "react";
import type { RepRole } from "@/types";

const navigation = [
  { name: "Overview", href: "/dashboard", icon: LayoutDashboard, adminOnly: false },
  { name: "Calls", href: "/dashboard/calls", icon: Phone, adminOnly: false },
  { name: "Reps", href: "/dashboard/reps", icon: Users, adminOnly: false },
  { name: "Analysis", href: "/dashboard/analysis", icon: BarChart3, adminOnly: true },
  { name: "Learning Queue", href: "/dashboard/learning-queue", icon: Brain, adminOnly: true },
  { name: "Pattern Library", href: "/dashboard/patterns", icon: BookOpen, adminOnly: true },
  { name: "Import Calls", href: "/dashboard/import-calls", icon: Upload, adminOnly: true },
  { name: "Settings", href: "/dashboard/settings", icon: Settings, adminOnly: false },
];

interface DashboardShellProps {
  children: React.ReactNode;
  orgName: string;
  userRole?: RepRole;
  isAdmin?: boolean;
}

export default function DashboardShell({ children, orgName, userRole, isAdmin: isAdminUser }: DashboardShellProps) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Mobile sidebar overlay */}
      <div 
        className={`fixed inset-0 z-40 lg:hidden transition-colors duration-300 ${
          sidebarOpen ? "bg-black/50 pointer-events-auto" : "bg-transparent pointer-events-none"
        }`}
        onClick={closeSidebar}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <aside 
        className={`
          fixed top-0 left-0 z-50 h-full w-64 
          bg-white dark:bg-zinc-900 
          border-r border-zinc-200 dark:border-zinc-800
          transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center justify-between px-6 border-b border-zinc-200 dark:border-zinc-800">
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">CC</span>
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-zinc-900 dark:text-white text-sm">
                  Credit Club
                </span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400 truncate max-w-[120px]">
                  {orgName}
                </span>
              </div>
            </Link>
            <button 
              className="lg:hidden p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
              onClick={closeSidebar}
              aria-label="Close sidebar"
            >
              <X className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-1">
            {navigation
              .filter((item) => !item.adminOnly || isAdminUser)
              .map((item) => {
              const isActive = item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(`${item.href}/`) || pathname === item.href;
              const Icon = item.icon;
              
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                    transition-all duration-150
                    ${isActive 
                      ? "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400" 
                      : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-200"
                    }
                  `}
                  onClick={closeSidebar}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* User section */}
          <div className="p-4 border-t border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center gap-3 px-3 py-2">
              <UserButton 
                appearance={{
                  elements: {
                    avatarBox: "w-8 h-8"
                  }
                }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">
                  Account
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 capitalize">
                  {isAdminUser ? "Admin" : userRole}
                </p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64 transition-[padding] duration-300">
        {/* Header */}
        <header className="sticky top-0 z-30 h-16 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex h-full items-center justify-between px-4 sm:px-6 lg:px-8">
            <button
              className="lg:hidden p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              <Menu className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
            </button>
            
            <div className="flex items-center gap-4 ml-auto">
              <span className="text-sm text-zinc-500 dark:text-zinc-400 hidden sm:block">
                Credit Club Coach
              </span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
