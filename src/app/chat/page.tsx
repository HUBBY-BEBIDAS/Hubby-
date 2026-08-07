"use client";

import { useState, useEffect, useRef, useMemo, FormEvent, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useApiToken, apiFetch } from "@/hooks/useApiToken";
import { Navbar } from "@/components/Navbar";
import { validateChatMessage } from "@/lib/chat-guard";
import { Send, Search, MessageSquare, ArrowLeft, Check, CheckCheck, ShieldAlert } from "lucide-react";

type ChatRoom = {
  id: string;
  other_party_id: string;
  other_party_name: string;
  other_party_logo_key: string | null;
  last_message: string | null;
  last_message_time: string | null;
  unread_count?: number;
  updated_at: string;
};

type ChatMessage = {
  id: string;
  room_id: string;
  sender_id: string;
  text: string;
  is_read?: boolean;
  read_at?: string | null;
  created_at: string;
};

function ChatContent() {
  const { data: session } = useSession({ required: true });
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useApiToken();

  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [messageText, setMessageText] = useState("");
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const urlRoomId = searchParams.get("roomId");

  // Rola para o fim da lista de mensagens
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Carrega a lista de conversas (rooms)
  const fetchRooms = async (showLoading = false) => {
    if (!token) return;
    if (showLoading) setLoadingRooms(true);
    try {
      const res = await apiFetch("/api/chat/rooms", { method: "GET", token });
      if (res.ok) {
        const data = await res.json();
        setRooms(data.rooms || []);
      }
    } catch (err) {
      console.error("Erro ao carregar conversas:", err);
    } finally {
      if (showLoading) setLoadingRooms(false);
    }
  };

  // Carrega as mensagens de uma sala selecionada
  const fetchMessages = async (roomId: string, showLoading = false) => {
    if (!token) return;
    if (showLoading) setLoadingMessages(true);
    try {
      const res = await apiFetch(`/api/chat/rooms/${roomId}/messages`, { method: "GET", token });
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch (err) {
      console.error("Erro ao carregar histórico:", err);
    } finally {
      if (showLoading) setLoadingMessages(false);
    }
  };

  // Estado de aviso de erro
  const [chatError, setChatError] = useState<string | null>(null);

  // Análise preventiva de contatos na mensagem atual
  const guardResult = useMemo(() => {
    return validateChatMessage(messageText);
  }, [messageText]);

  // Envia uma nova mensagem
  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!token || !selectedRoomId || !messageText.trim() || sending) return;

    if (!guardResult.isClean) {
      setChatError(guardResult.reason || "Conteúdo bloqueado por segurança.");
      return;
    }

    const textToSend = messageText.trim();
    setMessageText("");
    setChatError(null);
    setSending(true);

    try {
      const res = await apiFetch(`/api/chat/rooms/${selectedRoomId}/messages`, {
        method: "POST",
        token,
        body: JSON.stringify({ text: textToSend }),
      });

      if (res.ok) {
        const data = await res.json();
        // Adiciona localmente para feedback instantâneo
        setMessages((prev) => [...prev, data.message]);
        // Atualiza a lista de conversas para mover a conversa atual para o topo
        fetchRooms();
        setTimeout(scrollToBottom, 50);
      } else {
        const errData = await res.json().catch(() => ({}));
        setMessageText(textToSend);
        setChatError(errData.error || "Não foi possível enviar a mensagem.");
      }
    } catch (err) {
      console.error("Erro ao enviar mensagem:", err);
      setMessageText(textToSend);
      setChatError("Erro de conexão ao enviar mensagem.");
    } finally {
      setSending(false);
    }
  };

  // Efeito 1: Carrega as salas inicialmente
  useEffect(() => {
    if (token) {
      fetchRooms(true);
    }
  }, [token]);

  // Efeito 2: Escuta alteração da query string `roomId` na URL
  useEffect(() => {
    if (urlRoomId) {
      setSelectedRoomId(urlRoomId);
      fetchMessages(urlRoomId, true);
    } else {
      setSelectedRoomId(null);
      setMessages([]);
    }
  }, [urlRoomId]);

  // Efeito 3: Polling periódico das mensagens da sala ativa (a cada 4s) e da lista de salas (a cada 10s)
  useEffect(() => {
    if (!token) return;

    const messagesInterval = setInterval(() => {
      if (selectedRoomId) {
        fetchMessages(selectedRoomId, false);
      }
    }, 4000);

    const roomsInterval = setInterval(() => {
      fetchRooms(false);
    }, 10000);

    return () => {
      clearInterval(messagesInterval);
      clearInterval(roomsInterval);
    };
  }, [token, selectedRoomId]);

  // Efeito 4: Rola a tela para o final sempre que novas mensagens são carregadas
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Filtra as salas baseando-se na pesquisa do usuário
  const filteredRooms = useMemo(() => {
    return rooms.filter((r) =>
      r.other_party_name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [rooms, searchQuery]);

  // Busca os dados da sala ativa para exibir no cabeçalho
  const activeRoom = useMemo(() => {
    return rooms.find((r) => r.id === selectedRoomId);
  }, [rooms, selectedRoomId]);

  // Formata hora de forma amigável
  const formatTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  return (
    <div className="flex h-screen flex-col bg-[#F5F7FB]">
      <Navbar />

      <main className="mx-auto flex w-full max-w-6xl flex-1 overflow-hidden px-4 py-6">
        <div className="flex w-full overflow-hidden rounded-3xl border border-[#DBEAFE] bg-white shadow-xl">
          
          {/* Coluna Esquerda: Lista de Salas (Ocultada em telas pequenas se uma sala estiver selecionada) */}
          <div
            className={`flex flex-col border-r border-[#DBEAFE] bg-white transition-all ${
              selectedRoomId ? "hidden md:flex w-full md:w-80" : "w-full md:w-80"
            }`}
          >
            {/* Cabeçalho Busca */}
            <div className="border-b border-[#DBEAFE] px-4 py-4">
              <h1 className="text-lg font-bold text-[#0F172A] mb-3">Mensagens</h1>
              <div className="relative">
                <span className="absolute inset-y-0 left-3 flex items-center text-slate-400">
                  <Search size={16} />
                </span>
                <input
                  type="text"
                  placeholder="Buscar conversas..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-2xl border border-[#DBEAFE] bg-[#F5F7FB] py-2 pl-9 pr-4 text-sm text-[#0F172A] placeholder:text-slate-400 outline-none focus:border-[#22C55E] focus:bg-white transition-colors"
                />
              </div>
            </div>

            {/* Lista */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 py-2">
              {loadingRooms ? (
                <div className="flex justify-center py-8">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#22C55E] border-t-transparent" />
                </div>
              ) : filteredRooms.length === 0 ? (
                <div className="px-4 py-8 text-center text-xs text-slate-400">
                  Nenhuma conversa encontrada.
                </div>
              ) : (
                filteredRooms.map((room) => {
                  const isActive = room.id === selectedRoomId;
                  return (
                    <button
                      key={room.id}
                      onClick={() => router.push(`/chat?roomId=${room.id}`)}
                      className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors ${
                        isActive ? "bg-green-50/50 border-l-4 border-l-[#22C55E]" : "hover:bg-[#F5F7FB]"
                      }`}
                    >
                      {/* Avatar */}
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#DBEAFE]/60 text-sm font-bold text-[#2563EB]">
                        {room.other_party_name.slice(0, 2).toUpperCase()}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <p className="truncate text-sm font-bold text-[#0F172A]">
                            {room.other_party_name}
                          </p>
                          {room.last_message_time && (
                            <span className="text-[10px] text-slate-400 font-medium shrink-0">
                              {formatTime(room.last_message_time)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-1 mt-0.5">
                          <p className="truncate text-xs text-slate-500 font-medium">
                            {room.last_message || "Iniciar nova conversa"}
                          </p>
                          {Boolean(room.unread_count && room.unread_count > 0) && (
                            <span className="flex h-4 min-w-[16px] shrink-0 items-center justify-center rounded-full bg-[#22C55E] px-1 text-[10px] font-extrabold text-white">
                              {room.unread_count}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Coluna Direita: Conteúdo do Chat */}
          <div
            className={`flex flex-1 flex-col bg-[#F5F7FB]/50 transition-all ${
              !selectedRoomId ? "hidden md:flex" : "flex"
            }`}
          >
            {activeRoom ? (
              <>
                {/* Cabeçalho da conversa */}
                <div className="flex items-center gap-3 border-b border-[#DBEAFE] bg-white px-4 py-3.5 shadow-sm">
                  {/* Botão voltar para mobile */}
                  <button
                    onClick={() => router.push("/chat")}
                    className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-[#F5F7FB] text-slate-500 md:hidden"
                  >
                    <ArrowLeft size={18} />
                  </button>

                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#DBEAFE]/60 text-xs font-bold text-[#2563EB]">
                    {activeRoom.other_party_name.slice(0, 2).toUpperCase()}
                  </div>

                  <div>
                    <h2 className="text-sm font-bold text-[#0F172A]">
                      {activeRoom.other_party_name}
                    </h2>
                    <span className="text-[10px] font-semibold text-[#22C55E]">Online</span>
                  </div>
                </div>

                {/* Histórico rolável de mensagens */}
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-[#F8FAFC]">
                  {loadingMessages ? (
                    <div className="flex items-center justify-center py-20">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#22C55E] border-t-transparent" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center text-slate-400">
                      <MessageSquare size={32} className="text-slate-300 mb-2" />
                      <p className="text-sm font-medium">Envie a primeira mensagem para iniciar!</p>
                      <p className="text-xs">Combine prazo, preços e negociações de faturamento.</p>
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const isMe = msg.sender_id === session?.user?.id;
                      return (
                        <div
                          key={msg.id}
                          className={`flex w-full ${isMe ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[75%] rounded-3xl px-4 py-2.5 text-sm shadow-sm ${
                              isMe
                                ? "bg-[#22C55E] text-white rounded-tr-none"
                                : "bg-white text-[#0F172A] rounded-tl-none border border-slate-100"
                            }`}
                          >
                            <p className="break-words whitespace-pre-wrap leading-relaxed">
                              {msg.text}
                            </p>
                            <div className="mt-1 flex items-center justify-end gap-1">
                              <span
                                className={`text-[9px] ${
                                  isMe ? "text-white/80" : "text-slate-400"
                                }`}
                              >
                                {formatTime(msg.created_at)}
                              </span>
                              {isMe && (
                                <span title={msg.is_read ? "Lida" : "Enviada"}>
                                  {msg.is_read ? (
                                    <CheckCheck size={14} className="text-sky-200 inline-block" />
                                  ) : (
                                    <Check size={13} className="text-white/70 inline-block" />
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Banner de alerta de segurança / chat guard */}
                {(!guardResult.isClean || chatError) && (
                  <div className="flex items-center gap-2 border-t border-amber-200 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-800">
                    <ShieldAlert size={16} className="shrink-0 text-amber-600" />
                    <span className="flex-1">
                      {chatError || guardResult.reason || "Por segurança, o envio de telefones, e-mails e termos de contato externo é bloqueado."}
                    </span>
                    {chatError && (
                      <button
                        type="button"
                        onClick={() => setChatError(null)}
                        className="text-amber-600 hover:text-amber-900 underline ml-2"
                      >
                        Fechar
                      </button>
                    )}
                  </div>
                )}

                {/* Input de envio */}
                <form
                  onSubmit={handleSendMessage}
                  className="flex items-center gap-2 border-t border-[#DBEAFE] bg-white px-4 py-3"
                >
                  <input
                    type="text"
                    placeholder="Digite sua mensagem..."
                    value={messageText}
                    onChange={(e) => {
                      setMessageText(e.target.value);
                      if (chatError) setChatError(null);
                    }}
                    className={`flex-1 rounded-2xl border px-4 py-3 text-sm text-[#0F172A] placeholder:text-slate-400 outline-none transition-colors ${
                      !guardResult.isClean
                        ? "border-rose-300 bg-rose-50/50 focus:border-rose-500"
                        : "border-[#DBEAFE] bg-[#F5F7FB] focus:border-[#22C55E] focus:bg-white"
                    }`}
                  />
                  <button
                    type="submit"
                    disabled={!messageText.trim() || sending || !guardResult.isClean}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#22C55E] text-white hover:bg-[#16A34A] active:scale-95 disabled:opacity-50 transition"
                  >
                    <Send size={16} />
                  </button>
                </form>
              </>
            ) : (
              // Estado inicial sem sala selecionada
              <div className="flex flex-1 flex-col items-center justify-center p-8 text-center bg-[#F8FAFC]">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-[#DBEAFE]/40 text-slate-300">
                  <MessageSquare size={32} />
                </div>
                <h3 className="text-base font-bold text-[#0F172A]">Sua Central de Mensagens</h3>
                <p className="mt-1 max-w-sm text-xs text-slate-500">
                  Selecione uma conversa ao lado para negociar preços, tirar dúvidas de frete ou acompanhar o faturamento diretamente com a distribuidora.
                </p>
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen flex-col items-center justify-center bg-[#F5F7FB]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#22C55E] border-t-transparent" />
      </div>
    }>
      <ChatContent />
    </Suspense>
  );
}
