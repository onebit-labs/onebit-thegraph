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
import { transaction, vault, depositor } from "../generated/schema";

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

export function handleApproval(event: Approval): void {}

export function handleBalanceTransfer(event: BalanceTransfer): void {
  const OTokenContract = OToken.bind(event.address);
  const vaultAddress = OTokenContract.VAULT();
  const vaultId = vaultAddress.toHexString();
  let vaultRecord = vault.load(vaultId);
  if (!vaultRecord) return;

  const id = event.transaction.hash.toHexString();
  let record = transaction.load(id);
  if (!record) {
    record = new transaction(id);
  }
  record.vault = vaultAddress;
  record.type = 4;
  record.amount = event.params.value;
  record.account = event.params.from;
  record.createTimestamp = event.block.timestamp.toI32();
  record.to = event.params.to;
  record.from = event.params.from;
  record.save();

  const depositorId = getDepositorId(vaultAddress, event.params.to);
  let depositorRecord = depositor.load(depositorId);
  if (!depositorRecord) {
    depositorRecord = new depositor(depositorId);
    depositorRecord.oTokenAddress = vaultRecord.oTokenAddress;
    depositorRecord.account = event.params.to;
    depositorRecord.vault = vaultAddress;
    depositorRecord.createTimestamp = event.block.timestamp.toI32();
    depositorRecord.lastUpdateTimestamp = event.block.timestamp.toI32();
    depositorRecord.save();

    pushDepositor(vaultRecord, event.params.to);
    vaultRecord.lastUpdateTimestamp = event.block.timestamp.toI32();
    vaultRecord.save();
  }

  const balanceOf = OTokenContract.balanceOf(event.params.from);
  if (balanceOf.isZero()) {
    removeDepositor(vaultRecord, event.params.from);
    vaultRecord.lastUpdateTimestamp = event.block.timestamp.toI32();
    vaultRecord.save();
  }
}

export function handleBurn(event: Burn): void {}

export function handleInitialized(event: Initialized): void {}

export function handleMint(event: Mint): void {}

export function handleTransfer(event: Transfer): void {}
