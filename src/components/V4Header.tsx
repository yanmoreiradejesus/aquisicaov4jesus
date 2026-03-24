import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import logo from "@/assets/v4-logo.png";
import { LogOut, Shield } from "lucide-react";

const V4Header = () => {
  const location = useLocation();
  const { user, isAdmin, hasPageAccess, signOut } = useAuth();
  
  const isActive = (path: string) => location.pathname === path;

  const navItems = [
    { path: "/", label: "DASHBOARD" },
    { path: "/insights", label: "INSIGHTS" },
    { path: "/metas", label: "METAS" },
    { path: "/financeiro", label: "FINANCEIRO" },
  ];
  
  return (
    <header className="border-b border-border/50 bg-[#e50914]">
      <div className="container mx-auto px-4 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-8">
            <img src={logo} alt="V4 Company" className="h-5 w-auto" />
            
            <nav className="flex gap-4 lg:gap-6">
              {navItems
                .filter((item) => hasPageAccess(item.path))
                .map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`font-body text-xs lg:text-sm font-medium tracking-wider transition-all duration-300 text-white ${
                      isActive(item.path) ? "opacity-100" : "opacity-70 hover:opacity-100"
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              {isAdmin && (
                <Link
                  to="/admin"
                  className={`font-body text-xs lg:text-sm font-medium tracking-wider transition-all duration-300 text-white flex items-center gap-1 ${
                    isActive("/admin") ? "opacity-100" : "opacity-70 hover:opacity-100"
                  }`}
                >
                  <Shield className="h-3 w-3" />
                  ADMIN
                </Link>
              )}
            </nav>
          </div>
          
          {user && (
            <button
              onClick={signOut}
              className="flex items-center gap-2 text-white/70 hover:text-white transition-colors text-xs lg:text-sm"
              title="Sair"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden lg:inline">Sair</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

export default V4Header;
