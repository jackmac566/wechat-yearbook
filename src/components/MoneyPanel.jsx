import React, { useState } from 'react'
import { Icon, MiniStat, MoneyCard, PanelHead, dateRange, dateShort, levelText, number } from './ui.jsx'
import './data-panels.css'

const moneySeries = [
  ['redSent', '红包发出', 'dp-red-sent', '个'],
  ['redReceived', '红包收到', 'dp-red-recv', '个'],
  ['transferSent', '转账支出', 'dp-tf-sent', '笔'],
  ['transferReceived', '转账收入', 'dp-tf-recv', '笔'],
]

function ChatRedPackets({ counts }) {
  if (!counts.sent && !counts.received && !counts.unknown) return null
  return <section className="panel wide">
    <PanelHead title="聊天里的红包标记" subtitle="按聊天片段统计。金额和领取情况以支付账单为准。" />
    <div className="small-stat-grid">
      <MiniStat label="我发出的标记" value={counts.sent} />
      <MiniStat label="他人发出的标记" value={counts.received} />
      {counts.unknown > 0 && <MiniStat label="发送人未确认" value={counts.unknown} />}
    </div>
  </section>
}

const billTime = new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
const billDay = (date) => [date.getFullYear(), date.getMonth() + 1, date.getDate()].map((part) => String(part).padStart(2, '0')).join('-')

function SentRedPacketDetails({ payments, year }) {
  const [day, setDay] = useState('')
  if (!payments.length) return null
  const entries = day ? payments.filter(({ date }) => billDay(date) === day).sort((left, right) => left.date - right.date) : []
  return <details className="panel wide red-packet-details">
    <summary>查看发出红包明细</summary>
    <label>账单日期 <input type="date" min={`${year}-01-01`} max={`${year}-12-31`} value={day} onChange={(event) => setDay(event.target.value)} /></label>
    {day && (entries.length ? <table>
      <thead><tr><th scope="col">时间</th><th scope="col">金额</th></tr></thead>
      <tbody>{entries.map(({ date, amount }, index) => <tr key={index}><td>{billTime.format(date)}</td><td>¥{amount.toFixed(2)}</td></tr>)}</tbody>
    </table> : <p className="report-empty-note">导入的账单里未见当天的红包支出。</p>)}
  </details>
}

export function MoneyPanel({ stats, source, onImport }) {
  const [mode, setMode] = useState('amount')
  if (!source.hasYear) return <div className="detail-grid">
    <section className="panel wide">
      <PanelHead title="导入账单查看金额" subtitle={source.level === 'out_of_year' ? `当前账单未覆盖 ${stats.year} 年` : '微信支付账单提供红包和转账的实际收支。'} />
      <button className="primary-button" onClick={onImport}><Icon name="upload" size={17} />获取并导入账单</button>
    </section>
    <ChatRedPackets counts={stats.chatRedPackets} />
  </div>
  const valueOf = (bucket) => (mode === 'count' ? bucket.count : Number(bucket.amount))
  const maxValue = Math.max(...stats.paymentMonths.flatMap((month) => moneySeries.map(([key]) => valueOf(month[key]))), 1)
  const barHeight = (value) => `${value > 0 ? Math.max(4, (value / maxValue) * 100) : 0}%`
  const covered = stats.paymentMonthCoverage.filter(Boolean).length
  const range = stats.observedRanges.payments
  return (
    <div className="detail-grid">
      <section className="detail-hero orange">
        <span>{stats.year} 年 · {levelText(source.level)}</span>
        <h2>红包与转账</h2>
        <p>{range.count > 0 ? `已导入记录 ${dateRange(range.first, range.last)}` : '已导入账期，本年未见交易记录。'}</p>
      </section>

      <section className="panel wide">
        <PanelHead title="红包与转账汇总" subtitle="金额和次数以导入账单为准" link="补充账单" onLink={onImport} />
        <div className="money-grid">
          <MoneyCard kind="红包发出" amount={stats.redSentAmount} count={`${stats.redSentCount} 个`} tone="red" />
          <MoneyCard kind="红包收到" amount={stats.redReceivedAmount} count={`${stats.redReceivedCount} 个`} tone="green" />
          <MoneyCard kind="转账支出" amount={stats.transferSentAmount} count={`${stats.transferSentCount} 笔`} tone="blue" />
          <MoneyCard kind="转账收入" amount={stats.transferReceivedAmount} count={`${stats.transferReceivedCount} 笔`} tone="purple" />
        </div>
      </section>

      <SentRedPacketDetails key={stats.year} payments={stats.sentRedPacketPayments} year={stats.year} />

      <section className="panel wide">
        <PanelHead title="月度收支" subtitle="— 表示未见可统计记录，且未证实覆盖整月" badge={mode === 'amount' ? '金额 · 元' : '次数'} />
        <div className="dp-chart-controls">
          <div className="dp-toggle" role="group" aria-label="显示单位">
            <button aria-pressed={mode === 'amount'} className={mode === 'amount' ? 'active' : ''} onClick={() => setMode('amount')}>金额</button>
            <button aria-pressed={mode === 'count'} className={mode === 'count' ? 'active' : ''} onClick={() => setMode('count')}>次数</button>
          </div>
          <div className="dp-chart-legend">
            {moneySeries.map(([key, label, tone]) => <span className="dp-legend-item" key={key}><i className={tone} />{label}</span>)}
          </div>
        </div>
        <div className="dp-bars dp-money-chart" role="img" aria-label={`${stats.year} 年红包与转账月度收支走势`}>
          {stats.paymentMonths.map((month, index) => {
            const observed = stats.paymentMonthCoverage[index] || moneySeries.some(([key]) => month[key].count > 0)
            return <div className="dp-bar-group" key={index}>
              <div className="dp-bar-stack">{observed ? moneySeries.map(([key, label, tone, unit]) => (
                <i key={key} className={tone} style={{ height: barHeight(valueOf(month[key])) }} title={`${index + 1}月 · ${label}${mode === 'amount' ? ` ¥${month[key].amount}` : ` ${month[key].count} ${unit}`}`} />
              )) : <span className="dp-bar-unobserved" title={`${index + 1} 月 · 未见可统计记录，且未证实覆盖整月`}>—</span>}</div>
              <b>{index + 1}月</b>
            </div>
          })}
        </div>
      </section>

      <section className="panel wide">
        <PanelHead title="账期覆盖" badge={`${covered} / 12 个月`} />
        <div className="dp-coverage-strip" role="img" aria-label="账单账期覆盖的月份">
          {stats.paymentMonthCoverage.map((coveredMonth, index) => (
            <span key={index} className={coveredMonth ? 'covered' : ''} title={coveredMonth ? '账期覆盖整月' : '未证实覆盖整月'}>{index + 1}月</span>
          ))}
        </div>
        <div className="dp-coverage-legend">
          <i className="covered" /><span>账期覆盖整月</span>
          <i /><span>未证实覆盖整月</span>
        </div>
      </section>

      <section className="panel">
        <PanelHead title="最大单笔转账支出" />
        {stats.maxTransfer ? <div className="max-money"><span>¥</span><strong>{stats.maxTransfer.amount.toFixed(2)}</strong><small>{stats.maxTransfer.counterparty} · {dateShort(stats.maxTransfer.date)}</small></div> : <p className="report-empty-note">已导入的账单中没有有效转账支出。</p>}
      </section>

      <section className="panel">
        <PanelHead title="未计入汇总的交易" />
        {stats.excludedPayments > 0 ? (
          <div className="dp-excluded"><b>{number.format(stats.excludedPayments)}</b><span>笔失败、退款、退还、撤销、关闭或取消</span></div>
        ) : <p className="report-empty-note">已导入的账单中没有需要排除的无效交易。</p>}
      </section>

      <ChatRedPackets counts={stats.chatRedPackets} />
    </div>
  )
}

export default MoneyPanel
