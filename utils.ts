export function respond(text: string): Response {
  const xml = `<Response><Message>${text}</Message></Response>`;
  return new Response(xml, {
    headers: { "Content-Type": "application/xml" },
  });
}

export async function sendWhatsApp(to: string, body: string) {
  const sid = Deno.env.get("TWILIO_ACCOUNT_SID")!;
  const token = Deno.env.get("TWILIO_AUTH_TOKEN")!;
  const from = Deno.env.get("TWILIO_PHONE_NUMBER")!;
  const creds = btoa(`${sid}:${token}`);

  const form = new URLSearchParams({ To: to, From: from, Body: body });

  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${creds}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
  });
}
