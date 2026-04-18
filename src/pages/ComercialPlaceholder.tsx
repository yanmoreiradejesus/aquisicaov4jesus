import V4Header from "@/components/V4Header";
import { Card } from "@/components/ui/card";
import { Construction } from "lucide-react";

interface Props {
  titulo: string;
  descricao: string;
}

const ComercialPlaceholder = ({ titulo, descricao }: Props) => (
  <div className="min-h-screen bg-background">
    <V4Header />
    <main className="container mx-auto max-w-3xl px-4 lg:px-8 py-12 lg:py-20">
      <p className="text-xs font-medium text-muted-foreground tracking-widest uppercase mb-2">
        Comercial
      </p>
      <h1 className="font-heading text-3xl lg:text-4xl font-bold text-foreground tracking-wider uppercase mb-6">
        {titulo}
      </h1>
      <Card className="p-8 lg:p-12 text-center space-y-4">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <Construction className="h-7 w-7 text-primary" />
        </div>
        <h2 className="font-heading text-xl text-foreground">Em construção</h2>
        <p className="text-muted-foreground max-w-md mx-auto">{descricao}</p>
      </Card>
    </main>
  </div>
);

export default ComercialPlaceholder;
