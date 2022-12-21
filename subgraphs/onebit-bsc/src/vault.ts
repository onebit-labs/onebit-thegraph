import {
  Bytes,
  BigInt,
  crypto,
  ByteArray,
  Address,
} from "@graphprotocol/graph-ts";
import {
  Vault,
  Deposit,
  FundDeposit,
  FundWithdraw,
  NetValueUpdated,
  PeriodInitialized,
  Withdraw,
  PurchaseBeginTimestampMoved,
  PurchaseEndTimestampMoved,
  RedemptionBeginTimestampMoved,
} from "../generated/Onebit-Lightning-Hunter-USDT/Vault";
import { OToken } from "../generated/Onebit-Lightning-Hunter-USDT__OToken/OToken";
import {
  transaction,
  vault,
  portfolioTerm,
  netValue,
  depositor,
} from "../generated/schema";

function pushDepositor(vault: vault, value: Bytes): void {
  const array = vault.depositors;
  for (let i = 0; i < vault.depositors.length; i++) {
    if (vault.depositors[i].toHexString() == value.toHexString()) return;
  }
  array.push(value);
  vault.depositors = array;
}

function removeDepositor(vault: vault, value: Bytes): void {
  const array = new Array<Bytes>(0);
  for (let i = 0; i < vault.depositors.length; i++) {
    if (vault.depositors[i].toHexString() == value.toHexString()) continue;
    array.push(vault.depositors[i]);
  }
  vault.depositors = array;
}

function getDepositorId(vaultAddress: Bytes, accountAddress: Bytes): string {
  const vault = vaultAddress.toHexString();
  const account = accountAddress.toHexString();
  return crypto.keccak256(ByteArray.fromUTF8(vault + account)).toHexString();
}
function getPortfolioTermId(vaultAddress: Bytes, term: number): string {
  const vault = vaultAddress.toHexString();
  const account = term.toString();
  return crypto.keccak256(ByteArray.fromUTF8(vault + account)).toHexString();
}

export function handleDeposit(event: Deposit): void {
  const id = event.transaction.hash.toHexString();
  let record = transaction.load(id);
  if (!record) {
    record = new transaction(id);
  }

  record.vault = event.address;
  record.type = 1;
  record.amount = event.params.amount;
  record.account = event.params.onBehalfOf;
  record.createTimestamp = event.block.timestamp.toI32();
  record.to = record.vault;
  record.from = record.account;

  record.save();

  const vaultAddress = event.address;
  if (vaultAddress) {
    const vaultId = vaultAddress.toHexString();
    let vaultRecord = vault.load(vaultId);
    if (!vaultRecord) {
      vaultRecord = new vault(vaultId);
      vaultRecord.term = 1;
      vaultRecord.depositors = new Array<Bytes>(0);

      const contract = Vault.bind(vaultAddress);
      const reserveData = contract.getReserveData();

      vaultRecord.oTokenAddress = reserveData.oTokenAddress;

      const portfolioTermId = getPortfolioTermId(
        vaultAddress,
        vaultRecord.term
      );
      let portfolioTermRecord = portfolioTerm.load(portfolioTermId);
      if (!portfolioTermRecord) {
        portfolioTermRecord = new portfolioTerm(portfolioTermId);
      }

      portfolioTermRecord.vault = Bytes.fromHexString(vaultId);
      portfolioTermRecord.previousNetValue = BigInt.fromI32(0);
      portfolioTermRecord.previousAssetsUnderManagement = BigInt.fromI32(0);
      portfolioTermRecord.previousScaledAssetsUnderManagement = BigInt.fromI32(
        0
      );
      portfolioTermRecord.term = vaultRecord.term;
      portfolioTermRecord.createTimestamp = event.block.timestamp.toI32();
      portfolioTermRecord.purchaseBeginTimestamp = reserveData.purchaseBeginTimestamp.toI32();
      portfolioTermRecord.redemptionBeginTimestamp = reserveData.redemptionBeginTimestamp.toI32();
      portfolioTermRecord.purchaseEndTimestamp = reserveData.purchaseEndTimestamp.toI32();
      portfolioTermRecord.previousLiquidityIndex = BigInt.fromString(
        "1000000000000000000000000000"
      );
      portfolioTermRecord.previousDepositors = 0;
      portfolioTermRecord.managementFeeRate = reserveData.managementFeeRate;
      portfolioTermRecord.performanceFeeRate = reserveData.performanceFeeRate;
      portfolioTermRecord.save();
    }

    vaultRecord.lastUpdateTimestamp = event.block.timestamp.toI32();
    pushDepositor(vaultRecord, record.account);
    vaultRecord.save();

    const depositorId = getDepositorId(vaultAddress, record.account);
    let depositorRecord = depositor.load(depositorId);
    if (!depositorRecord) {
      depositorRecord = new depositor(depositorId);
      depositorRecord.oTokenAddress = vaultRecord.oTokenAddress;
      depositorRecord.account = record.account;
      depositorRecord.vault = vaultAddress;
      depositorRecord.createTimestamp = event.block.timestamp.toI32();
      depositorRecord.lastUpdateTimestamp = event.block.timestamp.toI32();
      depositorRecord.save();
    }
  }
}

export function handleFundDeposit(event: FundDeposit): void {
  const id = event.transaction.hash.toHexString();
  let record = transaction.load(id);
  if (!record) {
    record = new transaction(id);
  }

  record.vault = event.address;
  record.type = 3;
  record.amount = event.params.amount;
  record.account = event.params.from;
  record.createTimestamp = event.block.timestamp.toI32();
  record.to = record.vault;
  record.from = record.account;

  record.save();
}

export function handleFundWithdraw(event: FundWithdraw): void {
  const id = event.transaction.hash.toHexString();
  let record = transaction.load(id);
  if (!record) {
    record = new transaction(id);
  }

  record.vault = event.address;
  record.type = 3;
  record.amount = event.params.amount;
  record.account = event.params.to;
  record.createTimestamp = event.block.timestamp.toI32();
  record.to = record.account;
  record.from = record.vault;

  record.save();
}

export function handleNetValueUpdated(event: NetValueUpdated): void {
  const id = event.transaction.hash.toHexString();
  let record = netValue.load(id);
  if (!record) {
    record = new netValue(id);
  }

  record.vault = event.address;
  record.previousNetValue = event.params.previousNetValue;
  record.newNetValue = event.params.newNetValue;
  record.previousLiquidityIndex = event.params.previousLiquidityIndex;
  record.newLiquidityIndex = event.params.newLiquidityIndex;
  record.currentLiquidityRate = event.params.currentLiquidityRate;
  record.createTimestamp = event.block.timestamp.toI32();
  record.reserveNormalizedIncome = BigInt.fromI32(0);
  record.save();

  const vaultAddress = event.address;
  if (!vaultAddress) return;
  const contract = Vault.bind(vaultAddress);
  record.reserveNormalizedIncome = contract.getReserveNormalizedIncome();
  record.save();

  const vaultId = vaultAddress.toHexString();
  const vaultRecord = vault.load(vaultId);
  if (!vaultRecord) return;
  vaultRecord.lastUpdateTimestamp = event.block.timestamp.toI32();
  vaultRecord.save();
}

export function handlePeriodInitialized(event: PeriodInitialized): void {
  const vaultAddress = event.address;
  if (!vaultAddress) return;
  const vaultId = vaultAddress.toHexString();
  const vaultRecord = vault.load(vaultId);
  if (!vaultRecord) return;
  vaultRecord.term = vaultRecord.term + 1;
  vaultRecord.lastUpdateTimestamp = event.block.timestamp.toI32();
  vaultRecord.save();

  const contract = Vault.bind(vaultAddress);
  const normalizedIncome = contract.getReserveNormalizedIncome();

  const oTokenAddress = Address.fromBytes(vaultRecord.oTokenAddress);
  const OTokenContract = OToken.bind(oTokenAddress);
  const totalSupply = OTokenContract.totalSupply();
  const scaledTotalSupply = OTokenContract.scaledTotalSupply();

  const portfolioTermId = getPortfolioTermId(vaultAddress, vaultRecord.term);
  let portfolioTermRecord = portfolioTerm.load(portfolioTermId);
  if (!portfolioTermRecord) {
    portfolioTermRecord = new portfolioTerm(portfolioTermId);
  }

  portfolioTermRecord.vault = Bytes.fromHexString(vaultId);
  portfolioTermRecord.previousNetValue = normalizedIncome;
  portfolioTermRecord.previousAssetsUnderManagement = totalSupply;
  portfolioTermRecord.previousScaledAssetsUnderManagement = scaledTotalSupply;
  portfolioTermRecord.term = vaultRecord.term;
  portfolioTermRecord.createTimestamp = event.block.timestamp.toI32();
  portfolioTermRecord.purchaseBeginTimestamp = event.params.purchaseBeginTimestamp.toI32();
  portfolioTermRecord.redemptionBeginTimestamp = event.params.redemptionBeginTimestamp.toI32();
  portfolioTermRecord.purchaseEndTimestamp = event.params.purchaseEndTimestamp.toI32();
  portfolioTermRecord.previousLiquidityIndex =
    event.params.previousLiquidityIndex;
  portfolioTermRecord.previousDepositors = vaultRecord.depositors.length;
  portfolioTermRecord.managementFeeRate = event.params.managementFeeRate;
  portfolioTermRecord.performanceFeeRate = event.params.performanceFeeRate;
  portfolioTermRecord.save();
}

export function handleWithdraw(event: Withdraw): void {
  const id = event.transaction.hash.toHexString();
  let record = transaction.load(id);
  if (!record) {
    record = new transaction(id);
  }

  record.vault = event.address;
  record.type = 2;
  record.amount = event.params.amount;
  record.account = event.params.to;
  record.createTimestamp = event.block.timestamp.toI32();
  record.to = record.account;
  record.from = record.vault;

  record.save();

  const vaultAddress = event.address;
  if (!vaultAddress) return;
  const depositorId = getDepositorId(vaultAddress, record.account);
  let depositorRecord = depositor.load(depositorId);
  if (depositorRecord) {
    const oTokenAddress = Address.fromBytes(depositorRecord.oTokenAddress);
    const OTokenContract = OToken.bind(oTokenAddress);
    const balanceOf = OTokenContract.balanceOf(event.params.to);

    if (balanceOf.isZero()) {
      const vaultId = vaultAddress.toHexString();
      let vaultRecord = vault.load(vaultId);
      if (!vaultRecord) return;
      removeDepositor(vaultRecord, record.account);
      vaultRecord.save();
    }
  }
}

export function handlePurchaseBeginTimestampMoved(
  event: PurchaseBeginTimestampMoved
): void {
  const vaultAddress = event.address;
  const vaultId = vaultAddress.toHexString();
  const vaultRecord = vault.load(vaultId);
  if (!vaultRecord) return;

  const portfolioTermId = getPortfolioTermId(vaultAddress, vaultRecord.term);
  let portfolioTermRecord = portfolioTerm.load(portfolioTermId);
  if (!portfolioTermRecord) {
    portfolioTermRecord = new portfolioTerm(portfolioTermId);
  }
  portfolioTermRecord.purchaseBeginTimestamp = event.params.newTimetamp.toI32();
  portfolioTermRecord.save();
}

export function handlePurchaseEndTimestampMoved(
  event: PurchaseEndTimestampMoved
): void {
  const vaultAddress = event.address;
  const vaultId = vaultAddress.toHexString();
  const vaultRecord = vault.load(vaultId);
  if (!vaultRecord) return;

  const portfolioTermId = getPortfolioTermId(vaultAddress, vaultRecord.term);
  let portfolioTermRecord = portfolioTerm.load(portfolioTermId);
  if (!portfolioTermRecord) {
    portfolioTermRecord = new portfolioTerm(portfolioTermId);
  }
  portfolioTermRecord.purchaseEndTimestamp = event.params.newTimetamp.toI32();
  portfolioTermRecord.save();
}

export function handleRedemptionBeginTimestampMoved(
  event: RedemptionBeginTimestampMoved
): void {
  const vaultAddress = event.address;
  const vaultId = vaultAddress.toHexString();
  const vaultRecord = vault.load(vaultId);
  if (!vaultRecord) return;

  const portfolioTermId = getPortfolioTermId(vaultAddress, vaultRecord.term);
  let portfolioTermRecord = portfolioTerm.load(portfolioTermId);
  if (!portfolioTermRecord) {
    portfolioTermRecord = new portfolioTerm(portfolioTermId);
  }
  portfolioTermRecord.redemptionBeginTimestamp = event.params.newTimetamp.toI32();
  portfolioTermRecord.save();
}
