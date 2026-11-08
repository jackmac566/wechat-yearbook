import React, { useState } from 'react'
import { PanelHead, ReportEmpty, levelText, dateTime, formatHour, number, MiniStat, AccuracyNote, dateRange } from './ui.jsx'

const WEEKDAY_LABELS = ['一', '', '三', '', '五', '', '日']

function dayIndex(dateStr) {
  return (new Date(`${dateStr}T00:00:00Z`).getUTCDay() + 6) % 7
}

function buildWeeks(dailyCounts) {
  if (!dailyCounts.length) return []
  const weeks = []
  let current = Array(dayIndex(dailyCounts[0].date)).fill(null)
  for (const day of dailyCounts) {
    current.push(day)
    if (current.length === 7) {
      weeks.push(current)
      current = []
    }
  }
  if (current.length) weeks.push([...current, ...Array(7 - current.length).fill(null)])
  return weeks
}

function peakLabel(dateStr) {
  const [, month, day] = dateStr.split('-')
  return `${Number(month)}月${Number(day)}日`
}

function TimeCard({ title, hint, data }) {
  const total = data.sent + data.received + data.unknown
  const width = (count) => `${count / (total || 1) * 100}%`
  return <div className="dp-time-card">
    <header><b>{title}</b><small>{hint}</small><em>{number.format(total)} 条</em></header>
    <div className="dp-time-bars">
      <span><i>发出</i><b>{number.format(data.sent)}</b></span>
      <span><i>收到</i><b>{number.format(data.received)}</b></span>
      {data.unknown > 0 && <span><i>未知</i><b>{number.format(data.unknown)}</b></span>}
    </div>
    <div className="dp-time-track" aria-hidden="true"><u className="dp-sent" style={{ width: width(data.sent) }} /><u className="dp-recv" style={{ left: width(data.sent), width: width(data.received) }} /><u className="dp-unknown" style={{ left: width(data.sent + data.received), width: width(data.unknown) }} /></div>
  </div>
}

const messageTotal = ({ sent, received, unknown }) => sent + received + unknown

export function ChatTracePanel({ stats, source, onImport }) {
  const [hourDirection, setHourDirection] = useState('sent')
  if (!source.hasYear) return <ReportEmpty name="聊天记录" source={source} year={stats.year} onImport={onImport} />
  const weeks = buildWeeks(stats.dailyCounts)
  const maxTotal = Math.max(...stats.dailyCounts.map(messageTotal), 0)
  const levelOf = (total) => {
    if (!total) return 0
    if (total <= maxTotal * 0.25) return 1
    if (total <= maxTotal * 0.5) return 2
    if (total <= maxTotal * 0.75) return 3
    return 4
  }
  const monthLabels = weeks.map((week) => {
    const first = week.find(Boolean)
    return first ? Number(first.date.slice(5, 7)) : 0
  })
  const hourSeries = hourDirection === 'sent' ? stats.hourCounts : stats.receivedHourCounts
  const maxHour = Math.max(...hourSeries, 1)
  const seriesPeak = hourSeries.some((count) => count > 0) ? hourSeries.indexOf(Math.max(...hourSeries)) : null
  return <div className="detail-grid">
    <section className="detail-hero green"><span>{stats.year} 年 · {source.hasFragments ? '含转发片段' : levelText(source.level)}</span><h2>发出了 {number.format(stats.wordCount)} 个字</h2><p>{number.format(stats.sent)} 条发出 · {number.format(stats.received)} 条收到 · {source.hasFragments ? `${number.format(stats.typeCounts.voice || 0)} 条发出的语音` : `${stats.voiceMinutes} 分钟语音`}</p><p>{dateRange(stats.observedRanges.messages.first, stats.observedRanges.messages.last)}</p></section>

    <section className="panel wide dp-cal-panel"><PanelHead title="每日聊天活动" subtitle="颜色越深，当天导入的消息越多" badge={`${stats.activeDays} 天发过消息`} />
      <div className="dp-cal-scroll"><div className="dp-cal-main">
        <span className="dp-cal-corner" />
        <div className="dp-cal-months" style={{ gridTemplateColumns: `repeat(${weeks.length}, 1fr)` }}>{monthLabels.map((month, index) => <span key={index}>{month && month !== monthLabels[index - 1] ? `${month}月` : ''}</span>)}</div>
        <div className="dp-cal-weekdays">{WEEKDAY_LABELS.map((label, index) => <span key={index}>{label}</span>)}</div>
        <div className="dp-cal-weeks" style={{ gridTemplateColumns: `repeat(${weeks.length}, 1fr)` }}>{weeks.map((week, weekIndex) => <div className="dp-cal-week" key={weekIndex}>{week.map((day, dayPos) => day ? <div key={day.date} className={`dp-cal-day ${day.observed ? `lv${levelOf(messageTotal(day))}` : 'unobserved'}${day.date === stats.peakDay?.date ? ' peak' : ''}`} title={day.observed ? `${day.date} · 发出 ${day.sent} · 收到 ${day.received}${day.unknown ? ` · 方向未知 ${day.unknown}` : ''}` : `${day.date} · 未见导入记录`} /> : <div key={`pad-${dayPos}`} className="dp-cal-day pad" />)}</div>)}</div>
      </div></div>
      <div className="dp-cal-footer">
        <div className="dp-cal-legend"><i className="unobserved" /><span>未见记录</span><span>少</span>{[1, 2, 3, 4].map((level) => <i key={level} className={`lv${level}`} />)}<span>多</span></div>
        {stats.peakDay && <div className="dp-peak-note"><i /><span>发出最多的一天 <b>{peakLabel(stats.peakDay.date)}</b> · {number.format(stats.peakDay.count)} 条</span></div>}
      </div>
    </section>

    <section className="panel wide">
      <div className="dp-hour-head">
        <PanelHead title="聊天时段" subtitle="按本地时间汇总" />
        <div className="dp-hour-toggle" role="group" aria-label="消息方向">
          <button aria-pressed={hourDirection === 'sent'} className={hourDirection === 'sent' ? 'active' : ''} onClick={() => setHourDirection('sent')}>发出</button>
          <button aria-pressed={hourDirection === 'received'} className={hourDirection === 'received' ? 'active' : ''} onClick={() => setHourDirection('received')}>收到</button>
        </div>
      </div>
      <div className={`hour-chart ${hourDirection === 'received' ? 'dp-recv' : ''}`}>{hourSeries.map((count, hour) => <div key={hour} className={hour === seriesPeak ? 'peak' : ''}>{count > 0 && <i style={{ height: `${Math.max(4, (count / maxHour) * 100)}%` }} />}<span>{hour % 3 === 0 ? `${hour}:00` : ''}</span></div>)}</div>
      <p className="dp-hour-peak">{seriesPeak !== null ? <>{hourDirection === 'sent' ? '发出' : '收到'}峰值 <b>{number.format(hourSeries[seriesPeak])}</b> 条 · 出现在 <b>{formatHour(seriesPeak)}</b></> : '当前口径下没有可统计的消息。'}</p>
    </section>

    <section className="panel wide"><PanelHead title="工作日、周末与深夜" subtitle="深夜同时计入所在的工作日或周末" />
      <div className="dp-time-cards">
        <TimeCard title="工作日" hint="周一至周五" data={stats.activityTimeCounts.weekday} />
        <TimeCard title="周末" hint="周六与周日" data={stats.activityTimeCounts.weekend} />
        <TimeCard title="深夜" hint="00:00–05:59" data={stats.activityTimeCounts.lateNight} />
      </div>
    </section>

    {stats.directionUnknown > 0 && <section className="panel wide dp-unknown-panel">
      <div className="dp-unknown-number">{number.format(stats.directionUnknown)}</div>
      <div><b>条消息方向未知</b><p>只计入消息总数，收发分别统计。</p></div>
    </section>}

    <section className="panel"><PanelHead title="消息里程碑" /><div className="milestones"><div><i>01</i><span><b>第一条发出</b><small>{dateTime(stats.firstMessage?.date)}</small></span></div><div><i>12</i><span><b>最后一条发出</b><small>{dateTime(stats.lastMessage?.date)}</small></span></div><div><i>∞</i><span><b>最长连续发消息</b><small>{stats.streak} 天</small></span></div></div></section>
    <section className="panel"><PanelHead title="发出的其他消息" subtitle="按导出文件保留的类型识别" /><div className="small-stat-grid"><MiniStat label="图片" value={stats.typeCounts.image || 0} /><MiniStat label="表情包" value={stats.typeCounts.sticker || 0} /><MiniStat label="拍一拍" value={stats.typeCounts.poke || 0} /><MiniStat label="文件" value={stats.typeCounts.file || 0} /></div></section>
    <AccuracyNote title="撤回与删除"><p>只统计导入文件里仍保留的撤回提示和删除标记。</p></AccuracyNote>
  </div>
}
