import React, { useMemo, useRef, useState } from "react";
import { analyze, availableYears, coverage } from "./lib/analytics.js";
import { mergeDatasets, parseImport } from "./lib/parser.js";
import { serializeDataset } from "./lib/export.js";
import { demoDataset } from "./data/demo.js";
import StoryReport from "./components/StoryReport.jsx";
import { APP_VERSION } from "./version.js";

const icons = {
  story: "M5 4.5A2.5 2.5 0 0 1 7.5 2H20v17H7.5A2.5 2.5 0 0 0 5 21.5v-17Zm0 0v17M9 7h7m-7 4h7",
  overview: "M4 13h6V4H4v9Zm10 7h6v-9h-6v9ZM4 20h6v-3H4v3Zm10-13h6V4h-6v3Z",
  chat: "M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z",
  people: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m7-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 10v-2a4 4 0 0 0-3-3.87m-2-11.96a4 4 0 0 1 0 7.75",
  moments: "M12 3a9 9 0 1 0 9 9M12 3a9 9 0 0 1 9 9m-9-9c3.3 2.4 4.8 5.4 4.5 9M12 3C8.7 5.4 7.2 8.4 7.5 12m9 0c-.3 3-1.8 6-4.5 9m-4.5-9c.3 3 1.8 6 4.5 9M3 12h18",
  money: "M12 1v22m5-18.5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  data: "M12 2C7.6 2 4 3.8 4 6s3.6 4 8 4 8-1.8 8-4-3.6-4-8-4Zm-8 4v6c0 2.2 3.6 4 8 4s8-1.8 8-4V6M4 12v6c0 2.2 3.6 4 8 4s8-1.8 8-4v-6",
  updates: "M4 5h16M4 12h10M4 19h13m3-10v6m-3-3h6",
  upload: "M12 16V4m0 0L7 9m5-5 5 5M4 20h16",
  shield: "M12 22s8-3.5 8-10V5l-8-3-8 3v7c0 6.5 8 10 8 10Zm-3-10 2 2 4-5",
  share: "M18 8a3 3 0 1 0-2.83-4M6 14a3 3 0 1 0 0-4m12 10a3 3 0 1 0 0-4M8.6 11.5l6.8-4m-6.8 5 6.8 4",
  spark: "m12 3 1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7L12 3Zm7 11 .8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14Z",
};

function Icon({ name, size = 20 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill={name === "overview" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={icons[name]} /></svg>;
}

const nav = [
  ["story", "年报故事"], ["overview", "详细总览"], ["chat", "聊天轨迹"], ["people", "关系温度"],
  ["moments", "朋友圈"], ["money", "红包与转账"], ["data", "数据与隐私"], ["updates", "更新日志"],
];

const typeLabels = { text: "文字", image: "图片", voice: "语音", sticker: "表情", video: "视频", link: "链接", file: "文件", poke: "拍一拍", call: "通话", red_packet: "红包", transfer: "转账", system: "系统" };
const typeColors = { text: "#13966f", image: "#65c6a7", voice: "#f0b658", sticker: "#8c7ae6", video: "#ef7b73", link: "#5b8def", file: "#96a0aa", poke: "#ec8bb5", call: "#2aa6b7" };
const compact = new Intl.NumberFormat("zh-CN", { notation: "compact", maximumFractionDigits: 1 });
const number = new Intl.NumberFormat("zh-CN");
const emptyDataset = {
  source: "尚未导入",
  messages: [], payments: [], moments: [],
  confidence: { messages: "missing", payments: "missing", moments: "missing" },
  warnings: [],
};

function App() {
  const [dataset, setDataset] = useState(emptyDataset);
  const years = availableYears(dataset);
  const [year, setYear] = useState(years[0] || new Date().getFullYear());
  const [active, setActive] = useState("story");
  const [showImport, setShowImport] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [notice, setNotice] = useState("");
  const fileRef = useRef(null);
  const stats = useMemo(() => analyze(dataset, year), [dataset, year]);
  const quality = useMemo(() => coverage(dataset, year), [dataset, year]);
  const hasData = dataset.messages.length + dataset.payments.length + dataset.moments.length > 0;
  const isDemo = dataset.source === "演示数据";

  const handleFiles = async (files) => {
    if (!files?.length) return;
    let next = !hasData || isDemo ? { ...emptyDataset, source: "" } : dataset;
    const failures = [];
    for (const file of files) {
      try {
        const parsed = parseImport(file.name, await file.text());
        next = next.source ? mergeDatasets(next, parsed) : parsed;
      } catch (error) {
        failures.push(`${file.name}：${error.message}`);
      }
    }
    if (next.source) {
      setDataset(next);
      const nextYears = availableYears(next);
      if (nextYears.length) setYear(nextYears[0]);
      setActive("story");
      setNotice(`已在本机读取 ${files.length - failures.length} 个文件${failures.length ? `；${failures.length} 个未识别` : ""}`);
      setShowImport(false);
      window.setTimeout(() => setNotice(""), 4500);
    }
    if (failures.length) window.alert(failures.join("\n"));
  };

  const go = (key) => {
    setActive(key);
    document.querySelector(".content-scroll")?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openDemo = () => {
    setDataset(demoDataset);
    setYear(2025);
    setActive("story");
    setNotice("已进入演示模式，页面中的数字均为模拟数据");
    window.setTimeout(() => setNotice(""), 4500);
  };

  const exportDataset = () => {
    if (!hasData) return;
    const confirmed = window.confirm("标准 JSON 会包含联系人和聊天内容，适合自己备份或对接工具，不适合直接公开。继续导出吗？");
    if (!confirmed) return;
    const blob = new Blob([serializeDataset(dataset)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `微信年轮-标准数据-${year}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setNotice("已导出微信年轮标准 JSON，请不要把原始数据公开上传");
    window.setTimeout(() => setNotice(""), 4500);
  };

  return (
    <div className={`app-shell ${hasData && active === "story" ? "story-mode" : ""}`}>
      {hasData && active === "story" ? <StoryReport stats={stats} quality={quality} years={years} year={year} isDemo={isDemo} onYear={setYear} onDetail={() => go("overview")} onImport={() => setShowImport(true)} onShare={() => setShowShare(true)} /> : <>
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark"><i /><i /></span><span><b>微信年轮</b><small>WECHAT YEARBOOK</small></span></div>
        <nav>{nav.map(([key, label]) => <button key={key} className={active === key ? "active" : ""} onClick={() => go(key)}><Icon name={key} /><span>{label}</span>{key === "data" && dataset.source === "演示数据" ? <em /> : null}</button>)}</nav>
        <div className="side-privacy"><Icon name="shield" size={18} /><div><b>数据仅在本机</b><span>不登录 · 不上传 · 不联网分析</span></div></div>
        <button className="side-version" onClick={() => go("updates")}>当前版本 V{APP_VERSION} · 查看更新记录</button>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div><h1>{nav.find(([key]) => key === active)?.[1]}</h1><p>{!hasData ? "尚未读取任何真实文件，先按向导获取数据" : isDemo ? "演示模式 · 当前数字不代表任何真实账号" : `正在分析：${dataset.source}`}</p></div>
          <div className="top-actions">
            {active === "updates" ? <span className="current-release">CURRENT · V{APP_VERSION}</span> : <>
            {hasData && <label className="year-select"><span>分析年份</span><select value={year} onChange={(e) => setYear(Number(e.target.value))}>{years.map((item) => <option key={item}>{item}</option>)}</select></label>}
            {!hasData && <button className="ghost-button" onClick={openDemo}><Icon name="spark" size={17} />查看演示</button>}
            {hasData && <button className="ghost-button" onClick={() => setShowShare(true)}><Icon name="share" size={17} />生成年报卡片</button>}
            <button className="primary-button" onClick={() => setShowImport(true)}><Icon name="upload" size={17} />导入数据</button>
            </>}
          </div>
        </header>

        <div className="content-scroll">
          {isDemo && <div className="demo-banner"><span><Icon name="spark" size={17} /><b>演示模式</b>：当前所有姓名、消息数、红包与朋友圈数字均为模拟数据</span><button onClick={() => setShowImport(true)}>导入真实文件 →</button></div>}
          {!hasData && active !== "data" && active !== "updates" && <WelcomePage onImport={() => setShowImport(true)} onDemo={openDemo} />}
          {hasData && active === "overview" && <Overview stats={stats} quality={quality} onImport={() => setShowImport(true)} />}
          {hasData && active === "chat" && <ChatPage stats={stats} />}
          {hasData && active === "people" && <PeoplePage stats={stats} />}
          {hasData && active === "moments" && <MomentsPage stats={stats} confidence={quality.moments.level} />}
          {hasData && active === "money" && <MoneyPage stats={stats} confidence={quality.payments.level} />}
          {active === "data" && <DataPage dataset={dataset} quality={quality} year={year} onImport={() => setShowImport(true)} onExport={exportDataset} onReset={() => { setDataset(emptyDataset); setYear(new Date().getFullYear()); setNotice("已清除本次导入，当前没有任何统计数据"); }} />}
          {active === "updates" && <ChangelogPage />}
          <footer>微信年轮不会上传、出售或训练你的聊天数据。统计结论仅取决于你导入的数据覆盖范围。</footer>
        </div>
      </main>
      </>}

      {showImport && <ImportModal onClose={() => setShowImport(false)} fileRef={fileRef} onFiles={handleFiles} />}
      {showShare && <ShareModal stats={stats} quality={quality} onClose={() => setShowShare(false)} />}
      {notice && <div className="toast"><span>✓</span>{notice}</div>}
    </div>
  );
}

function WelcomePage({ onImport, onDemo }) {
  return <div className="welcome-page">
    <section className="welcome-hero"><span className="safe-chip"><Icon name="shield" size={15} />当前没有读取任何微信数据</span><h2>先找到文件，<br/>再生成属于你的微信年轮。</h2><p>这里不会自动填充“看起来像真的”统计。只有你主动选择本机文件后，年度消息、红包、朋友圈等数字才会出现。</p><div><button className="primary-button welcome-primary" onClick={onImport}><Icon name="upload" size={18} />查看文件获取与上传步骤</button><button className="ghost-button" onClick={onDemo}><Icon name="spark" size={17} />只查看演示效果</button></div><small>导入文件只在当前浏览器内读取，不会发送到网站服务器。</small></section>
    <section className="source-readiness">
      <article className="ready"><span><Icon name="money" /></span><div><em>最容易</em><h3>微信支付账单</h3><p>手机微信可以申请个人对账 CSV，红包与转账金额最准确。</p></div><b>推荐先导入</b></article>
      <article className="advanced"><span><Icon name="chat" /></span><div><em>需电脑工具</em><h3>聊天记录</h3><p>微信没有直接导出 CSV/JSON 按钮，需要先同步到电脑并使用兼容导出工具。</p></div><b>进阶操作</b></article>
      <article className="limited"><span><Icon name="moments" /></span><div><em>覆盖有限</em><h3>朋友圈记录</h3><p>国内版微信没有简单完整导出入口，只能按本机缓存或兼容工具读取。</p></div><b>实验功能</b></article>
    </section>
    <section className="honesty-card"><Icon name="spark" /><div><b>为什么不直接展示一堆数字？</b><p>因为没有文件就没有真实统计。演示只能说明界面长什么样，不能冒充用户的微信记录。</p></div></section>
  </div>;
}

function Overview({ stats, quality, onImport }) {
  const maxMonth = Math.max(...stats.monthCounts, 1);
  const typeEntries = Object.entries(stats.typeCounts).filter(([key]) => key !== "revoke").sort((a, b) => b[1] - a[1]).slice(0, 5);
  const totalTypes = typeEntries.reduce((s, [, count]) => s + count, 0) || 1;
  const stops = typeEntries.reduce((result, [key, count]) => {
    const end = result.end + (count / totalTypes) * 100;
    return { end, values: [...result.values, `${typeColors[key] || "#aab3ae"} ${result.end}% ${end}%`] };
  }, { end: 0, values: [] }).values.join(", ");
  return <div className="page-grid">
    <section className="hero-card">
      <div className="hero-orbit one" /><div className="hero-orbit two" />
      <div className="hero-copy"><span className="eyebrow">{stats.year} · YOUR YEAR IN WECHAT</span><h2>这一年，你发出了<br/><strong>{number.format(stats.sent)}</strong> 条消息</h2><p>那些随手发出的“收到”“哈哈哈”和深夜长谈，<br/>拼出了你这一年的社交年轮。</p><div className="hero-pills"><span><b>{stats.activeDays}</b> 个活跃日</span><span>最长连续 <b>{stats.streak}</b> 天</span><span>最常在 <b>{String(stats.peakHour).padStart(2, "0")}:00</b> 出现</span></div></div>
      <div className="year-ring"><div><span>{stats.year}</span><small>微信年轮</small></div></div>
    </section>

    <div className="metric-row">
      <Metric tone="mint" label="亲手撤回" value={stats.ownRevokes} unit="条" note="仅统计仍有撤回痕迹的记录" status="可检测" />
      <Metric tone="sand" label="已知删除" value={stats.knownDeleted} unit="条" note="彻底删除且无痕的无法恢复" status="有条件" />
      <Metric tone="lilac" label="朋友圈足迹" value={stats.momentsPosts} unit="条" note={`另有 ${stats.momentsComments} 条评论 · ${stats.momentsLikes} 次点赞`} status="依赖覆盖" />
      <Metric tone="coral" label="发出红包" value={stats.redSentCount} unit="个" note={`合计 ¥${stats.redSentAmount}`} status="账单准确" />
    </div>

    <section className="panel chart-panel"><PanelHead title="消息在一年里流动" subtitle="每月由你发出的消息数" badge="12 个月" />
      <div className="month-chart">{stats.monthCounts.map((count, index) => <div className="month-col" key={index}><span className="bar-value">{count ? compact.format(count) : ""}</span><div className="bar-track"><i style={{ height: `${Math.max(5, (count / maxMonth) * 100)}%` }} /></div><b>{index + 1}月</b></div>)}</div>
    </section>

    <section className="panel type-panel"><PanelHead title="你的表达方式" subtitle="不只是文字" />
      <div className="type-body"><div className="donut" style={{ background: `conic-gradient(${stops || "#dfe8e4 0 100%"})` }}><div><strong>{compact.format(stats.sent)}</strong><span>发送总量</span></div></div><div className="type-list">{typeEntries.map(([key, count]) => <div key={key}><i style={{ background: typeColors[key] || "#aab3ae" }} /><span>{typeLabels[key] || key}</span><b>{number.format(count)}</b><em>{Math.round((count / totalTypes) * 100)}%</em></div>)}</div></div>
    </section>

    <section className="panel contacts-panel"><PanelHead title="常亮的对话框" subtitle="发送消息最多的会话" link="查看关系温度" />
      <div className="contact-list">{stats.topContacts.slice(0, 5).map((item, index) => <div className="contact-item" key={item.name}><span className={`avatar av-${index}`}>{item.name.slice(0, 1)}</span><div><b>{item.name}</b><span><i style={{ width: `${Math.max(8, item.share * 2.8)}%` }} /></span></div><strong>{number.format(item.count)}<small> 条</small></strong></div>)}</div>
    </section>

    <section className="panel coverage-panel"><PanelHead title="这份年报有多完整？" subtitle="每个数字都应有可信度" />
      <div className="coverage-score"><div className="score-ring" style={{ "--score": `${quality.score * 3.6}deg` }}><b>{quality.score}</b><span>覆盖分</span></div><div className="coverage-list"><CoverageRow name="聊天记录" level={quality.messages.level} /><CoverageRow name="支付账单" level={quality.payments.level} /><CoverageRow name="朋友圈" level={quality.moments.level} /></div></div>
      <button className="panel-button" onClick={onImport}>补充数据，让结论更完整</button>
    </section>
  </div>;
}

function ChatPage({ stats }) {
  const maxHour = Math.max(...stats.hourCounts, 1);
  return <div className="detail-grid">
    <section className="detail-hero green"><span>CHAT TRACE</span><h2>你把 {number.format(stats.wordCount)} 个字<br/>留在了这一年里</h2><p>{number.format(stats.sent)} 条发出 · {number.format(stats.received)} 条收到 · {stats.voiceMinutes} 分钟语音</p></section>
    <section className="panel wide"><PanelHead title="一天里的聊天节奏" subtitle="你在什么时间最活跃" /><div className="hour-chart">{stats.hourCounts.map((count, hour) => <div key={hour} className={hour === stats.peakHour ? "peak" : ""}><i style={{ height: `${Math.max(4, (count / maxHour) * 100)}%` }} /><span>{hour % 3 === 0 ? `${hour}:00` : ""}</span></div>)}</div></section>
    <section className="panel"><PanelHead title="消息里程碑" subtitle="起点与终点" /><div className="milestones"><div><i>01</i><span><b>第一条发出</b><small>{dateTime(stats.firstMessage?.date)}</small></span></div><div><i>12</i><span><b>最后一条发出</b><small>{dateTime(stats.lastMessage?.date)}</small></span></div><div><i>∞</i><span><b>最长连续活跃</b><small>{stats.streak} 天</small></span></div></div></section>
    <section className="panel"><PanelHead title="小动作也算数" subtitle="最容易被忽略的微信瞬间" /><div className="small-stat-grid"><MiniStat label="图片" value={stats.typeCounts.image || 0} /><MiniStat label="表情包" value={stats.typeCounts.sticker || 0} /><MiniStat label="拍一拍" value={stats.typeCounts.poke || 0} /><MiniStat label="文件" value={stats.typeCounts.file || 0} /></div></section>
    <AccuracyNote title="关于撤回与删除"><p>撤回统计来自仍存在的系统消息，例如“你撤回了一条消息”。如果记录后来被清理，这次撤回就可能无法计入。</p><p>删除不是一个可完整追溯的动作：只有导出数据中保留删除标记时才能统计；彻底删除的内容不会被伪造或估算。</p></AccuracyNote>
  </div>;
}

function PeoplePage({ stats }) {
  const max = stats.topContacts[0]?.count || 1;
  return <div className="detail-grid">
    <section className="detail-hero teal"><span>RELATIONSHIP HEAT</span><h2>总有人，占据你聊天列表里<br/>更亮的那一格</h2><p>以下只统计你主动发出的消息，不读取语义、不评价关系好坏。</p></section>
    <section className="panel wide"><PanelHead title="年度联系热度" subtitle="发出的消息越多，轨道越长" />
      <div className="ranking">{stats.topContacts.map((item, index) => <div key={item.name}><em>{String(index + 1).padStart(2, "0")}</em><span className={`avatar av-${index}`}>{item.name.slice(0, 1)}</span><section><b>{item.name}</b><i><u style={{ width: `${(item.count / max) * 100}%` }} /></i></section><strong>{number.format(item.count)}<small> 条</small></strong></div>)}</div>
    </section>
    <section className="panel"><PanelHead title="关系报告的底线" subtitle="数据不是感情判决书" /><div className="principles"><p><b>不做“谁最爱你”</b><span>消息数量不等于关系质量。</span></p><p><b>默认隐藏联系人</b><span>公开分享卡片不带姓名和群名。</span></p><p><b>只做个人回忆</b><span>不提供监控、取证或他人账号分析。</span></p></div></section>
    <section className="panel quote-card"><Icon name="spark" /><blockquote>真正珍贵的不是发了多少条消息，而是多年后，你还能记得那一刻为什么按下发送。</blockquote><span>微信年轮 · {stats.year}</span></section>
  </div>;
}

function MomentsPage({ stats, confidence }) {
  return <div className="detail-grid">
    <section className="detail-hero purple"><span>MOMENTS</span><h2>{stats.momentsPosts} 次分享生活，<br/>{stats.momentsComments} 次走进别人的动态</h2><p>另有 {stats.momentsLikes} 次点赞被识别。</p></section>
    <section className="panel wide"><PanelHead title="朋友圈足迹" subtitle="公开表达与轻互动" badge={levelText(confidence)} /><div className="moment-cards"><BigNumber label="发表朋友圈" value={stats.momentsPosts} unit="条" /><BigNumber label="评论朋友圈" value={stats.momentsComments} unit="条" /><BigNumber label="点过赞" value={stats.momentsLikes} unit="次" /></div></section>
    <AccuracyNote title="为什么朋友圈可能不完整"><p>电脑端通常只保存你实际加载或同步到本机的朋友圈内容，评论和点赞也可能缺失。因此这里显示“识别到的数量”，不会宣称是微信服务器上的绝对总数。</p></AccuracyNote>
  </div>;
}

function MoneyPage({ stats, confidence }) {
  return <div className="detail-grid">
    <section className="detail-hero orange"><span>MONEY MOMENTS</span><h2>红包是气氛，转账是往来，<br/>账单负责把它们算清楚</h2><p>金额只在你的电脑上计算，分享卡片默认隐藏金额。</p></section>
    <section className="panel wide"><PanelHead title="红包与转账" subtitle="来自微信支付个人对账 CSV" badge={levelText(confidence)} /><div className="money-grid">
      <MoneyCard kind="红包发出" amount={stats.redSentAmount} count={`${stats.redSentCount} 个`} tone="red" />
      <MoneyCard kind="红包收到" amount={stats.redReceivedAmount} count={`${stats.redReceivedCount} 个`} tone="green" />
      <MoneyCard kind="转账支出" amount={stats.transferSentAmount} count={`${stats.transferSentCount} 笔`} tone="blue" />
      <MoneyCard kind="转账收入" amount={stats.transferReceivedAmount} count={`${stats.transferReceivedCount} 笔`} tone="purple" />
    </div></section>
    <section className="panel"><PanelHead title="年度最大单笔转账" subtitle="仅支出方向" /><div className="max-money"><span>¥</span><strong>{stats.maxTransfer?.amount?.toFixed(2) || "0.00"}</strong><small>{stats.maxTransfer ? `${stats.maxTransfer.counterparty} · ${dateShort(stats.maxTransfer.date)}` : "尚未导入账单"}</small></div></section>
    <AccuracyNote title="为什么金额应从账单统计"><p>聊天中的红包或转账卡片并不总包含最终金额与交易状态。导入微信支付“用于个人对账”的 CSV 后，金额、笔数、收支方向才可视为账单级准确。</p>{stats.excludedPayments > 0 && <p>本年度另有 {stats.excludedPayments} 笔失败、退款、退还、撤销或关闭记录，已从汇总中排除。</p>}</AccuracyNote>
  </div>;
}

function DataPage({ dataset, quality, year, onImport, onExport, onReset }) {
  const [guide, setGuide] = useState("payment");
  const recordCount = dataset.messages.length + dataset.payments.length + dataset.moments.length;
  return <div className="detail-grid">
    <section className="privacy-hero"><div><Icon name="shield" size={28} /></div><span><small>LOCAL FIRST · ZERO CLOUD</small><h2>你的微信记录，不该成为别人的数据。</h2><p>所有文件都在当前设备内读取和统计。应用不要求微信密码、不上传原始数据、不接入广告追踪。</p></span></section>
    <section className="panel wide"><PanelHead title="数据来源与可信度" subtitle={`${year} 年 · ${dataset.source}`} /><div className="source-table">
      <SourceRow name="聊天记录" description="消息、语音、图片、撤回系统记录" level={quality.messages.level} count={dataset.messages.length} />
      <SourceRow name="微信支付账单" description="红包、转账的笔数与金额" level={quality.payments.level} count={dataset.payments.length} />
      <SourceRow name="朋友圈记录" description="发表、评论、点赞" level={quality.moments.level} count={dataset.moments.length} />
    </div><div className="data-actions"><button className="primary-button" onClick={onImport}><Icon name="upload" size={17} />{recordCount ? "继续补充文件" : "查看步骤并导入"}</button>{recordCount > 0 && <button className="ghost-button" onClick={onExport}>导出标准 JSON</button>}{recordCount > 0 && <button className="danger-button" onClick={onReset}>清除本次导入</button>}</div></section>
    <FileGuide active={guide} onSelect={setGuide} className="wide" />
    <section className="panel"><PanelHead title="支持的字段" subtitle="方便对接开源导出工具" /><div className="schema"><code>messages[]</code><span>time · isSend · type · content · contact · duration</span><code>payments[]</code><span>交易时间 · 交易类型 · 收/支 · 金额(元) · 交易对方</span><code>moments[]</code><span>time · type(post/comment/like) · isOwn · content</span></div></section>
    <AccuracyNote title="重要边界"><p>当前版本不会自动扫描微信进程、提取密钥或破解账号。它只读取你主动选择的导出文件，这让公开发行更安全，也降低微信更新后失效的风险。</p><p>后续读取能力只通过独立适配器接入：仅本人设备、明确授权、全过程本地、无需关闭 SIP、失败可回退。导出的标准 JSON 含原始内容与联系人，请只在自己设备保存。</p></AccuracyNote>
  </div>;
}

function FileGuide({ active, onSelect, className = "" }) {
  return <section className={`panel file-guide-panel ${className}`}>
    <PanelHead title="文件从哪里来？" subtitle="按你的设备和目标，先找到正确文件" badge="全程本机" />
    <div className="guide-tabs" role="tablist" aria-label="文件获取方式">
      <button className={active === "payment" ? "active" : ""} onClick={() => onSelect("payment")}><Icon name="money" size={18} /><span><b>支付账单</b><small>最容易 · 官方 CSV</small></span></button>
      <button className={active === "chat" ? "active" : ""} onClick={() => onSelect("chat")}><Icon name="chat" size={18} /><span><b>聊天记录</b><small>需电脑导出工具</small></span></button>
      <button className={active === "moments" ? "active" : ""} onClick={() => onSelect("moments")}><Icon name="moments" size={18} /><span><b>朋友圈</b><small>覆盖可能不完整</small></span></button>
    </div>
    <GuideContent kind={active} />
  </section>;
}

function GuideContent({ kind }) {
  if (kind === "payment") return <div className="guide-content">
    <div className="guide-title"><span>推荐先做</span><div><h3>申请微信支付个人对账账单</h3><p>这是统计红包、转账金额和笔数最可靠的数据源。</p></div></div>
    <ol>
      <li><b>打开手机微信</b><span>依次进入「我」→「服务」→「钱包」。</span></li>
      <li><b>进入账单下载</b><span>点右上角「账单」→「常见问题」→「下载账单」。</span></li>
      <li><b>选择对账用途</b><span>选「用于个人对账」，时间范围选择要分析的完整年份。</span></li>
      <li><b>接收并解压</b><span>填写自己的邮箱、验证支付密码。邮件收到 ZIP 后，用微信支付官方通知中的解压码解压。</span></li>
      <li><b>上传里面的 CSV</b><span>不要直接上传 ZIP；选择解压后名称通常含「微信支付账单」的 <code>.csv</code> 文件。</span></li>
    </ol>
    <div className="guide-result"><b>能统计</b><span>红包发出/收到金额与个数、转账收入/支出金额与笔数，并排除失败、退款等无效交易。</span></div>
  </div>;

  if (kind === "chat") return <div className="guide-content">
    <div className="guide-title"><span className="advanced">进阶操作</span><div><h3>先迁移到电脑，再用本地工具导出</h3><p>微信目前没有“导出聊天 CSV / JSON”的官方按钮。</p></div></div>
    <ol>
      <li><b>先备份原记录</b><span>手机与电脑连接同一网络，在手机微信进入「我」→「设置」→「通用」→「聊天记录迁移与备份」→「迁移」→「迁移到电脑」。</span></li>
      <li><b>先确认系统与版本</b><span><a href="https://github.com/ycccccccy/echotrace" target="_blank" rel="noreferrer">EchoTrace</a> 的官方新手发行版面向 Windows 10+；Mac 不要直接下载 Windows 的 EXE。也可查看 <a href="https://github.com/LifeArchiveProject/WeChatDataAnalysis" target="_blank" rel="noreferrer">WeChatDataAnalysis</a> 当前说明。</span></li>
      <li><b>只在自己的电脑导出</b><span>按开源工具说明读取本人账号数据，优先选择 JSON 或 CSV；不要把密钥、数据库或聊天文件发给陌生人。WeFlow 现有仓库已移除取密钥/解密能力，不把它当成可用导出器。</span></li>
      <li><b>导入结构化结果</b><span>选择 <code>chat.json</code>、<code>messages.json</code> 或聊天记录 <code>.csv</code>。本项目兼容多种 EchoTrace / WeFlow 风格字段和嵌套会话结构，但不承诺所有版本零配置兼容。</span></li>
    </ol>
    <div className="guide-warning"><b>先确认兼容性与风险</b><span>第三方工具会随微信版本变化而失效。macOS 目前没有适合小白、稳定且零风险的通用聊天导出流程；绝不要关闭 SIP，也不建议为统计而重签微信。请先做官方备份，只分析本人账号。</span></div>
  </div>;

  return <div className="guide-content">
    <div className="guide-title"><span className="limited">实验功能</span><div><h3>朋友圈暂时没有简单、完整的官方导出</h3><p>本机没加载过的内容、评论和点赞都可能缺失，所以只能按“识别到的记录”统计。</p></div></div>
    <ol>
      <li><b>Windows 用户</b><span>可先查看上面的 <a href="https://github.com/LifeArchiveProject/WeChatDataAnalysis" target="_blank" rel="noreferrer">WeChatDataAnalysis</a> 是否支持你的微信版本与朋友圈导出。</span></li>
      <li><b>macOS 用户</b><span>不建议为了朋友圈统计去修改微信程序；当前先等待兼容的本地适配器。</span></li>
      <li><b>已有导出文件</b><span>可以上传朋友圈 JSON / CSV，建议含 <code>time</code>、<code>type</code>、<code>isOwn</code>、<code>content</code> 字段。</span></li>
      <li><b>阅读覆盖提示</b><span>结果会持续标为“可能不完整”，不会把本机缓存数量冒充账号历史总数。</span></li>
    </ol>
    <div className="guide-warning"><b>暂时做不到</b><span>已彻底删除且没有任何残留的消息、朋友圈与撤回记录无法被可靠恢复，应用不会虚构或估算。</span></div>
  </div>;
}

function ChangelogPage() {
  const releases = [
    {
      version: "V0.2.0",
      date: "2026年7月22日",
      title: "双平台开源桌面预览版",
      current: true,
      summary: "把 EchoTrace 的本地分析与分层服务经验、WeFlow 的兼容性教训，整理成可持续维护的导入优先架构。",
      groups: [
        ["年报", ["默认进入一屏一个结论的沉浸式年报故事", "保留详细总览、聊天、关系、朋友圈与账单页面", "缺少数据时明确标记未导入，不用零值冒充结论"]],
        ["兼容", ["适配多种大小写字段、EchoTrace / WeFlow 风格字段与嵌套会话 JSON", "加入带版本号的微信年轮标准 JSON 导入与导出", "修正本地时区边界下活跃日和连续天数计算"]],
        ["开源", ["加入 macOS Apple 芯片、Intel 与 Windows 自动打包流程", "加入 MIT 许可、隐私、安全、贡献、数据格式和小白发布文档", "取密钥与数据库解密不进入主程序，只保留独立适配器边界"]],
      ],
    },
    {
      version: "V0.1.2",
      date: "2026年7月21日",
      title: "真实数据与上传向导",
      summary: "默认不再自动展示模拟统计，先告诉访客文件从哪里来，再开始分析。",
      groups: [
        ["真实", ["首页默认改为空白数据状态，未导入就不显示统计数字", "演示数据只在用户主动点击后出现，并持续标明为模拟记录", "清除导入后回到空白状态，不再自动恢复演示数据"]],
        ["向导", ["加入微信支付个人对账 CSV 的手机申请、解压与上传步骤", "加入 Windows 与 macOS 聊天记录迁移、开源导出和文件选择说明", "加入朋友圈可获取范围、字段格式与不完整性提示"]],
        ["边界", ["明确区分官方账单、第三方本地导出和实验性朋友圈数据", "彻底删除且无残留的数据不会被恢复、估算或伪造"]],
      ],
    },
    {
      version: "V0.1.1",
      date: "2026年7月21日",
      title: "公开发行准备版",
      summary: "让每一位访客都能看到产品从哪里开始，又是怎样一点点长出来的。",
      groups: [
        ["新增", ["增加全访客可见的独立更新日志", "侧边栏常驻当前版本入口", "更新离线缓存版本，确保访客及时获得新版"]],
        ["优化", ["失败、退款、退还、撤销和关闭交易不计入有效金额", "优先使用消息 ID 与微信交易单号去重", "公开分享卡继续默认隐藏联系人、聊天原文和金额"]],
      ],
    },
    {
      version: "V0.1.0",
      date: "2026年7月21日",
      title: "首个可用体验版",
      summary: "微信年轮的第一个真实版本。从一份演示数据开始，把容易被忽略的微信小事变成年度档案。",
      groups: [
        ["核心", ["年度消息、活跃日、连续活跃与聊天时段分析", "文字、图片、语音、视频、表情、文件、链接与拍一拍分类", "联系人和群聊发送热度排行"]],
        ["数据", ["支持聊天、朋友圈 JSON / CSV 导入", "支持微信支付个人对账 CSV，统计红包和转账", "撤回、删除和朋友圈均显示可检测范围与可信度"]],
        ["体验", ["完成 PWA 桌面安装与离线访问", "本机生成年度分享卡片", "不要求微信密码，不上传原始聊天文件"]],
      ],
    },
  ];

  return <div className="changelog-page">
    <section className="changelog-hero"><span>CHANGELOG · BUILD IN PUBLIC</span><h2>每一次认真更新，<br/>都应该留下记录。</h2><p>这里从第一个真实版本开始，公开记录新增能力、体验改进与数据边界。不会从不存在的版本开始，也不会把“计划中”伪装成“已完成”。</p><div><b>4</b><small>已发布版本</small><i /><b>2026.07.21</b><small>首次记录</small></div></section>
    <section className="release-timeline">{releases.map((release) => <article className={`release-card ${release.current ? "current" : ""}`} key={release.version}>
      <div className="release-marker"><i /><span /></div>
      <div className="release-content"><header><div><span>{release.version}</span>{release.current && <em>当前版本</em>}<time>{release.date}</time></div><h3>{release.title}</h3><p>{release.summary}</p></header>
        <div className="release-groups">{release.groups.map(([name, items]) => <section key={name}><b>{name}</b><ul>{items.map((item) => <li key={item}>{item}</li>)}</ul></section>)}</div>
      </div>
    </article>)}</section>
    <section className="roadmap-card"><div><Icon name="spark" /><span><b>下一版本正在考虑</b><small>以下是计划，不计入已发布能力</small></span></div><p>经过安全评审的 macOS 独立数据适配器 · 大文件流式解析 · 年份对比 · 更多分享主题</p></section>
  </div>;
}

function ImportModal({ onClose, fileRef, onFiles }) {
  const [drag, setDrag] = useState(false);
  const [guide, setGuide] = useState("payment");
  return <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><div className="modal import-modal"><button className="modal-x" onClick={onClose}>×</button><span className="modal-kicker">FIND · EXPORT · IMPORT</span><h2>先找到正确文件，再上传</h2><p className="modal-desc">下面按数据类型写清楚获取路径。你可以从最简单、最准确的微信支付账单开始。</p>
    <FileGuide active={guide} onSelect={setGuide} />
    <div className={`drop-zone ${drag ? "drag" : ""}`} onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); onFiles([...e.dataTransfer.files]); }} onClick={() => fileRef.current?.click()}><Icon name="upload" size={26} /><b>已经拿到文件？拖到这里</b><span>或点击选择 CSV / JSON · 支持多选</span><input ref={fileRef} type="file" accept=".csv,.json,.txt" multiple hidden onChange={(e) => onFiles([...e.target.files])} /></div>
    <div className="privacy-line"><Icon name="shield" size={17} />分析在本机完成。关闭应用后，原始文件不会被复制到应用目录。</div>
  </div></div>;
}

function ShareModal({ stats, quality, onClose }) {
  const canvasRef = useRef(null);
  const draw = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    canvas.width = 1080; canvas.height = 1440;
    const gradient = ctx.createLinearGradient(0, 0, 1080, 1440); gradient.addColorStop(0, "#0c6b51"); gradient.addColorStop(1, "#092f2b"); ctx.fillStyle = gradient; ctx.fillRect(0, 0, 1080, 1440);
    ctx.strokeStyle = "rgba(255,255,255,.1)"; ctx.lineWidth = 2; for (let r = 160; r < 840; r += 95) { ctx.beginPath(); ctx.arc(850, 260, r, 0, Math.PI * 2); ctx.stroke(); }
    ctx.fillStyle = "rgba(255,255,255,.72)"; ctx.font = "28px system-ui"; ctx.fillText(`${stats.year} · MY YEAR IN WECHAT`, 86, 110);
    ctx.fillStyle = "#fff"; ctx.font = "700 58px system-ui"; ctx.fillText("我的微信年轮", 86, 208);
    ctx.font = "800 178px system-ui"; ctx.fillText(number.format(stats.sent), 78, 475);
    ctx.fillStyle = "#a8e1cb"; ctx.font = "36px system-ui"; ctx.fillText("条消息，被我按下发送", 90, 535);
    const cards = [["活跃了", `${stats.activeDays} 天`], ["亲手撤回", `${stats.ownRevokes} 条`], ["朋友圈", `${stats.momentsPosts} 条`], ["红包 / 转账", `${stats.redSentCount} 个 / ${stats.transferSentCount} 笔`]];
    cards.forEach(([label, value], i) => { const x = 82 + (i % 2) * 464; const y = 640 + Math.floor(i / 2) * 220; ctx.fillStyle = "rgba(255,255,255,.09)"; roundRect(ctx, x, y, 420, 170, 28); ctx.fill(); ctx.fillStyle = "rgba(255,255,255,.62)"; ctx.font = "26px system-ui"; ctx.fillText(label, x + 34, y + 52); ctx.fillStyle = "#fff"; ctx.font = "700 48px system-ui"; ctx.fillText(value, x + 34, y + 120); });
    ctx.fillStyle = "rgba(255,255,255,.68)"; ctx.font = "27px system-ui"; ctx.fillText(`数据覆盖分 ${quality.score} · 金额与联系人默认隐藏`, 86, 1188);
    ctx.fillStyle = "#fff"; ctx.font = "700 32px system-ui"; ctx.fillText("微信年轮", 86, 1310); ctx.fillStyle = "rgba(255,255,255,.52)"; ctx.font = "23px system-ui"; ctx.fillText("不上传聊天记录的本地年度报告", 86, 1352);
  };
  React.useEffect(draw, [stats, quality]);
  const download = () => { draw(); const link = document.createElement("a"); link.download = `微信年轮-${stats.year}.png`; link.href = canvasRef.current.toDataURL("image/png"); link.click(); };
  return <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><div className="modal share-modal"><button className="modal-x" onClick={onClose}>×</button><div><span className="modal-kicker">SHARE YOUR YEAR</span><h2>一张不泄露隐私的年报卡片</h2><p className="modal-desc">默认隐藏联系人、群名、聊天内容和具体金额，只分享你愿意公开的小数字。</p><ul><li>✓ 不含聊天原文</li><li>✓ 不含联系人姓名</li><li>✓ 不含红包与转账金额</li><li>✓ 图片完全在本机生成</li></ul><button className="primary-button big" onClick={download}>下载 PNG 卡片</button></div><canvas ref={canvasRef} /></div></div>;
}

function Metric({ tone, label, value, unit, note, status }) { return <section className={`metric-card ${tone}`}><span className="metric-status">{status}</span><p>{label}</p><h3>{number.format(value)} <small>{unit}</small></h3><div>{note}</div></section>; }
function PanelHead({ title, subtitle, badge, link }) { return <div className="panel-head"><div><h3>{title}</h3><p>{subtitle}</p></div>{badge && <span>{badge}</span>}{link && <button>{link} →</button>}</div>; }
function CoverageRow({ name, level }) { return <div><span><i className={`dot ${level}`} />{name}</span><b className={level}>{levelText(level)}</b></div>; }
function MiniStat({ label, value }) { return <div><span>{label}</span><b>{number.format(value)}</b><small>条</small></div>; }
function BigNumber({ label, value, unit }) { return <div><span>{label}</span><b>{number.format(value)}</b><small>{unit}</small></div>; }
function MoneyCard({ kind, amount, count, tone }) { return <div className={`money-card ${tone}`}><span>{kind}</span><b><small>¥</small>{amount}</b><em>{count}</em></div>; }
function SourceRow({ name, description, level, count }) { return <div><span><i className={`dot ${level}`} /><b>{name}</b><small>{description}</small></span><em>{number.format(count)} 条记录</em><strong className={level}>{levelText(level)}</strong></div>; }
function AccuracyNote({ title, children }) { return <section className="accuracy-note wide"><span>i</span><div><b>{title}</b>{children}</div></section>; }
function levelText(level) { return ({ complete: "完整", partial: "可能不完整", missing: "未导入", out_of_year: "该年无记录" })[level] || "未知"; }
function dateTime(date) { return date ? date.toLocaleString("zh-CN", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "暂无记录"; }
function dateShort(date) { return date ? date.toLocaleDateString("zh-CN", { month: "long", day: "numeric" }) : ""; }
function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }

export default App;
