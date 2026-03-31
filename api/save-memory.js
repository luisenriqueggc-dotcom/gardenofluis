import { createClient } from 'redis';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { userId, messages } = req.body;
  if (!userId || !messages?.length) return res.status(400).end();

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 300,
        messages: [
          ...messages,
          {
            role: 'user',
            content: 'Haz un resumen muy breve (máx 5 líneas) de los temas importantes: qué problema tenía el usuario, qué consejos se dieron, cómo se llamó si lo mencionó, qué quedó pendiente. Solo el resumen, sin saludos.'
          }
        ]
      })
    });

    const data = await response.json();
    const summary = data.content?.[0]?.text || '';
    if (!summary) return res.status(200).json({ ok: true });

    const client = createClient({ url: process.env.REDIS_URL });
    await client.connect();

    const existing = await client.get(`memory:${userId}`) || '';
    const date = new Date().toLocaleDateString('es-MX');
    const updated = `${existing}\n\n[${date}]: ${summary}`.trim().slice(-3000);
    await client.set(`memory:${userId}`, updated);

    await client.disconnect();
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('save-memory error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}
