import { Address } from "@graphprotocol/graph-ts";
import { Transfer } from "../generated/USDT/ERC20";
import { transaction } from "../generated/schema";

const vaults: string[] = ["0x3c997b030b643a823a170755a1640d5d2778d0ba"];
function isVault(vault: Address): i32 {
  for (let i = 0; i < vaults.length; i++) {
    if (vaults[i] == vault.toHexString()) return 1;
  }
  return 0;
}

export function handleTransfer(event: Transfer): void {
  if (!isVault(event.params.to)) return;

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
