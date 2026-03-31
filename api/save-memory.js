import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { userId, messages } = req.body;
  if (!userId || !messages?.length) return res.status(400).end();

  // Pedirle a Claude que haga un resumen de la conversación
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
          content: 'Haz un resumen muy breve (máx 5 líneas) de los temas importantes que se hablaron en esta conversación: qué problema tenía el usuario, qué consejos se dieron, cómo se llamó si lo mencionó, qué quedó pendiente. Solo el resumen, sin saludos.'
        }
      ]
    })
  });

  const data = await response.json();
  const summary = data.content?.[0]?.text || '';

  if (summary && userId) {
    // Obtener memorias anteriores y agregar la nueva
    const existing = await kv.get(`memory:${userId}`) || '';
    const date = new Date().toLocaleDateString('es-MX');
    const updated = `${existing}\n\n[${date}]: ${summary}`.trim();
    // Guardamos máximo los últimos 3000 caracteres para no pasarnos
    await kv.set(`memory:${userId}`, updated.slice(-3000));
  }

  return res.status(200).json({ ok: true });
}
