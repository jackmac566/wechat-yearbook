import React from 'react'
import { APP_VERSION } from '../version.js'
import './data-panels.css'

const releases = [
  [APP_VERSION, '区分红包标记和账单金额', '可从红包与转账页获取并导入支付账单，按日期查看发出的红包。'],
  ['0.5.1', '更简单的导入与年报', '可直接选择或拖入文件。报告按实际导入的记录显示聊天、账单和朋友圈，分享图片与私人备份分开。'],
  ['0.4.0', '更多可视化', '加入全年聊天热图、会话双向互动、红包与转账月度趋势，以及各来源的记录范围。'],
  ['0.3.0', '支持微信转发文件', '可导入微信聊天 ZIP 或 TXT，确认昵称与会话后查看统计。'],
]

export function ChangelogPanel() {
  return <section className="panel release-notes" aria-label="版本记录">
    {releases.map(([version, title, description]) => <article key={version}>
      <b className="release-version">V{version}</b>
      <div><h2>{title}</h2><p>{description}</p></div>
    </article>)}
  </section>
}
