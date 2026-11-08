import React from 'react'
import { Icon, PanelHead, dateRange, levelText, number } from './ui.jsx'
import './data-panels.css'

const sources = [
  ['messages', '聊天记录', '条'],
  ['payments', '微信支付账单', '笔'],
  ['moments', '朋友圈记录', '条'],
]

export function DataPrivacyPanel({ stats, dataset, quality, year, hasData, lastImport, onShare, onExport, onReset }) {
  return (
    <div className="detail-grid">
      <section className="privacy-hero">
        <div><Icon name="shield" size={26} /></div>
        <span><h2>记录只在这台 Mac 上分析</h2><p>退出应用会清空当前报告。想下次继续看，可以保存一份私人备份。</p></span>
      </section>

      {hasData && <section className="panel wide">
        <PanelHead title="已导入的记录" subtitle={`${year} 年`} />
        <div className="dp-source-cards">
          {sources.map(([key, name, unit]) => {
            const source = quality[key]
            const range = stats.observedRanges[key]
            return (
              <article className="dp-source-card" key={key}>
                <header>
                  <i className={`dot ${source.level}`} />
                  <div><b>{name}</b></div>
                  <em className={source.level}>{source.hasFragments ? '含转发片段' : levelText(source.level)}</em>
                </header>
                <dl>
                  <div><dt>记录日期</dt><dd>{range.count ? dateRange(range.first, range.last) : '—'}</dd></div>
                  <div><dt>导入记录</dt><dd>{source.hasYear ? `${number.format(range.count)} ${unit}` : '—'}</dd></div>
                </dl>
              </article>
            )
          })}
        </div>
        <div className="data-actions"><button className="danger-button" onClick={onReset}>清除当前报告</button></div>
      </section>}

      <section className="panel wide">
        <PanelHead title="导出" subtitle={hasData ? undefined : '导入记录后可分享或备份'} />
        <div className="dp-export-zones">
          <article className="dp-export-zone safe">
            <header><span className="dp-zone-icon safe"><Icon name="share" size={17} /></span><div><b>年报分享图</b><small>隐藏姓名、原文和具体金额</small></div><em>PNG</em></header>
            {hasData && <div className="export-actions"><button className="ghost-button export-button" onClick={onShare}>预览分享图</button></div>}
          </article>
          <article className="dp-export-zone raw">
            <header><span className="dp-zone-icon raw"><Icon name="data" size={17} /></span><div><b>私人备份</b><small>含原文和金额，可重新导入</small></div><em>JSON</em></header>
            {hasData && <div className="export-actions">
              <button className="ghost-button export-button" onClick={() => onExport('year')}>备份 {year} 年</button>
              <button className="ghost-button export-button" onClick={() => onExport('all')}>备份全部年份</button>
            </div>}
          </article>
        </div>
      </section>

      {(lastImport || dataset.diagnostics?.length > 0) && <details className="panel wide import-diagnostics" open={Boolean(lastImport?.failures?.length)}>
        <summary>导入检查</summary>
        {lastImport?.cancelled && <p className="import-result">上一批导入已取消。</p>}
        {lastImport?.failures?.length > 0 && <div className="import-result"><ul>{lastImport.failures.map(({ name, reason }, index) => <li key={index}><b>{name}</b><span>{reason}</span></li>)}</ul></div>}
        {dataset.diagnostics?.length > 0 && <div className="diagnostic-list">{dataset.diagnostics.slice(-20).map((item, index) => <div key={`${item.file}-${index}`}><span title={item.file}>{item.file}</span><b>{number.format(item.parsed)} 条已识别</b><em className={item.skipped ? 'warning' : 'complete'}>{item.skipped ? `${item.skipped} 条跳过` : '无跳过'}</em></div>)}</div>}
        {dataset.diagnostics?.length > 20 && <p>显示最近的 20 个文件，共 {dataset.diagnostics.length} 个。</p>}
        {dataset.warnings?.length > 0 && <ul>{dataset.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>}
      </details>}
    </div>
  )
}
