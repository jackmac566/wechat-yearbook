import React from 'react'
import { PanelHead, Metric, levelText, sourceUnavailable, formatHour, typeLabels, typeColors, compact, number, dateRange } from './ui.jsx'

export function OverviewPanel({ stats, quality, onImport, onPeople }) {
  const { messages, payments, moments } = quality
  const momentsAttributed = stats.momentOwnershipCounts.known > 0 || stats.momentOwnershipCounts.unknown === 0
  const maxMonth = Math.max(...stats.monthCounts, ...stats.receivedMonthCounts, 1)
  const observedMonths = new Set()
  const unknownMonths = Array(12).fill(0)
  for (const day of stats.dailyCounts) {
    if (!day.observed) continue
    const month = Number(day.date.slice(5, 7))
    observedMonths.add(month)
    unknownMonths[month - 1] += day.unknown
  }
  const typeEntries = Object.entries(stats.typeCounts).filter(([key]) => key !== 'other').sort((a, b) => b[1] - a[1]).slice(0, 5)
  const otherCount = stats.sent - typeEntries.reduce((sum, [, count]) => sum + count, 0)
  if (otherCount > 0) typeEntries.push(['other', otherCount])
  const totalTypes = stats.sent || 1
  const stops = typeEntries.reduce((result, [key, count]) => {
    const end = result.end + (count / totalTypes) * 100
    return { end, values: [...result.values, `${typeColors[key] || '#aab3ae'} ${result.end}% ${end}%`] }
  }, { end: 0, values: [] }).values.join(', ')
  const sources = [
    { key: 'messages', name: '聊天记录', range: stats.observedRanges.messages, source: messages, note: messages.hasFragments ? '含转发片段' : '' },
    { key: 'payments', name: '支付账单', range: stats.observedRanges.payments, source: payments, note: payments.level === 'complete' ? '账期覆盖全年' : '' },
    { key: 'moments', name: '朋友圈', range: stats.observedRanges.moments, source: moments, note: !momentsAttributed ? '本人归属未知' : '' },
  ]
  return (
    <div className="page-grid">
      <section className="hero-card">
        <div className="hero-orbit one" /><div className="hero-orbit two" />
        <div className="hero-copy">
          <span className="eyebrow">{stats.year} 年聊天总览</span>
          {messages.hasYear ? <>
            <h2>你发出了<br/><strong>{number.format(stats.sent)}</strong> 条消息</h2>
            <p>{messages.hasFragments ? '含转发片段，仅统计已导入记录。' : dateRange(stats.observedRanges.messages.first, stats.observedRanges.messages.last)}</p>
            <div className="hero-pills"><span><b>{stats.activeDays}</b> 个活跃日</span><span>最长连续 <b>{stats.streak}</b> 天</span>{stats.peakHour !== null && <span>最常在 <b>{formatHour(stats.peakHour)}</b> 出现</span>}</div>
          </> : <>
            <h2>聊天统计暂不可用</h2>
            <p>{sourceUnavailable('聊天记录', messages.level, stats.year)}</p>
          </>}
        </div>
        <div className="year-ring"><div><span>{stats.year}</span><small>微信年轮</small></div></div>
      </section>

      <div className="metric-row">
        <Metric tone="mint" label="识别到的本人撤回" value={stats.ownRevokes} unit="条" note="按已导入的撤回提示统计" source={messages} />
        <Metric tone="sand" label="识别到的删除标记" value={stats.knownDeleted} unit="条" note="按已导入的删除标记统计" source={messages} />
        <Metric tone="lilac" label="本人发表的朋友圈" value={stats.momentsPosts} unit="条" note={`${stats.momentsComments} 条评论 · ${stats.momentsLikes} 次点赞`} source={momentsAttributed ? moments : { ...moments, hasYear: false }} />
        <Metric tone="coral" label="发出红包" value={stats.redSentCount} unit="个" note={`合计 ¥${stats.redSentAmount}`} source={payments} />
      </div>

      {messages.hasYear && <>
      <section className="panel chart-panel dp-month-panel"><PanelHead title="月度聊天趋势" subtitle="— 表示未见导入记录" />
        <div className="dp-legend"><span><i className="dp-sent" />发出</span><span><i className="dp-recv" />收到</span>{stats.directionUnknown > 0 && <span>{number.format(stats.directionUnknown)} 条方向未知，另计</span>}</div>
        <div className="dp-month-chart">{stats.monthCounts.map((sent, index) => {
          const received = stats.receivedMonthCounts[index]
          const observed = observedMonths.has(index + 1)
          const unknown = unknownMonths[index]
          return <div className="dp-month-col" key={index} title={observed ? `${index + 1} 月 · 发出 ${sent} · 收到 ${received}${unknown ? ` · 方向未知 ${unknown}` : ''}` : `${index + 1} 月 · 未见导入记录`}>
            {observed && <span className="dp-bar-value">{`发 ${compact.format(sent)} · 收 ${compact.format(received)}`}</span>}
            <div className="dp-month-bars">{observed ? <>
              <div className="dp-track"><i className="dp-sent" style={{ height: `${Math.max(sent ? 3 : 0, (sent / maxMonth) * 100)}%` }} /></div>
              <div className="dp-track"><i className="dp-recv" style={{ height: `${Math.max(received ? 3 : 0, (received / maxMonth) * 100)}%` }} /></div>
            </> : <span className="dp-month-unobserved">—</span>}</div>
            <b>{index + 1}月</b>
          </div>
        })}</div>
      </section>

      <section className="panel type-panel"><PanelHead title="发出的消息类型" subtitle="按已识别类型统计" />
        <div className="type-body"><div className="donut" style={{ background: `conic-gradient(${stops || '#dfe8e4 0 100%'})` }}><div><strong>{compact.format(stats.sent)}</strong><span>发送总量</span></div></div><div className="type-list">{typeEntries.map(([key, count]) => <div key={key}><i style={{ background: typeColors[key] || '#aab3ae' }} /><span>{typeLabels[key] || key}</span><b>{number.format(count)}</b><em>{Math.round((count / totalTypes) * 100)}%</em></div>)}</div></div>
      </section>
      </>}

      <section className="panel wide dp-range-panel"><PanelHead title="已导入的数据" subtitle="日期为导入记录的最早与最晚时间" link="补充数据" onLink={onImport} />
        {sources.map(({ key, name, range, source, note }) => <div className="dp-range-row" key={key}>
          <span className="dp-range-name"><i className={`dot ${source.level}`} /><b>{name}</b>{note && <small>{note}</small>}</span>
          <em>{source.hasYear ? `${number.format(range.count)} 条记录` : '—'}</em>
          <span className="dp-range-dates">{dateRange(range.first, range.last)}</span>
          <strong className={source.level}>{levelText(source.level)}</strong>
        </div>)}
      </section>

      {messages.hasYear && (
        <section className="panel contacts-panel"><PanelHead title="发出消息最多的会话" link="查看关系温度" onLink={onPeople} />
          {stats.topContacts.length ? <div className="contact-list">{stats.topContacts.slice(0, 5).map((item, index) => <div className="contact-item" key={item.name}><span className={`avatar av-${index}`}>{item.name.slice(0, 1)}</span><div><b>{item.name}</b><span><i style={{ width: `${item.share}%` }} /></span></div><strong>{number.format(item.count)}<small> 条</small></strong></div>)}</div> : <p className="report-empty-note">当前记录中没有由你发出的消息。</p>}
        </section>
      )}

    </div>
  )
}
