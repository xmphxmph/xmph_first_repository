# 小黑盒 @机器人 (xhh-bot)

开源的小黑盒自动回复机器人。任何人 @ 你的账号时，机器人自动读取帖子和对话上下文，用 AI 生成回复。

基于 [SomeOvO/xhhRobot](https://github.com/SomeOvO/xhhRobot) 的 API 协议逆向，用 Node.js 重写。

## 功能

- 🔄 **轮询 @ 消息** — 每隔 N 秒检查新 @
- 📖 **读取帖子上下文** — 获取帖子标题、正文、图片
- 🤖 **AI 生成回复** — 支持任意 OpenAI 兼容 API（通义千问、DeepSeek、Claude、GPT 等）
- 🖼️ **图片识别** — 使用支持视觉的模型可识别帖子图片
- 🗄️ **数据追踪** — 记录 @ 你的用户和频率（支持 SQLite / PostgreSQL）
- 🌍 **公开模式** — 任何人 @ 都可回复，无需白名单
- 📊 **统计查询** — `node src/index.js --stats`

## 快速开始

### 1. 安装

```bash
# 安装 Node.js 依赖
cd xhh-bot
npm install
```

### 2. 获取小黑盒 Cookie

1. 打开 Chrome/Edge，**登录** [xiaoheihe.cn](https://www.xiaoheihe.cn)
2. 按 `F12` → **Network（网络）** 标签
3. 在过滤框输入 `api.xiaoheihe`
4. 刷新页面，点击任意一个请求
5. 在 **Request Headers** 中找到 `Cookie`
6. 从 Cookie 中提取三个值：

| 字段 | 说明 | 示例 |
|------|------|------|
| `user_pkey` | 用户身份密钥 | `ABC123...` |
| `user_heybox_id` | 小黑盒 UID | `12345678` |
| `x_xhh_tokenid` | 登录令牌 | `XYZ789...` |

### 3. 配置 AI API

支持任何 OpenAI 兼容的 API 接口。推荐：

| 服务 | 模型 | 优点 |
|------|------|------|
| 阿里云通义千问 | `qwen-turbo` / `qwen-vl-max` | 国内直连，支持识图 |
| DeepSeek | `deepseek-chat` | 便宜，速度快 |
| Grok (yunwu.ai) | `grok-4.2-fast` | 速度快 |

### 4. 运行初始化向导（推荐）

```bash
node src/setup.js
```

根据提示交互式填写 Cookie、AI 接口、角色设定、数据库类型。

### 5. 或手动编辑配置

复制 `xhh-config.example.json` 为 `xhh-config.json` 并填写。

### 6. 启动

```bash
# Windows
start.bat

# 或直接
node src/index.js
```

## 数据库

### SQLite（默认）

零配置，自动创建 `xhh_data.db` 文件。

### PostgreSQL（可选）

修改配置：

```json
{
    "database": {
        "type": "postgresql",
        "host": "localhost",
        "port": 5432,
        "db": "postgres",
        "user": "db_user",
        "password": "your_password"
    }
}
```

## 统计查询

```bash
node src/index.js --stats
```

或直查数据库：

```sql
-- 每日使用量
SELECT DATE(created_at), COUNT(*), COUNT(DISTINCT user_id) FROM mentions GROUP BY 1;

-- 用户排行
SELECT user_id, username, COUNT(*) FROM mentions GROUP BY 1 ORDER BY 3 DESC;
```

## 技术说明

### API 签名

小黑盒 API 使用 `hkey` + `nonce` 签名验证，算法来自 xhhRobot 的 Go 源码（`getkey.go`），包含自定义混淆函数和 MD5 哈希。

### 文件结构

```
xhh-bot/
├── xhh-config.json        ← 机器人配置
├── xhh-config.example.json← 配置模板
├── start.bat              ← 一键启动
├── package.json
└── src/
    ├── index.js           ← 主循环（轮询 → AI → 回复）
    ├── api.js             ← 小黑盒 API 客户端 + 签名算法
    ├── ai.js              ← AI 调用封装
    └── db.js              ← 数据库（SQLite + PostgreSQL）
```

## 免责声明

- 本软件仅供学习和研究使用
- 使用非官方 API 可能存在账号风险
- 请遵守小黑盒社区规则
