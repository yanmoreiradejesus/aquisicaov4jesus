import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import logo from "@/assets/v4-logo.png";
import { LogOut, Shield, ChevronDown } from "lucide-react";
import { useState, useRef, useEffect } from "react";

const V4Header = () => {
  const location = useLocation();
  const { user, isAdmin, hasPageAccess, signOut } = useAuth();
  const [aquisicaoOpen, setAquisicaoOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isActive = (path: string) => location.pathname === path;

  const aquisicaoItems = [
    { path: "/", label: "FUNIL" },
    { path: "/insights", label: "INSIGHTS" },
    { path: "/metas", label: "METAS" },
  ];

  const isAquisicaoActive = aquisicaoItems.some((item) => isActive(item.path));
  const visibleAquisicaoItems = aquisicaoItems.filter((item) => hasPageAccess(item.path));

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setAquisicaoOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="border-b border-border/50 bg-[#e50914]">
      <div className="container mx-auto px-4 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6 lg:gap-8">
            <img src={logo} alt="V4 Company" className="h-5 w-auto" />

            <nav className="flex items-center gap-4 lg:gap-6">
              {/* AQUISIÇÃO dropdown */}
              {visibleAquisicaoItems.length > 0 && (
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setAquisicaoOpen(!aquisicaoOpen)}
                    className={`font-body text-xs lg:text-sm font-medium tracking-wider transition-all duration-300 text-white flex items-center gap-1 ${
                      isAquisicaoActive ? "opacity-100" : "opacity-70 hover:opacity-100"
                    }`}
                  >
                    AQUISIÇÃO
                    <ChevronDown className={`h-3 w-3 transition-transform ${aquisicaoOpen ? "rotate-180" : ""}`} />
                  </button>
                  {aquisicaoOpen && (
                    <div className="absolute top-full left-0 mt-2 bg-[#b5070f] rounded-md shadow-lg py-1 min-w-[160px] z-50">
                      {visibleAquisicaoItems.map((item) => (
                        <Link
                          key={item.path}
                          to={item.path}
                          onClick={() => setAquisicaoOpen(false)}
                          className={`block px-4 py-2 font-body text-xs lg:text-sm font-medium tracking-wider text-white transition-all duration-200 ${
                            isActive(item.path)
                              ? "bg-white/20"
                              : "hover:bg-white/10"
                          }`}
                        >
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* FINANCEIRO standalone */}
              {hasPageAccess("/financeiro") && (
                <Link
                  to="/financeiro"
                  className={`font-body text-xs lg:text-sm font-medium tracking-wider transition-all duration-300 text-white ${
                    isActive("/financeiro") ? "opacity-100" : "opacity-70 hover:opacity-100"
                  }`}
                >
                  FINANCEIRO
                </Link>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-4">
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
      </div>
    </header>
  );
};

export default V4Header;
