// import { BigNumber, BigNumberish } from 'ethers'
// import { extendEnvironment } from 'hardhat/config'
// import { HardhatRuntimeEnvironment } from 'hardhat/types'

// const SNAPSHOT = 'evm_snapshot'
// const REVERT = 'evm_revert'
// const INCREASE_TIME = 'evm_increaseTime'
// const MINE = 'evm_mine'

// export type Snapshot = string

// export class TimePlugin {
//   hre: HardhatRuntimeEnvironment

//   methods = {
//     SNAPSHOT,
//     REVERT,
//     INCREASE_TIME,
//     MINE,
//   }

//   constructor(hre: HardhatRuntimeEnvironment) {
//     this.hre = hre
//   }
//   /**
//    * Snapshot the state of the blockchain at the current block. Takes no parameters.
//    *
//    * @returns the integer id of the snapshot created.
//    */
//   async snapshot(): Promise<Snapshot> {
//     return await this.hre.network.provider.send(this.methods.SNAPSHOT)
//   }

//   /**
//    * Revert the state of the blockchain to a previous snapshot.
//    * If no snapshot id is passed it will revert to the latest snapshot.
//    *
//    * @param snapId is the snapshot id to revert to
//    *
//    * @returns true
//    */
//   async revert(snapId: Snapshot): Promise<boolean> {
//     return await this.hre.network.provider.send(this.methods.REVERT, [snapId])
//   }

//   /**
//    * Jump forward in time.
//    *
//    * @param seconds amount of time to increase in seconds.
//    *
//    * @retruns the total time adjustment, in seconds.
//    */
//   async increaseTime(seconds: BigNumberish, mineAfter = true): Promise<number> {
//     const increasedSeconds = await this.hre.network.provider.send(this.methods.INCREASE_TIME, [BigNumber.from(seconds).toNumber()])
//     mineAfter && await this.mine()
//     return increasedSeconds
//   }

//   /**
//    * Force a block to be mined.
//    * Mines a block independent of whether or not mining is started or stopped.
//    */
//   async mine() {
//     await this.hre.network.provider.send(this.methods.MINE)
//   }

//   /**
//    * Returns current block timestamp
//    */
//   async getTime(): Promise<number> {
//     const lastMinedBlockNumber = await this.hre.ethers.provider.getBlockNumber()
//     const lastMinedBlock = await this.hre.ethers.provider.getBlock(lastMinedBlockNumber)
//     return lastMinedBlock.timestamp
//   }

//   async getCurrentBlockNumber(): Promise<number> {
//     return await this.hre.ethers.provider.getBlockNumber()
//   }
// }

// declare module 'hardhat/types/runtime' {
//   export interface HardhatRuntimeEnvironment {
//     time: TimePlugin
//   }
// }

// extendEnvironment((hre) => {
//   hre.time = new TimePlugin(hre)
// })
