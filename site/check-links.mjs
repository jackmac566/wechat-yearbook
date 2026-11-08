#!/usr/bin/env node
/**
 * 微信年轮官网自检脚本（零依赖，Node 18+）
 *
 * 检查内容：
 *  (a) 所有页面的 <a href> 相对链接指向存在的文件
 *      （site/downloads/** 目标为 expected-missing，DMG 放入后自动变为存在）
 *  (b) HTML 标签闭合（简单栈式校验）
 *  (c) 关键文案（SHA-256、未签名指引、「选中聊天」覆盖说明、已知限制等）
 *  (d) 无外部资源（CDN/字体/脚本）、无 <script>、无夸大承诺用语
 *
 * 用法：node site/check-links.mjs
 * 退出码：0 = 全部通过；1 = 存在错误
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, relative, sep } from 'node:path';

const SITE = dirname(fileURLToPath(import.meta.url));

let errors = 0;
let warnings = 0;
const report = [];
const expectedMissing = [];

function fail(msg) { errors++; report.push(`  ✗ ${msg}`); }
function warn(msg) { warnings++; report.push(`  ! ${msg}`); }
function ok(msg) { report.push(`  ✓ ${msg}`); }

/* ---------------- 收集页面 ---------------- */

const PAGES = readdirSync(SITE).filter((f) => f.endsWith('.html')).sort();
if (PAGES.length === 0) {
  console.error('✗ site/ 目录下没有 HTML 页面');
  process.exit(1);
}

/* ---------------- 工具 ---------------- */

const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

const TAG_RE = /<\/?([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)\s*(\/?)>/g;

function isExternalUrl(url) {
  return /^(?:https?:)?\/\//i.test(url);
}

/* ---------------- 逐页检查 ---------------- */

const pageTexts = {};

for (const page of PAGES) {
  const abs = join(SITE, page);
  const raw = readFileSync(abs, 'utf8');
  pageTexts[page] = raw;
  report.push(`\n【${page}】`);

  /* ---- (b) 标签闭合（栈式校验） ---- */
  const stack = [];
  let tagErr = false;
  let m;
  TAG_RE.lastIndex = 0;
  while ((m = TAG_RE.exec(raw)) !== null) {
    const full = m[0];
    const name = m[1].toLowerCase();
    const closing = full.startsWith('</');
    const selfClosed = m[3] === '/';
    if (closing) {
      const top = stack.pop();
      if (top !== name) {
        fail(`标签不匹配：期望 </${top}>，实际 </${name}>`);
        tagErr = true;
        break;
      }
    } else if (!selfClosed && !VOID_TAGS.has(name)) {
      stack.push(name);
    }
  }
  if (!tagErr) {
    if (stack.length > 0) fail(`有未闭合标签: ${stack.join(', ')}`);
    else ok('标签闭合检查通过');
  }

  /* ---- 基本结构 ---- */
  if (!/<title>[^<]+<\/title>/.test(raw)) fail('缺少 <title>');
  if (!/<html\s+lang="zh-CN"/.test(raw)) fail('缺少 lang="zh-CN"');
  if (!/href="assets\/site\.css"/.test(raw)) fail('未引用共享样式 assets/site.css');

  /* ---- 无脚本 ---- */
  if (/<script\b/i.test(raw)) fail('页面包含 <script>（要求零脚本）');

  /* ---- (a) 相对链接检查 ---- */
  const hrefRe = /<a\b[^>]*?href="([^"]+)"/gi;
  let am;
  while ((am = hrefRe.exec(raw)) !== null) {
    const href = am[1];
    if (/^(?:https?:|mailto:|javascript:|data:|tel:)/i.test(href)) continue; // 外部链接/其他协议
    const pathPart = href.split('#')[0];
    if (!pathPart) continue; // 纯锚点
    const target = resolve(SITE, pathPart);
    if (relative(SITE, target).startsWith('..')) {
      fail(`链接跳出 site 目录: ${href}`);
      continue;
    }
    if (existsSync(target)) continue;
    if (pathPart.replaceAll('\\', '/').startsWith('downloads/')) {
      expectedMissing.push(`${page} → ${href}`);
    } else {
      fail(`相对链接指向不存在的文件: ${href}`);
    }
  }

  /* ---- 外部链接白名单（仅提醒） ---- */
  const extRe = /<a\b[^>]*?href="(https?:\/\/[^"]+)"/gi;
  let em;
  while ((em = extRe.exec(raw)) !== null) {
    const u = em[1];
    const host = u.replace(/^https?:\/\//, '').split('/')[0];
    if (!['github.com', 'posts.tenpay.com'].includes(host)) {
      warn(`外部链接不在白名单: ${u}`);
    }
  }

  /* ---- 资源标签不得引用外部地址 ---- */
  const resRe = /<(?:link|script|img|iframe|video|audio|source|object|embed|track)\b[^>]*?>/gi;
  let rm;
  while ((rm = resRe.exec(raw)) !== null) {
    const tag = rm[0];
    const attr = /(?:href|src|data)\s*=\s*"([^"]+)"/i.exec(tag);
    if (attr && isExternalUrl(attr[1])) {
      fail(`资源标签引用外部地址: ${attr[1]}`);
    }
  }
}

/* ---------------- (c) 关键文案检查 ---------------- */

const COPY_CHECKS = [
  // 首页
  ['index.html', /V0\.5\.2/, '首页出现版本号 V0.5.2'],
  ['index.html', /0938d99054ca7ff259461f343072d5de7c4d4b1eb94be246de614c9427faa7e0/, '首页出现 SHA-256 校验值'],
  ['index.html', /临时签名/, '首页出现临时签名说明'],
  ['index.html', /右键/, '首页出现未签名指引（右键打开）'],
  ['index.html', /仍要打开/, '首页出现未签名指引（仍要打开）'],
  ['index.html', /macOS 14/, '首页出现系统要求 macOS 14+'],
  ['index.html', /Apple 芯片/, '首页出现 Apple 芯片要求'],
  ['index.html', /不是全账号年报/, '首页出现覆盖范围诚实说明'],
  ['index.html', /选中/, '首页出现「选中」覆盖说明'],
  ['index.html', /以支付账单为准/, '首页出现红包金额口径（以账单为准）'],
  ['index.html', /不上传/, '首页出现不上传承诺'],
  ['index.html', /不登录/, '首页出现不登录承诺'],
  ['index.html', /不联网分析/, '首页出现不联网分析承诺'],
  ['index.html', /隐藏昵称/, '首页出现分享图脱敏说明'],
  ['index.html', /观察区间/, '首页出现年报故事观察区间说明'],
  ['index.html', /releases\/download\/v0\.5\.2\/WeChat-Yearbook-0\.5\.2-mac-arm64\.dmg/, '首页出现 DMG 下载链接'],
  ['index.html', /jackmac566\/wechat-yearbook/, '首页出现 GitHub 仓库链接'],
  ['index.html', /最活跃的一天/, '首页出现聊天能力（最活跃的一天）'],
  ['index.html', /最长连续/, '首页出现聊天能力（最长连续活跃）'],
  ['index.html', /最常出现的时段/, '首页出现聊天能力（最常出现的时段）'],
  ['index.html', /双向会话排行/, '首页出现聊天能力（双向会话排行）'],
  ['index.html', /四类汇总/, '首页出现红包四类汇总'],
  ['index.html', /按日期查询发出的红包/, '首页出现按日期查发出红包'],
  ['index.html', /重新导入/, '首页诚实区出现升级后重新导入限制'],
  ['index.html', /无法逆推/, '首页诚实区出现方向字段限制'],
  ['index.html', /无法恢复/, '首页诚实区出现删除记录限制'],
  ['index.html', /朋友圈/, '首页出现朋友圈说明'],
  // 使用指南
  ['guide.html', /合并转发/, '指南出现合并转发'],
  ['guide.html', /其他应用/, '指南出现「其他应用」步骤'],
  ['guide.html', /发送到自定义/, '指南出现微信流「发送到自定义」'],
  ['guide.html', /渡口/, '指南出现渡口暂存'],
  ['guide.html', /下载账单/, '指南出现账单下载步骤'],
  ['guide.html', /用于个人对账/, '指南出现账单用途（用于个人对账）'],
  ['guide.html', /为什么不是全账号年报/, '指南 FAQ 出现「为什么不是全账号年报」'],
  ['guide.html', /覆盖范围怎么看/, '指南 FAQ 出现「覆盖范围怎么看」'],
  ['guide.html', /数据会去哪里/, '指南 FAQ 出现「数据会去哪里」'],
  ['guide.html', /升级后需要重新导入/, '指南 FAQ 出现升级后重新导入'],
  ['guide.html', /彻底删除/, '指南 FAQ 出现已删除记录说明'],
  ['guide.html', /isOwn/, '指南出现朋友圈归属字段（isOwn）'],
  ['guide.html', /实验功能/, '指南出现朋友圈实验功能说明'],
  // 隐私
  ['privacy.html', /不登录/, '隐私页出现不登录'],
  ['privacy.html', /不上传/, '隐私页出现不上传'],
  ['privacy.html', /不联网分析/, '隐私页出现不联网分析'],
  ['privacy.html', /脱敏分享图/, '隐私页出现脱敏分享图'],
  ['privacy.html', /JSON 备份/, '隐私页出现含原文 JSON 备份'],
  ['privacy.html', /不扫描微信进程/, '隐私页出现不扫描微信进程'],
  ['privacy.html', /不读取微信本地数据库/, '隐私页出现不读取数据库'],
  ['privacy.html', /不提取任何密钥/, '隐私页出现不提取密钥'],
  ['privacy.html', /MIT/, '隐私页出现 MIT 开源'],
  ['privacy.html', /npm audit/, '隐私页出现依赖审计'],
  ['privacy.html', /SHA-256/, '隐私页出现 SHA-256 校验'],
  // 更新日志
  ['changelog.html', /V0\.5\.2/, '日志出现 V0.5.2'],
  ['changelog.html', /V0\.5\.1/, '日志出现 V0.5.1'],
  ['changelog.html', /V0\.5\.0/, '日志出现 V0.5.0'],
  ['changelog.html', /V0\.4\.0/, '日志出现 V0.4.0'],
  ['changelog.html', /V0\.3\.0/, '日志出现 V0.3.0'],
  ['changelog.html', /红包标记/, '日志 V0.5.2 出现红包标记'],
  ['changelog.html', /按日期查询发出的红包明细/, '日志 V0.5.2 出现按日期查红包'],
  ['changelog.html', /账单获取指引/, '日志 V0.5.2 出现账单指引入口'],
  ['changelog.html', /热图/, '日志 V0.5.1 出现热图优化'],
  ['changelog.html', /文件接收/, '日志 V0.5.0 出现 macOS 文件接收'],
  ['changelog.html', /八个板块/, '日志 V0.4.0 出现八个板块'],
  ['changelog.html', /合并转发/, '日志 V0.3.0 出现合并转发 ZIP 导入'],
];

report.push('\n【关键文案】');
for (const [page, re, label] of COPY_CHECKS) {
  if (re.test(pageTexts[page])) ok(label);
  else fail(`${page}: 缺少关键文案「${label}」`);
}

/* ---------------- 禁止出现的夸大承诺 ---------------- */

report.push('\n【禁止用语】');
const FORBIDDEN = [
  [/完整统计/, '完整统计'],
  [/100%/, '100%'],
  [/完整覆盖/, '完整覆盖'],
];
let forbiddenFound = false;
for (const page of PAGES) {
  for (const [re, label] of FORBIDDEN) {
    if (re.test(pageTexts[page])) {
      fail(`${page}: 出现禁止用语「${label}」`);
      forbiddenFound = true;
    }
  }
  // 「全账号年报」只能出现在「不是全账号年报」的否定语境
  const withoutNegation = pageTexts[page].replace(/不是全账号年报/g, '');
  if (/全账号年报/.test(withoutNegation)) {
    fail(`${page}: 「全账号年报」出现在否定语境之外`);
    forbiddenFound = true;
  }
}
if (!forbiddenFound) ok('未发现夸大承诺用语');

/* ---------------- 样式表检查 ---------------- */

report.push('\n【共享样式 assets/site.css】');
const cssPath = join(SITE, 'assets', 'site.css');
if (!existsSync(cssPath)) {
  fail('assets/site.css 不存在');
} else {
  const css = readFileSync(cssPath, 'utf8');
  if (/@import/i.test(css)) fail('CSS 包含 @import（外部加载）');
  else if (/url\s*\(/i.test(css)) fail('CSS 包含 url()（外部资源）');
  else if (/https?:\/\//i.test(css)) fail('CSS 包含外部 URL');
  else ok('CSS 无外部资源引用');
}

/* ---------------- 汇总 ---------------- */

report.push('\n【expected-missing（DMG 由 GitHub Releases 承载，链接为外部地址）】');
if (expectedMissing.length > 0) {
  for (const em of expectedMissing) report.push(`  · ${em}`);
} else {
  report.push('  · 无（DMG 已存在或没有下载链接）');
}

console.log(report.join('\n'));

const summary = `\n========== 自检结果：${errors} 个错误，${warnings} 个提醒 ==========`;
console.log(summary);
if (errors > 0) {
  console.error('自检未通过');
  process.exit(1);
} else {
  console.log('自检通过 ✓');
}
