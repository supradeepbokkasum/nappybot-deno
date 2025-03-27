export function respond(text: string): Response {
  const xml = `<Response><Message>${text}</Message></Response>`;
  return new Response(xml, {
    headers: { "Content-Type": "application/xml" },
  });
}

export async function sendWhatsApp(to: string, body: string) {
  try {
    const sid = Deno.env.get("TWILIO_ACCOUNT_SID")!;
    const token = Deno.env.get("TWILIO_AUTH_TOKEN")!;
    const from = Deno.env.get("+61481297630")!;
    const creds = btoa(`${sid}:${token}`);

    console.log("📨 Sending WhatsApp to:", to);
    console.log("📨 Message:", body);

    const form = new URLSearchParams({ To: to, From: from, Body: body });

    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${creds}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
    });

    const result = await res.text();
    console.log("📬 Twilio response status:", res.status);
    console.log("📬 Twilio response body:", result);
    console.log("🔐 SID loaded?", !!Deno.env.get("TWILIO_ACCOUNT_SID"));

  } catch (err) {
    console.error("❌ Error sending WhatsApp message:", err);
  }
}
