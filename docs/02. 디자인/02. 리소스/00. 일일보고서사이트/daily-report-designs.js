globalThis.createTcDesigns = function createTcDesigns({
  pages,
  notify,
  download,
  icon,
}) {
  const doc = globalThis.document,
    win = globalThis.window;
  const kinds = {
    capture: '실제 앱 캡처',
    design: '디자인 시안',
    sketch: '구조 스케치',
  };
  const types = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
  };
  const pageMap = new Map(pages.map((page) => [page.id, page]));
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
  let database,
    slot,
    pageId,
    generation = 0,
    current,
    thumbnailUrl,
    previewUrl,
    viewerUrl,
    editPage,
    editRecord,
    picked,
    selecting = 0,
    pendingImport;
  const date = (value) =>
    new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  function open() {
    if (database) return database;
    database = new Promise((resolve, reject) => {
      const request = win.indexedDB.open('tripprint.tc-designs.v1', 1);
      request.onupgradeneeded = () =>
        request.result.createObjectStore('pages', { keyPath: 'pageId' });
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          database = null;
        };
        resolve(db);
      };
      request.onerror = () => {
        database = null;
        reject(
          new Error(
            '디자인 저장소를 열지 못했어요. 브라우저 저장 설정을 확인한 뒤 다시 시도해 주세요.',
          ),
        );
      };
      request.onblocked = () => {
        database = null;
        reject(new Error('다른 창의 보고서를 닫은 뒤 다시 시도해 주세요.'));
      };
    });
    return database;
  }
  async function read(id) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const request = db.transaction('pages', 'readonly').objectStore('pages');
      const result = id ? request.get(id) : request.getAll();
      result.onsuccess = () => resolve(result.result);
      result.onerror = () =>
        reject(new Error('디자인을 읽지 못했어요. 다시 시도해 주세요.'));
    });
  }
  async function write(entries, removeId) {
    const db = await open();
    return new Promise((resolve, reject) => {
      // 여러 페이지를 복원할 때도 모두 저장돼야 기존 자료를 교체한다.
      const failed = () =>
        reject(
          new Error(
            '디자인을 저장하지 못했어요. 기존 자료는 유지됩니다. 저장 공간을 확인한 뒤 다시 시도해 주세요.',
          ),
        );
      let tx;
      try {
        tx = db.transaction('pages', 'readwrite');
        const store = tx.objectStore('pages');
        if (removeId) store.delete(removeId);
        else entries.forEach((entry) => store.put(entry));
        tx.oncomplete = resolve;
        tx.onabort = tx.onerror = failed;
      } catch {
        tx?.abort();
        failed();
      }
    });
  }
  function field(value, max, required = false) {
    if (
      typeof value !== 'string' ||
      value.length > max ||
      (required && !value.trim())
    )
      throw new Error('디자인 제목·버전·메모의 형식과 길이를 확인해 주세요.');
    return value;
  }
  function metadata(value) {
    if (
      !value ||
      !pageMap.has(value.pageId) ||
      typeof value.kind !== 'string' ||
      !Object.hasOwn(kinds, value.kind) ||
      typeof value.updatedAt !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T/.test(value.updatedAt) ||
      !Number.isFinite(Date.parse(value.updatedAt))
    )
      throw new Error('디자인의 페이지·종류·등록 시각을 확인해 주세요.');
    return {
      pageId: value.pageId,
      kind: value.kind,
      title: field(value.title, 100, true),
      build: field(value.build, 160),
      note: field(value.note, 1000),
      updatedAt: value.updatedAt,
    };
  }
  async function imageInfo(blob) {
    if (
      !(blob instanceof win.Blob) ||
      !Object.hasOwn(types, blob.type) ||
      blob.size === 0 ||
      blob.size > 2 * 1024 * 1024
    )
      throw new Error('2MB 이하의 PNG·JPEG·WebP 이미지를 선택해 주세요.');
    const bytes = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
    const png = [137, 80, 78, 71, 13, 10, 26, 10].every(
      (n, i) => bytes[i] === n,
    );
    const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    const webp =
      String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
      String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
    if (
      !{ 'image/png': png, 'image/jpeg': jpeg, 'image/webp': webp }[blob.type]
    )
      throw new Error(
        '파일 내용이 이미지 형식과 달라요. PNG·JPEG·WebP 원본을 선택해 주세요.',
      );
    const url = win.URL.createObjectURL(blob),
      img = new win.Image();
    try {
      img.src = url;
      await img.decode();
      if (
        !img.naturalWidth ||
        !img.naturalHeight ||
        img.naturalWidth > 8000 ||
        img.naturalHeight > 8000 ||
        img.naturalWidth * img.naturalHeight > 12000000
      )
        throw new Error(
          '이미지는 가로·세로 8,000px 이하, 전체 1,200만 픽셀 이하로 선택해 주세요.',
        );
      return { width: img.naturalWidth, height: img.naturalHeight };
    } catch (error) {
      if (error.name === 'EncodingError')
        throw new Error(
          '이미지를 읽지 못했어요. 다른 원본 파일을 선택해 주세요.',
        );
      throw error;
    } finally {
      win.URL.revokeObjectURL(url);
    }
  }
  function revoke(url) {
    if (url) win.URL.revokeObjectURL(url);
  }
  function storageNote() {
    return '<p class="tc-design-storage">이미지는 이 브라우저에 보관됩니다. 다른 기기로 옮기거나 브라우저를 초기화하기 전에 ‘디자인 백업’을 내려받으세요. TC 결과 파일과 별도입니다.</p>';
  }
  async function mount(target, id) {
    slot = target;
    pageId = id;
    current = null;
    const token = ++generation;
    revoke(thumbnailUrl);
    thumbnailUrl = null;
    if (!pageMap.has(id)) {
      slot.innerHTML =
        '<section class="tc-design-panel"><h3>현재 디자인</h3><p>페이지를 하나 선택하면 해당 화면의 디자인을 추가하거나 확인할 수 있어요.</p></section>';
      return;
    }
    slot.innerHTML =
      '<section class="tc-design-panel"><h3>현재 디자인</h3><p role="status">저장한 디자인을 확인하고 있어요.</p></section>';
    try {
      const entry = await read(id);
      if (token !== generation || !slot.isConnected) return;
      const loaded = entry
        ? {
            ...metadata(entry),
            blob: entry.blob,
            ...(await imageInfo(entry.blob)),
          }
        : null;
      if (token !== generation || !slot.isConnected) return;
      // 이전 페이지의 이미지 해독이 늦어도 새 페이지 상태에 넣지 않는다.
      current = loaded;
      render();
    } catch (error) {
      if (token !== generation || !slot.isConnected) return;
      slot.innerHTML = `<section class="tc-design-panel"><h3>현재 디자인</h3><p role="alert">${esc(error.message)}</p><button class="secondary-button" data-design-action="retry">다시 시도</button></section>`;
      bind();
    }
  }
  function render() {
    if (!slot?.isConnected) return;
    if (current) thumbnailUrl = win.URL.createObjectURL(current.blob);
    slot.innerHTML = `<section class="tc-design-panel" aria-label="선택 페이지의 현재 디자인"><div class="tc-design-heading"><div><p class="eyebrow">${pageId} · PAGE DESIGN</p><h3>현재 디자인</h3></div><div class="tc-design-actions"><button class="quiet-button" data-design-action="backup">디자인 백업</button><button class="quiet-button" data-design-action="import">디자인 가져오기</button><button class="${current ? 'secondary' : 'primary'}-button" data-design-action="edit">${current ? '디자인 수정·교체' : '현재 디자인 추가'}</button></div></div>${current ? `<div class="tc-design-content"><button class="tc-design-thumb" data-design-action="view" aria-label="${esc(current.title)} 크게 보기"><img src="${thumbnailUrl}" alt="${esc(current.title)}"><span>${icon('search')} 크게 보기</span></button><div class="tc-design-info"><span class="tc-design-kind">${kinds[current.kind]}</span><h4>${esc(current.title)}</h4><dl><dt>버전·빌드</dt><dd>${esc(current.build || '입력하지 않음')}</dd><dt>등록·수정</dt><dd>${esc(date(current.updatedAt))}</dd><dt>이미지</dt><dd>${current.width} × ${current.height}px · ${Math.ceil(current.blob.size / 1024)}KB</dd></dl><p class="tc-design-note">${esc(current.note || '등록한 메모가 없어요.')}</p><div class="tc-design-actions"><button class="secondary-button" data-design-action="download">원본 내려받기</button><button class="quiet-button danger-text" data-design-action="delete">디자인 삭제</button></div></div></div>` : `<div class="tc-design-empty"><span class="tc-design-placeholder">${icon('layers')}</span><div><h4>${esc(pageMap.get(pageId).name)}의 디자인을 추가하세요</h4><p>실제 앱 캡처나 시안을 등록하면 이 페이지의 TC와 함께 확인할 수 있어요.<br>등록 전에는 확인되지 않은 화면을 대신 표시하지 않습니다.</p></div></div>`}${storageNote()}</section>`;
    bind();
  }
  function bind() {
    slot.onclick = (event) => {
      const action = event.target.closest('[data-design-action]')?.dataset
        .designAction;
      if (action === 'edit') showEditor();
      else if (action === 'view') showViewer();
      else if (action === 'download')
        download(
          current.blob,
          `${pageId}-design.${types[current.blob.type]}`,
          current.blob.type,
        );
      else if (action === 'delete') confirmDelete();
      else if (action === 'backup') backup();
      else if (action === 'import') importInput.click();
      else if (action === 'retry') mount(slot, pageId);
    };
  }
  const editor = doc.createElement('dialog');
  editor.className = 'tc-design-editor';
  editor.setAttribute('aria-labelledby', 'design-editor-title');
  editor.id = 'tc-design-editor';
  doc.body.append(editor);
  function showEditor() {
    editPage = pageId;
    editRecord = current;
    picked = null;
    selecting++;
    revoke(previewUrl);
    previewUrl = current ? win.URL.createObjectURL(current.blob) : null;
    editor.innerHTML = `<div class="dialog-top"><div><p class="eyebrow">${editPage} · ${esc(pageMap.get(editPage).name)}</p><h2 id="design-editor-title">현재 디자인 ${current ? '수정·교체' : '추가'}</h2></div><button class="icon-button" data-design-close aria-label="디자인 등록 닫기">${icon('close')}</button></div><form id="tc-design-form"><label>이미지 종류<select name="kind">${Object.entries(
      kinds,
    )
      .map(
        ([value, title]) =>
          `<option value="${value}" ${current?.kind === value ? 'selected' : ''}>${title}</option>`,
      )
      .join(
        '',
      )}</select></label><label>제목<input name="title" maxlength="100" required value="${esc(current?.title || pageMap.get(editPage).name)}"></label><label>이미지 파일<input type="file" name="image" accept="image/png,image/jpeg,image/webp" ${current ? '' : 'required'}></label><p class="tc-design-help">PNG·JPEG·WebP · 2MB 이하 · 최대 1,200만 픽셀. 개인정보가 없는 화면을 사용하세요.${current ? ' 파일을 선택하지 않으면 현재 이미지를 유지합니다.' : ''}</p><div class="tc-design-preview" ${previewUrl ? '' : 'hidden'}><img id="tc-design-preview" ${previewUrl ? `src="${previewUrl}"` : ''} alt="저장 전 디자인 미리보기"></div><label>버전·빌드<input name="build" maxlength="160" placeholder="예: 앱 버전, 검수 빌드 번호" value="${esc(current?.build || '')}"></label><label>메모<textarea name="note" maxlength="1000" rows="3" placeholder="확인할 부분이나 이전 화면과 달라진 점">${esc(current?.note || '')}</textarea></label><p class="form-error" id="design-editor-error" role="alert"></p><div class="dialog-actions"><button type="button" class="secondary-button" data-design-close>취소</button><button type="submit" class="primary-button">디자인 저장</button></div></form>`;
    editor.showModal();
  }
  editor.addEventListener('click', (event) => {
    if (event.target.closest('[data-design-close]')) editor.close();
  });
  editor.addEventListener('close', () => {
    selecting++;
    picked = null;
    revoke(previewUrl);
    previewUrl = null;
    slot
      ?.querySelector('[data-design-action="edit"]')
      ?.focus({ preventScroll: true });
  });
  editor.addEventListener('change', async (event) => {
    if (event.target.name !== 'image') return;
    const input = event.target,
      file = input.files[0],
      token = ++selecting;
    const submit = editor.querySelector('[type="submit"]');
    submit.disabled = Boolean(file);
    picked = null;
    revoke(previewUrl);
    previewUrl = editRecord ? win.URL.createObjectURL(editRecord.blob) : null;
    editor.querySelector('.tc-design-preview').hidden = !previewUrl;
    const preview = editor.querySelector('#tc-design-preview');
    if (previewUrl) preview.src = previewUrl;
    else preview.removeAttribute('src');
    editor.querySelector('#design-editor-error').textContent = '';
    if (!file) return;
    try {
      const info = await imageInfo(file);
      if (token !== selecting || !editor.open) return;
      picked = { blob: file, ...info };
      revoke(previewUrl);
      previewUrl = win.URL.createObjectURL(file);
      editor.querySelector('#tc-design-preview').src = previewUrl;
      editor.querySelector('.tc-design-preview').hidden = false;
    } catch (error) {
      if (token !== selecting) return;
      input.value = '';
      editor.querySelector('#design-editor-error').textContent = error.message;
    } finally {
      if (token === selecting) submit.disabled = false;
    }
  });
  editor.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.target,
      submit = form.querySelector('[type="submit"]');
    if (form.elements.image.files.length && !picked) {
      editor.querySelector('#design-editor-error').textContent =
        '이미지를 확인한 뒤 저장해 주세요.';
      return;
    }
    if (!picked && !editRecord) {
      editor.querySelector('#design-editor-error').textContent =
        '이미지를 선택해 주세요.';
      return;
    }
    try {
      submit.disabled = true;
      const entry = {
        ...metadata({
          pageId: editPage,
          kind: form.elements.kind.value,
          title: form.elements.title.value,
          build: form.elements.build.value,
          note: form.elements.note.value,
          updatedAt: new Date().toISOString(),
        }),
        ...(picked || {
          blob: editRecord.blob,
          width: editRecord.width,
          height: editRecord.height,
        }),
      };
      await write([entry]);
      editor.close();
      if (slot?.isConnected) mount(slot, pageId);
      notify('이 페이지의 디자인을 저장했어요.');
    } catch (error) {
      editor.querySelector('#design-editor-error').textContent = error.message;
    } finally {
      submit.disabled = false;
    }
  });
  const viewer = doc.createElement('dialog');
  viewer.className = 'tc-design-viewer';
  viewer.id = 'tc-design-viewer';
  viewer.setAttribute('aria-labelledby', 'design-view-title');
  doc.body.append(viewer);
  function showViewer() {
    if (!current) return;
    revoke(viewerUrl);
    viewerUrl = win.URL.createObjectURL(current.blob);
    viewer.innerHTML = `<div class="dialog-top"><div><p class="eyebrow">${kinds[current.kind]} · ${esc(current.build || '버전 입력 없음')}</p><h2 id="design-view-title">${esc(current.title)}</h2></div><button class="icon-button" data-viewer-close aria-label="디자인 크게 보기 닫기">${icon('close')}</button></div><img src="${viewerUrl}" alt="${esc(current.title)}"><p>${esc(current.note)}</p><button class="secondary-button" data-viewer-close>닫기</button>`;
    viewer.showModal();
  }
  viewer.addEventListener('click', (event) => {
    if (event.target.closest('[data-viewer-close]')) viewer.close();
  });
  viewer.addEventListener('close', () => {
    revoke(viewerUrl);
    viewerUrl = null;
    slot
      ?.querySelector('[data-design-action="view"]')
      ?.focus({ preventScroll: true });
  });
  const confirm = doc.createElement('dialog');
  confirm.className = 'confirm-dialog';
  confirm.id = 'tc-design-confirm';
  confirm.setAttribute('aria-labelledby', 'design-confirm-title');
  doc.body.append(confirm);
  confirm.addEventListener('close', () => {
    pendingImport = null;
  });
  function confirmDelete() {
    pendingImport = null;
    confirm.innerHTML = `<h2 id="design-confirm-title">이 페이지의 디자인을 삭제할까요?</h2><p>${esc(pageMap.get(pageId).name)}에 등록한 이미지·메모를 지웁니다. TC 결과와 다른 페이지의 디자인은 유지합니다.</p><p class="form-error" role="alert"></p><div class="dialog-actions"><button class="secondary-button" data-design-cancel>취소</button><button class="primary-button" data-design-remove="${pageId}">디자인 삭제</button></div>`;
    confirm.showModal();
  }
  confirm.addEventListener('click', async (event) => {
    if (event.target.closest('[data-design-cancel]')) {
      confirm.close();
      return;
    }
    const removeId = event.target.closest('[data-design-remove]')?.dataset
        .designRemove,
      apply = event.target.closest('[data-design-apply]');
    if (!removeId && !apply) return;
    const button = event.target.closest('button');
    button.disabled = true;
    try {
      await write(pendingImport || [], removeId);
      confirm.close();
      if (slot?.isConnected) mount(slot, pageId);
      notify(
        removeId
          ? '이 페이지의 디자인을 삭제했어요.'
          : '디자인 백업을 가져왔어요.',
      );
      pendingImport = null;
    } catch (error) {
      confirm.querySelector('.form-error').textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });
  function dataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new win.FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () =>
        reject(
          new Error('이미지를 백업 파일로 읽지 못했어요. 다시 시도해 주세요.'),
        );
      reader.readAsDataURL(blob);
    });
  }
  async function backup() {
    try {
      const entries = await read();
      if (!entries.length) {
        notify('백업할 디자인이 없어요. 페이지의 디자인을 먼저 추가해 주세요.');
        return;
      }
      const saved = [];
      for (const entry of entries)
        saved.push({ ...metadata(entry), dataUrl: await dataUrl(entry.blob) });
      download(
        JSON.stringify({ schemaVersion: 1, entries: saved }, null, 2),
        'tc-designs.json',
        'application/json;charset=utf-8',
      );
      notify('전체 페이지의 디자인 백업을 내려받습니다.');
    } catch (error) {
      notify(error.message);
    }
  }
  const importInput = doc.createElement('input');
  importInput.hidden = true;
  importInput.type = 'file';
  importInput.accept = 'application/json,.json';
  importInput.id = 'tc-design-import';
  doc.body.append(importInput);
  importInput.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      if (file.size > 60 * 1024 * 1024)
        throw new Error('디자인 백업은 60MB 이하로 선택해 주세요.');
      const value = JSON.parse(await file.text());
      if (
        value?.schemaVersion !== 1 ||
        !Array.isArray(value.entries) ||
        !value.entries.length ||
        value.entries.length > pages.length
      )
        throw new Error(
          '현재 페이지 목록에 맞는 디자인 백업 JSON을 선택해 주세요.',
        );
      const entries = [],
        ids = new Set();
      for (const item of value.entries) {
        const meta = metadata(item);
        if (ids.has(meta.pageId))
          throw new Error('같은 페이지가 중복된 디자인 백업이에요.');
        ids.add(meta.pageId);
        if (
          typeof item.dataUrl !== 'string' ||
          item.dataUrl.length > 2800000 ||
          !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(
            item.dataUrl,
          )
        )
          throw new Error('백업의 이미지 형식을 확인해 주세요.');
        const [header, body] = item.dataUrl.split(','),
          mime = header.slice(5, header.indexOf(';')),
          bytes = Uint8Array.from(win.atob(body), (c) => c.charCodeAt(0)),
          blob = new win.Blob([bytes], { type: mime });
        entries.push({ ...meta, blob, ...(await imageInfo(blob)) });
      }
      pendingImport = entries;
      confirm.innerHTML = `<h2 id="design-confirm-title">디자인 백업을 가져올까요?</h2><p>${entries.length}개 페이지의 디자인을 교체합니다. 파일에 없는 페이지와 TC 결과는 유지합니다. 현재 디자인이 필요하면 먼저 백업해 주세요.</p><p class="form-error" role="alert"></p><div class="dialog-actions"><button class="secondary-button" data-design-cancel>취소</button><button class="primary-button" data-design-apply>디자인 적용</button></div>`;
      confirm.showModal();
    } catch (error) {
      pendingImport = null;
      notify(
        error instanceof SyntaxError
          ? '디자인 백업 JSON을 읽지 못했어요. 기존 자료는 유지합니다.'
          : error.message,
      );
    } finally {
      event.target.value = '';
    }
  });
  return { mount };
};
