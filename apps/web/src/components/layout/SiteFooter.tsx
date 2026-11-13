import Image from 'next/image';
import { siteAssets, photoCredits } from '@/shared/assets/siteAssets';
import { siteNavigation } from '@/shared/navigation/siteNavigation';

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-container">
        <div className="footer-top">
          <a href="#top" aria-label="TripPrint 처음으로">
            <Image
              src={siteAssets.logo}
              alt="TripPrint"
              width={160}
              height={50}
            />
          </a>
          <p>
            여행은 지나가도,
            <br />
            이야기는 남으니까.
          </p>
          <nav aria-label="하단 소개">
            {siteNavigation.map((item) => (
              <a key={item.href} href={item.href}>
                {item.label}
              </a>
            ))}
            <a href="#top">맨 위로</a>
          </nav>
        </div>
        <div className="footer-bottom">
          <p>TripPrint · 여행을 나만의 이야기로</p>
          <details className="photo-credits" id="credits">
            <summary>사진 출처 보기</summary>
            <ul>
              {photoCredits.map((credit) => (
                <li key={credit.file}>
                  <a href={credit.sourceUrl} target="_blank" rel="noreferrer">
                    {credit.author} · {credit.file}
                  </a>{' '}
                  —{' '}
                  <a href={credit.licenseUrl} target="_blank" rel="noreferrer">
                    {credit.license}
                  </a>
                  <p>{credit.changes}</p>
                </li>
              ))}
            </ul>
          </details>
        </div>
      </div>
    </footer>
  );
}
