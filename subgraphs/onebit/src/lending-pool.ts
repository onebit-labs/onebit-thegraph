import { Bytes, BigInt } from '@graphprotocol/graph-ts'
import {
  LendingPool,
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
import { transaction, lendingPool, portfolioTerm } from "../generated/schema"

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

  const lendingPoolAddress = event.transaction.to
  if (lendingPoolAddress) {
    const poolId = lendingPoolAddress.toHexString()
    let poolRecord = lendingPool.load(poolId)
    if (!poolRecord) {
      poolRecord = new lendingPool(poolId)
      poolRecord.term = 1
      poolRecord.depositors = new Array<Bytes>(0)

      const contract = LendingPool.bind(lendingPoolAddress)
      const reserveData = contract.getReserveData()

      let portfolioTermRecord = portfolioTerm.load(id)
      if (!portfolioTermRecord) {
        portfolioTermRecord = new portfolioTerm(id)
      }

      const normalizedIncome = contract.getReserveNormalizedIncome()
      portfolioTermRecord.lendingPool = Bytes.fromHexString(poolId)
      portfolioTermRecord.value = normalizedIncome
      portfolioTermRecord.term = poolRecord.term
      portfolioTermRecord.createTimestamp = event.block.timestamp.toI32()
      portfolioTermRecord.purchaseBeginTimestamp = reserveData.purchaseBeginTimestamp.toI32()
      portfolioTermRecord.redemptionBeginTimestamp = reserveData.redemptionBeginTimestamp.toI32()
      portfolioTermRecord.purchaseEndTimestamp = reserveData.purchaseEndTimestamp.toI32()
      portfolioTermRecord.previousLiquidityIndex = BigInt.fromI32(0)
      portfolioTermRecord.previousDepositors = 0
      portfolioTermRecord.managementFeeRate = reserveData.managementFeeRate
      portfolioTermRecord.performanceFeeRate = reserveData.performanceFeeRate
      portfolioTermRecord.save()
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

export function handlePeriodInitialized(event: PeriodInitialized): void {
  const lendingPoolAddress = event.transaction.to
  if (!lendingPoolAddress) return
  const poolId = lendingPoolAddress.toHexString()
  const poolRecord = lendingPool.load(poolId)
  if (!poolRecord) return
  poolRecord.term = poolRecord.term + 1
  poolRecord.lastUpdateTimestamp = event.block.timestamp.toI32()
  poolRecord.save()

  const id = event.transaction.hash.toHexString()
  const contract = LendingPool.bind(lendingPoolAddress)
  const normalizedIncome = contract.getReserveNormalizedIncome()

  let portfolioTermRecord = portfolioTerm.load(id)
  if (!portfolioTermRecord) {
    portfolioTermRecord = new portfolioTerm(id)
  }

  portfolioTermRecord.lendingPool = Bytes.fromHexString(poolId)
  portfolioTermRecord.value = normalizedIncome
  portfolioTermRecord.term = poolRecord.term
  portfolioTermRecord.createTimestamp = event.block.timestamp.toI32()
  portfolioTermRecord.purchaseBeginTimestamp = event.params.purchaseBeginTimestamp.toI32()
  portfolioTermRecord.redemptionBeginTimestamp = event.params.redemptionBeginTimestamp.toI32()
  portfolioTermRecord.purchaseEndTimestamp = event.params.purchaseEndTimestamp.toI32()
  portfolioTermRecord.previousLiquidityIndex = event.params.previousLiquidityIndex
  portfolioTermRecord.previousDepositors = poolRecord.depositors.length
  portfolioTermRecord.managementFeeRate = event.params.managementFeeRate
  portfolioTermRecord.performanceFeeRate = event.params.performanceFeeRate
  portfolioTermRecord.save()
}
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
