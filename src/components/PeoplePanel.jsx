import React from 'react'
import { PanelHead, ReportEmpty, levelText, dateTime, number } from './ui.jsx'

const messageTotal = ({ sent, received, unknown }) => sent + received + unknown

function PersonRow({ person, index }) {
  const maxMonth = Math.max(...person.months.map(messageTotal), 1)
  const total = messageTotal(person)
  const width = (count) => `${count / (total || 1) * 100}%`
  return <div className="dp-person-row">
    <em className="dp-rank">{String(index + 1).padStart(2, '0')}</em>
    <span className={`avatar av-${index % 6}`}>{person.name.slice(0, 1)}</span>
    <div className="dp-person-name"><b title={person.name}>{person.name}</b><small>最近一条 {dateTime(person.lastDate)}</small></div>
    <div className="dp-person-bars">
      <div className="dp-dual-track">
        <i className="dp-sent" style={{ width: width(person.sent) }} />
        <i className="dp-recv" style={{ left: width(person.sent), width: width(person.received) }} />
        <i className="dp-unknown" style={{ left: width(person.sent + person.received), width: width(person.unknown) }} />
      </div>
      <div className="dp-dual-nums">
        <span className="dp-sent">发出 {number.format(person.sent)}</span>
        <span className="dp-recv">收到 {number.format(person.received)}</span>
        {person.unknown > 0 && <span className="dp-unknown">未知 {number.format(person.unknown)}</span>}
      </div>
    </div>
    <div className="dp-person-months" aria-label="月度消息趋势">{person.months.map((month, monthIndex) => {
      const monthTotal = messageTotal(month)
      const height = monthTotal ? Math.max(12, (monthTotal / maxMonth) * 100) : 0
      const share = (count) => `${count / (monthTotal || 1) * 100}%`
      return <div className="dp-mini-month" key={monthIndex} title={monthTotal ? `${monthIndex + 1} 月 · 发出 ${month.sent} · 收到 ${month.received}${month.unknown ? ` · 未知 ${month.unknown}` : ''}` : `${monthIndex + 1} 月 · 未见导入记录`}>
        <i className="dp-mini-track"><u style={{ height: `${height}%` }}><b className="dp-unknown" style={{ height: share(month.unknown) }} /><b className="dp-recv" style={{ height: share(month.received) }} /><b className="dp-sent" style={{ height: share(month.sent) }} /></u></i>
      </div>
    })}</div>
    <strong className="dp-person-total">{number.format(total)}<small> 条</small></strong>
  </div>
}

export function PeoplePanel({ stats, source, onImport }) {
  if (!source.hasYear) return <ReportEmpty name="聊天记录" source={source} year={stats.year} onImport={onImport} />
  return <div className="detail-grid">
    <section className="detail-hero teal"><span>{stats.year} 年 · {source.hasFragments ? '含转发片段' : levelText(source.level)}</span><h2>会话互动</h2><p>按已导入的消息量排序。私聊和群聊各按会话统计。</p></section>
    <section className="panel wide"><PanelHead title="会话消息排行" subtitle="显示消息最多的 12 个会话，含方向未知的消息" />
      <div className="dp-people-legend"><span><i className="dp-sent" />发出</span><span><i className="dp-recv" />收到</span>{stats.directionUnknown > 0 && <span><i className="dp-unknown" />方向未知</span>}<span>右侧柱形为月度趋势</span></div>
      {stats.conversations.length ? <div className="dp-people-list">{stats.conversations.map((person, index) => <PersonRow key={`${person.name}-${index}`} person={person} index={index} />)}</div> : <p className="report-empty-note">当前记录中没有可统计的会话。</p>}
    </section>
  </div>
}
