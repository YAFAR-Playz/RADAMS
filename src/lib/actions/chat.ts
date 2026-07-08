"use server";

import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-profile";
import type { Role } from "@/lib/roles";

export type StaffDirectoryEntry = { id: string; name: string; initials: string; role: Role };

export type ConversationSummary = {
  id: string;
  type: "dm" | "group";
  title: string;
  subtitle: string;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
};

export type ChatMessage = {
  id: string;
  senderId: string;
  senderName: string;
  senderInitials: string;
  body: string;
  createdAt: string;
  mine: boolean;
};

function offeringLabel(o: { session: string; unit: string | null; courses: { name: string } | { name: string }[] | null } | null) {
  if (!o) return "—";
  const course = Array.isArray(o.courses) ? o.courses[0] : o.courses;
  return [course?.name, o.session, o.unit].filter(Boolean).join(" · ");
}

// Every other staff member in the org — the pool available to start a new DM.
export async function listStaffDirectory(): Promise<StaffDirectoryEntry[]> {
  const profile = await getCurrentProfile();
  if (!profile || !profile.org) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, initials, role")
    .eq("org_id", profile.org.id)
    .is("left_at", null)
    .neq("id", profile.id)
    .order("full_name", { ascending: true });
  return (data ?? []).map((p) => ({ id: p.id, name: p.full_name, initials: p.initials, role: p.role as Role }));
}

// Offerings the current user can open a group channel for — heads/assistants
// on that offering only (v1 scope; other roles use DMs).
export async function listMyChatOfferings(): Promise<{ id: string; label: string }[]> {
  const profile = await getCurrentProfile();
  if (!profile) return [];
  const supabase = await createClient();

  if (profile.role === "head") {
    const { data } = await supabase.from("offering_heads").select("course_offerings(id, session, unit, courses(name))").eq("head_id", profile.id);
    return (data ?? [])
      .map((row) => {
        const o = Array.isArray(row.course_offerings) ? row.course_offerings[0] : row.course_offerings;
        return o ? { id: o.id, label: offeringLabel(o) } : null;
      })
      .filter((o): o is { id: string; label: string } => !!o);
  }
  if (profile.role === "assistant") {
    const { data } = await supabase.from("offering_assistants").select("course_offerings(id, session, unit, courses(name))").eq("assistant_id", profile.id);
    return (data ?? [])
      .map((row) => {
        const o = Array.isArray(row.course_offerings) ? row.course_offerings[0] : row.course_offerings;
        return o ? { id: o.id, label: offeringLabel(o) } : null;
      })
      .filter((o): o is { id: string; label: string } => !!o);
  }
  return [];
}

export async function listConversations(): Promise<ConversationSummary[]> {
  const profile = await getCurrentProfile();
  if (!profile || !profile.org) return [];
  const supabase = await createClient();

  const { data: memberships } = await supabase
    .from("chat_conversation_members")
    .select(
      "last_read_at, chat_conversations(id, type, offering_id, last_message_at, course_offerings(session, unit, courses(name)))"
    )
    .eq("profile_id", profile.id);

  const rows = (memberships ?? [])
    .map((m) => {
      const c = Array.isArray(m.chat_conversations) ? m.chat_conversations[0] : m.chat_conversations;
      return c ? { conv: c, lastReadAt: m.last_read_at as string | null } : null;
    })
    .filter((r): r is { conv: NonNullable<typeof r>["conv"]; lastReadAt: string | null } => !!r);

  if (!rows.length) return [];

  const convIds = rows.map((r) => r.conv.id);

  const { data: otherMembers } = await supabase
    .from("chat_conversation_members")
    .select("conversation_id, profiles(id, full_name, initials)")
    .in("conversation_id", convIds)
    .neq("profile_id", profile.id);

  const otherByConv = new Map<string, { name: string; initials: string }>();
  for (const row of otherMembers ?? []) {
    const p = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    if (p) otherByConv.set(row.conversation_id, { name: p.full_name, initials: p.initials });
  }

  const { data: lastMessages } = await supabase
    .from("chat_messages")
    .select("conversation_id, body, created_at")
    .in("conversation_id", convIds)
    .order("created_at", { ascending: false });
  const lastMessageByConv = new Map<string, { body: string; created_at: string }>();
  for (const m of lastMessages ?? []) {
    if (!lastMessageByConv.has(m.conversation_id)) lastMessageByConv.set(m.conversation_id, m);
  }

  const { data: unreadRows } = await supabase.from("chat_messages").select("conversation_id, created_at, sender_id").in("conversation_id", convIds);
  const unreadByConv = new Map<string, number>();
  for (const m of unreadRows ?? []) {
    if (m.sender_id === profile.id) continue;
    const row = rows.find((r) => r.conv.id === m.conversation_id);
    if (row && (!row.lastReadAt || m.created_at > row.lastReadAt)) {
      unreadByConv.set(m.conversation_id, (unreadByConv.get(m.conversation_id) ?? 0) + 1);
    }
  }

  return rows
    .map(({ conv }) => {
      const o = Array.isArray(conv.course_offerings) ? conv.course_offerings[0] : conv.course_offerings;
      const other = otherByConv.get(conv.id);
      const last = lastMessageByConv.get(conv.id);
      return {
        id: conv.id,
        type: conv.type,
        title: conv.type === "dm" ? other?.name ?? "Unknown" : offeringLabel(o),
        subtitle: conv.type === "dm" ? "Direct message" : "Course channel",
        lastMessage: last?.body ?? null,
        lastMessageAt: last?.created_at ?? conv.last_message_at ?? null,
        unreadCount: unreadByConv.get(conv.id) ?? 0,
      };
    })
    .sort((a, b) => {
      const at = a.lastMessageAt ?? "";
      const bt = b.lastMessageAt ?? "";
      return at < bt ? 1 : at > bt ? -1 : 0;
    });
}

export async function getOrStartDm(otherProfileId: string): Promise<string> {
  const profile = await getCurrentProfile();
  if (!profile || !profile.org) throw new Error("Not authenticated");
  if (otherProfileId === profile.id) throw new Error("Can't message yourself");
  const supabase = await createClient();

  const { data: myConvs } = await supabase.from("chat_conversation_members").select("conversation_id").eq("profile_id", profile.id);
  const myConvIds = (myConvs ?? []).map((c) => c.conversation_id);

  if (myConvIds.length) {
    const { data: sharedConvs } = await supabase
      .from("chat_conversation_members")
      .select("conversation_id, chat_conversations(type)")
      .eq("profile_id", otherProfileId)
      .in("conversation_id", myConvIds);
    for (const row of sharedConvs ?? []) {
      const c = Array.isArray(row.chat_conversations) ? row.chat_conversations[0] : row.chat_conversations;
      if (c?.type === "dm") return row.conversation_id;
    }
  }

  // Generate the id client-side rather than relying on `.select()` after
  // insert: the SELECT policy on chat_conversations requires membership,
  // which doesn't exist yet at the moment of insert (member rows come in the
  // very next query) — Postgres re-checks the SELECT policy for a RETURNING
  // clause, so `.insert().select()` here would fail RLS every time.
  const newConvId = randomUUID();
  const { error } = await supabase.from("chat_conversations").insert({ id: newConvId, org_id: profile.org.id, type: "dm" as const });
  if (error) throw new Error(error.message);

  const { error: memberError } = await supabase.from("chat_conversation_members").insert([
    { conversation_id: newConvId, profile_id: profile.id },
    { conversation_id: newConvId, profile_id: otherProfileId },
  ]);
  if (memberError) throw new Error(memberError.message);

  return newConvId;
}

// Group channel membership tracks the offering's current heads/assistants —
// re-synced every time someone opens it, so a newly assigned assistant sees
// the channel without any separate provisioning step.
export async function getOrCreateOfferingChannel(offeringId: string): Promise<string> {
  const profile = await getCurrentProfile();
  if (!profile || !profile.org) throw new Error("Not authenticated");
  const supabase = await createClient();

  // Plain SELECT would require is_chat_member(id) — but the person opening
  // this for the first time (e.g. a newly assigned assistant) isn't a member
  // yet, which is exactly the case this needs to handle. RPC bypasses RLS.
  const { data: existingId } = await supabase.rpc("find_group_conversation_id", { p_offering_id: offeringId });

  let conversationId = existingId ?? undefined;
  if (!conversationId) {
    const newConvId = randomUUID();
    // Same RETURNING-vs-SELECT-policy issue as the DM path above.
    const { error } = await supabase
      .from("chat_conversations")
      .insert({ id: newConvId, org_id: profile.org.id, type: "group" as const, offering_id: offeringId });
    if (error) throw new Error(error.message);
    conversationId = newConvId;
  }

  const [{ data: heads }, { data: assistants }] = await Promise.all([
    supabase.from("offering_heads").select("head_id").eq("offering_id", offeringId),
    supabase.from("offering_assistants").select("assistant_id").eq("offering_id", offeringId),
  ]);
  const staffIds = new Set([...(heads ?? []).map((h) => h.head_id), ...(assistants ?? []).map((a) => a.assistant_id)]);

  // Upsert-ignore rather than diffing against a "who's already a member"
  // read first — that read is itself membership-gated by RLS, so for
  // someone not yet a member (the exact case being handled) it would come
  // back empty and this would try to re-insert everyone, colliding with the
  // primary key for members who are already there.
  if (staffIds.size) {
    await supabase
      .from("chat_conversation_members")
      .upsert(
        Array.from(staffIds).map((profile_id) => ({ conversation_id: conversationId, profile_id })),
        { onConflict: "conversation_id,profile_id", ignoreDuplicates: true }
      );
  }

  return conversationId;
}

export async function listMessages(conversationId: string): Promise<ChatMessage[]> {
  const profile = await getCurrentProfile();
  if (!profile) return [];
  const supabase = await createClient();

  const { data } = await supabase
    .from("chat_messages")
    .select("id, sender_id, body, created_at, profiles(full_name, initials)")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(200);

  await supabase.from("chat_conversation_members").update({ last_read_at: new Date().toISOString() }).eq("conversation_id", conversationId).eq("profile_id", profile.id);

  return (data ?? []).map((m) => {
    const sender = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
    return {
      id: m.id,
      senderId: m.sender_id,
      senderName: sender?.full_name ?? "—",
      senderInitials: sender?.initials ?? "—",
      body: m.body,
      createdAt: m.created_at,
      mine: m.sender_id === profile.id,
    };
  });
}

export async function sendMessage(conversationId: string, body: string): Promise<void> {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Not authenticated");
  const trimmed = body.trim();
  if (!trimmed) return;
  const supabase = await createClient();

  const { error } = await supabase.from("chat_messages").insert({ conversation_id: conversationId, sender_id: profile.id, body: trimmed });
  if (error) throw new Error(error.message);

  await supabase
    .from("chat_conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", conversationId);
  await supabase
    .from("chat_conversation_members")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("profile_id", profile.id);
}
