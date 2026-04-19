import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import logo from "@/assets/v4-logo.png";
import { LogOut, Shield, ChevronDown, Menu, X, Home } from "lucide-react";
import { useState, useRef, useEffect } from "react";

const V4Header = () => {
  const location = useLocation();
  const { user, isAdmin, hasPageAccess, signOut } = useAuth();
  const [aquisicaoOpen, setAquisicaoOpen] = useState(false);
  const [comercialOpen, setComercialOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const comercialRef = useRef<HTMLDivElement>(null);

  const isActive = (path: string) => location.pathname === path;

  const aquisicaoItems = [
    { path: "/aquisicao/dashboard", label: "Dashboard" },
    { path: "/aquisicao/funil", label: "Funil" },
    { path: "/aquisicao/meta", label: "Meta" },
    { path: "/aquisicao/insights", label: "Insights" },
    { path: "/aquisicao/financeiro", label: "Financeiro" },
  ];

  const comercialItems = [
    { path: "/comercial/leads", label: "CRM Leads" },
    { path: "/comercial/oportunidades", label: "Oportunidades" },
    { path: "/comercial/accounts", label: "Accounts" },
    { path: "/comercial/cobrancas", label: "Cobranças" },
  ];

  const isAquisicaoActive = aquisicaoItems.some((item) => isActive(item.path));
  const visibleAquisicaoItems = aquisicaoItems.filter((item) => hasPageAccess(item.path));
  const isComercialActive = comercialItems.some((item) => isActive(item.path));
  const visibleComercialItems = comercialItems.filter((item) => hasPageAccess(item.path));

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setAquisicaoOpen(false);
      }
      if (comercialRef.current && !comercialRef.current.contains(event.target as Node)) {
        setComercialOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navLinkBase =
    "relative font-body text-[13px] font-medium tracking-tight transition-colors duration-200 text-foreground/70 hover:text-foreground flex items-center gap-1.5 py-1.5";
  const navLinkActive = "text-foreground";

  return (
    <>
      <header
        className={`sticky top-0 z-40 transition-all duration-300 ${
          scrolled
            ? "bg-background/70 backdrop-blur-xl backdrop-saturate-150 border-b border-border/60"
            : "bg-background/40 backdrop-blur-md border-b border-border/30"
        }`}
      >
        <div className="container mx-auto px-4 lg:px-8">
          <div className="flex items-center justify-between h-12">
            <div className="flex items-center gap-8">
              <Link to="/" className="flex items-center" title="Hub">
                <img src={logo} alt="V4 Company" className="h-4 w-auto opacity-90 hover:opacity-100 transition-opacity" />
              </Link>

              {/* Desktop nav */}
              <nav className="hidden md:flex items-center gap-1">
                <Link
                  to="/"
                  className={`${navLinkBase} px-3 rounded-md hover:bg-foreground/5 ${isActive("/") ? navLinkActive : ""}`}
                  title="Hub"
                >
                  <Home className="h-3.5 w-3.5" />
                  <span>Hub</span>
                </Link>

                {visibleAquisicaoItems.length > 0 && (
                  <div className="relative" ref={dropdownRef}>
                    <button
                      onClick={() => setAquisicaoOpen(!aquisicaoOpen)}
                      className={`${navLinkBase} px-3 rounded-md hover:bg-foreground/5 ${
                        isAquisicaoActive ? navLinkActive : ""
                      }`}
                    >
                      <span>Data Analytics</span>
                      <ChevronDown
                        className={`h-3 w-3 transition-transform duration-200 ${aquisicaoOpen ? "rotate-180" : ""}`}
                      />
                    </button>
                    {aquisicaoOpen && (
                      <div className="absolute top-full left-0 mt-1.5 min-w-[200px] z-50 rounded-lg border border-border/60 bg-popover/95 backdrop-blur-xl shadow-ios-lg py-1.5 animate-in fade-in-0 zoom-in-95 slide-in-from-top-1 duration-150">
                        {visibleAquisicaoItems.map((item) => (
                          <Link
                            key={item.path}
                            to={item.path}
                            onClick={() => setAquisicaoOpen(false)}
                            className={`block mx-1 px-3 py-1.5 rounded-md font-body text-[13px] font-medium tracking-tight transition-colors ${
                              isActive(item.path)
                                ? "bg-foreground/10 text-foreground"
                                : "text-foreground/75 hover:bg-foreground/5 hover:text-foreground"
                            }`}
                          >
                            {item.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {visibleComercialItems.length > 0 && (
                  <div className="relative" ref={comercialRef}>
                    <button
                      onClick={() => setComercialOpen(!comercialOpen)}
                      className={`${navLinkBase} px-3 rounded-md hover:bg-foreground/5 ${
                        isComercialActive ? navLinkActive : ""
                      }`}
                    >
                      <span>Revenue</span>
                      <ChevronDown
                        className={`h-3 w-3 transition-transform duration-200 ${comercialOpen ? "rotate-180" : ""}`}
                      />
                    </button>
                    {comercialOpen && (
                      <div className="absolute top-full left-0 mt-1.5 min-w-[200px] z-50 rounded-lg border border-border/60 bg-popover/95 backdrop-blur-xl shadow-ios-lg py-1.5 animate-in fade-in-0 zoom-in-95 slide-in-from-top-1 duration-150">
                        {visibleComercialItems.map((item) => (
                          <Link
                            key={item.path}
                            to={item.path}
                            onClick={() => setComercialOpen(false)}
                            className={`block mx-1 px-3 py-1.5 rounded-md font-body text-[13px] font-medium tracking-tight transition-colors ${
                              isActive(item.path)
                                ? "bg-foreground/10 text-foreground"
                                : "text-foreground/75 hover:bg-foreground/5 hover:text-foreground"
                            }`}
                          >
                            {item.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </nav>
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden md:flex items-center gap-1">
                {isAdmin && (
                  <Link
                    to="/admin"
                    className={`${navLinkBase} px-3 rounded-md hover:bg-foreground/5 ${
                      isActive("/admin") ? navLinkActive : ""
                    }`}
                  >
                    <Shield className="h-3.5 w-3.5" />
                    <span>Admin</span>
                  </Link>
                )}
                {user && (
                  <button
                    onClick={signOut}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-foreground/70 hover:text-foreground hover:bg-foreground/5 transition-colors text-[13px] font-medium"
                    title="Sair"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span className="hidden lg:inline">Sair</span>
                  </button>
                )}
              </div>

              {/* Mobile hamburger */}
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="md:hidden text-foreground p-1.5 rounded-md hover:bg-foreground/5 transition-colors"
              >
                <Menu className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile sidebar overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="fixed inset-0 bg-background/60 backdrop-blur-sm animate-in fade-in-0 duration-200"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="fixed top-0 right-0 h-full w-72 bg-background/95 backdrop-blur-xl border-l border-border/60 shadow-ios-xl flex flex-col animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between p-4 border-b border-border/60">
              <img src={logo} alt="V4 Company" className="h-4 w-auto opacity-90" />
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="text-foreground/70 hover:text-foreground p-1.5 rounded-md hover:bg-foreground/5 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="flex-1 overflow-auto py-2">
              {visibleAquisicaoItems.length > 0 && (
                <div className="px-3 py-2">
                  <span className="px-3 text-foreground/40 text-[10px] font-semibold uppercase tracking-widest">
                    Data Analytics
                  </span>
                  <div className="mt-1.5 space-y-0.5">
                    {visibleAquisicaoItems.map((item) => (
                      <Link
                        key={item.path}
                        to={item.path}
                        className={`block px-3 py-2 rounded-md text-[13px] font-medium transition-colors ${
                          isActive(item.path)
                            ? "bg-foreground/10 text-foreground"
                            : "text-foreground/75 hover:bg-foreground/5 hover:text-foreground"
                        }`}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {visibleComercialItems.length > 0 && (
                <div className="px-3 py-2">
                  <span className="px-3 text-foreground/40 text-[10px] font-semibold uppercase tracking-widest">
                    Revenue
                  </span>
                  <div className="mt-1.5 space-y-0.5">
                    {visibleComercialItems.map((item) => (
                      <Link
                        key={item.path}
                        to={item.path}
                        className={`block px-3 py-2 rounded-md text-[13px] font-medium transition-colors ${
                          isActive(item.path)
                            ? "bg-foreground/10 text-foreground"
                            : "text-foreground/75 hover:bg-foreground/5 hover:text-foreground"
                        }`}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              <div className="px-3 py-2">
                <Link
                  to="/"
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-[13px] font-medium transition-colors ${
                    isActive("/")
                      ? "bg-foreground/10 text-foreground"
                      : "text-foreground/75 hover:bg-foreground/5 hover:text-foreground"
                  }`}
                >
                  <Home className="h-3.5 w-3.5" />
                  Hub
                </Link>
              </div>

              {isAdmin && (
                <div className="px-3 py-2">
                  <Link
                    to="/admin"
                    className={`flex items-center gap-2 px-3 py-2 rounded-md text-[13px] font-medium transition-colors ${
                      isActive("/admin")
                        ? "bg-foreground/10 text-foreground"
                        : "text-foreground/75 hover:bg-foreground/5 hover:text-foreground"
                    }`}
                  >
                    <Shield className="h-3.5 w-3.5" />
                    Admin
                  </Link>
                </div>
              )}
            </nav>

            {user && (
              <div className="border-t border-border/60 p-3">
                <button
                  onClick={signOut}
                  className="flex items-center gap-2 text-foreground/70 hover:text-foreground hover:bg-foreground/5 transition-colors text-[13px] font-medium w-full px-3 py-2 rounded-md"
                >
                  <LogOut className="h-4 w-4" />
                  Sair
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default V4Header;
