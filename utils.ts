export function respond(text: string): Response {
  const xml = `<Response><Message>${text}</Message></Response>`;
  return new Response(xml, {
    headers: { "Content-Type": "application/xml" },
  });
}

export async function sendWhatsApp(to: string, body: string) {
  try {
    console.log("🔍 Entered sendWhatsApp()");

    const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const token = Deno.env.get("TWILIO_AUTH_TOKEN");
    const from = Deno.env.get("TWILIO_PHONE_NUMBER");

    console.log("🧪 SID:", sid ? "[OK]" : "❌ MISSING");
    console.log("🧪 Token:", token ? "[OK]" : "❌ MISSING");
    console.log("🧪 From:", from ? from : "❌ MISSING");

    if (!sid || !token || !from) {
      console.error("❌ One or more Twilio environment variables are missing.");
      return;
    }

    const creds = btoa(`${sid}:${token}`);
    console.log("📨 Preparing to send WhatsApp message...");

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

  } catch (err) {
    console.error("❌ sendWhatsApp() failed:", err);
  }
}
