'use client';

import Image from 'next/image';
import { useRef } from 'react';
import { siteAssets } from '@/shared/assets/siteAssets';
import { siteNavigation } from '@/shared/navigation/siteNavigation';

export function SiteHeader() {
  const menu = useRef<HTMLDetailsElement>(null);
  return (
    <header className="site-header">
      <div className="site-container header-inner">
        <a href="#top" className="site-brand" aria-label="TripPrint 처음으로">
          <Image
            src={siteAssets.logo}
            alt="TripPrint"
            width={128}
            height={40}
            preload
          />
        </a>
        <nav className="desktop-navigation" aria-label="사이트 소개">
          {siteNavigation.map((item) => (
            <a key={item.href} href={item.href}>
              {item.label}
            </a>
          ))}
        </nav>
        <details
          ref={menu}
          className="mobile-navigation"
          onKeyDown={(event) => {
            if (event.key === 'Escape' && menu.current?.open) {
              menu.current.open = false;
              menu.current.querySelector('summary')?.focus();
            }
          }}
        >
          <summary>
            메뉴 <span aria-hidden="true">＋</span>
          </summary>
          <nav aria-label="모바일 사이트 소개">
            {siteNavigation.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => {
                  if (menu.current) menu.current.open = false;
                }}
              >
                {item.label}
              </a>
            ))}
          </nav>
        </details>
      </div>
    </header>
  );
}
