import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { ApiError, db, result } from "./db.js";
import { uuid } from "./validators.js";

export const messagingRoutes = Router();

async function requireMember(conversationId: string, profileId: string) {
  const membership = await result(
    db
      .from("conversation_members")
      .select("conversation_id")
      .eq("conversation_id", conversationId)
      .eq("profile_id", profileId)
      .maybeSingle(),
  );
  if (!membership) {
    throw new ApiError(404, "NOT_FOUND", "Không tìm thấy cuộc trò chuyện.");
  }

  const conversation = await result(
    db
      .from("conversations")
      .select("request_id")
      .eq("id", conversationId)
      .maybeSingle(),
  );
  if (conversation?.request_id) {
    throw new ApiError(
      409,
      "REQUEST_WORKSPACE",
      "Vui lòng mở hội thoại trong workspace yêu cầu dịch vụ.",
    );
  }
}

async function requireInternalConversation(conversationId: string) {
  const memberships =
    (await result(
      db
        .from("conversation_members")
        .select("profile_id")
        .eq("conversation_id", conversationId),
    )) ?? [];
  const profileIds = memberships.map((membership) => membership.profile_id);
  const profiles = profileIds.length
    ? ((await result(
        db.from("profiles").select("id,role").in("id", profileIds),
      )) ?? [])
    : [];

  if (profiles.some((profile) => !["STAFF", "ADMIN"].includes(profile.role))) {
    throw new ApiError(
      403,
      "REQUEST_REQUIRED",
      "Customer và Creator trao đổi trong hội thoại dịch vụ được phân công.",
    );
  }
}

messagingRoutes.get("/", async (req, res) => {
  const memberships =
    (await result(
      db
        .from("conversation_members")
        .select("conversation_id,last_read_at,muted,archived")
        .eq("profile_id", req.identity.id)
        .eq("archived", false),
    )) ?? [];
  const conversationIds = memberships.map(
    (membership) => membership.conversation_id,
  );
  if (!conversationIds.length) return res.json({ success: true, data: [] });

  const [conversationRows, membershipRows] = await Promise.all([
    result(
      db
        .from("conversations")
        .select("*")
        .in("id", conversationIds)
        .is("request_id", null)
        .order("last_message_at", { ascending: false }),
    ),
    result(
      db
        .from("conversation_members")
        .select("conversation_id,profile_id,last_read_at")
        .in("conversation_id", conversationIds),
    ),
  ]);
  const conversations = conversationRows ?? [];
  const allMemberships = membershipRows ?? [];
  const profileIds = [
    ...new Set(allMemberships.map((membership) => membership.profile_id)),
  ];
  const profiles = profileIds.length
    ? ((await result(
        db
          .from("profiles")
          .select("id,full_name,avatar_url,role")
          .in("id", profileIds),
      )) ?? [])
    : [];

  return res.json({
    success: true,
    data: conversations.map((conversation) => {
      const ownMembership = memberships.find(
        (membership) => membership.conversation_id === conversation.id,
      );
      return {
        ...conversation,
        members: allMemberships
          .filter(
            (membership) => membership.conversation_id === conversation.id,
          )
          .map((membership) =>
            profiles.find((profile) => profile.id === membership.profile_id),
          )
          .filter(Boolean),
        unread:
          !ownMembership?.last_read_at ||
          new Date(conversation.last_message_at) >
            new Date(ownMembership.last_read_at),
      };
    }),
  });
});

messagingRoutes.post("/", async (req, res) => {
  if (!["STAFF", "ADMIN"].includes(req.identity.role)) {
    throw new ApiError(
      403,
      "REQUEST_REQUIRED",
      "Trao đổi dịch vụ trong hội thoại yêu cầu; không tạo chat riêng với Creator.",
    );
  }

  const body = z
    .object({
      creator_id: uuid.optional(),
      profile_id: uuid.optional(),
      subject: z.string().trim().max(160).default(""),
    })
    .refine((value) => value.creator_id || value.profile_id)
    .parse(req.body);

  let recipientId = body.profile_id;
  if (body.creator_id) {
    const creator = await result(
      db
        .from("creator_profiles")
        .select("profile_id,display_name")
        .eq("id", body.creator_id)
        .maybeSingle(),
    );
    if (!creator?.profile_id) {
      throw new ApiError(
        409,
        "CREATOR_OFFLINE",
        "Creator này chưa kích hoạt nhắn tin.",
      );
    }
    recipientId = creator.profile_id;
  }
  if (!recipientId) {
    throw new ApiError(422, "INVALID_RECIPIENT", "Vui lòng chọn người nhận.");
  }
  if (recipientId === req.identity.id) {
    throw new ApiError(422, "INVALID_RECIPIENT", "Không thể tự nhắn tin.");
  }

  const recipient = await result(
    db
      .from("profiles")
      .select("id,full_name,role")
      .eq("id", recipientId)
      .eq("active", true)
      .maybeSingle(),
  );
  if (!recipient) {
    throw new ApiError(
      404,
      "RECIPIENT_NOT_FOUND",
      "Không tìm thấy người nhận.",
    );
  }
  if (!["STAFF", "ADMIN"].includes(recipient.role)) {
    throw new ApiError(
      403,
      "REQUEST_REQUIRED",
      "Customer và Creator trao đổi trong hội thoại dịch vụ được phân công.",
    );
  }

  const conversationId = randomUUID();
  await result(
    db.from("conversations").insert({
      id: conversationId,
      subject: body.subject || `Trao đổi với ${recipient.full_name}`,
    }),
  );
  await result(
    db.from("conversation_members").insert([
      {
        conversation_id: conversationId,
        profile_id: req.identity.id,
        last_read_at: new Date().toISOString(),
      },
      { conversation_id: conversationId, profile_id: recipient.id },
    ]),
  );
  return res.status(201).json({ success: true, data: { id: conversationId } });
});

messagingRoutes.get("/:id", async (req, res) => {
  const conversationId = uuid.parse(req.params.id);
  await requireMember(conversationId, req.identity.id);
  const limit = z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(50)
    .parse(req.query.limit);
  const before = z.iso.datetime().optional().parse(req.query.before);
  let query = db
    .from("conversation_messages")
    .select("id,conversation_id,sender_id,content,attachments,created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (before) query = query.lt("created_at", before);

  const [messageRows, conversation, membershipRows] = await Promise.all([
    result(query),
    result(
      db.from("conversations").select("*").eq("id", conversationId).single(),
    ),
    result(
      db
        .from("conversation_members")
        .select("profile_id,last_read_at")
        .eq("conversation_id", conversationId),
    ),
  ]);
  const newestFirstMessages = messageRows ?? [];
  const memberships = membershipRows ?? [];
  const profiles =
    (await result(
      db
        .from("profiles")
        .select("id,full_name,avatar_url,role")
        .in(
          "id",
          memberships.map((membership) => membership.profile_id),
        ),
    )) ?? [];

  return res.json({
    success: true,
    data: {
      conversation,
      messages: newestFirstMessages.reverse(),
      members: memberships.map((membership) => ({
        ...membership,
        ...profiles.find((profile) => profile.id === membership.profile_id),
      })),
    },
  });
});

messagingRoutes.post("/:id/messages", async (req, res) => {
  if (!["STAFF", "ADMIN"].includes(req.identity.role)) {
    throw new ApiError(
      403,
      "REQUEST_REQUIRED",
      "Hãy trao đổi trong hội thoại dịch vụ được phân công.",
    );
  }
  const conversationId = uuid.parse(req.params.id);
  await requireMember(conversationId, req.identity.id);
  await requireInternalConversation(conversationId);

  const body = z
    .object({
      content: z.string().trim().min(1).max(5000),
      attachments: z.array(z.url()).max(6).default([]),
    })
    .strict()
    .parse(req.body);
  const message = await result(
    db
      .from("conversation_messages")
      .insert({
        conversation_id: conversationId,
        sender_id: req.identity.id,
        ...body,
      })
      .select()
      .single(),
  );
  await result(
    db
      .from("conversation_members")
      .update({ last_read_at: new Date().toISOString() })
      .eq("conversation_id", conversationId)
      .eq("profile_id", req.identity.id),
  );
  return res.status(201).json({ success: true, data: message });
});

messagingRoutes.post("/:id/read", async (req, res) => {
  const conversationId = uuid.parse(req.params.id);
  await requireMember(conversationId, req.identity.id);
  await result(
    db
      .from("conversation_members")
      .update({ last_read_at: new Date().toISOString() })
      .eq("conversation_id", conversationId)
      .eq("profile_id", req.identity.id),
  );
  return res.json({ success: true, data: { read: true } });
});
