import React, { useMemo, useRef, useState } from "react";
import { analyze, availableYears, coverage } from "./lib/analytics.js";
import { mergeDatasets } from "./lib/parser.js";
import { isChatArchive, parseImportArchive, parseImportText } from "./lib/import-file.js";
import { serializeDataset } from "./lib/export.js";
import { transcriptDataset } from "./lib/wechat-transcript.js";
import { demoDataset } from "./data/demo.js";
import StoryReport from "./components/StoryReport.jsx";
import { OverviewPanel } from "./components/OverviewPanel.jsx";
import { ChatTracePanel } from "./components/ChatTracePanel.jsx";
import { PeoplePanel } from "./components/PeoplePanel.jsx";
import { MomentsPanel } from "./components/MomentsPanel.jsx";
import { MoneyPanel } from "./components/MoneyPanel.jsx";
import { DataPrivacyPanel } from "./components/DataPrivacyPanel.jsx";
import { ChangelogPanel } from "./components/ChangelogPanel.jsx";
import { Icon, FileGuide, number, levelText } from "./components/ui.jsx";
import "./components/detail-panels.css";
import { APP_VERSION } from "./version.js";

const nav = [
  ["story", "年报故事"], ["overview", "详细总览"], ["chat", "聊天轨迹"], ["people", "关系温度"],
  ["moments", "朋友圈"], ["money", "红包与转账"], ["data", "数据与隐私"], ["updates", "更新日志"],
];

const emptyDataset = {
  source: "尚未导入",
  messages: [], payments: [], moments: [],
  confidence: { messages: "missing", payments: "missing", moments: "missing" },
  coverageRanges: { messages: [], payments: [], moments: [] },
  diagnostics: [],
  warnings: [],
};

const supportedFile = (file) => /\.(csv|json|txt|zip)$/i.test(file.name || "");
const displayFileName = (file) => file.webkitRelativePath || file.name;

async function parseFileLocally(file, signal, onProgress) {
  const name = displayFileName(file);
  signal.throwIfAborted();
  if (typeof Worker === "undefined") {
    if (isChatArchive(name)) {
      const result = await parseImportArchive(file, () => onProgress({ phase: "parsing" }));
      signal.throwIfAborted();
      return result;
    }
    const contents = await file.text();
    signal.throwIfAborted();
    return parseImportText(name, contents);
  }
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./workers/import.worker.js", import.meta.url), { type: "module" });
    const cleanup = () => {
      worker.terminate();
      signal.removeEventListener("abort", abort);
    };
    const fail = (error) => {
      cleanup();
      reject(error);
    };
    const abort = () => fail(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    worker.onmessage = ({ data }) => {
      if (data.phase) {
        onProgress(data);
      } else if (data.ok) {
        cleanup();
        resolve(data.result);
      } else {
        fail(new Error(data.error));
      }
    };
    worker.onerror = () => fail(new Error("本地解析线程启动失败"));
    worker.onmessageerror = () => fail(new Error("无法读取本地解析结果"));
    try {
      worker.postMessage({ name, file });
    } catch (error) {
      fail(error);
    }
  });
}

function App() {
  const [dataset, setDataset] = useState(emptyDataset);
  const years = useMemo(() => availableYears(dataset), [dataset]);
  const [year, setYear] = useState(years[0] || new Date().getFullYear());
  const [active, setActive] = useState("story");
  const [showImport, setShowImport] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [notice, setNotice] = useState("");
  const [importProgress, setImportProgress] = useState(null);
  const [transcriptReview, setTranscriptReview] = useState(null);
  const [lastImport, setLastImport] = useState(null);
  const [importGuide, setImportGuide] = useState("");
  const [pendingFiles, setPendingFiles] = useState([]);
  const importController = useRef(null);
  const noticeTimer = useRef(null);
  const homeFileInput = useRef(null);
  const stats = useMemo(() => analyze(dataset, year), [dataset, year]);
  const quality = useMemo(() => coverage(dataset, year), [dataset, year]);
  const hasData = years.length > 0;
  const isDemo = dataset.source === "演示数据";
  const modalOpen = showImport || showShare;

  const notify = (message) => {
    window.clearTimeout(noticeTimer.current);
    setNotice(message);
    noticeTimer.current = window.setTimeout(() => setNotice(""), 4500);
  };

  const reviewTranscript = (name, transcript, signal) => new Promise((resolve, reject) => {
    const close = () => {
      signal.removeEventListener("abort", abort);
      setTranscriptReview(null);
    };
    const abort = () => {
      close();
      reject(signal.reason);
    };
    signal.addEventListener("abort", abort, { once: true });
    setTranscriptReview({
      name,
      senders: transcript.senders,
      count: transcript.records.length,
      submit(selection) {
        close();
        resolve(selection);
      },
    });
  });

  const handleFiles = async (files) => {
    if (!files.length || importController.current) return;
    setShowImport(true);
    setImportGuide("");
    const supported = files.filter(supportedFile);
    const result = { imported: 0, skipped: 0, ignored: files.length - supported.length, failures: [] };
    if (!supported.length) {
      setLastImport(result);
      return;
    }
    const largeFiles = supported.filter((file) => file.size >= 50 * 1024 * 1024);
    if (largeFiles.length && !window.confirm(`有 ${largeFiles.length} 个文件超过 50 MB，处理可能需要一些时间。继续导入吗？`)) {
      setLastImport({ cancelled: true });
      return;
    }
    const controller = new AbortController();
    importController.current = controller;
    const { signal } = controller;
    let next = hasData && !isDemo ? dataset : null;
    try {
      for (const [index, file] of supported.entries()) {
        const name = displayFileName(file);
        const progress = { index, total: supported.length, name, size: file.size };
        setImportProgress({ ...progress, phase: "reading" });
        try {
          const importedFile = await parseFileLocally(file, signal, (status) => setImportProgress({ ...progress, ...status }));
          signal.throwIfAborted();
          let parsed = importedFile.dataset;
          if (importedFile.transcript) {
            const selection = await reviewTranscript(name, importedFile.transcript, signal);
            signal.throwIfAborted();
            if (!selection) throw new Error("已跳过本文件的发送人确认");
            const prefix = `${importedFile.transcript.signature}:`;
            const previous = next?.messages.filter((item) => item.contact === selection.conversation.trim() && item.fragmentRef?.startsWith(prefix));
            if (previous?.length && (previous.find((item) => item.isSend)?.sender ?? null) !== selection.selfName) {
              throw new Error("这份片段已按另一个发送人设置导入。如需更正，请清除当前报告后重新导入");
            }
            parsed = transcriptDataset(name, importedFile.transcript, selection.selfName, selection.conversation);
          }
          if (parsed.source === "演示数据" && (supported.length > 1 || (hasData && !isDemo))) {
            throw new Error("请在空白或演示状态下单独导入演示备份");
          }
          const diagnostic = parsed.diagnostics[0];
          if (!diagnostic.parsed && !availableYears(parsed).length) {
            throw new Error(diagnostic.skipped ? `没有有效记录，${diagnostic.skipped} 条已跳过` : "没有可用于年报的记录或账期");
          }
          next = next ? mergeDatasets(next, parsed) : parsed;
          result.imported += 1;
          result.skipped += diagnostic.skipped;
        } catch (error) {
          if (signal.aborted) {
            setLastImport({ cancelled: true });
            return;
          }
          result.failures.push({ name, reason: error instanceof SyntaxError ? "JSON 格式无效，请检查文件是否完整" : error.message });
        }
      }
      setLastImport(result);
      if (result.imported) {
        setDataset(next);
        const nextYears = availableYears(next);
        setYear(hasData && !isDemo && nextYears.includes(year) ? year : nextYears[0]);
        setActive("story");
        if (!result.failures.length && !result.ignored && !result.skipped) {
          setShowImport(false);
          notify(`已在本机导入 ${result.imported} 个文件`);
        }
      }
    } finally {
      importController.current = null;
      setImportProgress(null);
    }
  };

  const go = (key) => {
    setActive(key);
    document.querySelector(".content-scroll")?.scrollTo({ top: 0, behavior: "smooth" });
  };
  const openImport = () => {
    setImportGuide("");
    setShowImport(true);
  };
  const openGuide = (kind) => {
    setImportGuide(kind);
    setShowImport(true);
  };
  React.useEffect(() => {
    return window.yearbookInbox?.onFiles((files) => new Promise((resolve) => {
      setPendingFiles((previous) => [...previous, { files, resolve }]);
    }));
  }, []);
  React.useEffect(() => {
    if (!pendingFiles.length || importController.current || showShare) return;
    const [{ files, resolve }] = pendingFiles;
    setPendingFiles((previous) => previous.slice(1));
    const failures = files.filter(({ error }) => error).map(({ name, error }) => ({ name, reason: error }));
    if (failures.length) {
      openImport();
      setLastImport({ imported: 0, skipped: 0, ignored: 0, failures });
      resolve();
    } else {
      handleFiles(files.map(({ name, data }) => new File([data], name))).finally(resolve);
    }
  }, [pendingFiles, importProgress, showShare]);

  const openDemo = () => {
    setDataset(demoDataset);
    setYear(2025);
    setActive("story");
  };

  const exportDataset = (scope = "year") => {
    if (!hasData) return;
    const oneYear = scope === "year";
    const label = oneYear ? `${year} 年` : "全部年份";
    const confirmed = window.confirm(`备份包含${label}的聊天原文、联系人和金额。请私下保存。继续吗？`);
    if (!confirmed) return;
    const blob = new Blob([serializeDataset(dataset, oneYear ? { year } : {})], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = oneYear ? `微信年轮-标准数据-${year}.json` : "微信年轮-标准数据-全部年份.json";
    link.click();
    URL.revokeObjectURL(url);
    notify("备份已导出");
  };

  const resetData = () => {
    if (hasData && !isDemo && !window.confirm("清除当前报告？以后可重新导入原文件或备份。")) return;
    setDataset(emptyDataset);
    setLastImport(null);
    setYear(new Date().getFullYear());
    go("story");
    notify("已清除当前报告");
  };

  const home = !hasData && active !== "data" && active !== "updates";
  const lightShell = !hasData;
  return (
    <div className={`app-shell ${hasData && active === "story" ? "story-mode" : ""} ${lightShell ? "light-shell" : ""}`}>
      {hasData && active === "story" ? <StoryReport stats={stats} quality={quality} years={years} year={year} isDemo={isDemo} inert={modalOpen} onYear={setYear} onDetail={() => go("overview")} onImport={openImport} onShare={() => setShowShare(true)} /> : <>
      {hasData && <aside className="sidebar" inert={modalOpen}>
        <div className="brand"><span className="brand-mark"><i /><i /></span><span><b>微信年轮</b></span></div>
        <nav aria-label="报告版块">{nav.slice(0, -1).map(([key, label]) => <button key={key} className={active === key ? "active" : ""} aria-label={label} aria-current={active === key ? "page" : undefined} onClick={() => go(key)}><Icon name={key} /><span>{label}</span></button>)}</nav>
        <button className={`side-version ${active === "updates" ? "active" : ""}`} aria-label="更新日志" aria-current={active === "updates" ? "page" : undefined} onClick={() => go("updates")}><Icon name="updates" size={17} /><span>更新日志</span></button>
      </aside>}

      <main className="workspace" inert={modalOpen}>
        {lightShell && <header className="home-bar">
          <button className="home-brand" onClick={() => go("story")} aria-label="微信年轮首页"><span className="brand-mark"><i /><i /></span><b>微信年轮</b></button>
          <div className="home-bar-links"><button onClick={() => go("data")} aria-current={active === "data" ? "page" : undefined}>数据与隐私</button><button onClick={() => go("updates")} aria-current={active === "updates" ? "page" : undefined}>更新日志</button></div>
        </header>}
        {!home && <header className="topbar">
          <div><h1>{nav.find(([key]) => key === active)?.[1]}</h1></div>
          <div className="top-actions">
            {active === "updates" ? <span className="current-release">V{APP_VERSION}</span> : <>
            {hasData && <label className="year-select"><span>分析年份</span><select value={year} onChange={(e) => setYear(Number(e.target.value))}>{years.map((item) => <option key={item}>{item}</option>)}</select></label>}
            {hasData && <button className="ghost-button report-share-button" onClick={() => setShowShare(true)}><Icon name="share" size={17} /><span>分享图</span></button>}
            <button className="primary-button" onClick={openImport}><Icon name="upload" size={17} />导入记录</button>
            </>}
          </div>
        </header>}

        <div className="content-scroll">
          {isDemo && active !== "updates" && <div className="demo-banner"><span><Icon name="spark" size={17} /><b>示例报告</b> · 数字为模拟数据</span></div>}
          {home && <WelcomePage onChoose={() => homeFileInput.current?.click()} onDrop={handleFiles} onGuide={() => openGuide("chat")} onDemo={openDemo} />}
          {hasData && active === "overview" && <OverviewPanel stats={stats} quality={quality} onImport={openImport} onPeople={() => go("people")} />}
          {hasData && active === "chat" && <ChatTracePanel stats={stats} source={quality.messages} onImport={openImport} />}
          {hasData && active === "people" && <PeoplePanel stats={stats} source={quality.messages} onImport={openImport} />}
          {hasData && active === "moments" && <MomentsPanel stats={stats} source={quality.moments} onImport={openImport} />}
          {hasData && active === "money" && <MoneyPanel stats={stats} source={quality.payments} onImport={() => openGuide("payment")} />}
          {active === "data" && <DataPrivacyPanel stats={stats} dataset={dataset} quality={quality} year={year} hasData={hasData} lastImport={lastImport} onShare={() => setShowShare(true)} onExport={exportDataset} onReset={resetData} />}
          {active === "updates" && <ChangelogPanel />}
        </div>
      </main>
      </>}

      <input ref={homeFileInput} type="file" accept=".zip,.txt,.json,.csv" multiple hidden onChange={(event) => { handleFiles([...event.target.files]); event.target.value = ""; }} />
      {showImport && <ImportModal initialGuide={importGuide} onClose={() => setShowImport(false)} onFiles={handleFiles} progress={importProgress} transcriptReview={transcriptReview} result={lastImport} onCancel={() => importController.current?.abort()} onInspect={() => { setShowImport(false); go("data"); }} />}
      {showShare && <ShareModal stats={stats} quality={quality} isDemo={isDemo} onClose={() => setShowShare(false)} />}
      {notice && <div className="toast" role="status" aria-live="polite"><span>✓</span>{notice}</div>}
    </div>
  );
}

function WelcomePage({ onChoose, onDrop, onGuide, onDemo }) {
  const [drag, setDrag] = useState(false);
  return <div className="welcome-page">
    <section className="welcome-hero">
      <div className="welcome-intro"><span className="safe-chip"><Icon name="shield" size={15} />仅在本机分析</span><h1>回看你的<br/>微信这一年。</h1><p>从聊天和账单里，看见自己的沟通与往来。</p><button className="welcome-link" onClick={onDemo}><Icon name="spark" size={17} />查看示例 <span aria-hidden="true">→</span></button></div>
      <div className="welcome-intake">
        <button className={`welcome-drop ${drag ? "drag" : ""}`} onClick={onChoose}
          onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; setDrag(true); }} onDragLeave={() => setDrag(false)}
          onDrop={(event) => { event.preventDefault(); setDrag(false); onDrop([...event.dataTransfer.files]); }}>
          <span className="welcome-file-icon"><Icon name="upload" size={27} /></span>
          <b>导入记录</b><span>选择文件，或拖到这里</span>
        </button>
        <div className="welcome-sources"><span>聊天</span><span>支付账单</span><span>朋友圈</span></div>
        <button className="welcome-help" onClick={onGuide}>怎么拿到文件？</button>
      </div>
    </section>
  </div>;
}

function TranscriptReview({ review }) {
  const [sender, setSender] = useState("");
  const [conversation, setConversation] = useState("");
  const senderRef = useRef(null);
  React.useEffect(() => senderRef.current.focus(), []);
  const ready = sender !== "" && conversation.trim().length > 0;
  return <form className="transcript-review" onSubmit={(event) => {
    event.preventDefault();
    if (ready) review.submit({ selfName: sender === "none" ? null : review.senders[Number(sender)].name, conversation });
  }}>
    <h3>哪一个昵称是你？</h3>
    <p className="transcript-file" title={review.name}>{review.name} · {number.format(review.count)} 条消息</p>
    <div className="transcript-fields">
      <label><span>我的昵称</span><select ref={senderRef} value={sender} onChange={(event) => setSender(event.target.value)} required>
        <option value="">请选择</option>
        {review.senders.map(({ name, count }, index) => <option value={index} key={name}>{name}（{number.format(count)} 条）</option>)}
        <option value="none">这批没有我的消息</option>
      </select></label>
      <label><span>会话名称</span><input type="text" value={conversation} onChange={(event) => setConversation(event.target.value)} placeholder="同一会话请填写同一个名称" maxLength={120} required /></label>
    </div>
    <p>同一会话分批导入时，沿用名称并选取不同的消息。多人使用同一昵称时，请跳过该文件。</p>
    <div className="transcript-actions"><button type="submit" className="primary-button" disabled={!ready}>确认并继续</button><button type="button" className="ghost-button export-button" onClick={() => review.submit(null)}>跳过文件</button></div>
  </form>;
}

function ImportModal({ initialGuide, onClose, onFiles, progress, transcriptReview, result, onCancel, onInspect }) {
  const [drag, setDrag] = useState(false);
  const [guide, setGuide] = useState(initialGuide || "chat");
  const [showGuide, setShowGuide] = useState(Boolean(initialGuide));
  const modalRef = useRef(null);
  const fileRef = useRef(null);
  const folderRef = useRef(null);
  React.useEffect(() => {
    const previousFocus = document.activeElement;
    modalRef.current.focus();
    return () => previousFocus?.focus();
  }, []);

  const handleKeyDown = (event) => {
    if (event.key === "Escape" && !progress) onClose();
    if (event.key !== "Tab") return;
    const controls = [...modalRef.current.querySelectorAll('a[href], button:not(:disabled), input:not([hidden]), select, summary, [tabindex="0"]')]
      .filter((element) => element.getClientRects().length);
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === modalRef.current)) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };
  const chooseFiles = () => !progress && fileRef.current?.click();
  const selectFiles = (event) => {
    onFiles([...event.target.files]);
    event.target.value = "";
  };
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !progress && onClose()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => event.preventDefault()}><div ref={modalRef} className="modal import-modal" role="dialog" aria-modal="true" aria-labelledby="import-title" tabIndex="-1" onKeyDown={handleKeyDown}><button className="modal-x" onClick={onClose} disabled={Boolean(progress)} aria-label="关闭导入窗口">×</button><h2 id="import-title">导入记录</h2>
    {transcriptReview ? <TranscriptReview key={progress.index} review={transcriptReview} /> : progress ? <div className="drop-zone busy">
      <b role="status">{progress.phase === "reading" ? "正在本机读取" : "正在本机解析"}第 {progress.index + 1} / {progress.total} 个文件</b>
      <span title={progress.name}>{progress.name}</span>
      <progress aria-label={progress.phase === "reading" ? "当前文件读取进度" : "当前文件解析中"} value={progress.loaded} max={progress.size || 1} />
    </div> : <div className={`drop-zone ${drag ? "drag" : ""}`} role="button" tabIndex={0}
      onKeyDown={(event) => { if (["Enter", " "].includes(event.key)) { event.preventDefault(); chooseFiles(); } }}
      onDragOver={(event) => { event.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
      onDrop={(event) => { event.preventDefault(); setDrag(false); onFiles([...event.dataTransfer.files]); }} onClick={chooseFiles}>
      <Icon name="upload" size={26} /><b>选择文件，或拖到这里</b><span>ZIP、TXT、JSON、CSV · 支持多选</span>
    </div>}
    <input ref={fileRef} type="file" accept=".zip,.txt,.json,.csv" multiple hidden onChange={selectFiles} />
    <input ref={folderRef} type="file" multiple webkitdirectory="" hidden onChange={selectFiles} />
    <div className="folder-import">{progress ? <>
      <button className="danger-button" onClick={onCancel}>取消本批导入</button>
    </> : <>
      <button className="ghost-button export-button" onClick={() => folderRef.current?.click()}>选择文件夹</button><button className="ghost-button export-button" aria-expanded={showGuide} onClick={() => setShowGuide(!showGuide)}>{showGuide ? "收起获取步骤" : "怎么拿到文件？"}</button>
    </>}</div>
    {!progress && showGuide && <FileGuide active={guide} onSelect={setGuide} />}
    {!progress && result && (result.cancelled || result.failures.length > 0 || result.skipped > 0 || result.ignored > 0) && <>
      <ImportResult result={result} />
      {!result.cancelled && <button className="ghost-button export-button import-inspect" onClick={onInspect}>查看导入检查</button>}
    </>}
    <div className="privacy-line"><Icon name="shield" size={17} />文件仅在本机处理</div>
  </div></div>;
}

function ImportResult({ result }) {
  if (result.cancelled) return <p className="import-result" role="status">已取消，本批文件未合并到年报。</p>;
  const { imported, skipped, ignored, failures } = result;
  return <div className="import-result">
    <p role="status">{imported || failures.length ? `最近一批导入 ${imported} 个文件` : "未找到支持的 ZIP、TXT、JSON 或 CSV 文件"}{failures.length > 0 && ` · ${failures.length} 个未导入`}{skipped > 0 && ` · ${skipped} 条已跳过`}{ignored > 0 && ` · 忽略 ${ignored} 个其他文件`}</p>
    {failures.length > 0 && <details open>
      <summary>未导入的文件和原因</summary>
      <ul>{failures.map(({ name, reason }, index) => <li key={`${name}-${index}`}><b>{name}</b><span>{reason}</span></li>)}</ul>
    </details>}
  </div>;
}

function ShareModal({ stats, quality, isDemo, onClose }) {
  const canvasRef = useRef(null);
  const modalRef = useRef(null);
  const draw = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const { messages, moments, payments } = quality;
    canvas.width = 1080; canvas.height = 1440;
    const gradient = ctx.createLinearGradient(0, 0, 1080, 1440); gradient.addColorStop(0, "#0c6b51"); gradient.addColorStop(1, "#092f2b"); ctx.fillStyle = gradient; ctx.fillRect(0, 0, 1080, 1440);
    ctx.strokeStyle = "rgba(255,255,255,.1)"; ctx.lineWidth = 2; for (let r = 160; r < 840; r += 95) { ctx.beginPath(); ctx.arc(850, 260, r, 0, Math.PI * 2); ctx.stroke(); }
    ctx.fillStyle = "rgba(255,255,255,.72)"; ctx.font = "28px system-ui"; ctx.fillText(`${stats.year} 年`, 86, 110);
    if (isDemo) {
      ctx.fillStyle = "#ffe0a2";
      ctx.font = "700 28px system-ui";
      ctx.fillText("演示数据 · 仅供预览", 745, 110);
    }
    ctx.fillStyle = "#fff"; ctx.font = "700 58px system-ui"; ctx.fillText("我的微信年轮", 86, 208);
    ctx.font = "800 166px system-ui";
    const highlight = messages.hasYear
      ? [stats.totalMessages, "条聊天消息"]
      : payments.hasYear
        ? [stats.redSentCount + stats.redReceivedCount + stats.transferSentCount + stats.transferReceivedCount, "笔红包与转账"]
        : [stats.observedRanges.moments.count, "条朋友圈记录"];
    ctx.fillText(number.format(highlight[0]), 78, 475, 920);
    ctx.fillStyle = "#a8e1cb"; ctx.font = "36px system-ui";
    ctx.fillText(highlight[1], 90, 535, 900);

    const cards = [
      ["发出消息", `${number.format(stats.sent)} 条`, messages],
      ["收到消息", `${number.format(stats.received)} 条`, messages],
      ["朋友圈记录", `${number.format(stats.observedRanges.moments.count)} 条`, moments],
      ["红包 / 转账", `${number.format(stats.redSentCount + stats.redReceivedCount)} 个 / ${number.format(stats.transferSentCount + stats.transferReceivedCount)} 笔`, payments],
    ];
    cards.forEach(([label, value, source], i) => {
      const x = 82 + (i % 2) * 464;
      const y = 640 + Math.floor(i / 2) * 220;
      ctx.fillStyle = "rgba(255,255,255,.09)";
      roundRect(ctx, x, y, 420, 170, 28);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.62)";
      ctx.font = "26px system-ui";
      ctx.fillText(label, x + 34, y + 52);
      ctx.fillStyle = "#fff";
      ctx.font = source.hasYear ? "700 48px system-ui" : "600 36px system-ui";
      ctx.fillText(source.hasYear ? value : levelText(source.level), x + 34, y + 120, 352);
    });
    ctx.fillStyle = "rgba(255,255,255,.78)"; ctx.font = "26px system-ui";
    ctx.fillText(`聊天 ${messages.hasFragments ? "含转发片段" : levelText(messages.level)} · 朋友圈 ${levelText(moments.level)} · 账单 ${levelText(payments.level)}`, 86, 1118, 908);
    ctx.fillText("仅统计已导入的记录", 86, 1188, 908);
    ctx.fillStyle = "#fff"; ctx.font = "700 32px system-ui"; ctx.fillText("微信年轮", 86, 1310); ctx.fillStyle = "rgba(255,255,255,.52)"; ctx.font = "23px system-ui"; ctx.fillText("不上传聊天记录的本地年度报告", 86, 1352);
  };
  React.useEffect(draw, [stats, quality, isDemo]);
  React.useEffect(() => {
    modalRef.current?.focus();
    const closeOnEscape = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);
  const download = () => { draw(); const link = document.createElement("a"); link.download = `微信年轮-${stats.year}${isDemo ? "-演示" : ""}.png`; link.href = canvasRef.current.toDataURL("image/png"); link.click(); };
  return <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><div ref={modalRef} className="modal share-modal" role="dialog" aria-modal="true" aria-labelledby="share-title" tabIndex="-1"><button className="modal-x" onClick={onClose} aria-label="关闭分享窗口">×</button><div><h2 id="share-title">年报分享图</h2><p className="modal-desc">已隐藏姓名、聊天内容和具体金额。</p><button className="primary-button big" onClick={download}>保存图片</button></div><canvas ref={canvasRef} aria-label={`${stats.year} 微信年报分享图预览`} /></div></div>;
}

function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }

export default App;
