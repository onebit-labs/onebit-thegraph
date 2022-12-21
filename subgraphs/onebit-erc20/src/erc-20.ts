import { Address } from "@graphprotocol/graph-ts";
import { Transfer } from "../generated/USDT/ERC20";
import { transaction } from "../generated/schema";

const OTokens: string[] = [
  "0xf2f46bc53f6239c620384632ec6a482386999964",
  "0x3979c568a0118dca44eef22396ac5d604ac73c46",
  "0x6bed7692fa0eaf88c94c14586f0d0c45872f0510",
  "0xd8c962825476622d9a370b567c2d95c323f5b168",
];
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
