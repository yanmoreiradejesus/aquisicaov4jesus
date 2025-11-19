import { Link, useLocation } from "react-router-dom";

const V4Header = () => {
  const location = useLocation();
  
  const isActive = (path: string) => location.pathname === path;
  
  return (
    <header className="border-b border-border/50 bg-card">
      <div className="container mx-auto px-4 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-8">
            <h1 className="font-heading text-2xl lg:text-3xl text-foreground">V4 COMPANY</h1>
            
            <nav className="flex gap-4 lg:gap-6">
              <Link
                to="/"
                className={`font-body text-xs lg:text-sm font-medium tracking-wider transition-all duration-300 hover:text-primary ${
                  isActive("/") ? "text-primary" : "text-muted-foreground"
                }`}
              >
                Funil & Insights
              </Link>
              <Link
                to="/metas"
                className={`font-body text-xs lg:text-sm font-medium tracking-wider transition-all duration-300 hover:text-primary ${
                  isActive("/metas") ? "text-primary" : "text-muted-foreground"
                }`}
              >
                Metas & Acompanhamento
              </Link>
            </nav>
          </div>
          
          <div className="h-8 w-8 rounded-lg border border-border/50 bg-gradient-to-br from-card to-muted/20" />
        </div>
      </div>
    </header>
  );
};

export default V4Header;
