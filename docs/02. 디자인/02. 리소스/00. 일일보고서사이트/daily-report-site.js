/* global renderReportMarkdown */
(() => {
  const doc = globalThis.document;
  const win = globalThis.window;
  const initial = JSON.parse(doc.getElementById('report-data').textContent);
  const storageKey = 'tripprint.daily-journal.v1';
  const views = new Set([
    'overview',
    'improvements',
    'checks',
    'next',
    'document',
    'tc',
  ]);
  const statusLabels = { done: '완료', review: '검토', pending: '진행 중' };
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  const icons = {
    notebook: '<path d="M8 3h11v18H5V3h3M9 7h6M9 11h6M3 7h4M3 12h4M3 17h4"/>',
    book: '<path d="M4 4h6a3 3 0 0 1 3 3v14a4 4 0 0 0-4-3H4zM13 7a3 3 0 0 1 3-3h5v14h-4a4 4 0 0 0-4 3"/>',
    changes: '<path d="M4 7h15m-4-4 4 4-4 4M20 17H5m4-4-4 4 4 4"/>',
    shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9S4 17 4 12V6zM8 12l3 3 5-6"/>',
    flag: '<path d="M5 21V4m0 1c5-4 9 4 14 0v10c-5 4-9-4-14 0"/>',
    calendar:
      '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18M7 15h2m4 0h2"/>',
    download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4"/>',
    upload: '<path d="M12 16V4m-5 5 5-5 5 5M4 16v4h16v-4"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
    left: '<path d="m14 6-6 6 6 6"/>',
    right: '<path d="m9 6 6 6-6 6"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
    print: '<path d="M7 8V3h10v5M7 17H4V9h16v8h-3M7 14h10v7H7zM17 11h.01"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    arrow: '<path d="M4 12h15m-5-5 5 5-5 5"/>',
    code: '<path d="m8 6-6 6 6 6m8-12 6 6-6 6M14 3l-4 18"/>',
    user: '<circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
    layers: '<path d="m12 3 10 6-10 6L2 9zM3 14l9 6 9-6M3 18l9 5 9-5"/>',
    route:
      '<circle cx="5" cy="5" r="2"/><circle cx="19" cy="19" r="2"/><path d="M7 5h10a4 4 0 0 1 0 8H7a3 3 0 0 0 0 6h10"/>',
    git: '<circle cx="6" cy="5" r="3"/><circle cx="18" cy="8" r="3"/><circle cx="6" cy="20" r="3"/><path d="M6 8v9m12-6c0 4-12 1-12 6"/>',
    edit: '<path d="m15 4 5 5M4 20l5-1L21 7l-5-5L4 14z"/>',
    trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
  };
  const checkLabels = {
    'npm run check': '코드·문서 품질',
    'npm run test:auth': '인증·닉네임 규칙',
    'npm run test:foundation': '서버·저장 계약',
    'npm run test:profile:web': '프로필 사용자 흐름',
    'npm run test:headers:web': '헤더·화면 이동',
    'npm run test:release': '빌드·배포 설정',
  };
  const escape = (value) =>
    String(value ?? '').replace(
      /[&<>"']/g,
      (c) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
        })[c],
    );
  const icon = (name) =>
    `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.book}</svg>`;
  const byId = (id) => doc.getElementById(id);
  const atNoon = (date) => new Date(date + 'T12:00:00Z');
  const iso = (date) => date.toISOString().slice(0, 10);
  const addDays = (date, days) => {
    const next = atNoon(date);
    next.setUTCDate(next.getUTCDate() + days);
    return iso(next);
  };
  const validDate = (date) =>
    typeof date === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    Number.isFinite(atNoon(date).getTime()) &&
    iso(atNoon(date)) === date;
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const fullDate = (date) =>
    new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'UTC',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    }).format(atNoon(date));
  let toastTimer;
  let editingDate = null;
  let localReports = [];
  let selectedDate = initial.reports[0]?.date || today;
  let view = 'overview';
  const initialRoute = /^#(\d{4}-\d{2}-\d{2})\/(\w+)$/.exec(win.location.hash);
  if (initialRoute && validDate(initialRoute[1])) {
    selectedDate = initialRoute[1];
    view = views.has(initialRoute[2]) ? initialRoute[2] : 'overview';
  }

  function toast(message) {
    clearTimeout(toastTimer);
    byId('toast').textContent = message;
    byId('toast').hidden = false;
    toastTimer = setTimeout(() => {
      byId('toast').hidden = true;
    }, 5500);
  }
  function textField(value, limit, optional = false) {
    if (optional && value === undefined) return '';
    if (typeof value !== 'string' || value.length > limit)
      throw new Error('일지 파일의 내용이나 길이를 확인해 주세요.');
    return value;
  }
  function items(value, fields) {
    if (value === undefined) return [];
    if (!Array.isArray(value) || value.length > 60)
      throw new Error('일지 항목은 60개 이하여야 해요.');
    return value.map((item) => {
      if (!item || typeof item !== 'object')
        throw new Error('일지 항목 형식을 확인해 주세요.');
      return Object.fromEntries(
        fields.map((key) => [key, textField(item[key], 7000, true)]),
      );
    });
  }
  function validateReport(value) {
    if (!value || !validDate(value.date))
      throw new Error('일지의 날짜를 확인해 주세요.');
    const title = textField(value.title, 100),
      summary = textField(value.summary, 5000),
      markdown = textField(value.markdown, 200000);
    if (!title.trim() || !summary.trim() || !markdown.trim())
      throw new Error('제목과 작업 내용이 있는 일지 파일을 선택해 주세요.');
    const work = items(value.work, ['area', 'after', 'boundary', 'status']).map(
      (item) => ({
        ...item,
        status: statusLabels[item.status] ? item.status : 'review',
      }),
    );
    return {
      id: value.date,
      date: value.date,
      title,
      summary,
      markdown,
      work,
      improvements: items(value.improvements, ['before', 'after']),
      checks: items(value.checks, ['name', 'result', 'evidence']),
      next: items(value.next, ['title', 'action', 'status']),
      sourceHref: '',
      origin: 'local',
    };
  }
  try {
    const saved = JSON.parse(win.localStorage.getItem(storageKey) || '[]');
    if (!Array.isArray(saved) || saved.length > 300)
      throw new Error('저장한 일지 형식을 확인해 주세요.');
    localReports = saved
      .map(validateReport)
      .filter(
        (item) =>
          !initial.reports.some((original) => original.date === item.date),
      );
  } catch {
    toast(
      '저장한 일지를 읽지 못했어요. 백업 파일을 가져오거나 새 일지를 등록해 주세요.',
    );
  }
  const allReports = () =>
    [...initial.reports, ...localReports].sort((a, b) =>
      b.date.localeCompare(a.date),
    );
  const currentReport = () =>
    allReports().find((item) => item.date === selectedDate);
  const tcChart = globalThis.createTcChart({
    catalog: initial.tcCatalog,
    source: initial.tcResults,
    notify: toast,
    download,
    icon,
  });
  function saveLocal(next) {
    try {
      win.localStorage.setItem(storageKey, JSON.stringify(next));
      localReports = next;
      return true;
    } catch {
      return false;
    }
  }
  function hydrateIcons() {
    doc.querySelectorAll('[data-icon]').forEach((element) => {
      element.innerHTML = icon(element.dataset.icon);
      element.setAttribute('aria-hidden', 'true');
    });
  }
  function setMenu(open) {
    const wasOpen = doc.body.classList.contains('menu-open');
    doc.body.classList.toggle('menu-open', open);
    byId('menu-backdrop').hidden = !open;
    byId('menu-button').setAttribute('aria-expanded', String(open));
    byId('sidebar').inert = win.innerWidth <= 760 && !open;
    doc.querySelector('.main-shell').inert = win.innerWidth <= 760 && open;
    if (open) byId('sidebar').querySelector('a')?.focus();
    else if (wasOpen) byId('menu-button').focus();
  }
  function navigate(date = selectedDate, nextView = view, focusDay = false) {
    selectedDate = date;
    view = nextView;
    setMenu(false);
    try {
      win.history.replaceState(null, '', `#${selectedDate}/${view}`);
    } catch {
      /* 파일 열기 정책과 관계없이 본문 전환은 유지한다. */
    }
    render();
    if (focusDay)
      doc
        .querySelector(`[data-date="${selectedDate}"]`)
        ?.focus({ preventScroll: true });
  }
  function sourceLink(report, href) {
    if (/^https?:/i.test(href) || href.startsWith('#')) return href;
    if (!report.sourceHref) return href;
    return new win.URL(href, new win.URL(report.sourceHref, doc.baseURI)).href;
  }
  function documentHtml(report) {
    return renderReportMarkdown(report.markdown, (href) =>
      sourceLink(report, href),
    );
  }
  function pill(status, text = statusLabels[status] || '기록') {
    return `<span class="pill ${status}">${status === 'done' ? icon('check') : ''}${escape(text)}</span>`;
  }
  function workIcon(area) {
    return /프로필|계정|게스트/.test(area)
      ? 'user'
      : /여행/.test(area)
        ? 'route'
        : /Git/.test(area)
          ? 'git'
          : /헤더|검/.test(area)
            ? 'shield'
            : /홈/.test(area)
              ? 'layers'
              : 'code';
  }
  function renderCalendar() {
    const selected = atNoon(selectedDate);
    const start = addDays(selectedDate, -((selected.getUTCDay() + 6) % 7));
    const end = addDays(start, 6);
    byId('week-label').innerHTML =
      `${selected.getUTCFullYear()}년 ${selected.getUTCMonth() + 1}월<span>${start.slice(5).replace('-', '.')} — ${end.slice(5).replace('-', '.')}</span>`;
    byId('week-grid').innerHTML = Array.from({ length: 7 }, (_, i) => {
      const date = addDays(start, i),
        number = atNoon(date).getUTCDate();
      const hasReport = allReports().some((item) => item.date === date);
      return `<button class="day-button ${date === selectedDate ? 'selected' : ''} ${date === today ? 'today' : ''}" data-date="${date}" aria-pressed="${date === selectedDate}" aria-label="${fullDate(date)}, ${hasReport ? '등록된 일지 있음' : '등록된 일지 없음'}"><span class="weekday">${weekdays[atNoon(date).getUTCDay()]}요일</span><span class="day-number">${String(number).padStart(2, '0')}</span><span class="day-state">${hasReport ? '<span class="tiny-dot"></span>일지 1건' : '기록 없음'}</span></button>`;
    }).join('');
    const reports = allReports();
    byId('date-list').innerHTML = reports
      .map(
        (report) =>
          `<button class="registered-day ${report.date === selectedDate ? 'selected' : ''}" data-date="${report.date}"><span class="tiny-dot"></span>${report.date.slice(5).replace('-', '.')} <small>${weekdays[atNoon(report.date).getUTCDay()]}요일${report.origin === 'local' ? ' · 직접 작성' : ''}</small></button>`,
      )
      .join('');
    byId('registered-count').textContent = String(reports.length).padStart(
      2,
      '0',
    );
    byId('report-count').textContent = String(reports.length);
    byId('month-label').textContent =
      reports[0]?.date.slice(0, 7).replace('-', '.') || '';
  }
  function overview(report) {
    const done = report.work.filter((item) => item.status === 'done').length;
    const review = report.work.filter(
      (item) => item.status === 'review',
    ).length;
    const pending = report.work.filter(
      (item) => item.status === 'pending',
    ).length;
    return `<section class="intro-card"><p class="card-label"><span class="label-line"></span>오늘의 작업 요약</p><p class="intro-text">${escape(report.summary)}</p><div class="status-pills">${done ? pill('done', `${done}개 영역 완료`) : ''}${review ? pill('review', `${review}개 영역 검토`) : ''}${pending ? pill('pending', `${pending}개 영역 진행 중`) : ''}</div></section><div class="section-label"><h3>작업한 내용</h3><small>${report.work.length}개 영역</small></div><div class="work-list">${report.work.length ? report.work.map((item) => `<details class="work-item"><summary><span class="work-icon">${icon(workIcon(item.area))}</span><span class="work-copy"><strong>${escape(item.area)}</strong><p>${escape(item.after)}</p></span>${pill(item.status)}</summary><div class="work-detail"><strong>확인 범위와 다음 단계</strong><p>${escape(item.boundary || '추가로 기록한 후속 작업이 없어요.')}</p></div></details>`).join('') : '<p class="search-empty">전체 문서에서 작업 내용을 확인해 주세요.</p>'}</div>`;
  }
  function improvements(report) {
    if (!report.improvements.length)
      return (
        '<div class="empty-state"><div class="empty-icon">' +
        icon('changes') +
        '</div><h2>등록된 개선 전후 기록이 없어요</h2><p>전체 문서에서 오늘의 작업을 확인할 수 있어요.</p><button class="secondary-button" data-action="document">전체 문서 보기</button></div>'
      );
    return `<div class="section-label"><h3>어디를 어떻게 개선했나요?</h3><small>${report.improvements.length}개 개선 기록</small></div>${report.improvements.map((item, i) => `<article class="change-card"><div class="change-top"><span></span>IMPROVEMENT ${String(i + 1).padStart(2, '0')}</div><div class="change-block"><span class="change-label">기존</span><p>${escape(item.before)}</p></div><div class="change-block after"><span class="change-label">개선</span><p>${escape(item.after)}</p></div></article>`).join('')}`;
  }
  function checks(report) {
    return `<div class="notice-banner">${icon('info')}<span>기록에 적힌 환경과 실행 범위를 기준으로 확인했습니다. 로컬 검사 통과와 실제 서비스·실기기 검증은 구분합니다.</span></div>${report.checks.length ? report.checks.map((check) => `<article class="check-card"><h3>${escape(checkLabels[check.name] || check.name)}${pill(/통과/.test(check.result) ? 'done' : 'review', /통과/.test(check.result) ? '통과' : '확인 필요')}</h3><p>${escape(check.result)}</p><details><summary>검사 명령과 증거 보기</summary><code>${escape(check.name)}</code><p>${escape(check.evidence)}</p></details></article>`).join('') : '<div class="empty-state"><h2>검증 결과가 아직 없어요</h2><p>확인한 환경과 결과를 일지에 남겨 주세요.</p></div>'}`;
  }
  function nextSteps(report) {
    return `<div class="section-label"><h3>이어서 할 작업</h3><small>${report.next.length}개 항목</small></div>${report.next.length ? report.next.map((item, i) => `<article class="next-card"><h3><span>${String(i + 1).padStart(2, '0')} &nbsp;${escape(item.title)}</span>${pill('review', /미구현/.test(item.status) ? '미구현' : /미검증|미실행/.test(item.status) ? '검증 예정' : '후속 작업')}</h3><p>${escape(item.action)}</p><div class="status-pills"><span class="pill">${escape(item.status)}</span></div></article>`).join('') : '<div class="empty-state"><h2>등록된 후속 작업이 없어요</h2><p>현재 일지에 남긴 다음 작업이 없습니다.</p></div>'}`;
  }
  function rail(report) {
    if (view === 'document') {
      const links = [...report.markdown.matchAll(/^##\s+(.+)$/gm)].map(
        (match) => ({
          title: match[1],
          slug: match[1]
            .replace(/[`*]/g, '')
            .trim()
            .toLowerCase()
            .replace(/[^\p{L}\p{N}\s-]/gu, '')
            .replace(/\s+/g, '-'),
        }),
      );
      return `<section class="rail-card"><h3 class="rail-heading">${icon('book')}문서 목차</h3><nav class="document-toc" aria-label="문서 목차">${links.map((link) => `<a href="#doc-${escape(link.slug)}">${escape(link.title)}</a>`).join('')}</nav></section>`;
    }
    const evidence = report.checks.slice(0, 6);
    return `<section class="rail-card"><h3 class="rail-heading">${icon('shield')}검증 결과</h3><p class="rail-caption">확인한 범위와 결과를 함께 봅니다.</p>${
      evidence.length
        ? evidence
            .map((check) => {
              const count = /(\d+)개\s*통과/.exec(check.result)?.[1];
              return `<div class="check-line"><span>${escape(checkLabels[check.name] || check.name)}</span><strong>${count || (/통과/.test(check.result) ? '통과' : '확인')}<span>${count ? '통과' : ''}</span></strong></div>`;
            })
            .join('')
        : '<p class="rail-note">이 일지에는 별도의 검사 결과가 등록되지 않았어요.</p>'
    }<p class="rail-note">보고서에 남긴 결과입니다.<br>실제 서비스·실기기 확인 여부는 원문을 참고해 주세요.</p><button class="rail-link" data-action="checks">검증 기록 자세히 보기${icon('arrow')}</button></section><section class="rail-card"><h3 class="rail-heading">${icon('flag')}다음에 할 일</h3><ul class="next-preview">${
      report.next
        .slice(0, 3)
        .map(
          (item) =>
            `<li><span><strong>${escape(item.title)}</strong>${escape(item.status)}</span></li>`,
        )
        .join('') || '<li>등록된 후속 작업이 없어요.</li>'
    }</ul><button class="rail-link" data-action="next">전체 후속 작업 ${report.next.length}개${icon('arrow')}</button></section><p class="provenance">${report.origin === 'project' ? '원본 문서를 바탕으로 정리한 기록입니다. 날짜 폴더의 보고서를 수정한 뒤 사이트를 다시 생성하면 반영됩니다.' : '이 브라우저에 직접 등록한 기록입니다. 백업 파일로 보관할 수 있어요.'}</p>`;
  }
  function render() {
    renderCalendar();
    const isTc = view === 'tc';
    doc.body.classList.toggle('tc-mode', isTc);
    doc.querySelector('.week-section').hidden = isTc;
    byId('new-button').hidden = isTc;
    doc.querySelector('.page-heading h1').innerHTML =
      `${isTc ? '페이지별 TC 차트' : '일일 보고서'}<span class="heading-dot">.</span>`;
    doc.querySelector('.page-heading .eyebrow').textContent = isTc
      ? 'TEST CASE MATRIX'
      : 'THE DAILY PROGRESS';
    doc.querySelector('.page-description').textContent = isTc
      ? '개발 · 에뮬레이터 · 실제 기기의 검수 결과를 구분합니다.'
      : '오늘의 작업과 달라진 점을 기록합니다.';
    doc.querySelector('.breadcrumb strong').textContent = isTc
      ? '페이지별 TC'
      : '일일 보고서';
    doc.querySelector('.record-summary div > span').textContent = isTc
      ? '개의 TC 검수 항목'
      : '일의 작업 기록';
    if (isTc) byId('registered-count').textContent = String(tcChart.caseCount);
    doc.querySelectorAll('[data-view]').forEach((button) => {
      const active =
        button.dataset.view === (view === 'document' ? 'overview' : view);
      button.classList.toggle('active', active);
      if (active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    const report = currentReport();
    doc.querySelector('.print-document')?.remove();
    if (isTc) {
      tcChart.render(byId('report-content'));
      hydrateIcons();
      return;
    }
    if (!report) {
      byId('report-content').innerHTML =
        `<div class="empty-state"><div class="empty-icon">${icon('notebook')}</div><h2>아직 등록된 일지가 없어요</h2><p>${escape(fullDate(selectedDate))}<br>오늘 한 작업과 개선한 점을 첫 일지로 남겨 보세요.</p><div class="empty-actions"><button class="primary-button" data-action="new">일지 등록</button>${allReports().length ? '<button class="secondary-button" data-action="latest">최근 일지로 돌아가기</button>' : ''}</div></div>`;
      hydrateIcons();
      return;
    }
    const tab =
      view === 'document'
        ? 'document'
        : view === 'improvements'
          ? 'improvements'
          : 'overview';
    const body =
      view === 'overview'
        ? overview(report)
        : view === 'improvements'
          ? improvements(report)
          : view === 'checks'
            ? checks(report)
            : view === 'next'
              ? nextSteps(report)
              : `<article class="full-document">${documentHtml(report)}</article>`;
    byId('report-content').innerHTML =
      `<div class="report-header"><div><p class="report-date">${icon('calendar')}${escape(fullDate(report.date))}<span class="pill">${report.origin === 'project' ? '원본 문서' : '직접 작성'}</span></p><h2 class="report-title" id="report-heading" tabindex="-1">${escape(report.title)}</h2></div><div class="report-tools">${report.origin === 'local' ? `<button class="icon-button" data-action="edit" aria-label="현재 일지 수정">${icon('edit')}</button><button class="icon-button" data-action="delete" aria-label="현재 일지 삭제">${icon('trash')}</button>` : ''}<button class="icon-button" data-action="download" aria-label="현재 일지 내려받기" title="Markdown 내려받기">${icon('download')}</button><button class="icon-button" data-action="print" aria-label="현재 일지 인쇄" title="인쇄 또는 PDF 저장">${icon('print')}</button></div></div><div class="content-layout"><div class="content-main"><nav class="content-tabs" aria-label="일지 내용 선택"><button data-action="overview" class="${tab === 'overview' && !['checks', 'next'].includes(view) ? 'active' : ''}">작업 요약</button><button data-action="improvements" class="${tab === 'improvements' ? 'active' : ''}">개선 전후</button><button data-action="document" class="${tab === 'document' ? 'active' : ''}">전체 문서</button></nav>${body}</div><aside class="right-rail" aria-label="일지 보조 정보">${rail(report)}</aside></div>`;
    const print = doc.createElement('div');
    print.className = 'print-document full-document';
    print.innerHTML = `<p>${escape(fullDate(report.date))} · TripPrint</p>${documentHtml(report)}`;
    byId('main').append(print);
    doc
      .querySelectorAll('.content-tabs button')
      .forEach((button) =>
        button.setAttribute(
          'aria-pressed',
          String(button.classList.contains('active')),
        ),
      );
    hydrateIcons();
  }
  function download(content, name, type) {
    const blob = new win.Blob([content], { type });
    const url = win.URL.createObjectURL(blob);
    const link = doc.createElement('a');
    link.href = url;
    link.download = name;
    doc.body.append(link);
    link.click();
    // 느린 기기에서도 내려받기가 시작되기 전에 주소를 해제하지 않는다.
    setTimeout(() => {
      link.remove();
      win.URL.revokeObjectURL(url);
    }, 60000);
  }
  function downloadReport(report) {
    download(
      report.markdown,
      `${report.date}_${report.title.replace(/[\\/:*?"<>|]/g, '_')}.md`,
      'text/markdown;charset=utf-8',
    );
  }
  function openEditor(edit = false) {
    const form = byId('editor-form');
    form.reset();
    byId('editor-error').textContent = '';
    const report = edit ? currentReport() : null;
    if (report && report.origin !== 'local') return;
    editingDate = report?.date || null;
    byId('editor-title').textContent = edit ? '일지 수정' : '새 일지 등록';
    form.elements.date.value = report?.date || selectedDate;
    form.elements.date.readOnly = Boolean(report);
    form.elements.title.value = report?.title || '';
    form.elements.summary.value = report?.summary || '';
    form.elements.status.value = report?.work[0]?.status || 'done';
    form.elements.before.value = report?.improvements[0]?.before || '';
    form.elements.after.value = report?.improvements[0]?.after || '';
    form.elements.next.value =
      report?.next.map((item) => item.action).join('\n') || '';
    byId('editor-dialog').showModal();
  }
  function formReport() {
    const form = byId('editor-form');
    const values = Object.fromEntries(
      ['date', 'title', 'summary', 'before', 'after', 'next', 'status'].map(
        (key) => [key, form.elements[key].value.trim()],
      ),
    );
    if (!validDate(values.date))
      throw new Error('올바른 작업 날짜를 선택해 주세요.');
    if (['title', 'summary', 'before', 'after'].some((key) => !values[key]))
      throw new Error('제목과 오늘 작업, 개선 전후 내용을 입력해 주세요.');
    const { date, title, summary, before, after, next, status } = values;
    const cell = (text) => text.replaceAll('|', '\\|').replaceAll('\n', ' ');
    const markdown = `# ${title}\n\n- 작업일: ${date}\n- 상태: ${statusLabels[status]}\n\n## 오늘 한 작업\n\n${summary}\n\n## 개선 전후\n\n| 개선 전 | 개선 후 |\n| --- | --- |\n| ${cell(before)} | ${cell(after)} |\n\n## 다음 작업\n\n${next || '등록한 후속 작업이 없습니다.'}\n`;
    return validateReport({
      date,
      title,
      summary,
      markdown,
      work: [
        {
          area: title,
          after: summary,
          boundary: next || '등록한 후속 작업이 없습니다.',
          status,
        },
      ],
      improvements: [{ before, after }],
      checks: [],
      next: next ? [{ title: '다음 작업', action: next, status: '예정' }] : [],
    });
  }
  byId('editor-form').addEventListener('submit', (event) => {
    event.preventDefault();
    try {
      const report = formReport();
      if (
        allReports().some(
          (item) => item.date === report.date && item.date !== editingDate,
        )
      )
        throw new Error(
          '이 날짜에는 이미 일지가 있어요. 다른 날짜를 선택해 주세요.',
        );
      const next = [
        ...localReports.filter((item) => item.date !== editingDate),
        report,
      ];
      if (next.length > 300)
        throw new Error(
          '이 브라우저에는 일지를 300개까지 보관할 수 있어요. 먼저 백업한 뒤 오래된 일지를 정리해 주세요.',
        );
      if (!saveLocal(next))
        throw new Error(
          '이 브라우저에 저장하지 못했어요. 파일로 내려받아 보관하거나 저장 공간을 확인한 뒤 다시 시도해 주세요.',
        );
      byId('editor-dialog').close();
      navigate(report.date, 'overview');
      byId('report-heading')?.focus();
      toast(editingDate ? '일지를 수정했어요.' : '새 일지를 등록했어요.');
    } catch (error) {
      byId('editor-error').textContent = error.message;
    }
  });
  byId('draft-download').addEventListener('click', () => {
    try {
      if (byId('editor-form').reportValidity()) downloadReport(formReport());
    } catch (error) {
      byId('editor-error').textContent = error.message;
    }
  });
  ['editor-close', 'editor-cancel'].forEach((id) =>
    byId(id).addEventListener('click', () => byId('editor-dialog').close()),
  );
  byId('new-button').addEventListener('click', () => openEditor());
  byId('previous-week').addEventListener('click', () =>
    navigate(addDays(selectedDate, -7), view),
  );
  byId('next-week').addEventListener('click', () =>
    navigate(addDays(selectedDate, 7), view),
  );
  byId('today-button').addEventListener('click', () => navigate(today, view));
  byId('menu-button').addEventListener('click', () =>
    setMenu(!doc.body.classList.contains('menu-open')),
  );
  byId('menu-backdrop').addEventListener('click', () => setMenu(false));
  doc.addEventListener('click', (event) => {
    const day = event.target.closest('[data-date]');
    if (day) {
      navigate(day.dataset.date, view, true);
      return;
    }
    const nav = event.target.closest('[data-view]');
    if (nav) {
      navigate(selectedDate, nav.dataset.view);
      return;
    }
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (views.has(action)) navigate(selectedDate, action);
    else if (action === 'new') openEditor();
    else if (action === 'edit') openEditor(true);
    else if (action === 'latest' && allReports().length)
      navigate(allReports()[0].date, 'overview');
    else if (action === 'download' && currentReport())
      downloadReport(currentReport());
    else if (action === 'print') win.print();
    else if (action === 'delete') byId('delete-dialog').showModal();
  });
  byId('delete-cancel').addEventListener('click', () =>
    byId('delete-dialog').close(),
  );
  byId('delete-confirm').addEventListener('click', () => {
    const report = currentReport();
    if (!report || report.origin !== 'local') return;
    if (!saveLocal(localReports.filter((item) => item.date !== report.date))) {
      toast(
        '삭제하지 못했어요. 브라우저 저장 공간을 확인한 뒤 다시 시도해 주세요.',
      );
      return;
    }
    byId('delete-dialog').close();
    render();
    toast('이 브라우저에서 일지를 삭제했어요.');
  });
  function search() {
    const query = byId('search-input').value.trim().toLocaleLowerCase();
    const matches = allReports().filter((report) =>
      `${report.date} ${fullDate(report.date)} ${report.title} ${report.markdown}`
        .toLocaleLowerCase()
        .includes(query),
    );
    byId('search-results').innerHTML = matches.length
      ? matches
          .map(
            (report) =>
              `<button class="search-result" data-result-date="${report.date}"><small>${escape(fullDate(report.date))}</small><strong>${escape(report.title)}</strong></button>`,
          )
          .join('')
      : '<p class="search-empty">검색 결과가 없어요. 날짜나 다른 작업명으로 검색해 주세요.</p>';
  }
  function openSearch() {
    byId('search-input').value = '';
    search();
    byId('search-dialog').showModal();
    byId('search-input').focus();
  }
  byId('search-button').addEventListener('click', openSearch);
  byId('search-input').addEventListener('input', search);
  byId('search-results').addEventListener('click', (event) => {
    const date = event.target.closest('[data-result-date]')?.dataset.resultDate;
    if (date) {
      byId('search-dialog').close();
      navigate(date, 'overview');
      byId('report-heading')?.focus();
    }
  });
  doc.addEventListener('keydown', (event) => {
    if (
      (event.ctrlKey || event.metaKey) &&
      event.key.toLowerCase() === 'k' &&
      !doc.querySelector('dialog[open]')
    ) {
      event.preventDefault();
      openSearch();
    }
    if (event.key === 'Escape') setMenu(false);
  });
  byId('backup-button').addEventListener('click', () => {
    if (view === 'tc') {
      tcChart.backup();
      return;
    }
    download(
      JSON.stringify({ version: 1, reports: allReports() }, null, 2),
      `TripPrint-일지백업-${today}.json`,
      'application/json;charset=utf-8',
    );
    toast('일지 백업 파일을 내려받습니다.');
  });
  byId('import-button').addEventListener('click', () => {
    if (view === 'tc') tcChart.importFile();
    else byId('import-file').click();
  });
  byId('import-file').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      if (file.size > 5 * 1024 * 1024)
        throw new Error('백업 파일은 5MB 이하로 선택해 주세요.');
      const data = JSON.parse(await file.text());
      if (
        data.version !== 1 ||
        !Array.isArray(data.reports) ||
        data.reports.length > 300
      )
        throw new Error('일지 백업 형식의 JSON 파일을 선택해 주세요.');
      const incoming = data.reports.map(validateReport),
        dates = new Set(allReports().map((report) => report.date)),
        added = [];
      for (const report of incoming)
        if (!dates.has(report.date)) {
          dates.add(report.date);
          added.push(report);
        }
      if (!added.length) {
        toast('가져올 새 일지가 없어요. 같은 날짜의 기록은 그대로 보관합니다.');
        return;
      }
      if (localReports.length + added.length > 300)
        throw new Error('이 브라우저에는 일지를 300개까지 보관할 수 있어요.');
      if (!saveLocal([...localReports, ...added]))
        throw new Error(
          '저장하지 못했어요. 기존 일지는 유지됩니다. 브라우저 저장 공간을 확인해 주세요.',
        );
      navigate(
        added.sort((a, b) => b.date.localeCompare(a.date))[0].date,
        'overview',
      );
      toast(
        `${added.length}개 일지를 가져왔어요. 같은 날짜의 기록은 건너뛰었어요.`,
      );
    } catch (error) {
      toast(
        error instanceof SyntaxError
          ? '파일을 읽지 못했어요. 일지 백업 JSON 파일을 선택해 주세요.'
          : error.message,
      );
    } finally {
      event.target.value = '';
    }
  });
  win.addEventListener('hashchange', () => {
    const route = /^#(\d{4}-\d{2}-\d{2})\/(\w+)$/.exec(win.location.hash);
    if (route && validDate(route[1]) && views.has(route[2])) {
      selectedDate = route[1];
      view = route[2];
      render();
    }
  });
  win.addEventListener('resize', () => {
    setMenu(win.innerWidth <= 760 && doc.body.classList.contains('menu-open'));
  });
  setMenu(false);
  render();
})();
