import {
  SYNC_WEB_CARD_SHADOW,
  SYNC_WEB_IMAGE_SHADOW,
  SYNC_WEB_PALETTE,
  SYNC_WEB_POSTER_BACKGROUND,
} from './sync-web-palette';
import type { PosterSpec } from './poster.types';

type SatoriElement = {
  type: string;
  props: {
    style?: Record<string, unknown>;
    children?:
      | SatoriElement
      | string
      | Array<SatoriElement | string | null | undefined>;
    src?: string;
  };
};

function scale(value: number, fontScale: number): number {
  return Math.round(value * fontScale);
}

function contentDensityScale(sectionCount: number): number {
  if (sectionCount <= 3) {
    return 1;
  }
  if (sectionCount <= 5) {
    return 0.9;
  }
  return 0.82;
}

function splitIntroAndListSections(spec: PosterSpec): {
  intro: string;
  listSections: PosterSpec['sections'];
} {
  const sections = spec.sections;
  if (sections.length === 0) {
    return {
      intro: [spec.festivalMeta, spec.topic].filter(Boolean).join(' · '),
      listSections: [],
    };
  }

  const first = sections[0];
  if (!first.body) {
    return {
      intro: first.headline,
      listSections: sections.slice(1),
    };
  }

  if (sections.length === 1) {
    return {
      intro: first.body,
      listSections: [],
    };
  }

  return {
    intro: first.body,
    listSections: sections,
  };
}

function titleBlock(spec: PosterSpec, s: number): SatoriElement {
  return {
    type: 'div',
    props: {
      style: {
        fontSize: scale(46, s),
        fontWeight: 700,
        lineHeight: 1.1,
        color: SYNC_WEB_PALETTE.inkStrong,
        marginBottom: scale(20, s),
      },
      children: spec.festivalName,
    },
  };
}

function quoteBlock(spec: PosterSpec, intro: string, s: number): SatoriElement {
  const children: Array<SatoriElement | string> = [];

  if (spec.festivalMeta) {
    children.push({
      type: 'div',
      props: {
        style: {
          display: 'flex',
          alignSelf: 'flex-start',
          marginBottom: scale(10, s),
          paddingTop: scale(4, s),
          paddingBottom: scale(4, s),
          paddingLeft: scale(10, s),
          paddingRight: scale(10, s),
          borderRadius: scale(6, s),
          backgroundColor: SYNC_WEB_PALETTE.codeBg,
          color: SYNC_WEB_PALETTE.primary,
          fontSize: scale(17, s),
          fontWeight: 600,
        },
        children: spec.festivalMeta,
      },
    });
  }

  children.push({
    type: 'div',
    props: {
      style: {
        display: 'flex',
        fontSize: scale(20, s),
        lineHeight: 1.55,
        color: SYNC_WEB_PALETTE.inkBody,
        fontStyle: 'italic',
      },
      children: intro,
    },
  });

  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        borderLeft: `${scale(4, s)}px solid ${SYNC_WEB_PALETTE.quoteBorder}`,
        paddingLeft: scale(20, s),
        marginBottom: scale(24, s),
      },
      children,
    },
  };
}

function featuredImage(spec: PosterSpec, s: number): SatoriElement | null {
  if (!spec.coverImageDataUrl) {
    return null;
  }

  const imageHeight = scale(300, s);

  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        width: '100%',
        marginBottom: scale(28, s),
        borderRadius: scale(14, s),
        overflow: 'hidden',
        boxShadow: SYNC_WEB_IMAGE_SHADOW,
      },
      children: [
        {
          type: 'img',
          props: {
            src: spec.coverImageDataUrl,
            style: {
              width: '100%',
              height: imageHeight,
              objectFit: 'cover',
            },
          },
        },
      ],
    },
  };
}

function sectionHeading(label: string, s: number): SatoriElement {
  return {
    type: 'div',
    props: {
      style: {
        fontSize: scale(24, s),
        fontWeight: 700,
        lineHeight: 1.25,
        color: SYNC_WEB_PALETTE.inkStrong,
        marginBottom: scale(14, s),
      },
      children: label,
    },
  };
}

function numberedListItem(
  index: number,
  section: PosterSpec['sections'][number],
  s: number,
): SatoriElement {
  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: scale(12, s),
        gap: scale(10, s),
      },
      children: [
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              minWidth: scale(28, s),
              fontSize: scale(19, s),
              fontWeight: 700,
              lineHeight: 1.45,
              color: SYNC_WEB_PALETTE.primary,
            },
            children: `${index}.`,
          },
        },
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
            },
            children: [
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: scale(19, s),
                    fontWeight: 700,
                    lineHeight: 1.45,
                    color: SYNC_WEB_PALETTE.inkStrong,
                  },
                  children: section.headline,
                },
              },
              ...(section.body
                ? [
                    {
                      type: 'div',
                      props: {
                        style: {
                          fontSize: scale(17, s),
                          lineHeight: 1.5,
                          color: SYNC_WEB_PALETTE.inkBody,
                          marginTop: scale(2, s),
                        },
                        children: section.body,
                      },
                    },
                  ]
                : []),
            ],
          },
        },
      ],
    },
  };
}

function genreChips(spec: PosterSpec, s: number): SatoriElement | null {
  if (spec.genres.length === 0) {
    return null;
  }

  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: scale(8, s),
        marginTop: scale(18, s),
        marginBottom: scale(4, s),
      },
      children: spec.genres.slice(0, 3).map((genre) => ({
        type: 'div',
        props: {
          style: {
            display: 'flex',
            paddingTop: scale(4, s),
            paddingBottom: scale(4, s),
            paddingLeft: scale(10, s),
            paddingRight: scale(10, s),
            borderRadius: scale(999, s),
            backgroundColor: SYNC_WEB_PALETTE.primarySoft,
            color: SYNC_WEB_PALETTE.primary,
            fontSize: scale(14, s),
            fontWeight: 600,
          },
          children: genre,
        },
      })),
    },
  };
}

function artistsLine(spec: PosterSpec, s: number): SatoriElement | null {
  if (spec.artists.length === 0) {
    return null;
  }

  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        marginTop: scale(20, s),
        paddingTop: scale(16, s),
        borderTop: `1px solid ${SYNC_WEB_PALETTE.borderSoft}`,
        fontSize: scale(16, s),
        lineHeight: 1.45,
        color: SYNC_WEB_PALETTE.inkMuted,
        fontStyle: 'italic',
      },
      children: `Headliners · ${spec.artists.join(' · ')}`,
    },
  };
}

function contentCard(spec: PosterSpec): SatoriElement {
  const density = contentDensityScale(spec.sections.length);
  const s = spec.size.fontScale * density;
  const { intro, listSections } = splitIntroAndListSections(spec);

  const bodyChildren: Array<SatoriElement | string | null> = [
    titleBlock(spec, s),
    quoteBlock(spec, intro, s),
    featuredImage(spec, s),
  ];

  if (listSections.length > 0) {
    bodyChildren.push(sectionHeading(`${spec.topic}:`, s));
    for (const [index, section] of listSections.entries()) {
      bodyChildren.push(numberedListItem(index + 1, section, s));
    }
  }

  bodyChildren.push(genreChips(spec, s));
  bodyChildren.push(artistsLine(spec, s));

  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        width: spec.size.contentWidth,
        backgroundColor: SYNC_WEB_PALETTE.card,
        borderRadius: scale(24, spec.size.fontScale),
        border: `1px solid ${SYNC_WEB_PALETTE.cardBorder}`,
        boxShadow: SYNC_WEB_CARD_SHADOW,
        paddingTop: scale(40, s),
        paddingBottom: scale(36, s),
        paddingLeft: scale(40, s),
        paddingRight: scale(40, s),
        flex: 1,
      },
      children: bodyChildren.filter(Boolean),
    },
  };
}

function footerRow(spec: PosterSpec, date: string): SatoriElement {
  const s = spec.size.fontScale;

  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: scale(20, s),
        paddingLeft: scale(8, s),
        paddingRight: scale(8, s),
        color: 'rgba(237, 237, 240, 0.72)',
        fontSize: scale(18, s),
        fontWeight: 500,
      },
      children: [
        { type: 'div', props: { children: `@${spec.brandName}` } },
        {
          type: 'div',
          props: {
            children: `${spec.tagline} · ${date}`,
          },
        },
      ],
    },
  };
}

export function buildPosterElement(
  spec: PosterSpec,
  date: string,
): SatoriElement {
  const { width, height, outerPadding } = spec.size;

  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width,
        height,
        paddingTop: outerPadding,
        paddingBottom: outerPadding,
        paddingLeft: outerPadding,
        paddingRight: outerPadding,
        backgroundImage: SYNC_WEB_POSTER_BACKGROUND,
        backgroundColor: SYNC_WEB_PALETTE.background,
        fontFamily: 'Noto Sans',
      },
      children: [
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column',
              width: spec.size.contentWidth,
              height: height - outerPadding * 2,
            },
            children: [contentCard(spec), footerRow(spec, date)],
          },
        },
      ],
    },
  };
}
