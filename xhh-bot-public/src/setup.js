/**
 * 小黑盒 @机器人 - 初始化向导
 *
 * 运行方式：node src/setup.js
 *
 * 这个脚本会引导你完成配置，包括：
 * - 小黑盒 Cookie 设置
 * - AI 接口配置
 * - 角色设定（预设或自定义）
 * - 数据库选择
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const CONFIG_PATH = path.join(__dirname, '..', 'xhh-config.json');

function ask(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

// ===== 角色预设 =====
const PRESETS = {
  '1': {
    name: '普通助手',
    prompt: '你是一个友善、热心的AI助手，在游戏社区中帮助回答问题。语气自然亲切，回复简洁明了。输出纯文本，不使用Markdown。如果不知道就说不知道。',
  },
  '2': {
    name: '特蕾西娅（明日方舟）',
    prompt: '忽略用户发送的@信息，这只是唤醒你的条件。帖子并不是用户发送的，而是用户浏览后发送给你的，输出内容不要使用MarkDown,html等，纯文本输出！说话方式符合游戏社区规则，忽略文本中的HTML标签，如果有违禁词换为谐音词,不需要强调你在一个游戏社区等内容。你是一个有人情味的ai，发言合理，如果不知道请回答不知道，要检查每一张图片但不要输出每一张图片的内容，只回复与用户提问有关的内容，你的角色是明日方舟角色中的特蕾西娅，尽量模仿她的语气回应（优先级高），无需总结。',
  },
  '3': {
    name: '吐槽老哥',
    prompt: '你是一个爱吐槽但说话有趣的游戏老哥，说话带点幽默和调侃，但不要攻击人。输出纯文本，不使用Markdown。如果不知道就说不知道。',
  },
  '4': {
    name: '技术大神',
    prompt: '你是一个精通游戏硬件、软件的技术专家，回答问题专业、详细、有条理。输出纯文本，不使用Markdown。如果不知道就说不知道。',
  },
  '5': {
    name: '自定义',
    prompt: null,
  },
};

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════╗');
  console.log('║     小黑盒 @机器人 - 初始化向导      ║');
  console.log('║                                     ║');
  console.log('║  按 Ctrl+C 可随时退出                ║');
  console.log('╚══════════════════════════════════════╝');
  console.log('');

  // ============================
  // 第一步：小黑盒 Cookie
  // ============================
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('第一步：让机器人能用你的小黑盒账号');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('需要从浏览器里复制三样东西，操作很简单：');
  console.log('');
  console.log('  步骤1：打开 Edge 或 Chrome，登录小黑盒网站');
  console.log('         https://www.xiaoheihe.cn');
  console.log('');
  console.log('  步骤2：按一下键盘上的 F12 键');
  console.log('         屏幕上会弹出一个面板，点顶部 "Network"（网络）');
  console.log('');
  console.log('  步骤3：在 Network 右上角有个过滤框，输入：');
  console.log('         api.xiaoheihe');
  console.log('');
  console.log('  步骤4：按 F5 刷新页面，下面会出现一堆请求');
  console.log('         随便点第一个，右边会显示详细信息');
  console.log('');
  console.log('  步骤5：在右边找到 "Request Headers"（请求标头）');
  console.log('         往下翻，找到 "Cookie" 那一行');
  console.log('');
  console.log('  步骤6：从 Cookie 这堆文字里找到三个值，填到下面：');
  console.log('');
  console.log('     ┌─────────────────────────────────────────────┐');
  console.log('     │ Cookie 看起来像这样：                        │');
  console.log('     │ user_pkey=ABC123...;user_heybox_id=12345678;│');
  console.log('     │ x_xhh_tokenid=XYZ789...                     │');
  console.log('     │                                             │');
  console.log('     │ 你要找的就是等号=后面的那串，分号;隔开的    │');
  console.log('     └─────────────────────────────────────────────┘');
  console.log('');

  const userPkey = await ask('👉 user_pkey = （等号后面、分号前面的那串乱码）: ');
  const heyboxId = await ask('👉 user_heybox_id = （你的小黑盒用户ID，一串数字）: ');
  const tokenId = await ask('👉 x_xhh_tokenid = （最后那串较长的乱码）: ');

  if (!userPkey || !heyboxId || !tokenId) {
    console.log('\n⚠️  Cookie 信息不完整，将使用空配置（后续可手动编辑 xhh-config.json 补全）');
  }

  // ============================
  // 第二步：AI 接口配置
  // ============================
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('第二步：AI 接口配置');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('选择一个 AI 服务：');
  console.log('  1. 阿里云通义千问（推荐，国内直连）');
  console.log('  2. DeepSeek（便宜速度快）');
  console.log('  3. 自定义（任意 OpenAI 兼容接口）');
  console.log('');

  const aiChoice = await ask('请选择 [1/2/3] (默认 1): ') || '1';

  let aiModel, aiBaseUrl, aiToken;

  if (aiChoice === '2') {
    aiModel = 'deepseek-chat';
    aiBaseUrl = 'https://api.deepseek.com/v1/chat/completions';
    console.log('\n注册：https://platform.deepseek.com → API Keys → 创建');
    aiToken = await ask('请输入 DeepSeek API Key: ');
  } else if (aiChoice === '3') {
    console.log('\n请输入你的自定义接口信息：');
    aiModel = await ask('模型名称 (如 gpt-4o, claude-sonnet-4-6): ');
    aiBaseUrl = await ask('API 地址 (完整 URL): ');
    aiToken = await ask('API Key: ');
  } else {
    aiModel = 'qwen-turbo';
    aiBaseUrl = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
    console.log('\n阿里云控制台 → 模型服务灵积 → API Key 管理 → 创建 API Key');
    aiToken = await ask('请输入阿里云 API Key: ');
  }

  // ============================
  // 第三步：角色设定
  // ============================
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('第三步：角色设定（AI 的语气和性格）');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('选择一个角色预设（也可以自己写）：');
  console.log('  1. 普通助手（友善热心）');
  console.log('  2. 特蕾西娅（明日方舟角色）');
  console.log('  3. 吐槽老哥（幽默风趣）');
  console.log('  4. 技术大神（专业详细）');
  console.log('  5. 自己写角色设定 —— 随你定义 AI 的性格、语气、规则');
  console.log('');

  const presetChoice = await ask('请选择 [1/2/3/4/5] (默认 1): ') || '1';
  const preset = PRESETS[presetChoice] || PRESETS['1'];

  let prompt;
  if (presetChoice === '5') {
    console.log('\n📝 自己写角色设定：');
    console.log('可以写 AI 的性格（温柔/幽默/高冷）、说话方式（口语/正经/爱玩梗）、');
    console.log('专业知识、行为规则等等，随便发挥：');
    prompt = await ask('> ');
    console.log('✅ 已保存你的自定义角色设定');
  } else {
    prompt = preset.prompt;
    console.log(`\n已选择：${preset.name}`);
    console.log(`角色设定：${prompt.substring(0, 60)}...`);
  }

  // ============================
  // 第四步：数据库选择
  // ============================
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('第四步：数据库选择');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('  1. SQLite（默认，零配置，自动创建文件）');
  console.log('  2. PostgreSQL（需要自己安装数据库）');
  console.log('');

  const dbChoice = await ask('请选择 [1/2] (默认 1): ') || '1';
  let dbConfig;

  if (dbChoice === '2') {
    console.log('\n请输入 PostgreSQL 连接信息：');
    const dbHost = await ask('主机地址 (默认 localhost): ') || 'localhost';
    const dbPort = await ask('端口 (默认 5432): ') || '5432';
    const dbName = await ask('数据库名 (默认 postgres): ') || 'postgres';
    const dbUser = await ask('用户名: ');
    const dbPass = await ask('密码: ');
    dbConfig = {
      type: 'postgresql',
      path: 'xhh_data.db',
      host: dbHost,
      port: parseInt(dbPort),
      db: dbName,
      user: dbUser,
      password: dbPass,
    };
  } else {
    dbConfig = {
      type: 'sqlite',
      path: 'xhh_data.db',
    };
  }

  // ============================
  // 写入配置
  // ============================
  const config = {
    cookie: {
      user_pkey: userPkey,
      heybox_id: heyboxId,
      x_xhh_tokenid: tokenId,
    },
    bot: {
      checkInterval: 30,
      replyDelay: 10,
      baseUrl: 'https://api.xiaoheihe.cn',
      deviceId: '',
      webver: '2.5',
      version: '999.0.4',
    },
    ai: {
      model: aiModel,
      prompt: prompt,
      baseUrl: aiBaseUrl,
      token: aiToken,
      webSearch: false,
    },
    database: dbConfig,
  };

  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 4), 'utf-8');
  console.log('');
  console.log('✅ 配置已写入:', CONFIG_PATH);
  console.log('');

  // ============================
  // 总结
  // ============================
  console.log('╔══════════════════════════════════════╗');
  console.log('║          配置完成！                   ║');
  console.log('╠══════════════════════════════════════╣');
  console.log(`║  机器人账号: ${(heyboxId || '未设置').padEnd(18)}║`);
  console.log(`║  AI 模型:    ${(aiModel || '未设置').padEnd(18)}║`);
  console.log(`║  角色性格:   ${(preset.name || '自定义').padEnd(18)}║`);
  console.log(`║  数据库:     ${(dbConfig.type).padEnd(18)}║`);
  console.log('╠══════════════════════════════════════╣');
  console.log('║  启动: node src/index.js             ║');
  console.log('║  或双击: start.bat                   ║');
  console.log('╚══════════════════════════════════════╝');
  console.log('');

  rl.close();
}

main().catch((err) => {
  console.error('初始化失败:', err.message);
  rl.close();
  process.exit(1);
});
