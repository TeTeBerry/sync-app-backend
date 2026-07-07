import { SYNC_WEB_POSTER_BACKGROUND } from './sync-web-palette';
import { emojiImage } from './poster-emoji.loader';
import { scaleLayout, TRAVEL_GUIDE_LAYOUT } from './travel-guide-poster.layout';
import {
  POSTER_EDITORIAL_COLORS,
  POSTER_FONT_BODY,
  POSTER_FONT_DISPLAY,
} from './travel-guide-poster.typography';
import type { TravelGuidePosterSpec } from './travel-guide-poster.types';

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

const colors = POSTER_EDITORIAL_COLORS;
const FONT_BODY = POSTER_FONT_BODY;
const FONT_DISPLAY = POSTER_FONT_DISPLAY;
const layout = TRAVEL_GUIDE_LAYOUT;

function centered(
  children: SatoriElement | string,
  style: Record<string, unknown> = {},
): SatoriElement {
  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        width: '100%',
        justifyContent: 'center',
        textAlign: 'center',
        ...style,
      },
      children,
    },
  };
}

function titleRow(spec: TravelGuidePosterSpec, s: number): SatoriElement {
  const titleChildren: Array<SatoriElement | string> = [
    {
      type: 'span',
      props: {
        style: {
          fontFamily: FONT_DISPLAY,
          fontSize: scaleLayout(layout.title, s),
          fontWeight: 700,
          lineHeight: 1.12,
          color: colors.inkStrong,
        },
        children: spec.title,
      },
    },
  ];

  if (spec.titleFlag) {
    titleChildren.push(
      emojiImage(spec.titleFlag, scaleLayout(layout.titleFlag, s), {
        marginLeft: scaleLayout(10, s),
      }),
    );
  }

  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        maxWidth: '96%',
      },
      children: titleChildren,
    },
  };
}

function emojiPrefixedLine(
  emoji: string,
  text: string,
  s: number,
  style: Record<string, unknown> = {},
): SatoriElement {
  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        maxWidth: '94%',
        ...style,
      },
      children: [
        emojiImage(emoji, scaleLayout(layout.metaIcon, s), {
          marginRight: scaleLayout(10, s),
        }),
        {
          type: 'span',
          props: {
            style: {
              fontFamily: FONT_BODY,
              fontSize: scaleLayout(layout.meta, s),
              fontWeight: 400,
              lineHeight: 1.4,
              color: colors.inkBody,
            },
            children: text,
          },
        },
      ],
    },
  };
}

function taglineRow(spec: TravelGuidePosterSpec, s: number): SatoriElement {
  const children: Array<SatoriElement | string> = [
    {
      type: 'span',
      props: {
        style: {
          fontFamily: FONT_BODY,
          fontSize: scaleLayout(layout.tagline, s),
          fontWeight: 400,
          lineHeight: 1.45,
          color: colors.inkMuted,
        },
        children: spec.tagline,
      },
    },
  ];

  if (spec.taglineIcon) {
    children.push(
      emojiImage(spec.taglineIcon, scaleLayout(layout.taglineIcon, s), {
        marginLeft: scaleLayout(8, s),
      }),
    );
  }

  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        maxWidth: '92%',
      },
      children,
    },
  };
}

function starDivider(
  s: number,
  marginY: number = layout.dividerMargin,
): SatoriElement {
  const diamond = scaleLayout(10, s);
  const gap = scaleLayout(14, s);

  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        width: layout.dividerWidth,
        marginTop: scaleLayout(marginY, s),
        marginBottom: scaleLayout(marginY, s),
      },
      children: [
        {
          type: 'div',
          props: {
            style: {
              flex: 1,
              height: 1,
              backgroundColor: colors.accentSoft,
            },
          },
        },
        {
          type: 'div',
          props: {
            style: {
              width: diamond,
              height: diamond,
              backgroundColor: colors.accent,
              transform: 'rotate(45deg)',
              marginLeft: gap,
              marginRight: gap,
              flexShrink: 0,
            },
          },
        },
        {
          type: 'div',
          props: {
            style: {
              flex: 1,
              height: 1,
              backgroundColor: colors.accentSoft,
            },
          },
        },
      ],
    },
  };
}

function guideItem(
  item: TravelGuidePosterSpec['guideItems'][number],
  s: number,
): SatoriElement {
  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '100%',
        marginBottom: scaleLayout(layout.guideSectionGap, s),
      },
      children: [
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: scaleLayout(10, s),
            },
            children: [
              emojiImage(item.icon, scaleLayout(layout.guideIcon, s), {
                marginRight: scaleLayout(12, s),
              }),
              {
                type: 'span',
                props: {
                  style: {
                    fontFamily: FONT_DISPLAY,
                    fontSize: scaleLayout(layout.guideLabel, s),
                    fontWeight: 700,
                    letterSpacing: scaleLayout(1.5, s),
                    textTransform: 'uppercase',
                    color: colors.inkStrong,
                  },
                  children: item.label,
                },
              },
            ],
          },
        },
        centered(item.subtitle, {
          fontFamily: FONT_BODY,
          fontSize: scaleLayout(layout.guideSubtitle, s),
          fontWeight: 400,
          lineHeight: 1.45,
          color: colors.inkBody,
          maxWidth: '92%',
        }),
      ],
    },
  };
}

function contentCard(spec: TravelGuidePosterSpec): SatoriElement {
  const s = spec.size.fontScale;
  const pad = scaleLayout(spec.size.cardPadding, s);
  const children: Array<SatoriElement | null> = [];

  children.push(
    titleRow(spec, s),
    starDivider(s),
    centered(spec.sectionTitle, {
      fontFamily: FONT_BODY,
      fontSize: scaleLayout(layout.sectionTitle, s),
      fontWeight: 400,
      color: colors.inkStrong,
    }),
    starDivider(s),
  );

  if (spec.locationLine) {
    children.push(
      emojiPrefixedLine('📍', spec.locationLine, s, {
        marginBottom: scaleLayout(8, s),
      }),
    );
  }

  if (spec.dateLine) {
    children.push(
      emojiPrefixedLine('📅', spec.dateLine, s, {
        marginBottom: scaleLayout(4, s),
      }),
    );
  }

  children.push(starDivider(s, layout.dividerMargin + 2));

  for (const item of spec.guideItems) {
    children.push(guideItem(item, s), starDivider(s));
  }

  children.push(
    centered(spec.follow, {
      fontFamily: FONT_DISPLAY,
      fontSize: scaleLayout(layout.follow, s),
      fontWeight: 700,
      letterSpacing: scaleLayout(3.5, s),
      textTransform: 'uppercase',
      color: colors.accent,
      marginTop: scaleLayout(6, s),
      marginBottom: scaleLayout(14, s),
    }),
    taglineRow(spec, s),
  );

  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '100%',
        backgroundColor: colors.card,
        borderRadius: scaleLayout(layout.cardRadius, s),
        border: `1px solid ${colors.cardBorder}`,
        boxShadow: '0 24px 64px rgba(18, 12, 40, 0.2)',
        paddingTop: pad,
        paddingBottom: pad,
        paddingLeft: pad,
        paddingRight: pad,
      },
      children: children.filter(Boolean),
    },
  };
}

export function buildTravelGuidePosterElement(
  spec: TravelGuidePosterSpec,
): SatoriElement {
  const { width, height, outerPadding } = spec.size;
  const backgroundStyle = spec.backgroundImageDataUrl
    ? {
        backgroundImage: `url(${spec.backgroundImageDataUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : {
        backgroundImage: SYNC_WEB_POSTER_BACKGROUND,
        backgroundColor: '#6e66e8',
      };

  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width,
        height,
        paddingTop: outerPadding,
        paddingBottom: outerPadding,
        paddingLeft: outerPadding,
        paddingRight: outerPadding,
        ...backgroundStyle,
        fontFamily: FONT_BODY,
      },
      children: [
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              maxWidth: spec.size.contentWidth,
            },
            children: [contentCard(spec)],
          },
        },
      ],
    },
  };
}
