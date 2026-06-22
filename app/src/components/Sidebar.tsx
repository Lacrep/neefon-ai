import { Link, useLocation } from "react-router";
import { useSettings } from "@/contexts/SettingsContext";

export default function Sidebar() {
  const location = useLocation();
  const { settings } = useSettings();

  const navItems = [
    { path: "/", label: "Dashboard", icon: "dashboard" },
    { path: "/history", label: "History", icon: "history" },
    { path: "/settings", label: "Settings", icon: "settings" },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <aside className="hidden md:flex fixed left-0 top-0 h-full w-64 bg-[#000613] z-50 flex-col shadow-2xl">
      {/* Brand */}
      <div className="px-3 md:px-5 py-5 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-[#005eb2] flex items-center justify-center shrink-0 shadow-lg shadow-blue-900/50">
          <svg viewBox="0 0 48 48" className="w-6 h-6" fill="none">
            <path d="M24 8C16 8 10 14 8 20h32c-2-6-8-12-16-12z" fill="url(#uG)" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M24 20v14" stroke="white" strokeWidth="2" strokeLinecap="round" />
            <circle cx="18" cy="26" r="1.5" fill="#9fc8ff" className="drop-anim" style={{ animationDelay: "0s" }} />
            <circle cx="24" cy="28" r="1.5" fill="#9fc8ff" className="drop-anim" style={{ animationDelay: "0.3s" }} />
            <circle cx="30" cy="25" r="1.5" fill="#9fc8ff" className="drop-anim" style={{ animationDelay: "0.6s" }} />
            <defs>
              <linearGradient id="uG" x1="8" y1="8" x2="40" y2="24" gradientUnits="userSpaceOnUse">
                <stop stopColor="#9fc8ff" />
                <stop offset="1" stopColor="#4597fe" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div className="hidden md:block">
          <h1 className="text-lg font-bold tracking-tight text-white font-heading leading-tight">หนีฝน AI</h1>
          <p className="text-[11px] text-blue-200/50">ระบบพยากรณ์ฝนอัจฉริยะ</p>
        </div>
      </div>

      {/* Nav Links */}
      <nav className="flex-1 py-2">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex items-center gap-3 px-4 md:px-5 py-3 border-l-4 transition-all duration-200 ${
              isActive(item.path)
                ? "bg-[#4597fe]/15 border-[#4597fe] text-white font-semibold"
                : "border-transparent text-white/60 hover:text-white hover:bg-white/5"
            }`}
          >
            <span className="material-symbols-outlined text-[22px] shrink-0">{item.icon}</span>
            <span className="hidden md:inline">{item.label}</span>
          </Link>
        ))}
      </nav>

      {/* Location info */}
      <div className="p-4 border-t border-white/10 mt-auto">
        <div className="flex items-center gap-2 text-white/45 text-xs">
          <span className="material-symbols-outlined text-[16px] shrink-0">location_on</span>
          <span className="hidden md:inline truncate">{settings.locationName || "กรุงเทพฯ"}</span>
        </div>
      </div>
    </aside>
  );
}
