import type { TravelPlanNodeRecord } from './types';

export type TravelPlanMemberBalance = {
  userId: string;
  balance: number;
};

export type TravelPlanTransferSuggestion = {
  fromUserId: string;
  toUserId: string;
  amount: number;
};

export type TravelPlanSettlementResult = {
  balances: TravelPlanMemberBalance[];
  transfers: TravelPlanTransferSuggestion[];
  splitTotal: number;
  participantCount: number;
};

function roundAmount(value: number): number {
  return Math.round(value);
}

function resolveSplitParticipants(
  node: TravelPlanNodeRecord,
  fallbackMemberIds?: string[],
): string[] {
  if (node.splitAmong?.length) {
    return node.splitAmong;
  }
  if (
    fallbackMemberIds &&
    fallbackMemberIds.length >= 2 &&
    node.splitCount &&
    node.splitCount > 0
  ) {
    return fallbackMemberIds.slice(0, node.splitCount);
  }
  return [];
}

function resolvePayer(node: TravelPlanNodeRecord): string | undefined {
  return node.paidBy?.trim() || node.createdBy?.trim() || undefined;
}

export function computeTravelPlanSettlement(input: {
  nodes: TravelPlanNodeRecord[];
  memberIds?: string[];
}): TravelPlanSettlementResult {
  const balances = new Map<string, number>();
  let splitTotal = 0;
  const participantSet = new Set<string>();

  for (const node of input.nodes) {
    if (!node.splitEnabled || node.price == null || node.price <= 0) {
      continue;
    }

    const participants = resolveSplitParticipants(node, input.memberIds);
    if (participants.length < 2) {
      continue;
    }

    const payer = resolvePayer(node);
    if (!payer) {
      continue;
    }

    splitTotal += node.price;
    for (const userId of participants) {
      participantSet.add(userId);
    }

    const share = node.price / participants.length;
    for (const userId of participants) {
      balances.set(userId, (balances.get(userId) ?? 0) - share);
    }
    balances.set(payer, (balances.get(payer) ?? 0) + node.price);
  }

  const roundedBalances: TravelPlanMemberBalance[] = [
    ...balances.entries(),
  ].map(([userId, balance]) => ({
    userId,
    balance: roundAmount(balance),
  }));

  const debtors = roundedBalances
    .filter((entry) => entry.balance < 0)
    .map((entry) => ({ ...entry }))
    .sort((a, b) => a.balance - b.balance);
  const creditors = roundedBalances
    .filter((entry) => entry.balance > 0)
    .map((entry) => ({ ...entry }))
    .sort((a, b) => b.balance - a.balance);

  const transfers: TravelPlanTransferSuggestion[] = [];
  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const amount = roundAmount(Math.min(-debtor.balance, creditor.balance));
    if (amount <= 0) {
      break;
    }
    transfers.push({
      fromUserId: debtor.userId,
      toUserId: creditor.userId,
      amount,
    });
    debtor.balance += amount;
    creditor.balance -= amount;
    if (debtor.balance === 0) {
      debtorIndex += 1;
    }
    if (creditor.balance === 0) {
      creditorIndex += 1;
    }
  }

  return {
    balances: roundedBalances,
    transfers,
    splitTotal: roundAmount(splitTotal),
    participantCount: participantSet.size || input.memberIds?.length || 0,
  };
}

export function sumTravelPlanNodePrices(nodes: TravelPlanNodeRecord[]): number {
  return roundAmount(
    nodes.reduce((sum, node) => {
      if (
        node.price == null ||
        !Number.isFinite(node.price) ||
        node.price < 0
      ) {
        return sum;
      }
      return sum + node.price;
    }, 0),
  );
}

export function sumSplitEnabledNodePrices(
  nodes: TravelPlanNodeRecord[],
): number {
  return roundAmount(
    nodes.reduce((sum, node) => {
      if (!node.splitEnabled || node.price == null || node.price <= 0) {
        return sum;
      }
      return sum + node.price;
    }, 0),
  );
}
