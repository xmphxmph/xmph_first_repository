const cfg = require('../xhh-config.json');

async function askAI(postContent, userMessage, images) {
  const aiCfg = cfg.ai;

  const messages = [
    { role: 'system', content: aiCfg.prompt },
  ];

  let context = `以下是帖子内容：\n标题：${postContent.title || '无标题'}`;
  if (postContent.content) context += `\n\n帖子正文：${postContent.content}`;
  context += `\n\n用户@你说：${userMessage}`;

  messages.push({ role: 'user', content: context });

  // 如果有图片追加图片
  if (images && images.length > 0) {
    const imgMsg = { role: 'user', content: [] };
    for (const url of images) {
      imgMsg.content.push({ type: 'image_url', image_url: { url } });
    }
    imgMsg.content.push({ type: 'text', text: '以上是帖子中的图片，请结合这些图片回复用户。' });
    messages.push(imgMsg);
  }

  try {
    const res = await fetch(aiCfg.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aiCfg.token}`,
      },
      body: JSON.stringify({
        model: aiCfg.model,
        messages,
        max_tokens: 1000,
        temperature: 0.7,
      }),
    });

    const data = await res.json();
    if (data.choices && data.choices[0]) {
      return {
        text: data.choices[0].message.content || '',
        tokens: data.usage?.total_tokens || 0,
      };
    }
    return { text: '', tokens: 0 };
  } catch (e) {
    console.log('[AI] 请求失败:', e.message);
    return { text: '', tokens: 0 };
  }
}

module.exports = { askAI };
