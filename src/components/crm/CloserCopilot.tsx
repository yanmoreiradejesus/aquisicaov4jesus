import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Brain, Send, Sparkles, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Msg = { role: "user" | "assistant"; content: string };

interface CloserCopilotProps {
  oportunidadeId: string;
}

const QUICK_ACTIONS: { key: string; label: string }[] = [
  { key: "quebrar_objecao", label: "🛡️ Quebrar objeção" },
  { key: "follow_up", label: "📨 Sugerir follow-up" },
  { key: "proximo_passo", label: "➡️ Próximo passo" },
  { key: "analise_perfil", label: "🧠 Análise de perfil" },
  { key: "script_fechamento", label: "🤝 Script de fechamento" },
];

export function CloserCopilot({ oportunidadeId }: CloserCopilotProps) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const send = async (opts: { text?: string; quickAction?: string }) => {
    if (loading) return;
    const text = opts.text?.trim();
    if (!text && !opts.quickAction) return;

    const newMessages: Msg[] = text ? [...messages, { role: "user", content: text }] : [...messages];
    if (opts.quickAction) {
      const qa = QUICK_ACTIONS.find((q) => q.key === opts.quickAction);
      newMessages.push({ role: "user", content: qa ? qa.label : opts.quickAction });
    }
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    let assistantSoFar = "";
    const upsert = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Sessão expirada");

      abortRef.current = new AbortController();
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/closer-copilot`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          oportunidade_id: oportunidadeId,
          messages: text ? newMessages.slice(0, -1) : newMessages,
          quick_action: opts.quickAction,
        }),
        signal: abortRef.current.signal,
      });

      if (!resp.ok || !resp.body) {
        const errBody = await resp.json().catch(() => ({ error: "Erro desconhecido" }));
        if (resp.status === 429) toast.error("Muitas requisições. Aguarde alguns segundos.");
        else if (resp.status === 402) toast.error("Créditos de IA esgotados.");
        else toast.error(errBody.error || "Falha ao chamar o Copilot");
        setMessages((prev) => prev.filter((m, i) => !(i === prev.length - 1 && m.role === "assistant" && !m.content)));
        setLoading(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let done = false;
      while (!done) {
        const { done: d, value } = await reader.read();
        if (d) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line || line.startsWith(":")) continue;
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") {
            done = true;
            break;
          }
          try {
            const parsed = JSON.parse(payload);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) upsert(content);
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }
    } catch (e: any) {
      if (e.name !== "AbortError") {
        console.error(e);
        toast.error(e.message || "Erro no Copilot");
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  return (
    <div className="flex flex-col h-[600px] border border-border/40 rounded-xl bg-background/30 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 bg-surface-2/40">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-primary" />
          <div>
            <p className="text-[12px] font-semibold">Copilot Closer</p>
            <p className="text-[10px] text-muted-foreground">IA avançada · consultor de vendas</p>
          </div>
        </div>
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[10px]"
            onClick={() => setMessages([])}
            disabled={loading}
          >
            <Trash2 className="h-3 w-3 mr-1" /> Limpar
          </Button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-8 space-y-3">
            <Sparkles className="h-8 w-8 text-primary/60 mx-auto" />
            <p className="text-[12px] text-muted-foreground max-w-xs mx-auto">
              Pergunte qualquer coisa sobre essa oportunidade ou use uma ação rápida abaixo.
            </p>
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-xl px-3 py-2 text-[12px] ${
                m.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-surface-2/70 text-foreground"
              }`}
            >
              {m.role === "assistant" ? (
                <div className="prose prose-sm prose-invert max-w-none [&>*]:my-1 [&_ul]:my-1 [&_li]:my-0">
                  <ReactMarkdown>{m.content || "..."}</ReactMarkdown>
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{m.content}</p>
              )}
            </div>
          </div>
        ))}
        {loading && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Opus está pensando...
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="px-3 py-2 border-t border-border/40 flex flex-wrap gap-1.5 bg-surface-2/30">
        {QUICK_ACTIONS.map((qa) => (
          <Badge
            key={qa.key}
            variant="outline"
            className="cursor-pointer hover:bg-primary/10 text-[10px] py-1 px-2"
            onClick={() => !loading && send({ quickAction: qa.key })}
          >
            {qa.label}
          </Badge>
        ))}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border/40 flex gap-2 items-end">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send({ text: input });
            }
          }}
          placeholder="Pergunte ao Copilot... (Enter envia, Shift+Enter quebra linha)"
          className="min-h-[40px] max-h-[120px] text-[12px] resize-none"
          disabled={loading}
        />
        <Button
          size="icon"
          onClick={() => send({ text: input })}
          disabled={loading || !input.trim()}
          className="h-10 w-10 shrink-0"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
