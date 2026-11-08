import React from 'react'
import { BigNumber, Icon, PanelHead, ReportEmpty, dateRange, levelText, number } from './ui.jsx'
import './data-panels.css'

export function MomentsPanel({ stats, source, onImport }) {
  if (!source.hasYear) return <ReportEmpty name="朋友圈记录" source={source} year={stats.year} onImport={onImport} />
  const maxMoment = Math.max(...stats.momentMonths.flatMap((month) => [month.posts, month.comments, month.likes]), 1)
  const barHeight = (value) => `${value > 0 ? Math.max(4, (value / maxMoment) * 100) : 0}%`
  const { known, unknown } = stats.momentOwnershipCounts
  const hasAttribution = known > 0 || unknown === 0
  const range = stats.observedRanges.moments
  return (
    <div className="detail-grid">
      <section className="detail-hero purple">
        <span>{stats.year} 年 · {levelText(source.level)}</span>
        <h2>{hasAttribution ? '朋友圈活动' : '暂未确认本人足迹'}</h2>
        <p>已导入记录 {dateRange(range.first, range.last)}</p>
      </section>

      {hasAttribution && <>
      <section className="panel wide">
        <PanelHead title="月度朋友圈足迹" subtitle="按已识别的本人操作统计 · — 表示未见本人记录" link="补充朋友圈文件" onLink={onImport} />
        <div className="dp-chart-controls">
          <div className="dp-chart-legend">
            <span className="dp-legend-item"><i className="dp-post" />发表</span>
            <span className="dp-legend-item"><i className="dp-comment" />评论</span>
            <span className="dp-legend-item"><i className="dp-like" />点赞</span>
          </div>
        </div>
        <div className="dp-bars dp-moments-chart" role="img" aria-label={`${stats.year} 年朋友圈足迹按月分布`}>
          {stats.momentMonths.map((month, index) => {
            const observed = month.posts + month.comments + month.likes > 0
            return <div className="dp-bar-group" key={index}>
              <div className="dp-bar-stack">{observed ? <>
                <i className="dp-post" style={{ height: barHeight(month.posts) }} title={`${index + 1}月 · 发表 ${month.posts} 条`} />
                <i className="dp-comment" style={{ height: barHeight(month.comments) }} title={`${index + 1}月 · 评论 ${month.comments} 条`} />
                <i className="dp-like" style={{ height: barHeight(month.likes) }} title={`${index + 1}月 · 点赞 ${month.likes} 次`} />
              </> : <span className="dp-bar-unobserved" title={`${index + 1} 月 · 未见本人记录`}>—</span>}</div>
              <b>{index + 1}月</b>
            </div>
          })}
        </div>
      </section>

      <section className={`panel ${unknown === 0 ? 'wide' : ''}`}>
        <PanelHead title="本人操作合计" />
        <div className="moment-cards">
          <BigNumber label="发表朋友圈" value={stats.momentsPosts} unit="条" />
          <BigNumber label="评论朋友圈" value={stats.momentsComments} unit="条" />
          <BigNumber label="点过赞" value={stats.momentsLikes} unit="次" />
        </div>
      </section>
      </>}

      {unknown > 0 && <section className={`panel dp-ownership-card has-unknown ${hasAttribution ? '' : 'wide'}`}>
        <PanelHead title="归属未确认" />
          <div className="dp-ownership-hero"><b>{number.format(unknown)}</b><span>条记录无法确认本人归属</span></div>
          <button className="primary-button" onClick={onImport}><Icon name="upload" size={17} />导入含本人标记的记录</button>
      </section>}
    </div>
  )
}

export default MomentsPanel
