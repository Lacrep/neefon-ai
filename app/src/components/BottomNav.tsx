import { Link, useLocation } from "react-router";

// Mobile-only bottom navigation (Material 3 style). The left Sidebar is hidden
// below md; this gives phones the full screen width and a familiar tab bar.
export default function BottomNav() {
  const location = useLocation();

  const navItems = [
    { path: "/", label: "หน้าหลัก", icon: "dashboard" },
    { path: "/history", label: "ประวัติ", icon: "history" },
    { path: "/settings", label: "ตั้งค่า", icon: "settings" },
  ];

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-[0_-4px_20px_rgba(0,31,63,0.06)]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex justify-around items-stretch">
        {navItems.map((item) => {
          const active = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              aria-current={active ? "page" : undefined}
              className="flex-1 flex flex-col items-center justify-center gap-1 py-2 active:scale-95 transition"
            >
              <span
                className={`material-symbols-outlined text-[22px] px-5 py-0.5 rounded-full transition-colors ${
                  active ? "bg-[#005eb2]/12 text-[#005eb2]" : "text-slate-400"
                }`}
              >
                {item.icon}
              </span>
              <span className={`text-[10px] font-medium ${active ? "text-[#005eb2]" : "text-slate-400"}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
