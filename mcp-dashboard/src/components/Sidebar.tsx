"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const navItems = [
  { href: "/", label: "Overview", icon: "dashboard" },
  { href: "/batch", label: "Batch Tasks", icon: "account_tree" },
  { href: "/tools", label: "Tools", icon: "extension" },
  { href: "/logs", label: "Agents", icon: "smart_toy" },
];

const configItems = [
  { href: "#", label: "Settings", icon: "settings" },
  { href: "#", label: "API Keys", icon: "key" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`${
        collapsed ? "w-20" : "w-64"
      } flex-shrink-0 border-r border-white/5 bg-[#0a0a0c] flex flex-col z-10 transition-all duration-300`}
    >
      {/* Header */}
      <div
        className={`h-16 flex items-center ${
          collapsed ? "justify-center" : "justify-between"
        } px-4 border-b border-white/5`}
      >
        <button
          onClick={() => collapsed && setCollapsed(false)}
          className={`flex items-center ${collapsed ? "cursor-pointer" : "cursor-default"}`}
        >
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-[0_0_20px_rgba(124,58,237,0.5)] flex-shrink-0">
            <span className="material-icons-round text-white text-lg">dns</span>
          </div>
          {!collapsed && (
            <span className="font-bold text-lg tracking-tight ml-3 whitespace-nowrap text-white">
              MCP Monitor
            </span>
          )}
        </button>
        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            className="cursor-pointer text-gray-400 hover:text-white transition-colors p-1 rounded-md hover:bg-white/5"
          >
            <span className="material-icons-round">chevron_left</span>
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-6 flex flex-col gap-1 overflow-y-auto overflow-x-hidden">
        {!collapsed && (
          <div className="px-3 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Dashboard
          </div>
        )}

        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center ${
                collapsed ? "justify-center px-0" : "px-3"
              } py-2.5 rounded-lg group transition-all ${
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <span
                className={`material-icons-round text-xl ${
                  collapsed ? "" : "mr-3"
                }`}
              >
                {item.icon}
              </span>
              {!collapsed && (
                <span className="font-medium whitespace-nowrap">
                  {item.label}
                </span>
              )}
            </Link>
          );
        })}

        <div className="flex-1"></div>

        {!collapsed && (
          <div className="px-3 mt-2 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Configuration
          </div>
        )}

        {configItems.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className={`flex items-center ${
              collapsed ? "justify-center px-0" : "px-3"
            } py-2.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg group transition-all`}
          >
            <span
              className={`material-icons-round text-xl ${
                collapsed ? "" : "mr-3"
              }`}
            >
              {item.icon}
            </span>
            {!collapsed && (
              <span className="font-medium whitespace-nowrap">{item.label}</span>
            )}
          </Link>
        ))}
      </nav>

      {/* User */}
      <div className="p-4 border-t border-white/5">
        <div
          className={`flex items-center ${collapsed ? "justify-center" : ""}`}
        >
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-pink-500 flex-shrink-0 flex items-center justify-center text-white font-medium text-sm">
            AU
          </div>
          {!collapsed && (
            <div className="ml-3 overflow-hidden">
              <p className="text-sm font-medium text-white">Admin User</p>
              <p className="text-xs text-gray-400">admin@mcp.local</p>
            </div>
          )}
        </div>
        {collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            className="mt-3 w-full flex justify-center text-gray-400 hover:text-white transition-colors"
          >
            <span className="material-icons-round">chevron_right</span>
          </button>
        )}
      </div>
    </aside>
  );
}
