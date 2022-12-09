import {
  Bytes,
  BigInt,
  crypto,
  ByteArray,
  Address,
} from "@graphprotocol/graph-ts";

import {
  OToken,
  Approval,
  BalanceTransfer,
  Burn,
  Initialized,
  Mint,
  Transfer,
} from "../generated/Onebit-Lightning-Hunter-USDT__OToken/OToken";
import { transaction, lendingPool, depositor } from "../generated/schema";

function pushDepositor(pool: lendingPool, value: Bytes): void {
  const array = pool.depositors;
  for (let i = 0; i < pool.depositors.length; i++) {
    if (pool.depositors[i].toHexString() == value.toHexString()) return;
  }
  array.push(value);
  pool.depositors = array;
}

function removeDepositor(pool: lendingPool, value: Bytes): void {
  const array = new Array<Bytes>(0);
  for (let i = 0; i < pool.depositors.length; i++) {
    if (pool.depositors[i].toHexString() == value.toHexString()) continue;
    array.push(pool.depositors[i]);
  }
  pool.depositors = array;
}

function getDepositorId(
  lendingPoolAddress: Bytes,
  accountAddress: Bytes
): string {
  const lendingPool = lendingPoolAddress.toHexString();
  const account = accountAddress.toHexString();
  return crypto
    .keccak256(ByteArray.fromUTF8(lendingPool + account))
    .toHexString();
}

export function handleApproval(event: Approval): void {}

export function handleBalanceTransfer(event: BalanceTransfer): void {
  const OTokenContract = OToken.bind(event.address);
  const lendingPoolAddress = OTokenContract.POOL();
  const lendingPoolId = lendingPoolAddress.toHexString();
  let poolRecord = lendingPool.load(lendingPoolId);
  if (!poolRecord) return;

  const id = event.transaction.hash.toHexString();
  let record = transaction.load(id);
  if (!record) {
    record = new transaction(id);
  }
  record.lendingPool = lendingPoolAddress;
  record.type = 4;
  record.amount = event.params.value;
  record.account = event.params.from;
  record.createTimestamp = event.block.timestamp.toI32();
  record.to = event.params.to;
  record.from = event.params.from;
  record.save();

  const depositorId = getDepositorId(lendingPoolAddress, event.params.to);
  let depositorRecord = depositor.load(depositorId);
  if (!depositorRecord) {
    depositorRecord = new depositor(depositorId);
    depositorRecord.oTokenAddress = poolRecord.oTokenAddress;
    depositorRecord.account = event.params.to;
    depositorRecord.lendingPool = lendingPoolAddress;
    depositorRecord.createTimestamp = event.block.timestamp.toI32();
    depositorRecord.lastUpdateTimestamp = event.block.timestamp.toI32();
    depositorRecord.save();

    pushDepositor(poolRecord, event.params.to);
    poolRecord.lastUpdateTimestamp = event.block.timestamp.toI32();
    poolRecord.save();
  }

  const balanceOf = OTokenContract.balanceOf(event.params.from);
  if (balanceOf.isZero()) {
    removeDepositor(poolRecord, event.params.from);
    poolRecord.lastUpdateTimestamp = event.block.timestamp.toI32();
    poolRecord.save();
  }
}

export function handleBurn(event: Burn): void {}

export function handleInitialized(event: Initialized): void {}

export function handleMint(event: Mint): void {}

export function handleTransfer(event: Transfer): void {}
