import { Link, useLocation } from "react-router-dom";
import logo from "@/assets/v4-logo.png";

const V4Header = () => {
  const location = useLocation();
  
  const isActive = (path: string) => location.pathname === path;
  
  return (
    <header className="border-b border-border/50 bg-[#e50914]">
      <div className="container mx-auto px-4 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-8">
            <img src={logo} alt="V4 Company" className="h-10 w-auto" />
            
            <nav className="flex gap-4 lg:gap-6">
              <Link
                to="/"
                className={`font-body text-xs lg:text-sm font-medium tracking-wider transition-all duration-300 text-white ${
                  isActive("/") ? "opacity-100" : "opacity-70 hover:opacity-100"
                }`}
              >
                DASHBOARD
              </Link>
              <Link
                to="/insights"
                className={`font-body text-xs lg:text-sm font-medium tracking-wider transition-all duration-300 text-white ${
                  isActive("/insights") ? "opacity-100" : "opacity-70 hover:opacity-100"
                }`}
              >
                INSIGHTS
              </Link>
              <Link
                to="/metas"
                className={`font-body text-xs lg:text-sm font-medium tracking-wider transition-all duration-300 text-white ${
                  isActive("/metas") ? "opacity-100" : "opacity-70 hover:opacity-100"
                }`}
              >
                METAS
              </Link>
            </nav>
          </div>
          
          <div className="h-8 w-8 rounded-lg border border-white/30 bg-white/10" />
        </div>
      </div>
    </header>
  );
};

export default V4Header;
