import { Bytes, BigInt, crypto, ByteArray } from '@graphprotocol/graph-ts'
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
import { transaction, lendingPool, portfolioTerm, netValue, depositor } from "../generated/schema"

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

function getDepositorId(lendingPoolAddress: Bytes, accountAddress: Bytes): string {
  const lendingPool = lendingPoolAddress.toHexString()
  const account = accountAddress.toHexString()
  return crypto.keccak256(ByteArray.fromUTF8(lendingPool + account)).toHexString()
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

    const depositorId = getDepositorId(lendingPoolAddress, record.account)
    let depositorRecord = depositor.load(depositorId)
    if (!depositorRecord) {
      depositorRecord = new depositor(depositorId)
      depositorRecord.balanceOf = BigInt.fromI32(0)
      depositorRecord.account = record.account
      depositorRecord.lendingPool = lendingPoolAddress
      depositorRecord.createTimestamp = event.block.timestamp.toI32()
    }
    depositorRecord.balanceOf = depositorRecord.balanceOf.plus(record.amount)
    depositorRecord.lastUpdateTimestamp = event.block.timestamp.toI32()
    depositorRecord.save()
  }
}

export function handleFundAddressUpdated(event: FundAddressUpdated): void { }

export function handleFundDeposit(event: FundDeposit): void { }

export function handleFundWithdraw(event: FundWithdraw): void { }

export function handleNetValueUpdated(event: NetValueUpdated): void {
  const id = event.transaction.hash.toHexString()
  let record = netValue.load(id)
  if (!record) {
    record = new netValue(id)
  }

  record.lendingPool = event.transaction.to
  record.previousNetValue = event.params.previousNetValue
  record.newNetValue = event.params.newNetValue
  record.previousLiquidityIndex = event.params.previousLiquidityIndex
  record.newLiquidityIndex = event.params.newLiquidityIndex
  record.currentLiquidityRate = event.params.currentLiquidityRate
  record.createTimestamp = event.block.timestamp.toI32()
  record.save()

  const lendingPoolAddress = event.transaction.to
  if (!lendingPoolAddress) return
  const poolId = lendingPoolAddress.toHexString()
  const poolRecord = lendingPool.load(poolId)
  if (!poolRecord) return
  for (let i = 0; i < poolRecord.depositors.length; i++) {
    const depositorId = getDepositorId(lendingPoolAddress, poolRecord.depositors[i])
    const depositorRecord = depositor.load(depositorId)
    if (!depositorRecord) continue
    depositorRecord.balanceOf = depositorRecord.balanceOf.times(record.newNetValue)
    depositorRecord.lastUpdateTimestamp = event.block.timestamp.toI32()
    depositorRecord.save()
  }
}

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

  const lendingPoolAddress = event.transaction.to
  if (!lendingPoolAddress) return
  const depositorId = getDepositorId(lendingPoolAddress, record.account)
  let depositorRecord = depositor.load(depositorId)
  if (depositorRecord) {
    depositorRecord.balanceOf = depositorRecord.balanceOf.minus(record.amount)
    depositorRecord.lastUpdateTimestamp = event.block.timestamp.toI32()
    depositorRecord.save()

    if (depositorRecord.balanceOf.isZero()) {
      const poolId = lendingPoolAddress.toHexString()
      let poolRecord = lendingPool.load(poolId)
      if (!poolRecord) return
      removeDepositor(poolRecord, record.account)
      poolRecord.save()
    }
  }
}
