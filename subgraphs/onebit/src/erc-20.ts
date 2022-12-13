import { Approval, Transfer } from "../generated/USDT/ERC20";
import { vault, transaction } from "../generated/schema";

export function handleApproval(event: Approval): void {}

export function handleTransfer(event: Transfer): void {
  const poolId = event.params.to.toHexString();
  let poolRecord = vault.load(poolId);
  if (!poolRecord) return;

  const id = event.transaction.hash.toHexString();
  let record = transaction.load(id);
  if (!record) {
    record = new transaction(id);
  }

  record.vault = event.params.to;
  record.type = 3;
  record.amount = event.params.value;
  record.account = event.params.from;
  record.createTimestamp = event.block.timestamp.toI32();
  record.to = record.vault;
  record.from = record.account;

  record.save();
}
