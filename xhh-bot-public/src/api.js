const crypto = require('crypto');

const RKEY = 'AB45STUVWZEFGJ6CH01D237IXYPQRKLMN89';

let config = null;
let cookieStr = '';

function init(cfg) {
  config = cfg;
  const c = config.cookie;
  const parts = [];
  if (c.user_pkey) parts.push(`user_pkey=${c.user_pkey}`);
  if (c.heybox_id) parts.push(`user_heybox_id=${c.heybox_id}`);
  if (c.x_xhh_tokenid) parts.push(`x_xhh_tokenid=${c.x_xhh_tokenid}`);
  cookieStr = parts.join(';');
}

// --- hkey 签名算法（从 xhhRobot 源码翻译） ---
function md5(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}

function av(str, key, n) {
  const sub = key.substring(0, key.length + n);
  let r = '';
  for (let i = 0; i < str.length; i++) r += sub[str.charCodeAt(i) % sub.length];
  return r;
}

function sv(str, key) {
  let r = '';
  for (let i = 0; i < str.length; i++) r += key[str.charCodeAt(i) % key.length];
  return r;
}

function Vm(n) { return n & 128 ? 255 & ((n << 1) ^ 27) : n << 1; }
function qm(n) { return Vm(n) ^ n; }
function _m(n) { return qm(Vm(n)); }
function Ym(n) { return _m(qm(Vm(n))); }
function Gm(n) { return Ym(n) ^ _m(n) ^ qm(n); }

function mixed(e) {
  return [
    Gm(e[0]) ^ Ym(e[1]) ^ _m(e[2]) ^ qm(e[3]),
    qm(e[0]) ^ Gm(e[1]) ^ Ym(e[2]) ^ _m(e[3]),
    _m(e[0]) ^ qm(e[1]) ^ Gm(e[2]) ^ Ym(e[3]),
    Ym(e[0]) ^ _m(e[1]) ^ qm(e[2]) ^ Gm(e[3]),
    e[4], e[5],
  ];
}

function NewStr(arr) {
  let r = '';
  for (let i = 0; i < arr[2].length; i++) {
    if (i < arr[0].length) r += arr[0][i];
    if (i < arr[1].length) r += arr[1][i];
    if (i < arr[2].length) r += arr[2][i];
  }
  return r;
}

function getNonce(_time) {
  const rand = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
  return md5(String(_time) + String(rand)).toUpperCase();
}

function getKeys(reqpath) {
  const _time = Math.floor(Date.now() / 1000);
  const nonce = getNonce(_time);
  const r = RKEY;
  const str1 = av(String(_time), r, -2);
  const str2 = sv(reqpath, r);
  const str3 = sv(nonce, r);
  const arr = [str1, str2, str3].sort((a, b) => a.length - b.length);
  const combined = NewStr(arr).substring(0, 20);
  const md5hex = md5(combined);
  const lastSixArr = md5hex.slice(-6).split('').map(c => c.charCodeAt(0));
  const mix = mixed(lastSixArr);
  const sum = mix.reduce((a, b) => a + b, 0);
  const code = String(sum % 100).padStart(2, '0');
  const s = av(md5hex.substring(0, 5), r, -4);
  return { hkey: s + code, nonce, time: _time };
}

// --- 请求封装 ---
async function request(method, path, options = {}) {
  const { hkey, nonce, time } = getKeys(path);
  const cfg = config.bot;

  const params = {
    os_type: 'web',
    app: 'web',
    client_type: 'web',
    version: cfg.version,
    web_version: cfg.webver,
    x_client_type: 'web',
    x_app: 'heybox_website',
    x_os_type: 'Windows',
    device_info: 'Chrome',
    device_id: cfg.deviceId || '',
    hkey,
    _time: String(time),
    nonce,
    _notip: 'true',
    ...(options.params || {}),
  };

  if (config.cookie.heybox_id) {
    params.heybox_id = config.cookie.heybox_id;
  }

  // 合并 extraQuery 中的参数
  if (options.extraQuery) {
    const qs = options.extraQuery.startsWith('?') ? options.extraQuery.slice(1) : options.extraQuery;
    for (const part of qs.split('&')) {
      const [k, ...v] = part.split('=');
      if (k && !params[k]) params[k] = v.join('=');
    }
  }

  const url = new URL(path, cfg.baseUrl);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const finalUrl = url.toString();

  const fetchOpts = {
    method,
    headers: {
      Cookie: cookieStr,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Referer: 'https://www.xiaoheihe.cn/',
      ...(options.headers || {}),
    },
  };

  if (options.body) {
    fetchOpts.headers['Content-Type'] = 'application/x-www-form-urlencoded;charset=utf-8';
    fetchOpts.body = options.body;
  }

  const res = await fetch(finalUrl, fetchOpts);
  const text = await res.text();
  try { return JSON.parse(text); }
  catch { return { raw: text }; }
}

// --- API 方法 ---
async function getMentions(offset = 0) {
  const extra = `?message_type=16&offset=${offset}&limit=20&no_more=false`;
  const data = await request('GET', '/bbs/app/user/message', { extraQuery: extra });
  if (data && data.result && data.result.messages) return data.result.messages;
  if (data && data.status === 'failed') console.log('[API] getMentions 失败:', data.msg);
  return [];
}

async function getLinkInfo(linkId) {
  const extra = `?h_src&link_id=${linkId}`;
  const data = await request('GET', '/bbs/app/link/tree', { extraQuery: extra });
  if (!data || data.status !== 'ok') return { title: '', content: '', images: [], topics: [], tags: [] };

  const link = data.result?.link;
  if (!link) return { title: '', content: '', images: [], topics: [], tags: [] };

  let contentParts = [];
  try { contentParts = JSON.parse(link.text || '[]'); }
  catch { contentParts = [{ type: 'text', text: link.text || '' }]; }

  const title = link.title || '';
  const images = contentParts.filter(p => p.type !== 'text' && p.type !== 'html').map(p => p.url);
  const textContent = contentParts
    .filter(p => p.type === 'text' || p.type === 'html')
    .map(p => (p.type === 'html' ? p.text.replace(/<[^>]+>/g, '') : p.text))
    .join('\n');

  return { title, content: textContent, images, topics: link.topics || [], tags: link.hashtags || [] };
}

async function replyComment(linkId, replyId, rootId, text) {
  const body = new URLSearchParams({
    is_cy: '',
    link_id: String(linkId),
    reply_id: String(replyId),
    root_id: String(rootId || replyId),
    text,
  });

  const data = await request('POST', '/bbs/app/comment/create', { body: body.toString() });
  if (data && data.status === 'ok') return true;
  if (data && data.status === 'failed') {
    console.log('[API] 回复失败:', data.msg, '(已标记)');
    return true;
  }
  return false;
}

module.exports = { init, getMentions, getLinkInfo, replyComment, request };
