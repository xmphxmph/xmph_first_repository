const db = require('./db');
const api = require('./api');
const { askAI } = require('./ai');
const path = require('path');
const fs = require('fs');

const CONFIG_PATH = path.join(__dirname, '..', 'xhh-config.json');
const BOT_USER_ID = '99143914';

function loadConfig() {
  delete require.cache[require.resolve(CONFIG_PATH)];
  return require(CONFIG_PATH);
}

async function processMention(msg) {
  const commentId = msg.comment_a_id;
  if (!commentId) return;

  // 去重
  if (await db.isReplied(commentId)) {
    return;
  }

  // 不回复自己的 @
  const userId = String(msg.userid_a || '');
  if (userId === BOT_USER_ID) return;

  const username = msg.user_a?.username || msg.user_a?.userid || userId;
  const postId = msg.linkid || '';

  // 从 @ 文本中提取用户消息（去掉 HTML @ 标签）
  const userMessage = (msg.comment_a_text || '').replace(/<[^>]+>/g, '').trim() || '...';
  const linkTitle = msg.link_title || '';

  console.log(`\n[回复] 用户: ${username}(${userId})`);
  console.log(`  帖子: ${postId} "${linkTitle.substring(0, 40)}"`);
  console.log(`  说: ${userMessage.substring(0, 60)}`);

  // 获取帖子详情
  let postContent = { title: linkTitle, content: '' };
  let images = [];

  if (postId) {
    try {
      const info = await api.getLinkInfo(postId);
      postContent = { title: info.title || linkTitle, content: info.content || '' };
      images = info.images || [];
      if (postContent.content) {
        console.log(`  帖子内容: ${(postContent.content || '').substring(0, 60)}`);
      }
    } catch (e) {
      console.log(`  [警告] 获取帖子详情失败: ${e.message}`);
    }
  }

  // 调用 AI
  console.log(`  [AI] 生成回复...`);
  const aiResult = await askAI(postContent, userMessage, images);
  const replyText = (aiResult.text || '').trim();
  console.log(`  [AI] 回复: ${replyText.substring(0, 80)} (${aiResult.tokens}t)`);

  if (!replyText) {
    console.log(`  [跳过] AI 返回为空`);
    return;
  }

  // 回复评论
  try {
    const rootId = msg.root_comment_id || commentId;
    const ok = await api.replyComment(postId, commentId, rootId, replyText);
    if (ok) {
      console.log(`  [✅] 已回复评论 ${commentId}`);

      // 记录到数据库（用户追踪）
      await db.logMention({
        user_id: userId,
        username,
        post_id: String(postId),
        comment_id: String(commentId),
      });
    } else {
      console.log(`  [❌] 回复失败`);
    }
  } catch (e) {
    console.log(`  [错误] 回复异常: ${e.message}`);
  }
}

async function poll() {
  console.log(`\n--- [轮询] ${new Date().toLocaleString()} ---`);
  try {
    const messages = await api.getMentions(0);
    if (!messages || messages.length === 0) {
      return;
    }

    console.log(`  发现 ${messages.length} 条消息`);

    for (const msg of messages) {
      try {
        await processMention(msg);
      } catch (e) {
        console.log(`  [错误] 处理消息失败: ${e.message}`);
      }
    }
  } catch (e) {
    console.log(`  [错误] 轮询失败: ${e.message}`);
  }
}

async function showStats() {
  console.log('\n========== 统计 ==========');
  const daily = await db.getDailyStats(7);
  if (daily.length > 0) {
    console.log('--- 近7天每日 ---');
    daily.forEach(r =>
      console.log(`  ${r.date} | ${r.total} 次 | ${r.unique_users} 人`)
    );
  }
  const hourly = await db.getHourlyStats(true);
  if (hourly.length > 0) {
    console.log('--- 今日每小时 ---');
    hourly.forEach(r =>
      console.log(`  ${r.hour}:00 | ${r.total} 次 | ${r.unique_users} 人`)
    );
  }
  console.log('========================\n');
}

async function main() {
  const config = loadConfig();
  console.log('========================================');
  console.log('  小黑盒 @机器人 v1.0');
  console.log('  公开模式 - 无需白名单');
  console.log(`  检测间隔: ${config.bot.checkInterval}s`);
  console.log(`  AI 模型: ${config.ai.model}`);
  console.log('========================================\n');

  await db.init();
  api.init(config);

  // 首次统计
  await showStats();

  // 主循环
  const runLoop = async () => {
    await poll();
    setTimeout(runLoop, config.bot.checkInterval * 1000);
  };

  await runLoop();
}

// 命令行支持
const args = process.argv.slice(2);
if (args.includes('--stats')) {
  (async () => { await db.init(); await showStats(); process.exit(0); })();
} else {
  main().catch(err => {
    console.error('[致命]', err);
    process.exit(1);
  });
}
