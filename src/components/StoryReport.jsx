import React, { useEffect, useMemo, useRef, useState } from "react";
import { APP_VERSION } from "../version.js";
import "./story-report.css";

const number = new Intl.NumberFormat("zh-CN");
const typeLabels = {
  text: "文字", image: "图片", voice: "语音", sticker: "表情",
  video: "视频", link: "链接", file: "文件", poke: "拍一拍",
  call: "通话", red_packet: "红包", transfer: "转账", system: "系统消息",
};

function SourceTag({ ready, children }) {
  return <span className={`story-source ${ready ? "ready" : "missing"}`}><i />{children}</span>;
}

function StorySlide({ index, eyebrow, tone = "paper", children }) {
  return <section className={`story-slide tone-${tone}`} data-story-index={index}>
    <div className="story-copy"><span className="story-number">{String(index + 1).padStart(2, "0")}</span><span className="story-eyebrow">{eyebrow}</span>{children}</div>
  </section>;
}

export default function StoryReport({ stats, quality, years, year, isDemo, onYear, onDetail, onImport, onShare }) {
  const scrollerRef = useRef(null);
  const [page, setPage] = useState(0);
  const [hideName, setHideName] = useState(true);
  const messageReady = quality.messages.hasYear;
  const activityReady = messageReady && stats.sent > 0;
  const paymentReady = quality.payments.hasYear;
  const momentReady = quality.moments.hasYear;
  const topMonthIndex = activityReady ? stats.monthCounts.indexOf(Math.max(...stats.monthCounts)) : null;
  const topType = Object.entries(stats.typeCounts).filter(([key]) => key !== "revoke").sort((a, b) => b[1] - a[1])[0];
  const topContact = stats.topContacts[0];
  const totalPages = 9;

  const dateRange = useMemo(() => {
    if (!stats.firstMessage || !stats.lastMessage) return "还没有可展示的消息时间线";
    const format = (date) => date.toLocaleDateString("zh-CN", { month: "long", day: "numeric" });
    return `${format(stats.firstMessage.date)} — ${format(stats.lastMessage.date)}`;
  }, [stats.firstMessage, stats.lastMessage]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return undefined;
    const slides = [...scroller.querySelectorAll("[data-story-index]")];
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) setPage(Number(visible.target.dataset.storyIndex));
    }, { root: scroller, threshold: [0.45, 0.7] });
    slides.forEach((slide) => observer.observe(slide));
    return () => observer.disconnect();
  }, []);

  const jump = (index) => scrollerRef.current?.querySelector(`[data-story-index="${index}"]`)?.scrollIntoView({ behavior: "smooth" });

  return <div className="story-report">
    <header className="story-toolbar">
      <button className="story-brand" onClick={() => jump(0)} aria-label="回到年报开头"><span><i /><i /></span><b>微信年轮</b></button>
      <div className="story-toolbar-actions">
        {isDemo && <span className="story-demo">演示数字</span>}
        <label><span>年份</span><select value={year} onChange={(event) => onYear(Number(event.target.value))}>{years.map((item) => <option key={item}>{item}</option>)}</select></label>
        <button onClick={onImport}>导入文件</button>
        <button onClick={onDetail}>详细数据</button>
      </div>
    </header>

    <main className="story-stage" ref={scrollerRef}>
      <StorySlide index={0} eyebrow={`${year} · MY YEAR IN WECHAT`} tone="green">
        <h1>这一年，<br/>你在微信里留下了什么？</h1>
        <p>{messageReady ? dateRange : "导入自己的文件，才会出现真实结论。"}</p>
        <div className="story-intro-actions"><button onClick={() => jump(1)}>{messageReady ? "开始翻阅" : "看看报告结构"}<span>↓</span></button><SourceTag ready={messageReady}>{messageReady ? "聊天记录已读取" : "聊天记录未导入"}</SourceTag></div>
      </StorySlide>

      <StorySlide index={1} eyebrow="THE MESSAGES YOU SENT">
        {messageReady ? <><p className="story-lead">你按下了</p><strong className="story-huge">{number.format(stats.sent)}</strong><h2>次发送。</h2><p className="story-note">也收到了 {number.format(stats.received)} 条回应。数字不评价关系，只替你保存时间的形状。</p></> : <MissingBlock title="消息页还空着" text="导入聊天 JSON 或 CSV 后，这里会展示发送、收到和消息类型。" onImport={onImport} />}
      </StorySlide>

      <StorySlide index={2} eyebrow="DAYS & NIGHTS" tone="ink">
        {activityReady ? <><p className="story-lead">你在 <b>{stats.activeDays}</b> 天里说过话</p><h2>最长连续出现<br/><strong>{stats.streak} 天</strong></h2><div className="story-facts"><span><small>最常出现</small><b>{String(stats.peakHour).padStart(2, "0")}:00</b></span><span><small>最热闹的月份</small><b>{topMonthIndex + 1} 月</b></span><span><small>那个月发出</small><b>{number.format(stats.monthCounts[topMonthIndex] || 0)} 条</b></span></div></> : <MissingBlock title="还不知道你的聊天节奏" text="当前年份没有识别到由你发出的普通消息；可继续补充聊天记录。" onImport={onImport} inverted />}
      </StorySlide>

      <StorySlide index={3} eyebrow="HOW YOU EXPRESSED YOURSELF">
        {activityReady ? <><p className="story-lead">你最常用</p><h2 className="story-word">{typeLabels[topType?.[0]] || "文字"}</h2><p className="story-note">共 {number.format(topType?.[1] || 0)} 条。图片 {number.format(stats.typeCounts.image || 0)} 张，语音约 {number.format(stats.voiceMinutes)} 分钟，表情 {number.format(stats.typeCounts.sticker || 0)} 个。</p></> : <MissingBlock title="表达方式等待导入" text="支持文字、图片、语音、视频、表情、链接、文件和拍一拍等类型。" onImport={onImport} />}
      </StorySlide>

      <StorySlide index={4} eyebrow="THE BRIGHTEST CONVERSATION" tone="mist">
        {messageReady && topContact ? <><p className="story-lead">这一格对话框，亮得最久</p><button className="story-private-name" onClick={() => setHideName((value) => !value)} aria-label="切换联系人隐私显示">{hideName ? "某个熟悉的对话框" : topContact.name}<span>{hideName ? "点按显示姓名" : "点按隐藏姓名"}</span></button><p className="story-note">你向这个会话发出 {number.format(topContact.count)} 条消息，占全年发送量约 {topContact.share}%。这不是感情排名，只是联系频率。</p></> : <MissingBlock title="关系热度还没有数据" text="联系人仅在本机参与统计；分享图默认不带姓名和群名。" onImport={onImport} />}
      </StorySlide>

      <StorySlide index={5} eyebrow="THE THINGS THAT DISAPPEARED">
        {messageReady ? <><p className="story-lead">有些话，发出后又消失了</p><div className="story-dual"><span><b>{number.format(stats.ownRevokes)}</b><small>条可检测的本人撤回</small></span><span><b>{number.format(stats.knownDeleted)}</b><small>条带删除标记的记录</small></span></div><p className="story-warning">彻底删除且没有残留的消息无法检测；已清理的撤回系统提示也无法补回。这里不估算、不伪造。</p></> : <MissingBlock title="撤回与删除不可凭空统计" text="只有导出文件中仍存在的撤回提示或删除标记才会计数。" onImport={onImport} />}
      </StorySlide>

      <StorySlide index={6} eyebrow="RED PACKETS & TRANSFERS" tone="red">
        {paymentReady ? <><p className="story-lead">发出去的心意，也留在账单里</p><h2><strong>{stats.redSentCount}</strong> 个红包</h2><p className="story-money">合计 ¥{stats.redSentAmount}</p><div className="story-facts"><span><small>发出转账</small><b>{stats.transferSentCount} 笔</b></span><span><small>转账支出</small><b>¥{stats.transferSentAmount}</b></span><span><small>收到红包</small><b>{stats.redReceivedCount} 个</b></span></div></> : <MissingBlock title="支付页等待官方账单" text="手机微信可申请“用于个人对账”的 CSV；它比聊天里的红包卡片更准确。" onImport={onImport} />}
      </StorySlide>

      <StorySlide index={7} eyebrow="MOMENTS" tone="violet">
        {momentReady ? <><p className="story-lead">朋友圈里，你留下</p><div className="story-moments"><span><b>{stats.momentsPosts}</b><small>条发表</small></span><span><b>{stats.momentsComments}</b><small>条评论</small></span><span><b>{stats.momentsLikes}</b><small>次点赞</small></span></div><p className="story-warning">朋友圈通常只覆盖电脑端曾加载或导出的部分，所以这是“识别到的数量”，不冒充服务器总数。</p></> : <MissingBlock title="朋友圈暂未导入" text="这是实验统计。即使导入，也会持续提示缓存和导出覆盖范围。" onImport={onImport} />}
      </StorySlide>

      <StorySlide index={8} eyebrow="YOUR REPORT, YOUR DEVICE" tone="green">
        <span className="story-score">数据覆盖分 <b>{quality.score}</b> / 100</span><h2>这份年报属于你，<br/>原始记录也只属于你。</h2><div className="story-source-list"><SourceTag ready={messageReady}>聊天 {sourceText(quality.messages.level)}</SourceTag><SourceTag ready={paymentReady}>账单 {sourceText(quality.payments.level)}</SourceTag><SourceTag ready={momentReady}>朋友圈 {sourceText(quality.moments.level)}</SourceTag></div><div className="story-end-actions"><button className="solid" onClick={onShare}>生成隐私分享图</button><button onClick={onDetail}>查看详细数据</button><button onClick={onImport}>补充文件</button></div><p className="story-footnote">微信年轮 V{APP_VERSION} · 本地计算 · 不登录 · 不上传 · 非微信官方产品</p>
      </StorySlide>
    </main>

    <nav className="story-progress" aria-label="年报页码">{Array.from({ length: totalPages }, (_, index) => <button key={index} className={page === index ? "active" : ""} onClick={() => jump(index)} aria-label={`第 ${index + 1} 页`} />)}</nav>
    <span className="story-page-count">{String(page + 1).padStart(2, "0")} / {String(totalPages).padStart(2, "0")}</span>
  </div>;
}

function MissingBlock({ title, text, onImport, inverted = false }) {
  return <div className={`story-missing ${inverted ? "inverted" : ""}`}><span>等待真实数据</span><h2>{title}</h2><p>{text}</p><button onClick={onImport}>查看文件获取步骤</button></div>;
}

function sourceText(level) {
  return ({ complete: "完整", partial: "可能不完整", missing: "未导入", out_of_year: "该年无记录" })[level] || "未知";
}
