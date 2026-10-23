import { spawn } from 'node:child_process';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { cpus, totalmem } from 'node:os';
import { chromium } from '@playwright/test';

// 측정은 일반 웹 릴리스 빌드와 실제 공개 API를 읽어 저장한 응답을 사용한다.
const discovery = JSON.parse(
  await readFile('.release/discovery-live.json', 'utf8'),
);
// 공개 피드는 실제 서버에서 읽되 로컬 출처 정책과 UI 처리 시간 측정을 분리한다.
const community = await fetch(
  'https://tripprint-api-staging.gametps.workers.dev/public/community?offset=0',
).then((response) => {
  // 원격 오류를 정상적인 빈 게시물로 바꾸지 않는다.
  return response.ok
    ? response.json()
    : Promise.reject(new Error('공개 피드 원본 조회 실패'));
});
const output = 'outputs/performance/20261012';
const server = spawn(process.execPath, ['scripts/qa/preview-trail.mjs'], {
  windowsHide: true,
  stdio: 'ignore',
});
let browser;

// 다른 작업이 제공하는 서버를 측정 대상으로 재사용하지 않는다.
async function ready(remaining = 60) {
  // 자체 정적 서버 시작 실패는 측정 실패로 처리한다.
  return fetch('http://127.0.0.1:8788/community')
    .then((response) => {
      // HTTP 오류를 정상 준비로 판정하지 않는다.
      return response.ok
        ? undefined
        : Promise.reject(new Error('정적 서버 준비 실패'));
    })
    .catch((error) => {
      // 짧고 제한된 재시도만 수행한다.
      return remaining
        ? new Promise((resolve) => {
            // 서버의 로컬 시작만 기다린다.
            return setTimeout(resolve, 100);
          }).then(() => {
            // 사용자나 원격 DB에 쓰기 요청을 보내지 않는다.
            return ready(remaining - 1);
          })
        : Promise.reject(error);
    });
}

// 브라우저 표준 관측 API로 로딩과 긴 작업을 기록한다.
function instrument() {
  // 측정 상태는 브라우저 메모리에만 보관한다.
  window.tripprintPerf = {
    lcp: 0,
    shifts: 0,
    longTasks: [],
    events: [],
    frames: [],
    lastFrame: 0,
    sampling: false,
  };
  // 지원되는 관측 항목만 등록한다.
  for (const type of [
    'largest-contentful-paint',
    'layout-shift',
    'longtask',
    'event',
  ]) {
    // 다른 측정 항목이 실패해도 가능한 측정은 유지한다.
    if (PerformanceObserver.supportedEntryTypes.includes(type))
      new PerformanceObserver((list) => {
        // 원문·입력 값 없이 성능 숫자만 수집한다.
        for (const entry of list.getEntries()) {
          if (type === 'largest-contentful-paint')
            window.tripprintPerf.lcp = entry.startTime;
          if (type === 'layout-shift' && !entry.hadRecentInput)
            window.tripprintPerf.shifts += entry.value;
          if (type === 'longtask')
            window.tripprintPerf.longTasks.push({
              start: entry.startTime,
              duration: entry.duration,
            });
          if (type === 'event' && entry.interactionId)
            window.tripprintPerf.events.push(entry.duration);
        }
      }).observe({
        type,
        buffered: true,
        ...(type === 'event' ? { durationThreshold: 16 } : {}),
      });
  }
  // 프레임 간격은 자동 전환 관찰 구간에만 저장한다.
  function frame(time) {
    // 관찰을 끄면 프레임 루프도 종료한다.
    if (!window.tripprintPerf.sampling) return;
    if (window.tripprintPerf.lastFrame)
      window.tripprintPerf.frames.push(time - window.tripprintPerf.lastFrame);
    window.tripprintPerf.lastFrame = time;
    requestAnimationFrame(frame);
  }
  // 관찰 시작은 첫 화면 로딩과 분리한다.
  window.tripprintStartFrames = () => {
    // 자동 전환이 실제로 보이는 구간만 측정한다.
    window.tripprintPerf.sampling = true;
    requestAnimationFrame(frame);
  };
}

// 분위수는 정렬한 실제 표본에서 계산한다.
function percentile(values, fraction) {
  // 없는 표본을 성능 0으로 바꾸지 않는다.
  return values.length
    ? [...values].sort((a, b) => {
        // 시간 표본을 숫자 오름차순으로 정렬한다.
        return a - b;
      })[Math.max(0, Math.ceil(values.length * fraction) - 1)]
    : null;
}

// 각 실행은 새 브라우저 문맥과 비어 있는 HTTP 캐시를 사용한다.
async function sample(profile, index) {
  // 계정과 기기 여행 데이터가 없는 공개 화면만 측정한다.
  const context = await browser.newContext({
    viewport: { width: 430, height: 932 },
    reducedMotion: 'no-preference',
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  const errors = [];
  let discoveryRequests = 0;
  let communityRequests = 0;
  await context.addInitScript(instrument);
  await page.route('**/public/discovery', (route) => {
    // 배포 전 응답 재현이며 원격 공개 API 지연 측정으로 보고하지 않는다.
    return (
      (discoveryRequests += 1),
      route.fulfill({ json: { data: discovery } })
    );
  });
  await page.route('**/public/community*', (route) => {
    // 읽어 온 실제 공개 피드만 같은 계약으로 재현한다.
    return ((communityRequests += 1), route.fulfill({ json: community }));
  });
  page.on('pageerror', (error) => {
    // 브라우저 실행 오류를 성공 결과에 숨기지 않는다.
    return errors.push(error.message);
  });
  await cdp.send('Network.enable');
  await cdp.send('Performance.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: profile.cpu });
  if (profile.network)
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 150,
      downloadThroughput: 1600000 / 8,
      uploadThroughput: 750000 / 8,
    });
  await page.goto('http://127.0.0.1:8788/community', {
    waitUntil: 'load',
    timeout: 120000,
  });
  await page
    .getByRole('button', { name: '홈 탭', exact: true })
    .waitFor({ timeout: 60000 });
  const entry = await page.evaluate(() => {
    // 공개 커뮤니티 진입의 로딩 지표이며 홈의 LCP로 이름 붙이지 않는다.
    return {
      navigationMs: performance.getEntriesByType('navigation')[0].loadEventEnd,
      fcpMs:
        performance.getEntriesByName('first-contentful-paint')[0]?.startTime ??
        null,
      lcpMs: window.tripprintPerf.lcp || null,
      layoutShiftSum: window.tripprintPerf.shifts,
    };
  });
  const homeStart = performance.now();
  await page.getByRole('button', { name: '홈 탭', exact: true }).click();
  await page
    .getByTestId('destination-carousel-position')
    .waitFor({ timeout: 60000 });
  const homeReadyMs = performance.now() - homeStart;
  await page.waitForFunction(
    () => {
      // 초기 이미지 다운로드가 자동 전환 프레임 표본에 섞이지 않게 한다.
      return [...document.images]
        .filter((image) => {
          // 실제 도시 사진 호스트의 이미지 로딩만 기다린다.
          return image.src.includes('wikimedia.org');
        })
        .every((image) => {
          // 완료되지 않은 다운로드를 준비된 사진으로 처리하지 않는다.
          return image.complete;
        });
    },
    undefined,
    { timeout: 60000 },
  );
  const homePhotosReadyMs = performance.now() - homeStart;
  if (community.data.length === 0)
    await page
      .getByText(
        '아직 공개된 여행이 없어요. 여행을 마친 뒤 나의 일정을 공유할 수 있어요.',
        { exact: true },
      )
      .waitFor();
  if (index === 1)
    await page.screenshot({ path: `${output}/${profile.name}-home.png` });
  await page.mouse.move(0, 0);
  await cdp.send('HeapProfiler.collectGarbage');
  const memoryBefore = await cdp.send('Performance.getMetrics').catch(() => {
    // 측정 API 실패를 실제 0바이트로 해석하지 않는다.
    return { metrics: [] };
  });
  await page.evaluate(() => {
    // 추천 자동 순환 구간의 프레임 간격을 수집한다.
    return window.tripprintStartFrames();
  });
  const observed = [];
  for (let step = 0; step < 30; step += 1) {
    // 실제 시간으로 15초 동안 전환 여부를 관찰한다.
    await page.waitForTimeout(500);
    observed.push(
      await page.getByTestId('destination-carousel-position').textContent(),
    );
  }
  const frames = await page.evaluate(() => {
    // 프레임 루프가 다음 검증 단계에 남지 않게 끝낸다.
    return (
      (window.tripprintPerf.sampling = false),
      window.tripprintPerf.frames
    );
  });
  await page
    .getByRole('button', { name: '여행지 자동 넘김 일시정지', exact: true })
    .click();
  for (let step = 0; step < 12; step += 1) {
    // 같은 세 장을 반복 탐색할 때 요소·메모리가 계속 쌓이는지 확인한다.
    await page
      .getByRole('button', { name: '다음 추천 여행지', exact: true })
      .click();
    await page.waitForTimeout(250);
  }
  await page
    .getByRole('button', { name: /여행지 살펴보기$/, exact: false })
    .click();
  await page
    .getByRole('link', { name: '소개 원문 · 위키백과 기여자', exact: true })
    .waitFor();
  await page
    .getByRole('button', { name: '여행지 상세 닫기', exact: true })
    .click();
  await cdp.send('HeapProfiler.collectGarbage');
  const memoryAfter = await cdp.send('Performance.getMetrics');
  const metrics = await page.evaluate(() => {
    // 사용자 내용 대신 작업 시간과 공개 자산 크기만 반환한다.
    return {
      longTasks: window.tripprintPerf.longTasks,
      eventDurations: window.tripprintPerf.events,
      resources: performance
        .getEntriesByType('resource')
        .filter((resource) => {
          // 크기 확인이 허용되는 같은 출처의 정적 자산만 집계한다.
          return resource.name.startsWith(location.origin);
        })
        .map((resource) => {
          // 공개 자산의 경로·크기·다운로드 시간만 남긴다.
          return {
            path: new URL(resource.name).pathname,
            bytes: resource.encodedBodySize,
            durationMs: resource.duration,
          };
        }),
      documentElements: document.getElementsByTagName('*').length,
    };
  });
  const result = {
    profile: profile.name,
    run: index,
    entry,
    homeReadyMs,
    homePhotosReadyMs,
    frameSamples: frames.length,
    frameIntervalP95Ms: percentile(frames, 0.95),
    frameOver50Ms: frames.filter((duration) => {
      // 관찰 구간의 큰 프레임 간격만 센다.
      return duration > 50;
    }).length,
    observedPositions: [...new Set(observed)],
    interactionDurationP95Ms: percentile(metrics.eventDurations, 0.95),
    longTaskCount: metrics.longTasks.length,
    longTaskMaxMs: percentile(
      metrics.longTasks.map((task) => {
        // 관찰된 작업 시간으로 최대 긴 작업을 계산한다.
        return task.duration;
      }),
      1,
    ),
    longTaskOver50TotalMs: metrics.longTasks.reduce((total, task) => {
      // 전체 관찰 구간에서 50ms를 초과한 부분만 더한다.
      return total + Math.max(0, task.duration - 50);
    }, 0),
    discoveryRequests,
    communityRequests,
    memoryBefore: memoryBefore.metrics,
    memoryAfter: memoryAfter.metrics,
    errors,
    ...metrics,
  };
  await context.close();
  await writeFile(
    `${output}/${profile.name}-${index}.json`,
    JSON.stringify(result, null, 2),
  );
  if (
    observed.every((position) => {
      // 실제 화면의 위치가 바뀌지 않았다면 자동 전환 실패다.
      return position === observed[0];
    }) ||
    discoveryRequests !== 1 ||
    errors.length
  )
    throw new Error(`전환/조회/실행 오류: ${profile.name} ${index}`);
  console.log(
    JSON.stringify({
      profile: profile.name,
      run: index,
      homeReadyMs: Math.round(homeReadyMs),
      frameIntervalP95Ms: result.frameIntervalP95Ms,
      entryFcpMs: entry.fcpMs,
    }),
  );
  return result;
}

// 성능 검사 실패도 자료를 보존하고 브라우저와 자체 서버를 닫는다.
try {
  await ready();
  await mkdir(output, { recursive: true });
  await writeFile(
    `${output}/public-community-capture.json`,
    JSON.stringify(
      { capturedAt: new Date().toISOString(), body: community },
      null,
      2,
    ),
  );
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const results = [];
  for (const profile of [
    { name: 'desktop', cpu: 1, network: false },
    { name: 'mobile-emulation', cpu: 4, network: true },
  ]) {
    // 각 조건 세 번의 개별 결과를 남겨 평균 하나로 변동을 숨기지 않는다.
    for (let index = 1; index <= 3; index += 1)
      results.push(await sample(profile, index));
  }
  await writeFile(
    `${output}/results.json`,
    JSON.stringify(
      {
        measuredAt: new Date().toISOString(),
        browser: browser.version(),
        cpu: cpus()[0]?.model,
        memoryGb: totalmem() / 1024 ** 3,
        discoveryCapturedAt: discovery.fetchedAt,
        method:
          'Local exported web, fresh Chrome contexts, actual public discovery and community responses replayed, live image requests, 15-second autoplay; mobile emulation: 4x CPU, 150ms RTT, 1.6Mbps down/750Kbps up. Entry metrics describe community navigation, homeReadyMs describes SPA home text/card transition excluding public API latency. homePhotosReadyMs includes completion of all three recommended city images. Interaction duration is a lab sample, not field INP. Long-task excess covers the whole observed session and is not Lighthouse TBT. Static localhost serves uncompressed assets, not production CDN compression. Native Android, production cache and concurrency capacity are not measured.',
        results,
      },
      null,
      2,
    ),
  );
} finally {
  // 측정이 만든 자원만 정리한다.
  await browser?.close();
  server.kill();
}
