import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send, Sparkles, Trash2, Flame } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string };

interface Props {
  accountId: string;
}

const SUGGESTIONS = [
  "Qual a melhor abordagem pra essa primeira GC?",
  "Quais red flags você vê no contexto desse cliente?",
  "O que tem maior risco de churn aqui?",
  "Sugira 3 oportunidades de upsell baseadas no que já sabemos.",
];

export const OnboardingCopilot = ({ accountId }: Props) => {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // reset ao trocar de conta
  useEffect(() => {
    setMessages([]);
    setInput("");
  }, [accountId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Msg = { role: "user", content: text.trim() };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: sessionRes } = await supabase.auth.getSession();
      const token = sessionRes.session?.access_token;
      if (!token) throw new Error("Sessão expirada");

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/onboarding-copilot`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ account_id: accountId, messages: next }),
        signal: controller.signal,
      });

      if (!resp.ok || !resp.body) {
        if (resp.status === 429) throw new Error("Muitas requisições. Aguarde alguns segundos.");
        if (resp.status === 402) throw new Error("Créditos de IA esgotados.");
        throw new Error(`Falha (${resp.status})`);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let acc = "";
      let started = false;

      const flush = () => {
        setMessages((prev) => {
          if (!started) {
            started = true;
            return [...prev, { role: "assistant", content: acc }];
          }
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: acc } : m));
        });
      };

      let done = false;
      while (!done) {
        const { value, done: rDone } = await reader.read();
        if (rDone) break;
        buf += decoder.decode(value, { stream: true });

        let nl;
        while ((nl = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const j = line.slice(6).trim();
          if (j === "[DONE]") {
            done = true;
            break;
          }
          try {
            const parsed = JSON.parse(j);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              acc += delta;
              flush();
            }
          } catch {
            buf = line + "\n" + buf;
            break;
          }
        }
      }
    } catch (e: any) {
      if (e.name !== "AbortError") {
        toast({ title: "Erro no copilot", description: e.message, variant: "destructive" });
        setMessages((prev) => prev.slice(0, -1));
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    send(input);
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-220px)] min-h-[500px]">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Flame className="h-4 w-4 text-orange-400" />
          <span className="text-[11px] font-semibold tracking-[0.15em] uppercase text-muted-foreground">
            Copilot brutalmente honesto
          </span>
        </div>
        {messages.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setMessages([])} className="h-7 text-xs">
            <Trash2 className="h-3 w-3 mr-1" /> Limpar
          </Button>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 pr-1">
        {messages.length === 0 && (
          <div className="text-center py-8 space-y-4">
            <Sparkles className="h-8 w-8 mx-auto text-primary/60" />
            <div>
              <p className="text-sm font-medium text-foreground/90">Pergunte qualquer coisa sobre esse contrato</p>
              <p className="text-xs text-muted-foreground mt-1">
                Tenho acesso ao lead, oportunidade, ligações, transcrições, GC, cobranças. Vou te dar a verdade nua.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-xl mx-auto">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-left text-xs text-foreground/80 rounded-lg border border-border/40 bg-surface-1/40 hover:bg-surface-2/60 hover:border-primary/30 transition px-3 py-2"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={cn(
              "rounded-xl px-3 py-2 text-[13px]",
              m.role === "user"
                ? "bg-primary/10 border border-primary/30 ml-8"
                : "bg-surface-1/60 border border-border/40 mr-8",
            )}
          >
            {m.role === "assistant" ? (
              <div className="prose prose-invert prose-sm max-w-none prose-p:my-1.5 prose-ul:my-1.5 prose-li:my-0.5 prose-headings:font-display prose-headings:tracking-[-0.01em] prose-strong:text-foreground prose-a:text-primary">
                <ReactMarkdown>{m.content || "…"}</ReactMarkdown>
              </div>
            ) : (
              <p className="whitespace-pre-wrap text-foreground/90">{m.content}</p>
            )}
          </div>
        ))}

        {loading && messages[messages.length - 1]?.role === "user" && (
          <div className="rounded-xl px-3 py-2 bg-surface-1/60 border border-border/40 mr-8 inline-flex items-center gap-2 text-[12px] text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> pensando…
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="mt-3 flex items-end gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Pergunte algo... (Enter envia, Shift+Enter quebra linha)"
          className="min-h-[44px] max-h-32 resize-none text-[13px]"
          disabled={loading}
        />
        <Button type="submit" disabled={loading || !input.trim()} size="icon" className="h-11 w-11 shrink-0">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  );
};
