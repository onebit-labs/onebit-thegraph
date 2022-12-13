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
  FundAddressUpdated,
  FundDeposit,
  FundWithdraw,
  NetValueUpdated,
  Paused,
  PeriodInitialized,
  Unpaused,
  Withdraw,
  PurchaseEndTimestampMoved,
  RedemptionBeginTimestampMoved,
} from "../generated/Onebit-Lightning-Hunter-USDT/Vault";
import { OToken } from "../generated/Onebit-Lightning-Hunter-USDT/OToken";
import {
  transaction,
  vault,
  portfolioTerm,
  netValue,
  depositor,
} from "../generated/schema";

function pushDepositor(pool: vault, value: Bytes): void {
  const array = pool.depositors;
  for (let i = 0; i < pool.depositors.length; i++) {
    if (pool.depositors[i].toHexString() == value.toHexString()) return;
  }
  array.push(value);
  pool.depositors = array;
}

function removeDepositor(pool: vault, value: Bytes): void {
  const array = new Array<Bytes>(0);
  for (let i = 0; i < pool.depositors.length; i++) {
    if (pool.depositors[i].toHexString() == value.toHexString()) continue;
    array.push(pool.depositors[i]);
  }
  pool.depositors = array;
}

function getDepositorId(
  vaultAddress: Bytes,
  accountAddress: Bytes
): string {
  const vault = vaultAddress.toHexString();
  const account = accountAddress.toHexString();
  return crypto
    .keccak256(ByteArray.fromUTF8(vault + account))
    .toHexString();
}

export function handleDeposit(event: Deposit): void {
  const id = event.transaction.hash.toHexString();
  let record = transaction.load(id);
  if (!record) {
    record = new transaction(id);
  }

  record.vault = event.transaction.to;
  record.type = 1;
  record.amount = event.params.amount;
  record.account = event.params.onBehalfOf;
  record.createTimestamp = event.block.timestamp.toI32();
  record.to = record.vault;
  record.from = record.account;

  record.save();

  const vaultAddress = event.transaction.to;
  if (vaultAddress) {
    const poolId = vaultAddress.toHexString();
    let poolRecord = vault.load(poolId);
    if (!poolRecord) {
      poolRecord = new vault(poolId);
      poolRecord.term = 1;
      poolRecord.depositors = new Array<Bytes>(0);

      const contract = Vault.bind(vaultAddress);
      const reserveData = contract.getReserveData();

      poolRecord.oTokenAddress = reserveData.oTokenAddress;

      let portfolioTermRecord = portfolioTerm.load(id);
      if (!portfolioTermRecord) {
        portfolioTermRecord = new portfolioTerm(id);
      }

      portfolioTermRecord.vault = Bytes.fromHexString(poolId);
      portfolioTermRecord.previousNetValue = BigInt.fromI32(0);
      portfolioTermRecord.previousAssetsUnderManagement = BigInt.fromI32(0);
      portfolioTermRecord.previousScaledAssetsUnderManagement = BigInt.fromI32(
        0
      );
      portfolioTermRecord.term = poolRecord.term;
      portfolioTermRecord.createTimestamp = event.block.timestamp.toI32();
      portfolioTermRecord.purchaseBeginTimestamp = reserveData.purchaseBeginTimestamp.toI32();
      portfolioTermRecord.redemptionBeginTimestamp = reserveData.redemptionBeginTimestamp.toI32();
      portfolioTermRecord.purchaseEndTimestamp = reserveData.purchaseEndTimestamp.toI32();
      portfolioTermRecord.previousLiquidityIndex = BigInt.fromI32(0);
      portfolioTermRecord.previousDepositors = 0;
      portfolioTermRecord.managementFeeRate = reserveData.managementFeeRate;
      portfolioTermRecord.performanceFeeRate = reserveData.performanceFeeRate;
      portfolioTermRecord.save();
    }

    poolRecord.lastUpdateTimestamp = event.block.timestamp.toI32();
    pushDepositor(poolRecord, record.account);
    poolRecord.save();

    const depositorId = getDepositorId(vaultAddress, record.account);
    let depositorRecord = depositor.load(depositorId);
    if (!depositorRecord) {
      depositorRecord = new depositor(depositorId);
      depositorRecord.oTokenAddress = poolRecord.oTokenAddress;
      depositorRecord.account = record.account;
      depositorRecord.vault = vaultAddress;
      depositorRecord.createTimestamp = event.block.timestamp.toI32();
      depositorRecord.lastUpdateTimestamp = event.block.timestamp.toI32();
      depositorRecord.save();
    }
  }
}

export function handleFundAddressUpdated(event: FundAddressUpdated): void {}

export function handleFundDeposit(event: FundDeposit): void {
  const id = event.transaction.hash.toHexString();
  let record = transaction.load(id);
  if (!record) {
    record = new transaction(id);
  }

  record.vault = event.transaction.to;
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

  record.vault = event.transaction.to;
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

  record.vault = event.transaction.to;
  record.previousNetValue = event.params.previousNetValue;
  record.newNetValue = event.params.newNetValue;
  record.previousLiquidityIndex = event.params.previousLiquidityIndex;
  record.newLiquidityIndex = event.params.newLiquidityIndex;
  record.currentLiquidityRate = event.params.currentLiquidityRate;
  record.createTimestamp = event.block.timestamp.toI32();
  record.reserveNormalizedIncome = BigInt.fromI32(0);
  record.save();

  const vaultAddress = event.transaction.to;
  if (!vaultAddress) return;
  const contract = Vault.bind(vaultAddress);
  record.reserveNormalizedIncome = contract.getReserveNormalizedIncome();
  record.save();

  const poolId = vaultAddress.toHexString();
  const poolRecord = vault.load(poolId);
  if (!poolRecord) return;
  poolRecord.lastUpdateTimestamp = event.block.timestamp.toI32();
  poolRecord.save();
}

export function handlePaused(event: Paused): void {}

export function handlePeriodInitialized(event: PeriodInitialized): void {
  const vaultAddress = event.transaction.to;
  if (!vaultAddress) return;
  const poolId = vaultAddress.toHexString();
  const poolRecord = vault.load(poolId);
  if (!poolRecord) return;
  poolRecord.term = poolRecord.term + 1;
  poolRecord.lastUpdateTimestamp = event.block.timestamp.toI32();
  poolRecord.save();

  const id = event.transaction.hash.toHexString();
  const contract = Vault.bind(vaultAddress);
  const normalizedIncome = contract.getReserveNormalizedIncome();

  const oTokenAddress = Address.fromBytes(poolRecord.oTokenAddress);
  const OTokenContract = OToken.bind(oTokenAddress);
  const totalSupply = OTokenContract.totalSupply();
  const scaledTotalSupply = OTokenContract.scaledTotalSupply();

  let portfolioTermRecord = portfolioTerm.load(id);
  if (!portfolioTermRecord) {
    portfolioTermRecord = new portfolioTerm(id);
  }

  portfolioTermRecord.vault = Bytes.fromHexString(poolId);
  portfolioTermRecord.previousNetValue = normalizedIncome;
  portfolioTermRecord.previousAssetsUnderManagement = totalSupply;
  portfolioTermRecord.previousScaledAssetsUnderManagement = scaledTotalSupply;
  portfolioTermRecord.term = poolRecord.term;
  portfolioTermRecord.createTimestamp = event.block.timestamp.toI32();
  portfolioTermRecord.purchaseBeginTimestamp = event.params.purchaseBeginTimestamp.toI32();
  portfolioTermRecord.redemptionBeginTimestamp = event.params.redemptionBeginTimestamp.toI32();
  portfolioTermRecord.purchaseEndTimestamp = event.params.purchaseEndTimestamp.toI32();
  portfolioTermRecord.previousLiquidityIndex =
    event.params.previousLiquidityIndex;
  portfolioTermRecord.previousDepositors = poolRecord.depositors.length;
  portfolioTermRecord.managementFeeRate = event.params.managementFeeRate;
  portfolioTermRecord.performanceFeeRate = event.params.performanceFeeRate;
  portfolioTermRecord.save();
}
export function handleUnpaused(event: Unpaused): void {}

export function handleWithdraw(event: Withdraw): void {
  const id = event.transaction.hash.toHexString();
  let record = transaction.load(id);
  if (!record) {
    record = new transaction(id);
  }

  record.vault = event.transaction.to;
  record.type = 2;
  record.amount = event.params.amount;
  record.account = event.params.to;
  record.createTimestamp = event.block.timestamp.toI32();
  record.to = record.account;
  record.from = record.vault;

  record.save();

  const vaultAddress = event.transaction.to;
  if (!vaultAddress) return;
  const depositorId = getDepositorId(vaultAddress, record.account);
  let depositorRecord = depositor.load(depositorId);
  if (depositorRecord) {
    const oTokenAddress = Address.fromBytes(depositorRecord.oTokenAddress);
    const OTokenContract = OToken.bind(oTokenAddress);
    const balanceOf = OTokenContract.balanceOf(event.params.to);

    if (balanceOf.isZero()) {
      const poolId = vaultAddress.toHexString();
      let poolRecord = vault.load(poolId);
      if (!poolRecord) return;
      removeDepositor(poolRecord, record.account);
      poolRecord.save();
    }
  }
}

export function handlePurchaseEndTimestampMoved(
  event: PurchaseEndTimestampMoved
): void {}

export function handleRedemptionBeginTimestampMoved(
  event: RedemptionBeginTimestampMoved
): void {}
