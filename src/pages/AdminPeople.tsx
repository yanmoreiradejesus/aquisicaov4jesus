import { Users } from "lucide-react";

const AdminPeople = () => {
  return (
    <div className="min-h-screen bg-background">
      <main className="w-full px-4 lg:px-8 py-6 lg:py-10 animate-fade-in">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">People</h1>
            <p className="text-sm text-muted-foreground">
              Gestão de pessoas — time, cargos e alocação. Em breve.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card/40 p-10 text-center text-muted-foreground">
          Área em construção.
        </div>
      </main>
    </div>
  );
};

export default AdminPeople;
