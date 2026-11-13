import Image from 'next/image';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { SiteFooter } from '@/components/layout/SiteFooter';
import {
  MotionControl,
  MotionSurface,
} from '@/components/motion/MotionSurface';
import { ActionLink } from '@/components/ui/ActionLink';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { siteAssets } from '@/shared/assets/siteAssets';
import { JourneyChapters } from './JourneyChapters';
import './landing.css';

export function LandingPage() {
  return (
    <MotionSurface>
      <a className="skip-link" href="#main">
        본문으로 건너뛰기
      </a>
      <SiteHeader />
      <main id="main" tabIndex={-1}>
        <section
          className="hero site-container"
          id="top"
          tabIndex={-1}
          data-scene
        >
          <div className="hero-copy">
            <p className="eyebrow hero-enter">EVERY TRIP TELLS A STORY</p>
            <h1 className="hero-enter">
              떠나는 순간부터,
              <br />
              다시 꺼내 볼<br />
              <span>이야기까지.</span>
            </h1>
            <p className="hero-description hero-enter">
              여행을 기다리는 설렘도, 간직하고 싶은 순간도.
              <br className="wide-break" /> 나만의 이야기로 이어지는 여행,
              TripPrint.
            </p>
            <div className="hero-enter">
              <ActionLink href="#journey">여행 이야기 살펴보기</ActionLink>
            </div>
            <div className="hero-caption">
              <span className="small-orbit" aria-hidden="true" />
              <span>가고 · 머물고 · 기록하다</span>
            </div>
          </div>
          <div
            className="travel-collage"
            aria-label="도시 사진을 펼친 여행 노트"
          >
            <div className="collage-orbit" aria-hidden="true" />
            <figure className="travel-photo photo-back">
              <Image
                src={siteAssets.osaka}
                alt="오사카성의 봄 풍경"
                sizes="(max-width: 767px) 50vw, 260px"
                placeholder="blur"
              />
              <figcaption>다음에 걷고 싶은 길</figcaption>
            </figure>
            <figure className="travel-photo photo-main">
              <Image
                src={siteAssets.danang}
                alt="다낭의 강과 용다리 풍경"
                sizes="(max-width: 767px) 65vw, 360px"
                placeholder="blur"
                preload
              />
              <figcaption>
                <span>DA NANG, VIETNAM</span>
                <span>조금 더 머물고 싶은 순간.</span>
              </figcaption>
            </figure>
            <div className="travel-stamp" aria-hidden="true">
              TAKE A TRIP
              <br />
              <span>KEEP A STORY</span>
            </div>
            <div className="memory-slip">
              <span className="eyebrow">NOTE TO SELF</span>
              <p>
                좋았던 순간은
                <br />
                작게라도 남겨 두기.
              </p>
              <span className="slip-line" aria-hidden="true" />
            </div>
            <svg
              className="travel-route"
              viewBox="0 0 500 160"
              fill="none"
              aria-hidden="true"
            >
              <path d="M10 120C100 10 160 160 270 70S390 20 480 65" />
              <circle cx="10" cy="120" r="6" />
              <circle cx="480" cy="65" r="6" />
            </svg>
          </div>
          <div className="hero-bottom">
            <span>나의 여행을, 나의 방식으로.</span>
            <MotionControl />
            <a href="#journey" className="scroll-link">
              아래로 둘러보기 <span aria-hidden="true">↓</span>
            </a>
          </div>
        </section>
        <section
          className="journey-section"
          id="journey"
          tabIndex={-1}
          data-scene
          data-reveal
        >
          <div className="site-container">
            <div className="section-intro">
              <SectionHeading
                eyebrow="01 — BEFORE, DURING & AFTER"
                description="준비하는 날부터 다시 추억하는 날까지. 여행의 세 장면을 펼쳐 보세요."
              >
                여행은, 떠나기 전부터
                <br />
                돌아온 뒤까지.
              </SectionHeading>
              <span className="section-index" aria-hidden="true">
                01—03
              </span>
            </div>
            <JourneyChapters />
          </div>
        </section>
        <section
          className="records-section site-container"
          id="records"
          tabIndex={-1}
          data-scene
          data-reveal
        >
          <div className="record-visual">
            <div className="journal-sheet">
              <p className="eyebrow">MY TRAVEL JOURNAL</p>
              <figure>
                <Image
                  src={siteAssets.tokyo}
                  alt="도쿄 신주쿠의 도시 풍경"
                  sizes="(max-width: 767px) 70vw, 360px"
                  placeholder="blur"
                />
                <figcaption>그날, 내가 머문 도시.</figcaption>
              </figure>
              <div className="journal-lines" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
            </div>
            <div className="receipt-slip">
              <span className="eyebrow">A LITTLE MEMORY</span>
              <p>
                좋아했던 한 끼<br />
                기억하고 싶은 한 곳
              </p>
              <div className="receipt-rule" />
              <span>
                한 장의 영수증에서,
                <br />
                그날의 이야기로.
              </span>
            </div>
            <span className="example-label">여행 기록의 예시</span>
          </div>
          <div className="records-copy">
            <SectionHeading
              eyebrow="02 — MOMENTS INTO MEMORIES"
              description="사진 속 풍경에 장소를 더하고, 영수증의 음식과 구매 내역을 실제 방문에 연결하는 기록을 생각해요. 계획한 일정과 다녀온 기록은 각각 남겨요."
            >
              사진 한 장 너머의
              <br />
              이야기도 함께.
            </SectionHeading>
            <ul className="record-points">
              <li>
                <span>01</span>
                <div>
                  <h3>어디에 머물렀는지</h3>
                  <p>가고 싶던 곳과 실제로 다녀온 곳을 구분해서.</p>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <h3>무엇을 좋아했는지</h3>
                  <p>맛있었던 음식과 작지만 반가웠던 발견까지.</p>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <h3>무엇을 나누고 싶은지</h3>
                  <p>개인적인 기록은 간직하고, 나누고 싶은 이야기만.</p>
                </div>
              </li>
            </ul>
          </div>
        </section>
        <section className="closing-section" data-scene data-reveal>
          <div className="site-container">
            <p className="eyebrow">
              LEAVE WITH CURIOSITY. RETURN WITH STORIES.
            </p>
            <h2>
              다음 여행엔,
              <br />
              어떤 이야기를 남길까요?
            </h2>
            <p>마음이 먼저 떠난 그곳에서부터.</p>
            <ActionLink href="#top" quiet>
              처음부터 둘러보기
            </ActionLink>
            <div className="closing-route" aria-hidden="true">
              <span /> · · · · · · · · · · · · · · · · <span />
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </MotionSurface>
  );
}
