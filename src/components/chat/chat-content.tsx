"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { Spinner, SkeletonRow } from "@/components/ui/spinner";
import {
  listConversations,
  listStaffDirectory,
  listMyChatOfferings,
  getOrStartDm,
  getOrCreateOfferingChannel,
  listMessages,
  sendMessage,
  type ConversationSummary,
  type StaffDirectoryEntry,
  type ChatMessage,
} from "@/lib/actions/chat";
import type { Role } from "@/lib/roles";

const POLL_MS = 4000;

function timeAgo(iso: string | null) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export function ChatContent({ role }: { role: Role }) {
  const [conversations, setConversations] = useState<ConversationSummary[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [directory, setDirectory] = useState<StaffDirectoryEntry[] | null>(null);
  const [offerings, setOfferings] = useState<{ id: string; label: string }[] | null>(null);
  const [directorySearch, setDirectorySearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const canHaveChannels = role === "head" || role === "assistant";

  async function reloadConversations() {
    const data = await listConversations();
    setConversations(data);
  }

  useEffect(() => {
    listConversations().then(setConversations);
    const t = setInterval(reloadConversations, POLL_MS * 2);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    async function load() {
      const data = await listMessages(activeId as string);
      if (!cancelled) setMessages(data);
    }
    load();
    const t = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [activeId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  const active = conversations?.find((c) => c.id === activeId) ?? null;

  async function openNewMessage() {
    setNewOpen(true);
    if (!directory) setDirectory(await listStaffDirectory());
    if (canHaveChannels && !offerings) setOfferings(await listMyChatOfferings());
  }

  async function startDm(otherId: string) {
    try {
      const id = await getOrStartDm(otherId);
      setNewOpen(false);
      await reloadConversations();
      setActiveId(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start conversation.");
    }
  }

  async function openChannel(offeringId: string) {
    try {
      const id = await getOrCreateOfferingChannel(offeringId);
      setNewOpen(false);
      await reloadConversations();
      setActiveId(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't open channel.");
    }
  }

  async function onSend() {
    if (!activeId || !draft.trim()) return;
    setSending(true);
    const body = draft;
    setDraft("");
    try {
      await sendMessage(activeId, body);
      const data = await listMessages(activeId);
      setMessages(data);
      await reloadConversations();
    } catch {
      setError("Couldn't send message — try again.");
      setDraft(body);
    } finally {
      setSending(false);
    }
  }

  const filteredDirectory = useMemo(() => {
    if (!directory) return [];
    const q = directorySearch.trim().toLowerCase();
    if (!q) return directory;
    return directory.filter((d) => d.name.toLowerCase().includes(q) || d.role.toLowerCase().includes(q));
  }, [directory, directorySearch]);

  return (
    <div className="flex h-[calc(100vh-140px)] min-h-[480px] gap-4">
      {error && (
        <div className="absolute z-10 flex items-center justify-between gap-3 rounded-[var(--rad-sm)] border border-[var(--danger)] bg-[var(--dangers)] px-4 py-3 text-[13px] font-medium text-[var(--danger)]">
          {error}
          <button onClick={() => setError(null)} className="flex-none">
            <Icon name="x" size={16} />
          </button>
        </div>
      )}

      {/* CONVERSATION LIST — on mobile this is the only pane shown until a conversation is picked */}
      <div
        className={`${activeId ? "hidden" : "flex"} w-full flex-col overflow-hidden rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)] sm:flex sm:w-[300px] sm:flex-none`}
      >
        <div className="flex items-center justify-between gap-2 border-b border-[var(--border2)] p-[14px_16px]">
          <h3 className="m-0 text-[15px] font-semibold text-[var(--text)]">Chat</h3>
          <button
            onClick={openNewMessage}
            className="flex h-[30px] w-[30px] items-center justify-center rounded-[8px] bg-[var(--brand)] text-[var(--brandfg)]"
            title="New message"
          >
            <Icon name="plus" size={15} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations === null ? (
            Array.from({ length: 5 }, (_, i) => <SkeletonRow key={i} className="m-2 h-[52px]" />)
          ) : conversations.length === 0 ? (
            <div className="p-5 text-center text-[13px] text-[var(--muted)]">No conversations yet. Start one with the + button.</div>
          ) : (
            conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveId(c.id)}
                className="flex w-full items-center gap-[10px] border-b border-[var(--border2)] p-[12px_16px] text-left hover:bg-[var(--surface2)]"
                style={{ background: activeId === c.id ? "var(--surface2)" : "transparent" }}
              >
                <div
                  className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-full text-[12.5px] font-bold"
                  style={{ background: c.type === "group" ? "var(--brands)" : "var(--surface2)", color: c.type === "group" ? "var(--brand)" : "var(--muted)" }}
                >
                  <Icon name={c.type === "group" ? "users" : "message"} size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[13.5px] font-semibold text-[var(--text)]">{c.title}</span>
                    {c.lastMessageAt && <span className="flex-none text-[11px] text-[var(--subtle)]">{timeAgo(c.lastMessageAt)}</span>}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[12px] text-[var(--muted)]">{c.lastMessage ?? c.subtitle}</span>
                    {c.unreadCount > 0 && (
                      <span className="flex h-[18px] min-w-[18px] flex-none items-center justify-center rounded-full bg-[var(--brand)] px-1 text-[10.5px] font-bold text-[var(--brandfg)]">
                        {c.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* THREAD — on mobile this replaces the list entirely once a conversation is picked */}
      <div className={`${activeId ? "flex" : "hidden"} w-full flex-1 flex-col overflow-hidden rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)] sm:flex`}>
        {!active ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
            <div className="flex h-[54px] w-[54px] items-center justify-center rounded-[14px] bg-[var(--surface2)] text-[var(--muted)]">
              <Icon name="message" size={24} />
            </div>
            <p className="m-0 text-[13.5px] text-[var(--muted)]">Select a conversation, or start a new one.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-[10px] border-b border-[var(--border2)] p-[14px_18px]">
              <button onClick={() => setActiveId(null)} className="flex-none sm:hidden" title="Back to conversations">
                <Icon name="arrow-r" size={18} style={{ transform: "rotate(180deg)" }} className="text-[var(--muted)]" />
              </button>
              <div className="min-w-0 flex-1">
                <h3 className="m-0 truncate text-[15px] font-semibold text-[var(--text)]">{active.title}</h3>
                <p className="m-0 mt-[2px] text-[12px] text-[var(--muted)]">{active.subtitle}</p>
              </div>
            </div>
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-[16px_18px]">
              {messages === null ? (
                <Spinner size={20} />
              ) : messages.length === 0 ? (
                <div className="py-8 text-center text-[13px] text-[var(--muted)]">No messages yet — say hello.</div>
              ) : (
                <div className="flex flex-col gap-[10px]">
                  {messages.map((m) => (
                    <div key={m.id} className="flex" style={{ justifyContent: m.mine ? "flex-end" : "flex-start" }}>
                      <div className="max-w-[70%]">
                        {!m.mine && <div className="mb-[3px] text-[11.5px] font-semibold text-[var(--subtle)]">{m.senderName}</div>}
                        <div
                          className="rounded-[12px] px-[13px] py-[9px] text-[13.5px] leading-[1.4]"
                          style={
                            m.mine
                              ? { background: "var(--brand)", color: "var(--brandfg)" }
                              : { background: "var(--surface2)", color: "var(--text)" }
                          }
                        >
                          {m.body}
                        </div>
                        <div className="mt-[3px] text-[10.5px] text-[var(--subtle)]" style={{ textAlign: m.mine ? "right" : "left" }}>
                          {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-[10px] border-t border-[var(--border2)] p-[12px_16px]">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    onSend();
                  }
                }}
                placeholder="Type a message…"
                className="h-[42px] flex-1 rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] px-[14px] text-[13.5px] text-[var(--text)] outline-none"
              />
              <button
                onClick={onSend}
                disabled={!draft.trim() || sending}
                className="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-[var(--rad-sm)] bg-[var(--brand)] text-[var(--brandfg)] disabled:opacity-50"
              >
                {sending ? <Spinner size={16} /> : <Icon name="send" size={17} />}
              </button>
            </div>
          </>
        )}
      </div>

      {/* NEW MESSAGE MODAL */}
      {newOpen && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/30 p-4" onClick={() => setNewOpen(false)}>
          <div
            className="flex max-h-[520px] w-full max-w-[420px] flex-col overflow-hidden rounded-[var(--rad)] bg-[var(--surface)] shadow-[var(--shadow)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--border2)] p-[14px_18px]">
              <h3 className="m-0 text-[15px] font-semibold text-[var(--text)]">New message</h3>
              <button onClick={() => setNewOpen(false)}>
                <Icon name="x" size={18} className="text-[var(--muted)]" />
              </button>
            </div>
            <div className="border-b border-[var(--border2)] p-[12px_16px]">
              <input
                value={directorySearch}
                onChange={(e) => setDirectorySearch(e.target.value)}
                placeholder="Search staff…"
                className="h-[38px] w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface2)] px-3 text-[13px] text-[var(--text)] outline-none"
              />
            </div>
            <div className="flex-1 overflow-y-auto">
              {canHaveChannels && offerings && offerings.length > 0 && (
                <div>
                  <div className="p-[10px_16px] text-[11px] font-bold uppercase tracking-[0.04em] text-[var(--subtle)]">Course channels</div>
                  {offerings.map((o) => (
                    <button
                      key={o.id}
                      onClick={() => openChannel(o.id)}
                      className="flex w-full items-center gap-[10px] p-[10px_16px] text-left hover:bg-[var(--surface2)]"
                    >
                      <Icon name="users" size={16} className="text-[var(--brand)]" />
                      <span className="text-[13.5px] font-medium text-[var(--text)]">{o.label}</span>
                    </button>
                  ))}
                  <div className="p-[10px_16px] text-[11px] font-bold uppercase tracking-[0.04em] text-[var(--subtle)]">Direct message</div>
                </div>
              )}
              {directory === null ? (
                <SkeletonRow className="m-3 h-[40px]" />
              ) : filteredDirectory.length === 0 ? (
                <div className="p-4 text-center text-[13px] text-[var(--muted)]">No staff found.</div>
              ) : (
                filteredDirectory.map((d) => (
                  <button key={d.id} onClick={() => startDm(d.id)} className="flex w-full items-center gap-[10px] p-[10px_16px] text-left hover:bg-[var(--surface2)]">
                    <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[var(--surface2)] text-[11.5px] font-bold text-[var(--muted)]">
                      {d.initials}
                    </div>
                    <div>
                      <div className="text-[13.5px] font-medium text-[var(--text)]">{d.name}</div>
                      <div className="text-[11.5px] capitalize text-[var(--subtle)]">{d.role}</div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
