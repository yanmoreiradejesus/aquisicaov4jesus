import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { ArrowUp, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Msg = {
  role: "user" | "assistant";
  content: string;
  ts?: number;
};

interface OnboardingCopilotProps {
  accountId: string;
}

const SUGGESTIONS = [
  "Qual a melhor abordagem pra primeira GC?",
  "Quais red flags você vê nesse cliente?",
  "Onde tem maior risco de churn aqui?",
  "Sugira 3 oportunidades de upsell.",
];

export function OnboardingCopilot({ accountId }: OnboardingCopilotProps) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setMessages([]);
    setInput("");
  }, [accountId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const send = async (text: string) => {
    if (loading) return;
    const t = text.trim();
    if (!t) return;

    const userMsg: Msg = { role: "user", content: t, ts: Date.now() };
    const newMessages = [...messages, userMsg];
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
        return [...prev, { role: "assistant", content: assistantSoFar, ts: Date.now() }];
      });
    };

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Sessão expirada");

      abortRef.current = new AbortController();
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/onboarding-copilot`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          account_id: accountId,
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
        signal: abortRef.current.signal,
      });

      if (!resp.ok || !resp.body) {
        const errBody = await resp.json().catch(() => ({ error: "Erro desconhecido" }));
        if (resp.status === 429) toast.error("Muitas requisições. Aguarde alguns segundos.");
        else if (resp.status === 402) toast.error("Créditos de IA esgotados.");
        else toast.error(errBody.error || "Falha ao chamar o Copilot");
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
          if (payload === "[DONE]") { done = true; break; }
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

  const formatTime = (ts?: number) =>
    ts ? new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "";

  return (
    <div
      className="flex flex-col h-[640px] rounded-2xl overflow-hidden border border-white/5"
      style={{
        background: "#000000",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5 bg-black/80 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#007AFF] to-[#5856D6] flex items-center justify-center text-white text-[13px] font-semibold">
            🧠
          </div>
          <div>
            <p className="text-[13px] font-semibold leading-tight text-white">Copilot Onboarding</p>
            <p className="text-[10px] text-white/50 leading-tight">
              consultor do contrato · online
            </p>
          </div>
        </div>
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[10px] text-white/70 hover:text-white hover:bg-white/10"
            onClick={() => setMessages([])}
            disabled={loading}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {messages.length === 0 && (
          <div className="text-center py-16 space-y-3">
            <p className="text-[15px] font-medium text-white/90">Como posso ajudar?</p>
            <p className="text-[12px] text-white/40 max-w-xs mx-auto">
              Tenho acesso a tudo desse contrato — pergunte ou escolha uma sugestão abaixo.
            </p>
          </div>
        )}

        {messages.map((m, i) => {
          const isUser = m.role === "user";
          const prev = messages[i - 1];
          const showTime = !prev || (m.ts && prev.ts && m.ts - (prev.ts || 0) > 5 * 60 * 1000);
          return (
            <div key={i}>
              {showTime && m.ts && (
                <div className="text-center text-[10px] text-white/35 my-2">
                  {formatTime(m.ts)}
                </div>
              )}
              <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                <div className="flex flex-col gap-1 max-w-[78%]">
                  {m.content && (
                    <div
                      className={`px-3.5 py-2 text-[14px] leading-snug ${
                        isUser
                          ? "bg-[#007AFF] text-white rounded-[18px] rounded-br-[6px] self-end"
                          : "bg-[#1C1C1E] text-white/95 rounded-[18px] rounded-bl-[6px] self-start"
                      }`}
                      style={{ wordBreak: "break-word" }}
                    >
                      {m.role === "assistant" ? (
                        <div className="prose prose-sm prose-invert max-w-none [&>*]:my-1 [&_ul]:my-1 [&_li]:my-0 [&_p]:text-[14px] [&_p]:text-white/95 [&_strong]:font-semibold [&_strong]:text-white [&_a]:text-[#0A84FF] [&_code]:text-white [&_code]:bg-white/10 [&_code]:px-1 [&_code]:rounded">
                          <ReactMarkdown>{m.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap">{m.content}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {loading && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex justify-start">
            <div className="bg-[#1C1C1E] rounded-[18px] rounded-bl-[6px] px-4 py-3 flex gap-1">
              <span className="h-2 w-2 rounded-full bg-white/50 animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="h-2 w-2 rounded-full bg-white/50 animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="h-2 w-2 rounded-full bg-white/50 animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}
      </div>

      {/* Suggestions (only when empty) */}
      {messages.length === 0 && (
        <div className="px-4 pb-2 flex flex-wrap gap-1.5 justify-center">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => !loading && send(s)}
              disabled={loading}
              className="text-[11px] px-3 py-1.5 rounded-full bg-[#1C1C1E] text-white/85 hover:bg-[#2C2C2E] transition-colors disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input bar */}
      <div className="p-2.5 border-t border-white/5 bg-black/80 backdrop-blur-md">
        <div className="flex items-end gap-2">
          <div className="flex-1 flex items-end bg-[#1C1C1E] rounded-[20px] border border-white/10 min-h-[34px] px-3 py-1.5">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder=""
              rows={1}
              className="flex-1 bg-transparent outline-none resize-none text-[14px] leading-snug max-h-[120px] py-0.5 text-white placeholder:text-white/30"
              disabled={loading}
              style={{ fontFamily: 'inherit', height: 'auto' }}
              onInput={(e) => {
                const t = e.currentTarget;
                t.style.height = 'auto';
                t.style.height = Math.min(t.scrollHeight, 120) + 'px';
              }}
            />
          </div>

          {input.trim() && (
            <button
              onClick={() => send(input)}
              disabled={loading}
              className="h-8 w-8 rounded-full bg-[#007AFF] hover:bg-[#0066DD] flex items-center justify-center shrink-0 transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : <ArrowUp className="h-4 w-4 text-white" />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
