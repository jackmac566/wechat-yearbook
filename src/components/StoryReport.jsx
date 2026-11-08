import React, { useEffect, useRef, useState } from "react";
import "./story-report.css";

const number = new Intl.NumberFormat("zh-CN");
const longDate = new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long", day: "numeric" });
const typeLabels = {
  text: "文字", image: "图片", voice: "语音", sticker: "表情",
  video: "视频", link: "链接", file: "文件", poke: "拍一拍",
  call: "通话", location: "位置", red_packet: "红包", transfer: "转账",
};

const sourceMeta = {
  messages: { name: "聊天", unit: "条消息" },
  payments: { name: "账单", unit: "笔记录" },
  moments: { name: "朋友圈", unit: "条记录" },
};

function SourceTag({ ready, children }) {
  return <span className={`story-source ${ready ? "ready" : "missing"}`}><i />{children}</span>;
}

function StorySlide({ index, eyebrow, tone = "paper", source, children }) {
  return <section className={`story-slide tone-${tone}`} data-story-index={index}>
    <div className="story-copy"><span className="story-number">{String(index + 1).padStart(2, "0")}</span><span className="story-eyebrow">{eyebrow}{source?.level === "partial" && <small className="story-partial">{source.hasFragments ? "含转发片段" : "按导入记录统计"}</small>}</span>{children}</div>
  </section>;
}

function formatObservedRange(range) {
  if (!range?.first && !range?.last) return "";
  if (range.first && range.last && range.first.toDateString() !== range.last.toDateString()) {
    return `${longDate.format(range.first)} — ${longDate.format(range.last)}`;
  }
  return longDate.format(range.first || range.last);
}

function CoverSourceRow({ source, level, hasYear, range, hasFragments }) {
  const observed = range?.count > 0;
  const span = formatObservedRange(range);
  const meta = span
    ? `${span} · 共 ${number.format(range.count)} ${sourceMeta[source].unit}`
    : hasYear ? "已导入 · 0 条记录" : level === "out_of_year" ? "该年无记录" : "未导入";
  return <div className={`story-range-row ${observed ? "has-data" : ""}`}>
    <b>{sourceMeta[source].name}</b>
    <span className="story-range-meta">{meta}</span>
    {hasYear && <SourceTag ready={hasYear}>{hasFragments ? "含转发片段" : sourceText(level)}</SourceTag>}
  </div>;
}

export default function StoryReport({ stats, quality, years, year, isDemo, inert, onYear, onDetail, onImport, onShare }) {
  const scrollerRef = useRef(null);
  const [page, setPage] = useState(0);
  const [revealedContact, setRevealedContact] = useState(null);
  const observedRanges = stats.observedRanges || { messages: {}, payments: {}, moments: {} };
  const messageReady = quality.messages.hasYear;
  const activityReady = messageReady && stats.sent > 0;
  const paymentReady = quality.payments.hasYear;
  const momentReady = quality.moments.hasYear;
  const topMonthIndex = activityReady ? stats.monthCounts.indexOf(Math.max(...stats.monthCounts)) : null;
  const topType = Object.entries(stats.typeCounts).sort((a, b) => b[1] - a[1])[0];
  const topContact = stats.topContacts[0];
  const hideName = revealedContact !== topContact;
  const hasReportData = messageReady || paymentReady || momentReady;

  const chapters = [];
  if (messageReady) chapters.push({ id: "sent", eyebrow: "消息往来", source: quality.messages });
  if (activityReady) {
    chapters.push({ id: "days", eyebrow: "聊天节奏", tone: "ink", source: quality.messages });
    chapters.push({ id: "type", eyebrow: "表达方式", source: quality.messages });
  }
  if (topContact) chapters.push({ id: "contact", eyebrow: "发消息最多的会话", tone: "mist", source: quality.messages });
  if (stats.ownRevokes || stats.knownDeleted) chapters.push({ id: "vanished", eyebrow: "撤回与删除记录", source: quality.messages });
  if (paymentReady) chapters.push({ id: "money", eyebrow: "红包与转账", tone: "red", source: quality.payments });
  if (momentReady && stats.momentOwnershipCounts.known > 0) chapters.push({ id: "moments", eyebrow: "朋友圈", tone: "violet", source: quality.moments });
  const totalPages = chapters.length + 2;
  const slideKey = chapters.map((chapter) => chapter.id).join("|");
  const shownPage = Math.min(page, totalPages - 1);

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
  }, [slideKey]);

  useEffect(() => {
    setPage(0);
    scrollerRef.current?.scrollTo({ top: 0, behavior: "instant" });
  }, [year]);

  const jump = (index) => scrollerRef.current?.querySelector(`[data-story-index="${index}"]`)?.scrollIntoView({ behavior: "smooth" });

  function chapterBody(id) {
    switch (id) {
      case "sent": {
        const directions = [["发出", stats.sent], ["收到", stats.received], ["方向未知", stats.directionUnknown]];
        const total = stats.sent + stats.received + stats.directionUnknown;
        return <><h2>导入了 <strong>{number.format(stats.totalMessages)}</strong> 条聊天记录</h2>
          {total > 0 ? <div className="story-direction">
            <div className="story-direction-track" aria-hidden="true">{directions.map(([label, count], index) => count > 0 && <i key={label} className={`direction-${index}`} style={{ flex: count }} />)}</div>
            <div className="story-direction-key">{directions.map(([label, count], index) => (index < 2 || count > 0) && <span key={label}><i className={`direction-${index}`} />{label} <b>{number.format(count)}</b></span>)}</div>
          </div> : <p>这批聊天记录没有可统计收发的普通消息。</p>}
        </>;
      }
      case "days":
        return <><p className="story-lead">你在 <b>{stats.activeDays}</b> 天里发过消息</p><h2>最长连续 <strong>{stats.streak} 天</strong></h2><div className="story-facts"><span><small>最常发消息的时段</small><b>{String(stats.peakHour).padStart(2, "0")}:00</b></span><span><small>最活跃月份</small><b>{topMonthIndex + 1} 月</b></span><span><small>那个月发出</small><b>{number.format(stats.monthCounts[topMonthIndex])} 条</b></span></div></>;
      case "type":
        return <><p className="story-lead">你最常发的是</p><h2 className="story-word">{typeLabels[topType?.[0]] || "其他类型"}</h2><p className="story-note">共 {number.format(topType[1])} 条。图片 {number.format(stats.typeCounts.image || 0)} 张，语音 {number.format(stats.typeCounts.voice || 0)} 条，表情包 {number.format(stats.typeCounts.sticker || 0)} 个。</p></>;
      case "contact":
        return <><button className="story-private-name" onClick={() => setRevealedContact(hideName ? topContact : null)} aria-label={hideName ? "显示会话名称" : "隐藏会话名称"}>{hideName ? "你常聊的会话" : topContact.name}<span>{hideName ? "点按显示会话名称" : "点按隐藏会话名称"}</span></button><p className="story-note">你向这个会话发出 {number.format(topContact.count)} 条消息，占已统计发送量的 {topContact.share}%。</p></>;
      case "vanished":
        return <><p className="story-lead">有些话，发出后又消失了</p><div className="story-dual"><span><b>{number.format(stats.ownRevokes)}</b><small>条可检测的本人撤回</small></span><span><b>{number.format(stats.knownDeleted)}</b><small>条带删除标记的记录</small></span></div><p className="story-warning">只统计导出文件中保留的撤回提示和删除标记。</p></>;
      case "money": {
        const rows = [
          ["发出红包", stats.redSentCount, stats.redSentAmount, "个"],
          ["收到红包", stats.redReceivedCount, stats.redReceivedAmount, "个"],
          ["发出转账", stats.transferSentCount, stats.transferSentAmount, "笔"],
          ["收到转账", stats.transferReceivedCount, stats.transferReceivedAmount, "笔"],
        ];
        return <><h2>红包和转账的往来</h2><div className="story-facts story-payment-grid">{rows.map(([label, count, amount, unit]) => <span key={label}><small>{label}</small><b>¥{amount}</b><small>{number.format(count)} {unit}</small></span>)}</div></>;
      }
      case "moments":
        return <><p className="story-lead">朋友圈里，你留下</p><div className="story-moments"><span><b>{stats.momentsPosts}</b><small>条发表</small></span><span><b>{stats.momentsComments}</b><small>条评论</small></span><span><b>{stats.momentsLikes}</b><small>次点赞</small></span></div><p className="story-warning">按文件中可确认的本人操作统计。</p></>;
      default:
        return null;
    }
  }

  return <div className="story-report" inert={inert}>
    <header className="story-toolbar">
      <button className="story-brand" onClick={() => jump(0)} aria-label="回到年报开头"><span><i /><i /></span><b>微信年轮</b></button>
      <div className="story-toolbar-actions">
        {isDemo && <span className="story-demo">示例报告</span>}
        <label><span>年份</span><select value={year} onChange={(event) => onYear(Number(event.target.value))}>{years.map((item) => <option key={item}>{item}</option>)}</select></label>
        <button onClick={onImport}>导入记录</button>
        <button onClick={onShare}>分享图</button>
        <button className="story-detail-button" onClick={onDetail}>详细数据</button>
      </div>
    </header>

    <main className="story-stage" ref={scrollerRef}>
      <StorySlide index={0} eyebrow="微信年轮" tone="green">
        <h1>你的 {year} 年微信回顾</h1>
        <div className="story-range-list">
          <CoverSourceRow source="messages" level={quality.messages.level} hasYear={messageReady} range={observedRanges.messages} hasFragments={quality.messages.hasFragments} />
          <CoverSourceRow source="payments" level={quality.payments.level} hasYear={paymentReady} range={observedRanges.payments} />
          <CoverSourceRow source="moments" level={quality.moments.level} hasYear={momentReady} range={observedRanges.moments} />
        </div>
        <div className="story-intro-actions"><button onClick={() => jump(1)}>开始翻阅<span aria-hidden="true">↓</span></button></div>
      </StorySlide>

      {chapters.map((chapter, position) => <StorySlide key={chapter.id} index={position + 1} eyebrow={chapter.eyebrow} tone={chapter.tone} source={chapter.source}>{chapterBody(chapter.id)}</StorySlide>)}

      <StorySlide index={totalPages - 1} eyebrow={`${year} 年`} tone="green">
        <h2>留一份这一年的回顾</h2>
        <div className="story-end-actions"><button className="solid" onClick={onShare}>生成分享图</button><button onClick={onDetail}>查看详细数据</button></div>
      </StorySlide>
    </main>

    <nav className="story-progress" aria-label="年报页码">{Array.from({ length: totalPages }, (_, index) => <button key={index} className={shownPage === index ? "active" : ""} onClick={() => jump(index)} aria-label={`第 ${index + 1} 页`} />)}</nav>
    <div className="story-page-count">
      <button aria-label="上一页" disabled={shownPage === 0} onClick={() => jump(shownPage - 1)}>↑</button>
      <span>{String(shownPage + 1).padStart(2, "0")} / {String(totalPages).padStart(2, "0")}</span>
      <button aria-label="下一页" disabled={shownPage === totalPages - 1} onClick={() => jump(shownPage + 1)}>↓</button>
    </div>
  </div>;
}

function sourceText(level) {
  return ({ complete: "完整", partial: "可能不完整", missing: "未导入", out_of_year: "该年无记录" })[level] || "未知";
}
