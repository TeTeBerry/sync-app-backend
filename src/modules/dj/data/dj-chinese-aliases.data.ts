/** Canonical Discogs-style artist name → common Chinese fan nicknames. */
export type DjChineseAliasEntry = {
  canonicalName: string;
  aliases: string[];
};

export const DJ_CHINESE_ALIASES: DjChineseAliasEntry[] = [
  { canonicalName: 'Martin Garrix', aliases: ['小马丁'] },
  { canonicalName: 'Hardwell', aliases: ['硬好'] },
  { canonicalName: 'Armin van Buuren', aliases: ['小明'] },
  { canonicalName: 'Tiësto', aliases: ['铁丝桶', '老铁'] },
  { canonicalName: 'David Guetta', aliases: ['塔叔'] },
  { canonicalName: 'Avicii', aliases: ['A神', '鸽子王'] },
  { canonicalName: 'Steve Aoki', aliases: ['潮爷', '卖蛋糕的'] },
  { canonicalName: 'Calvin Harris', aliases: ['高富帅'] },
  { canonicalName: 'Zedd', aliases: ['萌猴'] },
  { canonicalName: 'DJ Snake', aliases: ['蛇爷', '蛇叔'] },
  { canonicalName: 'Afrojack', aliases: ['全球最高DJ'] },
  { canonicalName: 'Nicky Romero', aliases: ['长脸'] },
  { canonicalName: 'R3HAB', aliases: ['阿三', '三哥'] },
  { canonicalName: 'KSHMR', aliases: ['K神', '克什米尔'] },
  { canonicalName: 'Excision', aliases: ['E神', '切割', '老切'] },
  { canonicalName: 'Rezz', aliases: ['眼镜妹'] },
  {
    canonicalName: 'Dimitri Vegas & Like Mike',
    aliases: ['IPAD兄弟', '比利时兄弟'],
  },
  { canonicalName: 'W&W', aliases: ['王炸'] },
  { canonicalName: 'Don Diablo', aliases: ['大菠萝'] },
  { canonicalName: 'Alan Walker', aliases: ['教主', '走路哥'] },
  { canonicalName: 'Skrillex', aliases: ['大神'] },
  { canonicalName: 'Oliver Heldens', aliases: ['呆驴'] },
  { canonicalName: 'Deorro', aliases: ['熊猫'] },
  { canonicalName: 'Carta', aliases: ['旺仔'] },
  { canonicalName: 'Marshmello', aliases: ['棉花糖', '老棉'] },
  { canonicalName: 'The Chainsmokers', aliases: ['烟鬼', '烟卷'] },
  { canonicalName: 'Yellow Claw', aliases: ['黄爪'] },
  { canonicalName: 'Carl Cox', aliases: ['黑猪'] },
];
