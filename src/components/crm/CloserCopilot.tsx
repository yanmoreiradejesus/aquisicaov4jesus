import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Plus, ArrowUp, FileText, X, Save, Trash2, Loader2, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Attachment = {
  id: string;
  name: string;
  type: string; // mime
  size: number;
  path: string; // storage path
  signedUrl: string;
  isImage: boolean;
};

type Msg = {
  role: "user" | "assistant";
  content: string;
  attachments?: Attachment[];
  ts?: number;
};

interface CloserCopilotProps {
  oportunidadeId: string;
}

const QUICK_ACTIONS: { key: string; label: string }[] = [
  { key: "quebrar_objecao", label: "Quebrar objeção" },
  { key: "follow_up", label: "Sugerir follow-up" },
  { key: "proximo_passo", label: "Próximo passo" },
  { key: "analise_perfil", label: "Análise de perfil" },
  { key: "script_fechamento", label: "Script de fechamento" },
];

const ACCEPTED = "image/png,image/jpeg,image/jpg,image/webp,image/gif,application/pdf";

export function CloserCopilot({ oportunidadeId }: CloserCopilotProps) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  // ---------- Upload ----------
  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const userId = u?.user?.id;
      if (!userId) throw new Error("Sessão expirada");

      const uploaded: Attachment[] = [];
      for (const file of Array.from(files)) {
        if (file.size > 20 * 1024 * 1024) {
          toast.error(`${file.name}: máximo 20MB`);
          continue;
        }
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${userId}/${oportunidadeId}/${Date.now()}-${safeName}`;
        const { error: upErr } = await supabase.storage
          .from("copilot-attachments")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) {
          toast.error(`Falha ao enviar ${file.name}`);
          continue;
        }
        const { data: signed } = await supabase.storage
          .from("copilot-attachments")
          .createSignedUrl(path, 60 * 60 * 24 * 7);

        const att: Attachment = {
          id: crypto.randomUUID(),
          name: file.name,
          type: file.type,
          size: file.size,
          path,
          signedUrl: signed?.signedUrl || "",
          isImage: file.type.startsWith("image/"),
        };

        // Registra na tabela
        await supabase.from("crm_copilot_attachments").insert({
          oportunidade_id: oportunidadeId,
          user_id: userId,
          file_name: file.name,
          file_path: path,
          file_type: file.type,
          file_size: file.size,
        });

        // Atividade no histórico
        await supabase.from("crm_atividades").insert({
          oportunidade_id: oportunidadeId,
          tipo: "nota",
          titulo: "Anexo Copilot",
          descricao: `📎 ${file.name}\n${att.signedUrl}`,
          usuario_id: userId,
        });

        uploaded.push(att);
      }
      setPending((p) => [...p, ...uploaded]);
      if (uploaded.length) toast.success(`${uploaded.length} anexo(s) prontos`);
    } catch (e: any) {
      toast.error(e.message || "Erro no upload");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removePending = (id: string) => setPending((p) => p.filter((a) => a.id !== id));

  // ---------- Send ----------
  const send = async (opts: { text?: string; quickAction?: string }) => {
    if (loading) return;
    const text = opts.text?.trim();
    const atts = pending;
    if (!text && !opts.quickAction && atts.length === 0) return;

    const userMsg: Msg = {
      role: "user",
      content: text || (opts.quickAction ? QUICK_ACTIONS.find((q) => q.key === opts.quickAction)?.label || "" : ""),
      attachments: atts.length ? atts : undefined,
      ts: Date.now(),
    };
    const newMessages: Msg[] = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setPending([]);
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
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/closer-copilot`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          oportunidade_id: oportunidadeId,
          messages: newMessages.map((m) => ({
            role: m.role,
            content: m.content,
            attachments: m.attachments?.map((a) => ({
              name: a.name,
              type: a.type,
              path: a.path,
              url: a.signedUrl,
            })),
          })),
          quick_action: opts.quickAction,
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

  // ---------- Save conversation to notes ----------
  const saveToNotes = async () => {
    if (!messages.length) {
      toast.error("Sem conversa para salvar");
      return;
    }
    setSavingNotes(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const userId = u?.user?.id;

      const dateStr = new Date().toLocaleString("pt-BR");
      const body = messages
        .map((m) => {
          const who = m.role === "user" ? "👤 Closer" : "🧠 Copilot";
          const atts = m.attachments?.length
            ? `\n\n_Anexos: ${m.attachments.map((a) => a.name).join(", ")}_`
            : "";
          return `**${who}:**\n${m.content}${atts}`;
        })
        .join("\n\n");

      const block = `\n\n--- Conversa Copilot [${dateStr}] ---\n${body}\n--- fim ---\n`;

      const { data: opp } = await supabase
        .from("crm_oportunidades")
        .select("notas")
        .eq("id", oportunidadeId)
        .maybeSingle();

      const novasNotas = (opp?.notas || "") + block;

      await supabase.from("crm_oportunidades").update({ notas: novasNotas }).eq("id", oportunidadeId);

      await supabase.from("crm_atividades").insert({
        oportunidade_id: oportunidadeId,
        tipo: "nota",
        titulo: "Conversa Copilot salva",
        descricao: body.slice(0, 4000),
        usuario_id: userId,
      });

      toast.success("Conversa salva nas notas");
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSavingNotes(false);
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
            <p className="text-[13px] font-semibold leading-tight text-white">Copilot Closer</p>
            <p className="text-[10px] text-white/50 leading-tight">
              consultor de vendas · online
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[10px] text-white/70 hover:text-white hover:bg-white/10"
                onClick={saveToNotes}
                disabled={savingNotes}
              >
                {savingNotes ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
                Salvar nas notas
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[10px] text-white/70 hover:text-white hover:bg-white/10"
                onClick={() => setMessages([])}
                disabled={loading}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {messages.length === 0 && (
          <div className="text-center py-16 space-y-3">
            <p className="text-[15px] font-medium text-white/90">Como posso ajudar?</p>
            <p className="text-[12px] text-white/40 max-w-xs mx-auto">
              Faça uma pergunta, anexe prints ou PDFs, ou escolha uma sugestão abaixo.
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
                  {/* Attachments */}
                  {m.attachments?.map((a) => (
                    <div
                      key={a.id}
                      className={`rounded-2xl overflow-hidden ${
                        isUser ? "self-end" : "self-start"
                      }`}
                    >
                      {a.isImage ? (
                        <a href={a.signedUrl} target="_blank" rel="noreferrer">
                          <img
                            src={a.signedUrl}
                            alt={a.name}
                            className="max-w-[240px] max-h-[240px] object-cover rounded-2xl"
                          />
                        </a>
                      ) : (
                        <a
                          href={a.signedUrl}
                          target="_blank"
                          rel="noreferrer"
                          className={`flex items-center gap-2 px-3 py-2.5 rounded-2xl ${
                            isUser
                              ? "bg-[#007AFF] text-white"
                              : "bg-[#1C1C1E] text-white/95"
                          }`}
                        >
                          <FileText className="h-4 w-4 shrink-0" />
                          <span className="text-[12px] truncate max-w-[180px]">{a.name}</span>
                        </a>
                      )}
                    </div>
                  ))}

                  {/* Text bubble */}
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

        {/* Typing indicator */}
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

      {/* Quick actions (only when empty) */}
      {messages.length === 0 && (
        <div className="px-4 pb-2 flex flex-wrap gap-1.5 justify-center">
          {QUICK_ACTIONS.map((qa) => (
            <button
              key={qa.key}
              onClick={() => !loading && send({ quickAction: qa.key })}
              disabled={loading}
              className="text-[11px] px-3 py-1.5 rounded-full bg-[#1C1C1E] text-white/85 hover:bg-[#2C2C2E] transition-colors disabled:opacity-50"
            >
              {qa.label}
            </button>
          ))}
        </div>
      )}

      {/* Pending attachments preview */}
      {pending.length > 0 && (
        <div className="px-3 pt-2 flex flex-wrap gap-2 border-t border-white/5">
          {pending.map((a) => (
            <div
              key={a.id}
              className="relative group flex items-center gap-1.5 bg-[#1C1C1E] text-white/90 rounded-xl pl-2 pr-7 py-1.5 max-w-[200px]"
            >
              {a.isImage ? <ImageIcon className="h-3.5 w-3.5 shrink-0" /> : <FileText className="h-3.5 w-3.5 shrink-0" />}
              <span className="text-[11px] truncate">{a.name}</span>
              <button
                onClick={() => removePending(a.id)}
                className="absolute right-1 top-1/2 -translate-y-1/2 h-4 w-4 rounded-full bg-white/15 hover:bg-white/30 flex items-center justify-center"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input bar iMessage-style */}
      <div className="p-2.5 border-t border-border/40 bg-background/60 backdrop-blur-md">
        <div className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED}
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || loading}
            className="h-8 w-8 rounded-full bg-muted hover:bg-muted/70 flex items-center justify-center shrink-0 transition-colors disabled:opacity-50"
            title="Anexar imagem ou PDF"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </button>

          <div className="flex-1 flex items-end bg-muted rounded-[20px] border border-border/50 min-h-[34px] px-3 py-1.5">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send({ text: input });
                }
              }}
              placeholder="iMessage"
              rows={1}
              className="flex-1 bg-transparent outline-none resize-none text-[14px] leading-snug max-h-[120px] py-0.5"
              disabled={loading}
              style={{
                fontFamily: 'inherit',
                height: 'auto',
              }}
              onInput={(e) => {
                const t = e.currentTarget;
                t.style.height = 'auto';
                t.style.height = Math.min(t.scrollHeight, 120) + 'px';
              }}
            />
          </div>

          {(input.trim() || pending.length > 0) && (
            <button
              onClick={() => send({ text: input })}
              disabled={loading}
              className="h-8 w-8 rounded-full bg-[#007AFF] hover:bg-[#0066DD] flex items-center justify-center shrink-0 transition-colors disabled:opacity-50"
            >
              <ArrowUp className="h-4 w-4 text-white" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
