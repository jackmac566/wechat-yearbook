import React from "react";

export const icons = {
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

export function Icon({ name, size = 20 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill={name === "overview" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={icons[name]} /></svg>;
}

export const typeLabels = { text: "文字", image: "图片", voice: "语音", sticker: "表情", video: "视频", link: "链接", file: "文件", poke: "拍一拍", call: "通话", location: "位置", red_packet: "红包", transfer: "转账", other: "其他类型" };
export const typeColors = { text: "#13966f", image: "#65c6a7", voice: "#f0b658", sticker: "#8c7ae6", video: "#ef7b73", link: "#5b8def", file: "#96a0aa", poke: "#ec8bb5", call: "#2aa6b7" };
export const compact = new Intl.NumberFormat("zh-CN", { notation: "compact", maximumFractionDigits: 1 });
export const number = new Intl.NumberFormat("zh-CN");

export function PanelHead({ title, subtitle, badge, link, onLink }) { return <div className="panel-head"><div><h3>{title}</h3><p>{subtitle}</p></div>{badge && <span>{badge}</span>}{link && <button onClick={onLink}>{link} →</button>}</div>; }
export function CoverageRow({ name, level }) { return <div><span><i className={`dot ${level}`} />{name}</span><b className={level}>{levelText(level)}</b></div>; }
export function MiniStat({ label, value }) { return <div><span>{label}</span><b>{number.format(value)}</b><small>条</small></div>; }
export function BigNumber({ label, value, unit }) { return <div><span>{label}</span><b>{number.format(value)}</b><small>{unit}</small></div>; }
export function MoneyCard({ kind, amount, count, tone }) { return <div className={`money-card ${tone}`}><span>{kind}</span><b><small>¥</small>{amount}</b><em>{count}</em></div>; }
export function SourceRow({ name, description, level, count }) { return <div><span><i className={`dot ${level}`} /><b>{name}</b><small>{description}</small></span><em>{level === "complete" || level === "partial" ? `${number.format(count)} 条记录` : "—"}</em><strong className={level}>{levelText(level)}</strong></div>; }
export function AccuracyNote({ title, children }) { return <section className="accuracy-note wide"><span>i</span><div><b>{title}</b>{children}</div></section>; }
export function Metric({ tone, label, value, unit, note, source }) {
  return <section className={`metric-card ${tone}`}>
    <header className="metric-meta"><p>{label}</p><span className="metric-status">{levelText(source.level)}</span></header>
    <h3>{source.hasYear ? <>{number.format(value)} <small>{unit}</small></> : "—"}</h3>
    {source.hasYear && <div>{note}</div>}
  </section>;
}
export function ReportEmpty({ name, source, year, onImport }) {
  return <div className="detail-grid"><section className="panel wide">
    <PanelHead title={`${name}暂不可用`} subtitle={sourceUnavailable(name, source.level, year)} />
    <button className="primary-button" onClick={onImport}><Icon name="upload" size={17} />导入文件</button>
  </section></div>;
}

export function FileGuide({ active, onSelect, className = "" }) {
  return <section className={`panel file-guide-panel ${className}`}>
    <div className="guide-tabs" aria-label="文件类型">
      {[
        ["chat", "chat", "聊天记录"],
        ["payment", "money", "支付账单"],
        ["moments", "moments", "朋友圈"],
      ].map(([key, icon, label]) => <button key={key} aria-pressed={active === key} className={active === key ? "active" : ""} onClick={() => onSelect(key)}><Icon name={icon} size={18} /><b>{label}</b></button>)}
    </div>
    <GuideContent kind={active} />
  </section>;
}

export function GuideContent({ kind }) {
  if (kind === "payment") return <div className="guide-content">
    <h3>下载个人对账账单</h3>
    <ol>
      <li>手机微信打开「我 → 服务 → 钱包 → 账单」。</li>
      <li>右上角点「常见问题 → 下载账单」，选择个人对账和所需日期。</li>
      <li>按页面提示取得账单。收到压缩包时先解压，再选择其中的 CSV。</li>
    </ol>
    <p>账单用于核对收发红包和转账的金额与笔数。</p>
  </div>;

  if (kind === "chat") return <div className="guide-content">
    <h3>导入聊天文件</h3>
    <p>已有聊天 ZIP、TXT、JSON 或 CSV，直接选择文件即可。微信合并转发只包含你选中的消息。</p>
    <details className="guide-extra">
      <summary>还没有聊天文件</summary>
      <ol>
        <li>在 Mac 微信多选消息，打开「合并转发 → 其他应用」。</li>
        <li>如果使用本机接收工具，例如「渡口」，可选择「暂存到渡口」，再把转发文件拖到微信年轮。</li>
        <li>选出你的昵称，填写这段聊天的会话名称。</li>
      </ol>
    </details>
  </div>;

  return <div className="guide-content">
    <h3>导入已有的朋友圈文件</h3>
    <p>选择兼容的朋友圈 JSON 或 CSV。结果会标注文件中实际记录的范围。</p>
  </div>;
}

export function levelText(level) { return ({ complete: "完整", partial: "可能不完整", missing: "未导入", out_of_year: "该年无记录" })[level] || "未知"; }
export function sourceUnavailable(name, level, year) { return level === "out_of_year" ? `已导入的${name}中没有 ${year} 年的数据。` : `${name}待导入。`; }
export function formatHour(hour) { return hour === null || hour === undefined ? "暂无" : `${String(hour).padStart(2, "0")}:00`; }
export function dateTime(date) { return date ? date.toLocaleString("zh-CN", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "暂无记录"; }
export function dateShort(date) { return date ? date.toLocaleDateString("zh-CN", { month: "long", day: "numeric" }) : ""; }
export function dateRange(first, last) {
  if (!first || !last) return "暂无记录";
  const sameYear = first.getFullYear() === last.getFullYear();
  const format = (date) => date.toLocaleDateString("zh-CN", sameYear ? { month: "long", day: "numeric" } : { year: "numeric", month: "long", day: "numeric" });
  return `${format(first)} — ${format(last)}`;
}
