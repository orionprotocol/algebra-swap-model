
// import { HardhatRuntimeEnvironment } from 'hardhat/types';
// import { DeployFunction } from 'hardhat-deploy/types';
// import { ethers, time } from 'hardhat';
// import { BigNumberish, MaxUint256, ZeroAddress } from 'ethers';
// import { convert } from '../orion-tools/extensions/bignumber';
// import { AlgebraFactory, AlgebraPool, INonfungiblePositionManager, Mintable, NonfungiblePositionManager, WETH } from '../typechain';

// const MIN_TICK = -887272n
// const MAX_TICK = -MIN_TICK

// function sqrt(value: BigNumberish) {
//   value = BigInt(value);
//   let z = (value + 1n) / 2n;
//   let y = value;
//   while (z - y < 0) {
//     y = z;
//     z = (value / z + z) / 2n;
//   }
//   return y;
// }

// export const getMinTick = (tickSpacing: BigNumberish) => MIN_TICK / BigInt(tickSpacing) * BigInt(tickSpacing)
// export const getMaxTick = (tickSpacing: BigNumberish) => MAX_TICK / BigInt(tickSpacing) * BigInt(tickSpacing)
// export const getMaxLiquidityPerTick = (tickSpacing: number) =>
//   (2n ** 128n - 1n) / (getMaxTick(tickSpacing) - getMinTick(tickSpacing))

// const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
//   const { getNamedAccounts } = hre;
//   const { owner } = await getNamedAccounts();

//   const factory = <AlgebraFactory>await hre.ethers.getContract("AlgebraFactory", owner)
//   const positionManager = <NonfungiblePositionManager>await hre.ethers.getContract("NonfungiblePositionManager", owner)

//   const weth = <Mintable>await hre.ethers.getContract("WETH", owner)
//   const usdt = <Mintable>await hre.ethers.getContract("USDT", owner)
//   const orion = <Mintable>await hre.ethers.getContract("Orion", owner)
//   const wxrp = <Mintable>await hre.ethers.getContract("WXRP", owner)
//   const wbtc = <Mintable>await hre.ethers.getContract("WBTC", owner)

//   const tokens = [usdt, orion] //, wxrp, wbtc, weth]

//   const liquidityAmounts = {}
//   liquidityAmounts[await usdt.getAddress()] = 100_000
//   liquidityAmounts[await orion.getAddress()] = 100_000
//   // liquidityAmounts[await wbtc.getAddress()] = 3.424
//   // liquidityAmounts[await wxrp.getAddress()] = 203983.2
//   // liquidityAmounts[await weth.getAddress()] = 1000

//   for (let token0 of tokens) {
//     for (let token1 of tokens) {
//       if (token0 === token1) continue

//       [token0, token1] = await token0.getAddress() < await token1.getAddress()
//         ? [token0, token1]
//         : [token1, token0]
//       const token0Address = await token0.getAddress();
//       const token1Address = await token1.getAddress();
//       const amount0 = await convert(liquidityAmounts[token0Address], token0)
//       const amount1 = await convert(liquidityAmounts[token1Address], token1)

//       let poolAddress = await factory.poolByPair(token0Address, token1Address)
//       if (poolAddress !== ZeroAddress) continue

//       const sqrtPrice = sqrt(amount1 * 2n ** 192n / amount0)
//       await (await positionManager.createAndInitializePoolIfNecessary(token0Address, token1Address, sqrtPrice)).wait()

//       poolAddress = await factory.poolByPair(token0Address, token1Address)
//       console.log(poolAddress)
//       const pool = <AlgebraPool>await ethers.getContractAt("AlgebraPool", poolAddress)
//       const tickSpacing = await pool.tickSpacing()
//       if (token0Address != await weth.getAddress()) {
//         await (await token0.mint(owner, amount0)).wait()
//       } else {
//         await (await (token0 as WETH).deposit({ value: amount0 })).wait()
//       }
//       if (token1Address != await weth.getAddress()) {
//         await (await token1.mint(owner, amount1)).wait()
//       } else {
//         await (await (token1 as WETH).deposit({ value: amount1 })).wait()
//       }
//       await (await token0.approve(positionManager, MaxUint256)).wait()
//       await (await token1.approve(positionManager, MaxUint256)).wait()

//       const mintParams: INonfungiblePositionManager.MintParamsStruct = {
//         token0: await pool.token0(),
//         token1: await pool.token1(),
//         tickLower: getMinTick(tickSpacing),
//         tickUpper: getMaxTick(tickSpacing),
//         amount0Desired: amount0 / 10n,
//         amount1Desired: amount1 / 10n,
//         amount0Min: 0,
//         amount1Min: 0,
//         recipient: owner,
//         deadline: await time.getTime() + 1000
//       }
//       await (await positionManager.mint(mintParams)).wait()
//     }
//   }
//   console.log("BlockNumber")
//   console.log(await hre.ethers.provider.getBlockNumber())
// };
// export default func;
// func.tags = ['AlgebraPools', "algebra"];
// func.dependencies = ["tokens", "AlgebraFactory", "NonfungiblePositionManager"]
