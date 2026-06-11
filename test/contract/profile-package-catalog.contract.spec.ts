import * as fs from 'fs';
import * as path from 'path';
import {
  listPackageTierDefinitions,
  type PackageTierLimits,
} from '@src/modules/profile/domain/package-tier.config';
import type { PackageTierId } from '@src/modules/profile/domain/package-tier-id.type';

const FRONTEND_ROOT = path.resolve(__dirname, '../../../sync-app');
const MOCK_DATA_PATH = path.join(
  FRONTEND_ROOT,
  'src/components/profile/profilePackageData.ts',
);

type MockTierLimits = PackageTierLimits;

function parseMockTierLimits(
  content: string,
  tierId: PackageTierId,
): MockTierLimits {
  const tierBlock = content.match(
    new RegExp(
      `id:\\s*'${tierId}'[\\s\\S]*?limits:\\s*\\{([\\s\\S]*?)\\},\\s*features:`,
    ),
  );
  if (!tierBlock) {
    throw new Error(`Could not parse MOCK tier limits for ${tierId}`);
  }
  const block = tierBlock[1];
  const contactUnlockCount = block.includes('contactUnlockCount: null')
    ? null
    : Number(block.match(/contactUnlockCount:\s*(\d+)/)?.[1]);
  const mapDays = Number(block.match(/mapDays:\s*(\d+)/)?.[1]);
  const postPinCount = Number(block.match(/postPinCount:\s*(\d+)/)?.[1]);
  const basicExposure = /basicExposure:\s*true/.test(block);

  return {
    contactUnlockCount,
    mapDays,
    postPinCount,
    basicExposure,
  };
}

describe('profile package catalog parity (requires sync-app sibling checkout)', () => {
  const hasFrontend = fs.existsSync(path.join(FRONTEND_ROOT, 'package.json'));
  const backendTiers = listPackageTierDefinitions();

  (hasFrontend ? it : it.skip)(
    'MOCK_PACKAGE_CATALOG tier limits match backend PROFILE_PACKAGE_TIERS',
    () => {
      const content = fs.readFileSync(MOCK_DATA_PATH, 'utf8');

      for (const backendTier of backendTiers) {
        const mockLimits = parseMockTierLimits(content, backendTier.id);
        expect(mockLimits).toEqual(backendTier.limits);
        expect(backendTier.priceYuan).toBeGreaterThan(0);
      }
    },
  );

  it('backend catalog has pro / pro_plus / ultra only', () => {
    expect(backendTiers.map((tier) => tier.id).sort()).toEqual(
      ['pro', 'pro_plus', 'ultra'].sort(),
    );
  });
});
