import { serve } from "https://deno.land/std/http/server.ts";

const kv = await Deno.openKv();

serve(async (req) => {
  console.log("✅ Received a request:", req.method);
  if (req.method !== "POST") {
    return new Response("Only POST supported", { status: 405 });
  }

  const formData = await req.formData();
  const from = formData.get("From")?.toString() ?? "";
  const bodyRaw = formData.get("Body")?.toString() ?? "";
  const body = bodyRaw.trim().toLowerCase();

  console.log("📩 Incoming message | From:", from, "| Body:", bodyRaw);

  const today = new Date().toISOString().slice(0, 10);

  const sessionKey = ["session", from];
  const userKey = ["user", from];

  const session = (await kv.get(sessionKey)).value ?? {};
  const userMeta = (await kv.get(userKey)).value;

  // Onboarding
  if (body === "/start") {
    if (userMeta) {
      const { groupId, role } = userMeta;
      return respond(
        `👋 You're already in a group!\n🔗 Group ID: ${groupId}\nRole: ${
          role === "primary" ? "👤 Primary" : "🤝 Contributor"
        }`
      );
    }
    await kv.set(sessionKey, { step: "awaiting_role" });
    return respond(
      "👋 Welcome to NappyBot!\nAre you the primary caregiver or a contributor?\n\n1️⃣ Primary\n2️⃣ Contributor"
    );
  }

  // Role selection
  if (!userMeta) {
    if (session?.step === "awaiting_role") {
      if (body === "1") {
        const groupId = `nappy-${crypto.randomUUID().slice(0, 4)}`;
        const groupKey = ["group", groupId];
        await kv.set(groupKey, [from]);
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

    if (session?.step === "awaiting_group_id") {
      const groupKey = ["group", body];
      const group = (await kv.get(groupKey)).value ?? [];

      if (group.length >= 3) {
        return respond("⚠️ This group already has 3 members.");
      }

      group.push(from);
      await kv.set(groupKey, group);
      await kv.set(userKey, { groupId: body, role: "contributor" });
      await kv.delete(sessionKey);
      return respond("🎉 You’ve joined the group. Start logging with /log!");
    }

    return respond("👋 Send /start to begin.");
  }

  // Logging
  const { groupId, role } = userMeta;
  const countKey = ["msgcount", groupId, today];
  const msgCount = ((await kv.get(countKey)).value as number ?? 0) + 1;

  if (msgCount > 50) {
    return respond("🚫 Group has reached the daily limit (50 messages).");
  }

  await kv.set(countKey, msgCount);

  if (body.startsWith("/log")) {
    const logText = bodyRaw.replace(/^\/log\b/i, "").trim();

    if (!logText) {
      return respond(`📝 What would you like to log?\n1️⃣ Feed\n2️⃣ Sleep\n3️⃣ Diaper\n\nOr type:\n/log 120ml feed at 3pm`);
    }

    const logKey = ["log", groupId, Date.now()];
    const log = { from, raw: logText, created_at: new Date().toISOString() };
    await kv.set(logKey, log);

    const members = (await kv.get(["group", groupId])).value ?? [];
    const ack = `✅ Log received: "${logText}"\n👤 Submitted by: ${role === "primary" ? "Primary" : "Contributor"}`;

    for (const member of members) {
      if (member !== from) await sendWhatsApp(member, ack);
    }

    return respond(ack);
  }

  return respond(`✅ Message received.\n._Messages today: ${msgCount}/50_`);
});

function respond(text: string): Response {
  const xml = `<Response><Message>${text}</Message></Response>`;
  return new Response(xml, {
    headers: { "Content-Type": "application/xml" },
  });
}

async function sendWhatsApp(to: string, body: string) {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID")!;
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN")!;
  const from = Deno.env.get("TWILIO_PHONE_NUMBER")!;
  const creds = btoa(`${accountSid}:${authToken}`);

  const form = new URLSearchParams({ To: to, From: from, Body: body });
  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${creds}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
  });
}
