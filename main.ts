import { serve } from "https://deno.land/std/http/server.ts";
import { handleStart, handleRoleSelection, handleContributorJoin, handleLog } from "./handlers.ts";

const kv = await Deno.openKv();

serve(async (req) => {
  console.log("✅ Received a request:", req.method);
  if (req.method !== "POST") return new Response("Only POST supported", { status: 405 });

  const formData = await req.formData();
  const from = formData.get("From")?.toString() ?? "";
  const bodyRaw = formData.get("Body")?.toString() ?? "";
  const body = bodyRaw.trim().toLowerCase();
  const today = new Date().toISOString().slice(0, 10);

  console.log("📩 Incoming message | From:", from, "| Body:", bodyRaw);

  const sessionKey = ["session", from];
  const userKey = ["user", from];
  const session = (await kv.get(sessionKey)).value ?? {};
  const userMeta = (await kv.get(userKey)).value;

  if (body === "/start") return await handleStart(kv, from, sessionKey, userKey, userMeta);
  if (!userMeta) {
    if (session?.step === "awaiting_role") return await handleRoleSelection(kv, body, from, sessionKey, userKey);
    if (session?.step === "awaiting_group_id") return await handleContributorJoin(kv, body, from, sessionKey, userKey);
    return respond("👋 Send /start to begin.");
  }

  return await handleLog(kv, body, bodyRaw, from, userMeta, today);
});

import { respond } from "./utils.ts"; // used in fallback
