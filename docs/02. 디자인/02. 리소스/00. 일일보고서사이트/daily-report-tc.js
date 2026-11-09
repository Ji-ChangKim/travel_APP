globalThis.createTcChart = function createTcChart({
  catalog,
  source,
  notify,
  download,
  icon,
}) {
  const doc = globalThis.document,
    win = globalThis.window;
  const designs = globalThis.createTcDesigns({
    pages: catalog.pages,
    notify,
    download,
    icon,
  });
  const key = 'tripprint.tc-results.v1';
  const stages = [
    {
      id: 'development',
      title: '개발 완료',
      short: '개발',
      description: '구현과 개발 단계 검수',
    },
    {
      id: 'emulator',
      title: 'Android Studio 테스트',
      short: '에뮬',
      description: 'Android 에뮬레이터',
    },
    {
      id: 'device',
      title: '내부 빌드 테스트',
      short: '실기기',
      description: '내부 설치본 · 실제 기기',
    },
  ];
  const names = { pass: '성공', fail: '실패', unverified: '미검증' };
  const cases = catalog.pages.flatMap((page) =>
    page.cases.map((item) => ({ ...item, page })),
  );
  const byId = new Map(cases.map((item) => [item.id, item]));
  const esc = (value) =>
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
  const empty = () => ({
    status: 'unverified',
    updatedAt: null,
    tester: '',
    build: '',
    device: '',
    note: '',
  });
  let selectedPage = catalog.pages[0]?.id || 'all',
    query = '',
    filter = 'all',
    host,
    attached = false;
  let detailId = '',
    incoming = null,
    raw = null,
    locked = false;

  function timestamp(value, optional = false) {
    if (optional && value === null) return null;
    if (
      typeof value !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T/.test(value) ||
      !Number.isFinite(Date.parse(value))
    )
      throw new Error('검수 기록 시각을 확인해 주세요.');
    return value;
  }
  function text(value, max) {
    if (typeof value !== 'string' || value.length > max)
      throw new Error('검수 정보의 형식이나 길이를 확인해 주세요.');
    return value;
  }
  function record(value) {
    if (
      !value ||
      typeof value.status !== 'string' ||
      !Object.hasOwn(names, value.status)
    )
      throw new Error('성공·실패·미검증 중 하나의 결과가 필요해요.');
    return {
      status: value.status,
      updatedAt: timestamp(value.updatedAt, value.status === 'unverified'),
      tester: text(value.tester, 100),
      build: text(value.build, 160),
      device: text(value.device, 160),
      note: text(value.note, 2000),
    };
  }
  function validate(value) {
    if (
      !value ||
      value.schemaVersion !== 1 ||
      value.catalogRevision !== catalog.revision ||
      !value.results ||
      Array.isArray(value.results) ||
      typeof value.results !== 'object' ||
      !Array.isArray(value.history) ||
      value.history.length > 10000
    )
      throw new Error(
        '현재 TC 목록과 같은 버전의 검수 결과 JSON을 선택해 주세요.',
      );
    const results = {};
    for (const [id, entries] of Object.entries(value.results)) {
      if (
        !byId.has(id) ||
        !entries ||
        typeof entries !== 'object' ||
        Array.isArray(entries)
      )
        throw new Error('목록에 없는 TC이거나 잘못된 결과 형식이에요.');
      results[id] = {};
      for (const [stage, item] of Object.entries(entries)) {
        if (!stages.some((entry) => entry.id === stage))
          throw new Error('알 수 없는 검수 단계가 있어요.');
        results[id][stage] = record(item);
      }
    }
    const history = value.history.map((item) => {
      if (
        !item ||
        !byId.has(item.id) ||
        !stages.some((stage) => stage.id === item.stage) ||
        !['status', 'note'].includes(item.kind)
      )
        throw new Error('검수 이력의 TC·단계를 확인해 주세요.');
      return {
        id: item.id,
        stage: item.stage,
        kind: item.kind,
        ...record(item),
      };
    });
    return {
      schemaVersion: 1,
      catalogRevision: catalog.revision,
      results,
      history,
    };
  }
  let data = validate(source);
  try {
    raw = win.localStorage.getItem(key);
    if (raw) {
      const saved = validate(JSON.parse(raw));
      const results = { ...data.results };
      for (const [id, entries] of Object.entries(saved.results)) {
        results[id] = { ...results[id] };
        for (const [stage, item] of Object.entries(entries))
          if (
            !results[id][stage] ||
            (item.updatedAt || '') >= (results[id][stage].updatedAt || '')
          )
            results[id][stage] = item;
      }
      data = {
        ...data,
        results,
        history: [
          ...new Map(
            [...data.history, ...saved.history].map((item) => [
              JSON.stringify(item),
              item,
            ]),
          ).values(),
        ],
      };
    }
  } catch {
    locked = true;
    notify(
      '이 브라우저의 TC 기록을 읽지 못했어요. 기존 기록을 내보내 보관한 뒤 올바른 결과 파일을 가져와 주세요.',
    );
  }
  const get = (id, stage) => data.results[id]?.[stage] || empty();
  const time = (value) =>
    value
      ? new Intl.DateTimeFormat('ko-KR', {
          timeZone: 'Asia/Seoul',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }).format(new Date(value))
      : '기록 없음';
  const outcome = (item) =>
    stages.every((stage) => get(item.id, stage.id).status === 'pass')
      ? 'pass'
      : stages.some((stage) => get(item.id, stage.id).status === 'fail')
        ? 'fail'
        : 'unverified';
  function counts(items, stage) {
    const result = { pass: 0, fail: 0, unverified: 0 };
    for (const item of items)
      result[stage ? get(item.id, stage).status : outcome(item)]++;
    return result;
  }
  function persist(next, restoring = false) {
    if (locked && !restoring) {
      notify('기존 TC 기록을 먼저 내보내 보관한 뒤 결과 파일을 가져와 주세요.');
      return false;
    }
    try {
      const clean = validate(next);
      win.localStorage.setItem(key, JSON.stringify(clean));
      data = clean;
      raw = JSON.stringify(clean);
      locked = false;
      return true;
    } catch {
      notify(
        'TC 결과를 저장하지 못했어요. 이전 결과와 입력은 유지됩니다. 브라우저 저장 공간을 확인한 뒤 다시 시도해 주세요.',
      );
      return false;
    }
  }
  function checks(id, stage, suffix = '') {
    const current = get(id, stage);
    return `<div class="tc-check-pair">${['pass', 'fail'].map((status) => `<label class="tc-choice ${status} ${current.status === status ? 'chosen' : ''}"><input type="checkbox" data-tc-id="${id}" data-tc-stage="${stage}" data-tc-status="${status}" aria-label="${id} ${stages.find((s) => s.id === stage).title} ${names[status]}${suffix}" ${current.status === status ? 'checked' : ''}><span>${names[status]}</span></label>`).join('')}</div>`;
  }
  function miniChart(value, total) {
    const percent = (count) => (total ? (count / total) * 100 : 0);
    return `<div class="tc-bar" role="img" aria-label="성공 ${value.pass}, 실패 ${value.fail}, 미검증 ${value.unverified}"><span class="tc-bar-pass" style="width:${percent(value.pass)}%"></span><span class="tc-bar-fail" style="width:${percent(value.fail)}%"></span><span class="tc-bar-empty" style="width:${percent(value.unverified)}%"></span></div>`;
  }
  function pageOverview() {
    return `<details class="tc-page-overview"><summary>페이지별 진행 현황 <span>${catalog.pages.length}개 페이지</span></summary><div class="tc-table-scroll" tabindex="0" role="region" aria-label="페이지별 TC 진행 차트"><table class="tc-overview-table"><thead><tr><th>페이지</th><th>TC</th>${stages.map((stage) => `<th>${stage.title}<small>${stage.description}</small></th>`).join('')}</tr></thead><tbody>${catalog.pages
      .map(
        (page) =>
          `<tr><th scope="row"><button class="tc-page-jump" data-tc-page-jump="${page.id}">${page.id} · ${esc(page.name)}</button></th><td>${page.cases.length}</td>${stages
            .map((stage) => {
              const value = counts(page.cases, stage.id);
              return `<td>${miniChart(value, page.cases.length)}<p class="tc-count-text">성공 ${value.pass} · 실패 ${value.fail} · 미검증 ${value.unverified}</p></td>`;
            })
            .join('')}</tr>`,
      )
      .join('')}</tbody></table></div></details>`;
  }
  function refreshPrint() {
    doc.querySelector('.print-document')?.remove();
    const printable = doc.createElement('div');
    printable.className = 'print-document full-document';
    printable.innerHTML = `<h2>TripPrint 페이지별 TC 검수표</h2><p>개발 완료 / Android Studio 에뮬레이터 / 내부 빌드 실기기 · 출력 ${esc(time(new Date().toISOString()))}</p><table><thead><tr><th>TC · 페이지 · 검사</th>${stages.map((stage) => `<th>${stage.title}</th>`).join('')}</tr></thead><tbody>${visibleCases()
      .map(
        (item) =>
          `<tr><td>${item.id} · ${esc(item.page.name)}<br>${esc(item.title)}</td>${stages
            .map((stage) => {
              const value = get(item.id, stage.id);
              return `<td><strong>${names[value.status]}</strong><br>${esc(value.tester)} ${esc(value.build)} ${esc(value.device)}<br>${esc(value.note)}<br>${esc(time(value.updatedAt))}</td>`;
            })
            .join('')}</tr>`,
      )
      .join(
        '',
      )}</tbody></table><p>수동으로 기록한 결과이며 실제 실행 환경·증거와 함께 확인합니다.</p>`;
    doc.getElementById('main').append(printable);
  }
  function visibleCases() {
    return cases.filter(
      (item) =>
        (selectedPage === 'all' || item.page.id === selectedPage) &&
        `${item.id} ${item.title} ${item.expected} ${item.page.name}`
          .toLowerCase()
          .includes(query.toLowerCase()) &&
        (filter === 'all' || filter === outcome(item)),
    );
  }
  function render(target = host) {
    host = target;
    const overall = counts(cases),
      selected = catalog.pages.find((page) => page.id === selectedPage),
      visible = visibleCases();
    host.innerHTML = `<section class="tc-workspace" aria-label="TripPrint 앱 페이지별 테스트 케이스"><div class="tc-topline"><div><p class="eyebrow">TRIPPRINT APP · TEST CASE MATRIX</p><h2>검수 결과를 단계별로 기록하세요</h2><p>성공·실패를 체크하고, 다시 확인하지 않은 항목은 미검증으로 남깁니다.</p></div><div class="tc-export-actions"><button class="primary-button" data-tc-action="export">검수 기록 내려받기</button><button class="secondary-button" data-tc-action="import">결과 가져오기</button><button class="icon-button" data-tc-action="print" aria-label="TC 검수표 인쇄">${icon('print')}</button></div></div><div class="tc-stage-cards">${stages
      .map((stage, i) => {
        const value = counts(cases, stage.id);
        return `<article class="tc-stage-card"><div class="tc-stage-name"><span>0${i + 1}</span><h3>${stage.title}</h3></div><p>${stage.description}</p><div class="tc-stage-score"><strong>${value.pass}<small> / ${cases.length}</small></strong><span>성공한 TC</span></div>${miniChart(value, cases.length)}<div class="tc-stage-legend"><span>성공 <b>${value.pass}</b></span><span>실패 <b>${value.fail}</b></span><span>미검증 <b>${value.unverified}</b></span></div></article>`;
      })
      .join(
        '',
      )}</div><p class="tc-storage-note">체크 결과는 이 브라우저에 보관됩니다. 개발 체크가 에뮬·실기기 결과를 자동 변경하지 않습니다. 파일 보관은 ‘검수 기록 내려받기’를 사용하세요.${locked ? '<strong> 기존 브라우저 기록을 읽지 못해 변경을 보호하고 있습니다.</strong>' : ''}</p>${pageOverview()}<div class="tc-filters"><label>페이지 선택<select id="tc-page-select"><option value="all">전체 페이지 (${cases.length} TC)</option>${catalog.pages.map((page) => `<option value="${page.id}" ${selectedPage === page.id ? 'selected' : ''}>${page.id} · ${esc(page.name)} (${page.cases.length})</option>`).join('')}</select></label><label class="tc-search-label">TC 검색<input id="tc-search" type="search" value="${esc(query)}" placeholder="TC ID, 기능, 기대 결과"></label><label>검수 상태<select id="tc-result-filter">${[
      ['all', '전체 상태'],
      ['fail', '실패가 있는 TC'],
      ['unverified', '아직 완료하지 않은 TC'],
      ['pass', '3단계 모두 성공'],
    ]
      .map(
        ([value, title]) =>
          `<option value="${value}" ${filter === value ? 'selected' : ''}>${title}</option>`,
      )
      .join(
        '',
      )}</select></label></div><div class="tc-list-heading"><div><h3>${selected ? `${selected.id} · ${esc(selected.name)}` : '전체 페이지'}</h3><p>${selected ? esc(selected.route) : '페이지별로 기능과 결과를 확인합니다.'}</p></div><span>${visible.length}개 표시 · 전체 ${catalog.pages.length}개 페이지 / ${cases.length} TC</span></div><div id="tc-design-slot"></div><p class="tc-scroll-hint">표를 좌우로 밀어 세 단계의 결과를 확인하세요.</p><div class="tc-table-scroll" tabindex="0" role="region" aria-label="페이지별 TC 체크 차트"><table class="tc-matrix"><thead><tr><th>TC · 검사 내용</th>${stages.map((stage, i) => `<th><span class="tc-column-step">0${i + 1}</span>${stage.title}<small>${stage.description}</small></th>`).join('')}<th>상세·기록</th></tr></thead><tbody>${
      visible.length
        ? visible
            .map(
              (item) =>
                `<tr data-tc-row="${item.id}"><th scope="row"><span class="tc-id">${item.id} <small>${esc(item.page.name)}</small></span><strong>${esc(item.title)}</strong><p>${esc(item.expected)}</p></th>${stages
                  .map((stage) => {
                    const value = get(item.id, stage.id);
                    return `<td class="tc-result-cell">${checks(item.id, stage.id)}<span class="tc-cell-state ${value.status}">${names[value.status]}</span>${value.updatedAt ? `<small class="tc-updated">${esc(time(value.updatedAt))}</small>` : ''}</td>`;
                  })
                  .join(
                    '',
                  )}<td><button class="secondary-button tc-detail-button" data-tc-open="${item.id}">기준·메모</button><span class="tc-overall ${outcome(item)}">${outcome(item) === 'pass' ? '3단계 성공' : outcome(item) === 'fail' ? '실패 있음' : '검수 진행 전·중'}</span></td></tr>`,
            )
            .join('')
        : '<tr><td colspan="5" class="tc-no-results">조건에 맞는 TC가 없어요. 페이지·검색어·상태를 바꿔 주세요.</td></tr>'
    }</tbody></table></div><p class="tc-bottom-note">전체 기준: 3단계 성공 ${overall.pass} · 실패 있음 ${overall.fail} · 완료 전 ${overall.unverified}. 웹 자동 검사 통과만으로 에뮬레이터·실기기 성공을 표시하지 않습니다.</p></section>`;
    if (selectedPage === 'all')
      doc.getElementById('tc-page-select').value = 'all';
    designs.mount(host.querySelector('#tc-design-slot'), selectedPage);
    refreshPrint();
    if (!attached) {
      host.addEventListener('change', onChange);
      host.addEventListener('input', onInput);
      host.addEventListener('click', onClick);
      attached = true;
    }
  }
  const detail = doc.createElement('dialog');
  detail.className = 'tc-detail-dialog';
  detail.id = 'tc-detail-dialog';
  detail.setAttribute('aria-labelledby', 'tc-detail-title');
  doc.body.append(detail);
  const restore = doc.createElement('dialog');
  restore.className = 'confirm-dialog';
  restore.id = 'tc-import-dialog';
  restore.setAttribute('aria-labelledby', 'tc-import-title');
  doc.body.append(restore);
  const fileInput = doc.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'application/json,.json';
  fileInput.hidden = true;
  fileInput.id = 'tc-import-file';
  doc.body.append(fileInput);
  function renderDetail() {
    const item = byId.get(detailId);
    if (!item) return;
    const recent = data.history
      .filter((event) => event.id === item.id)
      .slice(-5)
      .reverse();
    detail.innerHTML = `<div class="dialog-top"><div><p class="eyebrow">${item.id} · ${esc(item.page.name)}</p><h2 id="tc-detail-title">${esc(item.title)}</h2></div><button type="button" class="icon-button" data-tc-detail-close aria-label="TC 상세 닫기">${icon('close')}</button></div><dl class="tc-definition"><dt>사전 조건</dt><dd>${esc(item.condition || item.page.condition)}</dd><dt>조작 순서</dt><dd><ol>${item.steps.map((step) => `<li>${esc(step)}</li>`).join('')}</ol></dd><dt>기대 결과</dt><dd>${esc(item.expected)}</dd></dl><p class="editor-notice">성공·실패 체크를 바꾸거나 ‘검수 정보 저장’을 누르면 입력한 정보도 함께 보관됩니다. 체크는 수동 기록이며 테스트를 자동 실행하지 않습니다.</p><form id="tc-detail-form"><div class="tc-detail-stages">${stages
      .map((stage) => {
        const value = get(item.id, stage.id);
        return `<fieldset><legend>${stage.title}</legend>${checks(item.id, stage.id, ' 상세')}<label>검수자<input name="${stage.id}-tester" value="${esc(value.tester)}" maxlength="100" placeholder="선택 입력"></label><label>버전·빌드<input name="${stage.id}-build" value="${esc(value.build)}" maxlength="160" placeholder="예: 앱 버전 / 빌드 번호"></label><label>기기·OS<input name="${stage.id}-device" value="${esc(value.device)}" maxlength="160" placeholder="예: 에뮬레이터 또는 실제 기기"></label><label>메모·증거 위치<textarea name="${stage.id}-note" maxlength="2000" rows="3" placeholder="실패 증상, 재현 방법, 캡처 위치">${esc(value.note)}</textarea></label><small>${esc(time(value.updatedAt))}</small></fieldset>`;
      })
      .join(
        '',
      )}</div><p id="tc-detail-error" class="form-error" role="alert"></p><div class="dialog-actions"><button type="button" class="secondary-button" data-tc-detail-close>닫기</button><button type="submit" class="primary-button">검수 정보 저장</button></div></form><section class="tc-recent"><h3>최근 기록</h3>${recent.length ? `<ol>${recent.map((event) => `<li><span>${esc(time(event.updatedAt))}</span> ${stages.find((stage) => stage.id === event.stage).short} · ${names[event.status]}${event.kind === 'note' ? ' · 메모 갱신' : ''}</li>`).join('')}</ol>` : '<p>아직 기록한 결과가 없어요.</p>'}</section>`;
  }
  function detailFields(stage) {
    const form = detail.querySelector('form');
    if (!form) return {};
    return Object.fromEntries(
      ['tester', 'build', 'device', 'note'].map((field) => [
        field,
        form.elements[`${stage}-${field}`].value,
      ]),
    );
  }
  function update(id, changedStage, status) {
    const item = byId.get(id);
    if (!item) return;
    const results = { ...data.results, [id]: { ...data.results[id] } },
      history = [...data.history];
    const at = new Date().toISOString();
    let changes = 0;
    for (const stage of stages) {
      const old = get(id, stage.id);
      const fields =
        detail.open && detailId === id ? detailFields(stage.id) : {};
      const next = {
        ...old,
        ...fields,
        ...(stage.id === changedStage ? { status } : {}),
      };
      if (JSON.stringify(next) === JSON.stringify(old)) continue;
      next.updatedAt = at;
      results[id][stage.id] = next;
      history.push({
        id,
        stage: stage.id,
        kind: old.status === next.status ? 'note' : 'status',
        ...next,
      });
      changes++;
    }
    if (!changes) {
      notify('변경한 검수 정보가 없어요.');
      return;
    }
    if (!persist({ ...data, results, history })) {
      render();
      detail.querySelectorAll('[data-tc-status]').forEach((input) => {
        input.checked =
          get(input.dataset.tcId, input.dataset.tcStage).status ===
          input.dataset.tcStatus;
      });
      return;
    }
    render();
    if (detail.open) renderDetail();
    const scope = detail.open ? detail : host;
    if (changedStage)
      scope
        .querySelector(
          `input[data-tc-id="${id}"][data-tc-stage="${changedStage}"][data-tc-status="${status === 'unverified' ? 'pass' : status}"]`,
        )
        ?.focus({ preventScroll: true });
    notify(
      changedStage
        ? `${id} · ${stages.find((stage) => stage.id === changedStage).short} ${names[status]}로 기록했어요.`
        : '검수 정보를 저장했어요.',
    );
  }
  function onChange(event) {
    const input = event.target;
    if (input.matches('[data-tc-status]'))
      update(
        input.dataset.tcId,
        input.dataset.tcStage,
        input.checked ? input.dataset.tcStatus : 'unverified',
      );
    else if (input.id === 'tc-page-select') {
      selectedPage = input.value;
      render();
      doc.getElementById('tc-page-select').focus();
    } else if (input.id === 'tc-result-filter') {
      filter = input.value;
      render();
      doc.getElementById('tc-result-filter').focus();
    }
  }
  function onInput(event) {
    if (event.target.id !== 'tc-search') return;
    const position = event.target.selectionStart;
    query = event.target.value;
    render();
    const input = doc.getElementById('tc-search');
    input.focus();
    if (position !== null) input.setSelectionRange(position, position);
  }
  function onClick(event) {
    const page = event.target.closest('[data-tc-page-jump]');
    if (page) {
      selectedPage = page.dataset.tcPageJump;
      render();
      doc.getElementById('tc-page-select').focus();
      return;
    }
    const open = event.target.closest('[data-tc-open]');
    if (open) {
      detailId = open.dataset.tcOpen;
      renderDetail();
      detail.showModal();
      return;
    }
    const action = event.target.closest('[data-tc-action]')?.dataset.tcAction;
    if (action === 'export') backup();
    else if (action === 'import') fileInput.click();
    else if (action === 'print') win.print();
  }
  detail.addEventListener('change', onChange);
  detail.addEventListener('click', (event) => {
    if (event.target.closest('[data-tc-detail-close]')) detail.close();
  });
  detail.addEventListener('submit', (event) => {
    event.preventDefault();
    update(detailId);
  });
  detail.addEventListener('close', () => {
    host
      ?.querySelector(`[data-tc-open="${detailId}"]`)
      ?.focus({ preventScroll: true });
  });
  function backup() {
    download(
      locked && raw ? raw : JSON.stringify(data, null, 2),
      locked && raw ? 'tc-results-unreadable.json' : 'tc-results.json',
      'application/json;charset=utf-8',
    );
    notify('TC 검수 결과 파일을 내려받습니다.');
  }
  fileInput.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      if (file.size > 5 * 1024 * 1024)
        throw new Error('검수 결과 파일은 5MB 이하로 선택해 주세요.');
      incoming = validate(JSON.parse(await file.text()));
      const count = Object.values(incoming.results).reduce(
        (sum, entries) => sum + Object.keys(entries).length,
        0,
      );
      if (!count) {
        notify('파일에 적용할 TC 단계 기록이 없어요. 현재 결과를 유지합니다.');
        return;
      }
      restore.innerHTML = `<h2 id="tc-import-title">검수 결과를 가져올까요?</h2><p>${count}개 TC 단계 기록을 현재 자료와 합칩니다.<br>같은 TC·단계는 파일 값으로 바뀌고, 파일에 없는 현재 기록은 유지합니다.</p><p>현재 기록이 필요하면 먼저 검수 결과를 내려받아 보관해 주세요.</p><div class="dialog-actions"><button class="secondary-button" data-tc-import-cancel>취소</button><button class="primary-button" data-tc-import-apply>파일 결과 적용</button></div>`;
      restore.showModal();
    } catch (error) {
      incoming = null;
      notify(
        error instanceof SyntaxError
          ? '검수 결과 JSON을 읽지 못했어요. 기존 결과는 유지합니다.'
          : error.message,
      );
    } finally {
      event.target.value = '';
    }
  });
  restore.addEventListener('click', (event) => {
    if (event.target.closest('[data-tc-import-cancel]')) {
      incoming = null;
      restore.close();
    }
    if (!event.target.closest('[data-tc-import-apply]') || !incoming) return;
    const results = { ...data.results };
    for (const [id, entries] of Object.entries(incoming.results))
      results[id] = { ...results[id], ...entries };
    const history = [
      ...new Map(
        [...data.history, ...incoming.history].map((item) => [
          JSON.stringify(item),
          item,
        ]),
      ).values(),
    ];
    if (persist({ ...data, results, history }, true)) {
      incoming = null;
      restore.close();
      render();
      notify('TC 검수 결과를 가져왔어요.');
    }
  });
  return {
    render,
    backup,
    importFile: () => fileInput.click(),
    caseCount: cases.length,
  };
};
