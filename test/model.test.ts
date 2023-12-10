import { ethers, deployments, getUnnamedAccounts, getNamedAccounts, time } from 'hardhat';
import { setupNamedUsers, setupUsers } from './utils';
import hre from 'hardhat';
import { pick } from '../orion-tools/extensions/global';
import { wrapHardhatProvider } from 'hardhat-tracer/dist/src/wrapper';
import {
	AlgebraFactory,
	AlgebraPool,
	Mintable,
	SwapRouter,
} from '../typechain';
import { convert } from '../orion-tools/extensions/bignumber';
import _ from "lodash"

import './quickswap-model/tickTable';
import './quickswap-model/tickMath';
import './quickswap-model/priceMovementMath';
import './quickswap-model/constants';
import './quickswap-model/FullMath';
import './quickswap-model/tickManager';
import './quickswap-model/liquidityMath';
import './quickswap-model/dataStorageOperator';
import { burnLiquidity, convertSqrtPriceX96ToPrice, initializePool, mintLiquidity, swapExactInputSingle } from './utils/algebraHelpers';
import { AlgebraV1Pool } from './quickswap-model/model';
import { Tick, BurnEvent, MintEvent, Storage, SwapEvent, Timepoint, GlobalState } from './quickswap-model/types';
import { BigNumberish, ZeroAddress } from 'ethers';
import chalk from 'chalk';

wrapHardhatProvider(hre);
hre.tracer.enabled = false;

const setup = deployments.createFixture(async () => {
	await deployments.fixture(['algebra', 'tokens']);

	const unnamedAccounts = await getUnnamedAccounts();
	const namedAccounts = await getNamedAccounts();
	const namedAccountsForTest = pick(namedAccounts, 'owner');

	const contracts = {
		orn: <Mintable>await ethers.getContract('Orion', namedAccounts.owner),
		usdt: <Mintable>await ethers.getContract('USDT', namedAccounts.owner),
		factory: <AlgebraFactory>await ethers.getContract('AlgebraFactory', namedAccounts.owner),
		router: <SwapRouter>await ethers.getContract('SwapRouter', namedAccounts.owner)
	};

	return {
		...contracts,
		...(await setupNamedUsers(namedAccountsForTest, contracts)),
		unnamedAccounts: await setupUsers(unnamedAccounts, contracts),
	};
});

describe('AlgebraPool', async () => {
	it('Check model state', async () => {
		const { owner, usdt, orn, factory } = await setup();
		const ornPrice = 1;
		const pool = await initializePool(orn, usdt, ornPrice);
		const ornLiquidityAmount = await convert(10000, orn);
		const usdtLiquidityAmount = await convert(10000, usdt);
		const mint1 = await mintLiquidity(owner.address, orn, usdt, 0.8, 1.2, ornLiquidityAmount, usdtLiquidityAmount);
		await burnLiquidity(owner, mint1.tokenId, mint1.position.liquidity / 2n)
		await mintLiquidity(owner.address, orn, usdt, 0.7, 1.1, ornLiquidityAmount, usdtLiquidityAmount);
		const mint2 = await mintLiquidity(owner.address, orn, usdt, 0.9, 1.3, ornLiquidityAmount, usdtLiquidityAmount);
		const sellOrnAmount = await convert(1000, orn)
		const sellUsdtAmount = await convert(1000, usdt)
		await swapExactInputSingle(owner, orn, usdt, sellOrnAmount)
		await swapExactInputSingle(owner, orn, usdt, sellOrnAmount)
		await swapExactInputSingle(owner, usdt, orn, sellUsdtAmount)
		await burnLiquidity(owner, mint1.tokenId, mint1.position.liquidity / 2n)
		await swapExactInputSingle(owner, usdt, orn, sellUsdtAmount / 3n)
		await burnLiquidity(owner, mint2.tokenId, mint2.position.liquidity)
		await swapExactInputSingle(owner, orn, usdt, sellOrnAmount)
		await swapExactInputSingle(owner, orn, usdt, await convert(150, orn))
		await swapExactInputSingle(owner, usdt, orn, await convert(150, usdt))
		await mintLiquidity(owner.address, orn, usdt, 0.5, 1, ornLiquidityAmount, usdtLiquidityAmount);
		await swapExactInputSingle(owner, usdt, orn, await convert(20000, usdt))

		const model = await fillModelWithData(pool)
		await ensureStorageEquality(pool, model, await ethers.provider.getBlockNumber(), false)
	});
});

async function fillModelWithData(pool: AlgebraPool) {
	const model = new AlgebraV1Pool({
		token0: await pool.token0(),
		token1: await pool.token1(),
		activeIncentive: ZeroAddress
	} as Storage)
	const iface = pool.interface;
	const rawLogs = await ethers.provider.getLogs({ fromBlock: 0 });
	// let previousStorage: Storage;
	// let currentStorage: Storage = _.cloneDeep(model.storage)
	for (const rawLog of rawLogs) {
		const log = iface.parseLog(rawLog as any);
		if (log === null) continue;
		switch (log.name) {
			case 'Initialize': {
				// console.log('Initialize');
				const [price, tick] = log.args;
				const initializeEvent = { price, tick };
				const blockNumber = rawLog.blockNumber;
				const timestamp = (await ethers.provider.getBlock(blockNumber)).timestamp;
				model.initializeEventCallback(timestamp, initializeEvent);
				break;
			}
			case 'Mint': {
				// console.log('Mint');
				const [sender, owner, bottomTick, topTick, liquidityAmount, amount0, amount1] = log.args;
				const mintEvent = { sender, owner, bottomTick, topTick, liquidityAmount, amount0, amount1 } as MintEvent;
				const blockNumber = rawLog.blockNumber;
				const timestamp = (await ethers.provider.getBlock(blockNumber)).timestamp;
				model.mintEventCallback(timestamp, mintEvent);
				break;
			}
			case 'Burn': {
				// console.log('Burn');
				const [owner, bottomTick, topTick, liquidityAmount, amount0, amount1] = log.args;
				const burnEvent = { owner, bottomTick, topTick, liquidityAmount, amount0, amount1 } as BurnEvent;
				const blockNumber = rawLog.blockNumber;
				const timestamp = (await ethers.provider.getBlock(blockNumber)).timestamp;
				model.burnEventCallback(timestamp, burnEvent);
				break;
			}
			case 'Swap': {
				// console.log('Swap');
				const [sender, recipient, amount0, amount1, price, liquidity, tick] = log.args;
				const swapEvent = { sender, recipient, amount0, amount1, price, liquidity, tick } as SwapEvent;
				const blockNumber = rawLog.blockNumber;
				const timestamp = (await ethers.provider.getBlock(blockNumber)).timestamp;
				model.swapEventCallback(timestamp, swapEvent);
				break;
			}
			default: {
				continue
			}
		}
		await ensureStorageEquality(pool, model, rawLog.blockNumber)
		// previousStorage = _.cloneDeep(currentStorage);
		// currentStorage = _.cloneDeep(model.storage)
		// console.log(deepDiff(previousStorage, currentStorage))
	}
	return model;
}

async function ensureStorageEquality(pool: AlgebraPool, model: AlgebraV1Pool, blockNumber: BigNumberish, printOnlyIfError: boolean = true) {
	const log = (msg) => { if (!printOnlyIfError) console.log(msg) }
	log("=====================================================================================")
	log(chalk.yellow(`Checking storage equality at block: ${blockNumber}, current blockNumber ${await ethers.provider.getBlockNumber()}`))
	let isStorageEqual = true
	const contractStorage = await getFullContractStorage(pool, blockNumber)
	const modelStorage = model.storage

	for (const key in contractStorage) {
		const contractValue = contractStorage[key]
		const modelValue = modelStorage[key]
		if (typeof contractValue !== 'object') {
			if (contractValue !== modelValue) {
				console.log(chalk.red(`Field ${key} is incorrect`))
				console.log(`contractValue: ${contractValue}`)
				console.log(`modelValue: ${modelValue}`)
				isStorageEqual = false
			}
		}
	}

	const contractGlobalState = (await pool.globalState({ blockTag: blockNumber }) as any).toObject() as GlobalState
	const modelGlobalState = model.storage.globalState

	for (const key in contractGlobalState) {
		const contractValue = contractGlobalState[key]
		const modelValue = modelGlobalState[key]
		if (contractValue !== modelValue) {
			console.log(chalk.red(`Field ${key} globalState is incorrect`))
			console.log(`contractValue: ${contractValue}`)
			console.log(`modelValue: ${modelValue}`)
			isStorageEqual = false
		}
	}

	for (const index in contractStorage.timepoints) {
		const contractTimepoint = contractStorage.timepoints[index]
		const modelTimepoint = model.getTimepoint(index)
		if (!Object.keys(modelTimepoint).every(key => modelTimepoint[key] === contractTimepoint[key])) {
			console.log(chalk.red(`Timepoints at index ${index} is incorrect`))
			console.log(`contractTimepoint: ${contractTimepoint}`)
			console.log(`modelTimepoint: ${Object.values(modelTimepoint)}`)
			isStorageEqual = false
		}
	}
	if (isStorageEqual) {
		log(chalk.green("passed"))
	} else {
		throw new Error("Storage is inconsistent")
	}
	log("=====================================================================================")
}

async function getFullContractStorage(pool: AlgebraPool, blockNumber: BigNumberish) {
	const poolAddress = await pool.getAddress()
	const token0 = await pool.token0({ blockTag: blockNumber })
	const token1 = await pool.token1({ blockTag: blockNumber })
	const tickSpacing = await pool.tickSpacing({ blockTag: blockNumber })
	const totalFeeGrowth0Token = await pool.totalFeeGrowth0Token({ blockTag: blockNumber });
	const totalFeeGrowth1Token = await pool.totalFeeGrowth1Token({ blockTag: blockNumber });
	const globalState = await pool.globalState({ blockTag: blockNumber });
	const liquidity = await pool.liquidity({ blockTag: blockNumber });
	const volumePerLiquidityInBlock = await pool.volumePerLiquidityInBlock({ blockTag: blockNumber });
	const liquidityCooldown = await pool.liquidityCooldown({ blockTag: blockNumber });
	const activeIncentive = await pool.activeIncentive({ blockTag: blockNumber });

	const ticks: Partial<{ [n: number]: Tick }> = {}
	const tickTable: Partial<{ [n: number]: bigint }> = {}

	const dataStorageOperatorAddress = await pool.dataStorageOperator()
	const dataStorageOperator = await ethers.getContractAt("DataStorageOperator", dataStorageOperatorAddress)
	const timepoints: Timepoint[] = []
	for (let i = 0; i < 2 ** 16; ++i) {
		const timepoint = (await dataStorageOperator.timepoints(i, { blockTag: blockNumber }) as any).toObject() as Timepoint
		const defaultTimepoint = {
			initialized: false,
			blockTimestamp: 0n, // the block timestamp of th: biginte
			tickCumulative: 0n, // the tick accumulator, i.e. tick * time elapsed since the pool was first initialized
			secondsPerLiquidityCumulative: 0n, // the seconds per liquidity since the pool was first initialized
			volatilityCumulative: 0n, // the volatility accumulator, overflow after ~34800 years is desired :)
			averageTick: 0n, // average tick at this blockTimestamp
			volumePerLiquidityCumulative: 0n, // the gmean(volumes)/liquidity accumulator
		}

		if (Object.keys(defaultTimepoint).every(key => timepoint[key] === defaultTimepoint[key])) {
			break
		} else {
			timepoints[i] = timepoint
		}
	}
	const feeConfig = await dataStorageOperator.feeConfig({ blockTag: blockNumber })

	const poolStorage: Storage = {
		token0,
		token1,
		tickSpacing: Number(tickSpacing),
		totalFeeGrowth0Token,
		totalFeeGrowth1Token,
		globalState,
		liquidity,
		volumePerLiquidityInBlock,
		liquidityCooldown,
		activeIncentive,
		ticks,
		tickTable,
		timepoints,
		feeConfig
	}
	return poolStorage
}

/**
 * Deep diff between two object-likes
 * @param  {Object} fromObject the original object
 * @param  {Object} toObject   the updated object
 * @return {Object}            a new object which represents the diff
 */
function deepDiff(fromObject, toObject) {
	const changes = {};

	const buildPath = (path, obj, key) =>
		_.isUndefined(path) ? key : `${path}.${key}`;

	const walk = (fromObject, toObject, path) => {
		for (const key of _.keys(fromObject)) {
			const currentPath = buildPath(path, fromObject, key);
			if (!_.has(toObject, key)) {
				changes[currentPath] = { from: _.get(fromObject, key) };
			}
		}

		for (const [key, to] of _.entries(toObject)) {
			const currentPath = buildPath(path, toObject, key);
			if (!_.has(fromObject, key)) {
				changes[currentPath] = { to };
			} else {
				const from = _.get(fromObject, key);
				if (!_.isEqual(from, to)) {
					if (_.isObjectLike(to) && _.isObjectLike(from)) {
						walk(from, to, currentPath);
					} else {
						changes[currentPath] = { from, to };
					}
				}
			}
		}
	};

	walk(fromObject, toObject, undefined);

	return changes;
}
