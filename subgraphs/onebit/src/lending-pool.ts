import { Bytes } from '@graphprotocol/graph-ts'
import {
  Deposit,
  FundAddressUpdated,
  FundDeposit,
  FundWithdraw,
  NetValueUpdated,
  Paused,
  PeriodInitialized,
  Unpaused,
  Withdraw
} from "../generated/Onebit-USDT-1-LendingPool/LendingPool"
import { transaction, lendingPool } from "../generated/schema"

function pushDepositor(pool: lendingPool, value: Bytes): void {
  const array = pool.depositors
  for (let i = 0; i < pool.depositors.length; i++) {
    if (pool.depositors[i].toHexString() == value.toHexString()) return
  }
  array.push(value)
  pool.depositors = array
}

function removeDepositor(pool: lendingPool, value: Bytes): void {
  const array = new Array<Bytes>(0)
  for (let i = 0; i < pool.depositors.length; i++) {
    if (pool.depositors[i].toHexString() == value.toHexString()) continue
    array.push(pool.depositors[i])
  }
  pool.depositors = array
}

export function handleDeposit(event: Deposit): void {
  const id = event.transaction.hash.toHexString()
  let record = transaction.load(id)
  if (!record) {
    record = new transaction(id)
  }

  record.lendingPool = event.transaction.to
  record.type = 1
  record.amount = event.params.amount
  record.account = event.params.onBehalfOf
  record.createTimestamp = event.block.timestamp.toI32()

  record.save()

  const recordLendingPool = record.lendingPool
  if (recordLendingPool) {
    const poolId = recordLendingPool.toHexString()
    let poolRecord = lendingPool.load(poolId)
    if (!poolRecord) {
      poolRecord = new lendingPool(poolId)
      poolRecord.term = 0
      poolRecord.depositors = new Array<Bytes>(0)
    }

    poolRecord.lastUpdateTimestamp = event.block.timestamp.toI32()
    pushDepositor(poolRecord, record.account)
    poolRecord.save()
  }
}

export function handleFundAddressUpdated(event: FundAddressUpdated): void { }

export function handleFundDeposit(event: FundDeposit): void { }

export function handleFundWithdraw(event: FundWithdraw): void { }

export function handleNetValueUpdated(event: NetValueUpdated): void { }

export function handlePaused(event: Paused): void { }

export function handlePeriodInitialized(event: PeriodInitialized): void { }

export function handleUnpaused(event: Unpaused): void { }

export function handleWithdraw(event: Withdraw): void {
  const id = event.transaction.hash.toHexString()
  let record = transaction.load(id)
  if (!record) {
    record = new transaction(id)
  }

  record.lendingPool = event.transaction.to
  record.type = 2
  record.amount = event.params.amount
  record.account = event.params.to
  record.createTimestamp = event.block.timestamp.toI32()

  record.save()
}
