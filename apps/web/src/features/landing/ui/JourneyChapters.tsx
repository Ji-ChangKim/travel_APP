'use client';

import Image from 'next/image';
import { useState } from 'react';
import { siteAssets } from '@/shared/assets/siteAssets';
import { journeyChapters } from '../model/journeyChapters';

export function JourneyChapters() {
  const [selected, setSelected] = useState(0);
  const chapter = journeyChapters[selected] ?? journeyChapters[0];
  return (
    <div className="chapter-workspace">
      <div className="chapter-buttons" role="group" aria-label="여행의 세 장면">
        {journeyChapters.map((item, index) => (
          <button
            type="button"
            key={item.id}
            aria-pressed={index === selected}
            aria-controls="chapter-description"
            onClick={() => setSelected(index)}
          >
            <span>{item.number}</span>
            {item.label}
            <span aria-hidden="true">↗</span>
          </button>
        ))}
      </div>
      <div
        className="chapter-content"
        id="chapter-description"
        aria-live="polite"
      >
        <div className="chapter-copy" key={chapter.id}>
          <p className="eyebrow">{chapter.number} / YOUR JOURNEY</p>
          <h3>{chapter.title}</h3>
          <p>{chapter.description}</p>
          <p className="chapter-note">{chapter.note}</p>
        </div>
        <figure className="chapter-photo">
          <Image
            src={siteAssets[chapter.image]}
            alt={chapter.location}
            sizes="(max-width: 767px) 90vw, 42vw"
            placeholder="blur"
          />
          <figcaption>
            <span>{chapter.location}</span>
            {chapter.caption}
          </figcaption>
        </figure>
      </div>
      <div className="static-chapters">
        {journeyChapters.slice(1).map((item) => (
          <section className="chapter-copy chapter-static" key={item.id}>
            <p className="eyebrow">
              {item.number} — {item.label}
            </p>
            <h3>{item.title}</h3>
            <p>{item.description}</p>
            <p className="chapter-note">{item.note}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
