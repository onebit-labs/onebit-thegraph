import { Address } from "@graphprotocol/graph-ts";
import { Transfer } from "../generated/USDT/ERC20";
import { transaction } from "../generated/schema";

const vaults: string[] = [
  "0x249008409964a137ad50322bb03691b27347206c",
  "0xc097dc3a530c4a2dbcf9799487fefa6f6dd483a3",
  "0x888f74feb0f41cf8ec24b230ad7b1b527312af42",
  "0xa0efcba5e7732c7552bd6a946de8857223c70f00",
];
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
