import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import logo from "@/assets/v4-logo.png";
import { LogOut, Shield, ChevronDown, Menu, X } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
    { path: "/comercial/leads", label: "Leads" },
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

  // Solid red bar (V4 brand) — legacy top bar look, keeping the floating pill shape
  const glassPill =
    "rounded-full border border-red-700/60 bg-red-600 shadow-[0_8px_32px_-8px_rgba(220,38,38,0.45),0_2px_8px_-2px_rgba(0,0,0,0.4)]";

  // Active item: subtle pill + dot indicator (macOS Dock style)
  const navItemBase =
    "relative font-body text-[13px] font-medium tracking-tight flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all duration-200 ease-out";
  const navItemIdle = "text-white/80 hover:text-white hover:bg-white/15 hover:scale-[1.02]";
  const navItemActive = "text-white bg-white/20";

  const ActiveDot = () => (
    <span className="absolute -bottom-[6px] left-1/2 -translate-x-1/2 h-[3px] w-[3px] rounded-full bg-white/90" />
  );

  return (
    <TooltipProvider delayDuration={200}>
      {/* Floating pill header */}
      <header
        className={`fixed top-3 left-1/2 -translate-x-1/2 z-40 transition-all duration-300 ease-out px-3 sm:px-0 w-[calc(100%-1.5rem)] sm:w-auto max-w-[min(100%-1.5rem,1100px)] ${
          scrolled ? "scale-[0.98]" : ""
        }`}
      >
        <div
          key={location.pathname}
          className={`${glassPill} flex items-center gap-1 h-11 px-2 transition-all duration-300 animate-in fade-in-0 slide-in-from-top-4 zoom-in-95 duration-500 ease-out ${
            scrolled ? "bg-red-700" : ""
          }`}
        >
          {/* Logo */}
          <Link
            to="/"
            className="flex items-center pl-2 pr-2 h-8 rounded-full hover:bg-white/[0.04] transition-colors"
            title="Hub"
          >
            <img src={logo} alt="V4 Company" className="h-4 w-auto opacity-90" />
          </Link>

          {/* Divider */}
          <div className="hidden md:block w-px h-4 bg-white/10 mx-1" />

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-0.5">
            {visibleAquisicaoItems.length > 0 && (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setAquisicaoOpen(!aquisicaoOpen)}
                  className={`${navItemBase} ${isAquisicaoActive ? navItemActive : navItemIdle}`}
                >
                  <span>Data Analytics</span>
                  <ChevronDown
                    className={`h-3 w-3 opacity-60 transition-transform duration-200 ${aquisicaoOpen ? "rotate-180" : ""}`}
                  />
                  {isAquisicaoActive && <ActiveDot />}
                </button>
                {aquisicaoOpen && (
                  <div className="absolute top-full left-0 mt-2.5 min-w-[220px] z-50 rounded-2xl border border-white/[0.08] bg-popover/80 backdrop-blur-2xl backdrop-saturate-200 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.6),inset_0_1px_0_0_rgba(255,255,255,0.08)] p-1.5 animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-150">
                    {visibleAquisicaoItems.map((item) => (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setAquisicaoOpen(false)}
                        className={`block px-3 py-2 rounded-xl font-body text-[13px] font-medium tracking-tight transition-all duration-150 ${
                          isActive(item.path)
                            ? "bg-white/[0.08] text-foreground"
                            : "text-foreground/75 hover:bg-white/[0.05] hover:text-foreground"
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
                  className={`${navItemBase} ${isComercialActive ? navItemActive : navItemIdle}`}
                >
                  <span>Revenue</span>
                  <ChevronDown
                    className={`h-3 w-3 opacity-60 transition-transform duration-200 ${comercialOpen ? "rotate-180" : ""}`}
                  />
                  {isComercialActive && <ActiveDot />}
                </button>
                {comercialOpen && (
                  <div className="absolute top-full left-0 mt-2.5 min-w-[220px] z-50 rounded-2xl border border-white/[0.08] bg-popover/80 backdrop-blur-2xl backdrop-saturate-200 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.6),inset_0_1px_0_0_rgba(255,255,255,0.08)] p-1.5 animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-150">
                    {visibleComercialItems.map((item) => (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setComercialOpen(false)}
                        className={`block px-3 py-2 rounded-xl font-body text-[13px] font-medium tracking-tight transition-all duration-150 ${
                          isActive(item.path)
                            ? "bg-white/[0.08] text-foreground"
                            : "text-foreground/75 hover:bg-white/[0.05] hover:text-foreground"
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

          {/* Right side: divider + admin + signout */}
          <div className="hidden md:flex items-center gap-0.5 ml-1">
            {(isAdmin || user) && <div className="w-px h-4 bg-white/10 mx-1" />}
            {isAdmin && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    to="/admin"
                    className={`relative flex items-center justify-center h-8 w-8 rounded-full transition-all duration-200 ${
                      isActive("/admin")
                        ? "bg-white/[0.08] text-foreground"
                        : "text-foreground/65 hover:text-foreground hover:bg-white/[0.06] hover:scale-[1.05]"
                    }`}
                  >
                    <Shield className="h-3.5 w-3.5" />
                    {isActive("/admin") && <ActiveDot />}
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={8} className="rounded-lg text-xs">Admin</TooltipContent>
              </Tooltip>
            )}
            {user && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={signOut}
                    className="flex items-center justify-center h-8 w-8 rounded-full text-foreground/65 hover:text-foreground hover:bg-white/[0.06] hover:scale-[1.05] transition-all duration-200"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={8} className="rounded-lg text-xs">Sair</TooltipContent>
              </Tooltip>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="md:hidden ml-auto flex items-center justify-center h-8 w-8 rounded-full text-foreground/70 hover:text-foreground hover:bg-white/[0.06] transition-colors"
          >
            <Menu className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Spacer to offset fixed header */}
      <div aria-hidden className="h-[68px]" />

      {/* Mobile sidebar overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="fixed inset-0 bg-background/50 backdrop-blur-md animate-in fade-in-0 duration-200"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="fixed top-3 right-3 bottom-3 w-72 rounded-2xl border border-white/[0.08] bg-gradient-to-b from-popover/85 to-popover/75 backdrop-blur-2xl backdrop-saturate-200 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7),inset_0_1px_0_0_rgba(255,255,255,0.08)] flex flex-col animate-in slide-in-from-right-4 fade-in-0 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
              <img src={logo} alt="V4 Company" className="h-4 w-auto opacity-90" />
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-center h-8 w-8 rounded-full text-foreground/70 hover:text-foreground hover:bg-white/[0.06] transition-colors"
              >
                <X className="h-4 w-4" />
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
                        className={`block px-3 py-2 rounded-xl text-[13px] font-medium transition-colors ${
                          isActive(item.path)
                            ? "bg-white/[0.08] text-foreground"
                            : "text-foreground/75 hover:bg-white/[0.05] hover:text-foreground"
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
                        className={`block px-3 py-2 rounded-xl text-[13px] font-medium transition-colors ${
                          isActive(item.path)
                            ? "bg-white/[0.08] text-foreground"
                            : "text-foreground/75 hover:bg-white/[0.05] hover:text-foreground"
                        }`}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {isAdmin && (
                <div className="px-3 py-2">
                  <Link
                    to="/admin"
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[13px] font-medium transition-colors ${
                      isActive("/admin")
                        ? "bg-white/[0.08] text-foreground"
                        : "text-foreground/75 hover:bg-white/[0.05] hover:text-foreground"
                    }`}
                  >
                    <Shield className="h-3.5 w-3.5" />
                    Admin
                  </Link>
                </div>
              )}
            </nav>

            {user && (
              <div className="border-t border-white/[0.06] p-3">
                <button
                  onClick={signOut}
                  className="flex items-center gap-2 text-foreground/70 hover:text-foreground hover:bg-white/[0.05] transition-colors text-[13px] font-medium w-full px-3 py-2 rounded-xl"
                >
                  <LogOut className="h-4 w-4" />
                  Sair
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </TooltipProvider>
  );
};

export default V4Header;
