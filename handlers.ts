import { respond } from "./utils.ts";

export async function handleStart(kv, from, sessionKey, userKey, userMeta) {
  if (userMeta) {
    const { groupId, role } = userMeta;
    return respond(
      `👋 You're already part of a baby log group!\n🔗 Group ID: ${groupId}\nRole: ${role === "primary" ? "👤 Primary" : "🤝 Contributor"}`
    );
  }

  await kv.set(sessionKey, { step: "awaiting_role" });
  return respond(
    "👋 Welcome to NappyBot!\nAre you the primary caregiver or a contributor?\n\n1️⃣ Primary\n2️⃣ Contributor"
  );
}


export async function handleRoleSelection(kv, body, from, sessionKey, userKey) {
  if (body === "1") {
    const groupId = `nappy-${crypto.randomUUID().slice(0, 4)}`;
    await kv.set(["group", groupId], [from]);
    await kv.set(userKey, { groupId, role: "primary" });
    await kv.set(["primary", from], groupId);
    await kv.delete(sessionKey);
    return respond(`✅ You're the primary caregiver.\n🔗 Share this Group ID: ${groupId}`);
  } else if (body === "2") {
    await kv.set(sessionKey, { step: "awaiting_group_id" });
    return respond("🔑 Enter the group ID shared by the primary caregiver.");
  } else {
    return respond("❓ Reply with 1 or 2.");
  }
}

export async function handleContributorJoin(kv, groupId, from, sessionKey, userKey) {
  const groupKey = ["group", groupId];
  const members = (await kv.get(groupKey)).value ?? [];
  if (members.length >= 3) {
    return respond("⚠️ This group already has 3 members.");
  }
  members.push(from);
  await kv.set(groupKey, members);
  await kv.set(userKey, { groupId, role: "contributor" });
  await kv.delete(sessionKey);
  return respond("🎉 You’ve joined the group. Start logging with /log!");
}

export async function handleLog(kv, body, bodyRaw, from, userMeta, today) {
  const { groupId, role } = userMeta;
  const countKey = ["msgcount", groupId, today];
  const msgCount = ((await kv.get(countKey)).value as number ?? 0) + 1;

  if (msgCount > 50) return respond("🚫 Group has reached the daily limit (50 messages).");

  await kv.set(countKey, msgCount);

  if (body.startsWith("/log")) {
    const logText = bodyRaw.replace(/^\/log\\b/i, "").trim();
    if (!logText) {
      return respond(`📝 What would you like to log?\n1️⃣ Feed\n2️⃣ Sleep\n3️⃣ Diaper\n\nOr type:\n/log 120ml feed at 3pm`);
    }

    const log = { from, raw: logText, created_at: new Date().toISOString() };
    await kv.set(["log", groupId, Date.now()], log);

    const members = (await kv.get(["group", groupId])).value ?? [];
    const sender = role === "primary" ? "Primary" : "Contributor";
    const ack = `✅ Log received: "${logText}"\n👤 Submitted by: ${sender}`;

    for (const m of members) {
      if (m !== from) await sendWhatsApp(m, ack);
    }

    return respond(ack);
  }

  return respond(`✅ Message received.\n._Messages today: ${msgCount}/50_`);
}
	