import { useState } from "react";
import "./report-charts.css";

const number = new Intl.NumberFormat("zh-CN");
const weekdays = ["一", "二", "三", "四", "五", "六", "日"];
const directions = [
  ["sent", "发出"],
  ["received", "收到"],
  ["unknown", "方向未知"],
];

function chartValue(row, key) {
  const value = row.values?.[key];
  return row.observed !== false && Number.isFinite(value) && value >= 0 ? value : null;
}

function scaleFor(maximum) {
  if (maximum <= 1 && Number.isInteger(maximum)) return [1, 0];
  const stepSize = maximum / 4;
  const power = 10 ** Math.floor(Math.log10(stepSize));
  const normalized = stepSize / power;
  const step = (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) * power;
  const intervals = Math.ceil(maximum / step - 1e-9);
  return Array.from({ length: intervals + 1 }, (_, index) => step * (intervals - index));
}

export function SeriesChart({ rows, series, label, formatValue = number.format }) {
  if (!rows.length || !series.length) return null;
  const maximum = rows.reduce((largest, row) =>
    series.reduce((max, { key }) => Math.max(max, chartValue(row, key) ?? 0), largest), 0);
  const ticks = scaleFor(maximum);
  const plotWidth = rows.length * Math.max(29, series.length * 9);
  return <figure className="report-chart" aria-label={label}>
    <div className="report-chart-key" aria-hidden="true">
      {series.map(({ key, label: name, color }) =>
        <span key={key}><i style={{ "--report-color": color }} />{name}</span>)}
      {rows.some((row) => row.observed === false) && <span className="report-chart-note">— 未见导入记录</span>}
    </div>
    <div className="report-chart-scroll" tabIndex={0} role="region" aria-label={`${label}图表，可展开查看具体数值`}>
      <div className="report-chart-body" aria-hidden="true">
        <div className="report-chart-axis">
          {ticks.map((tick, index) => <span key={index}>{formatValue(tick)}</span>)}
        </div>
        <div className="report-chart-plot" style={{
          "--report-columns": rows.length,
          "--report-grid-spacing": `${100 / (ticks.length - 1)}%`,
          "--report-plot-width": `${plotWidth}px`,
        }}>
          {rows.map((row, index) => {
            const tooltip = row.observed === false ? `${row.label} · 未见导入记录` :
              [row.label, ...series.map(({ key, label: name }) => {
                const value = chartValue(row, key);
                return `${name} ${value === null ? "—" : formatValue(value)}`;
              })].join("\n");
            return <div className="report-chart-column" key={index} title={tooltip}>
              <div className="report-chart-bars">
                {row.observed === false ? <span className="report-chart-unobserved">—</span> : series.map(({ key, color }) => {
                  const value = chartValue(row, key);
                  return value === null ? null : <i key={key} className={value === 0 ? "report-chart-zero" : ""} style={{
                    "--report-height": `${100 * value / ticks[0]}%`,
                    "--report-color": color,
                  }} />;
                })}
              </div>
              <span className="report-chart-period">{row.label}</span>
            </div>;
          })}
        </div>
      </div>
    </div>
    <details className="report-chart-details">
      <summary>查看具体数值</summary>
      <div className="report-chart-table-scroll">
        <table>
          <caption className="report-chart-sr-only">{label}</caption>
          <thead><tr><th scope="col">时段</th>{series.map(({ key, label: name }) => <th scope="col" key={key}>{name}</th>)}<th scope="col">记录状态</th></tr></thead>
          <tbody>{rows.map((row, index) => <tr key={index}>
            <th scope="row">{row.label}</th>
            {series.map(({ key }) => {
              const value = chartValue(row, key);
              return <td key={key}>{value === null ? "—" : formatValue(value)}</td>;
            })}
            <td>{row.observed === false ? "未见导入记录" : "已有导入记录或覆盖依据"}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </details>
  </figure>;
}

function dailyTotal(day) {
  return day.sent + day.received + day.unknown;
}

function weekColumn(day) {
  const weekday = new Date(`${day.date}T00:00:00Z`).getUTCDay();
  return (weekday + 6) % 7;
}

export function ActivityCalendar({ dailyCounts }) {
  const months = Array.from({ length: 12 }, () => []);
  for (const day of dailyCounts) months[Number(day.date.slice(5, 7)) - 1].push(day);
  const [selectedMonth, setSelectedMonth] = useState(() =>
    Math.max(0, months.findIndex((days) => days.some((day) => day.observed))));
  const maximum = dailyCounts.reduce((max, day) => day.observed ? Math.max(max, dailyTotal(day)) : max, 1);

  return <figure className="report-chart report-calendar" aria-label="全年聊天活动日历">
    <div className="report-calendar-key" aria-hidden="true">
      <span><i data-intensity="missing" />未见导入记录</span>
      <span><i data-intensity="0" />已确认零条</span>
      <span className="report-calendar-scale">消息少
        {[1, 2, 3, 4].map((intensity) => <i key={intensity} data-intensity={intensity} />)}
      多</span>
    </div>
    <div className="report-calendar-months" aria-hidden="true">
      {months.map((days, month) => <div className="report-calendar-month" key={month}>
        <strong>{month + 1} 月</strong>
        <div className="report-calendar-grid">
          {weekdays.map((day) => <span className="report-calendar-weekday" key={day}>{day}</span>)}
          {days.map((day, index) => {
            const count = dailyTotal(day);
            const intensity = day.observed ? Math.ceil(Math.sqrt(count / maximum) * 4) : "missing";
            const tooltip = day.observed ? `${day.date}\n${directions.map(([key, name]) => `${name} ${number.format(day[key])}`).join(" · ")}` : `${day.date}\n未见导入记录`;
            return <i key={day.date} data-intensity={intensity} title={tooltip}
              style={index === 0 ? { gridColumnStart: weekColumn(day) + 1 } : undefined} />;
          })}
        </div>
      </div>)}
    </div>
    <details className="report-chart-details">
      <summary>查看每日消息明细</summary>
      <label className="report-calendar-picker">月份
        <select value={selectedMonth} onChange={(event) => setSelectedMonth(Number(event.target.value))}>
          {months.map((_, month) => <option key={month} value={month}>{month + 1} 月</option>)}
        </select>
      </label>
      <div className="report-chart-table-scroll">
        <table>
          <caption className="report-chart-sr-only">{selectedMonth + 1} 月每日聊天明细</caption>
          <thead><tr><th scope="col">日期</th>{directions.map(([key, name]) => <th scope="col" key={key}>{name}</th>)}<th scope="col">记录状态</th></tr></thead>
          <tbody>{months[selectedMonth].map((day) => <tr key={day.date}>
            <th scope="row">{day.date}</th>
            {directions.map(([key]) => <td key={key}>{day.observed ? number.format(day[key]) : "—"}</td>)}
            <td>{day.observed ? "已有导入记录或覆盖依据" : "未见导入记录"}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </details>
  </figure>;
}
