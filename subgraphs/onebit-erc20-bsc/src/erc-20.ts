import { Address } from "@graphprotocol/graph-ts";
import { Transfer } from "../generated/USDT/ERC20";
import { transaction } from "../generated/schema";

const OTokens: string[] = ["0xe48ead461f4f696b11aaf74e0d82d7c6cb06b3fd"];
function isOToken(OToken: Address): i32 {
  for (let i = 0; i < OTokens.length; i++) {
    if (OTokens[i] == OToken.toHexString()) return 1;
  }
  return 0;
}

export function handleTransfer(event: Transfer): void {
  if (!isOToken(event.params.to)) return;

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
