async function getRedisValue(redisUrl, key) {
  const url = new URL(redisUrl);
  const resp = await fetch(`${url.origin}/get/${key}`, {
    headers: { Authorization: `Bearer ${url.password}` }
  });
  const data = await resp.json();
  return data.result || null;
}

async function setRedisValue(redisUrl, key, value) {
  const url = new URL(redisUrl);
  await fetch(`${url.origin}/set/${key}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${url.password}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ value })
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { userId, messages } = req.body;
  if (!userId || !messages?.length) return res.status(400).end();

  const redisUrl = process.env.STORAGE_URL;

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
            content: 'Haz un resumen muy breve (máx 5 líneas) de los temas importantes que se hablaron en esta conversación: qué problema tenía el usuario, qué consejos se dieron, cómo se llamó si lo mencionó, qué quedó pendiente. Solo el resumen, sin saludos.'
          }
        ]
      })
    });

    const data = await response.json();
    const summary = data.content?.[0]?.text || '';

    if (summary && redisUrl) {
      const existing = await getRedisValue(redisUrl, `memory:${userId}`) || '';
      const date = new Date().toLocaleDateString('es-MX');
      const updated = `${existing}\n\n[${date}]: ${summary}`.trim();
      await setRedisValue(redisUrl, `memory:${userId}`, updated.slice(-3000));
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'Error guardando memoria' });
  }
}
