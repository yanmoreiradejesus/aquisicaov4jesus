import { Link, useLocation } from "react-router-dom";

const V4Header = () => {
  const location = useLocation();
  
  const isActive = (path: string) => location.pathname === path;
  
  return (
    <header className="border-b border-border bg-background">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-8">
            <h1 className="font-heading text-3xl text-primary">V4 COMPANY</h1>
            
            <nav className="flex gap-6">
              <Link
                to="/"
                className={`font-body text-sm font-medium uppercase tracking-wider transition-colors hover:text-primary ${
                  isActive("/") ? "text-primary" : "text-foreground"
                }`}
              >
                Funil & Insights
              </Link>
              <Link
                to="/metas"
                className={`font-body text-sm font-medium uppercase tracking-wider transition-colors hover:text-primary ${
                  isActive("/metas") ? "text-primary" : "text-foreground"
                }`}
              >
                Metas & Acompanhamento
              </Link>
            </nav>
          </div>
          
          <div className="h-8 w-8 rounded-sm border border-primary bg-card" />
        </div>
      </div>
    </header>
  );
};

export default V4Header;
