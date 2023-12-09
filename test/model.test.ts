import {ethers, deployments, getUnnamedAccounts, getNamedAccounts} from 'hardhat';
import {setupNamedUsers, setupUsers} from './utils';
import hre from 'hardhat';
import {pick} from '../orion-tools/extensions/global';
import {wrapHardhatProvider} from 'hardhat-tracer/dist/src/wrapper';
import {
	AlgebraFactory,
	Mintable,
} from '../typechain';
import {convert} from '../orion-tools/extensions/bignumber';

import './quickswap-model/tickTable';
import './quickswap-model/tickMath';
import './quickswap-model/priceMovementMath';
import './quickswap-model/constants';
import './quickswap-model/FullMath';
import './quickswap-model/tickManager';
import './quickswap-model/liquidityMath';
import './quickswap-model/dataStorageOperator';
import { initializePool, mintLiquidity } from './utils/algebraHelpers';

wrapHardhatProvider(hre);
hre.tracer.enabled = false;

const setup = deployments.createFixture(async () => {
	await deployments.fixture(['algebra', 'tokens']);

	const unnamedAccounts = await getUnnamedAccounts();
	const namedAccounts = await getNamedAccounts();
	const namedAccountsForTest = pick(namedAccounts, 'owner', 'matcher', 'trader1', 'trader2', 'trader3');

	const contracts = {
		orn: <Mintable>await ethers.getContract('Orion', namedAccounts.owner),
		usdt: <Mintable>await ethers.getContract('USDT', namedAccounts.owner),
		factory: <AlgebraFactory>await ethers.getContract('AlgebraFactory', namedAccounts.owner),
	};

	return {
		...contracts,
		...(await setupNamedUsers(namedAccountsForTest, contracts)),
		unnamedAccounts: await setupUsers(unnamedAccounts, contracts),
	};
});

async function setupModel() {
	
}

describe('AlgebraPool', async () => {
	it('Transaction', async () => {
		const {owner, usdt, orn, factory} = await setup();
		const ornPrice = 1;
		const pool = await initializePool(orn, usdt, ornPrice)
		const ornLiquidityAmount = await convert(10000, orn)
		const usdtLiquidityAmount = await convert(10000, usdt)
		await mintLiquidity(owner.address, orn, usdt, 0.8, 1.2, ornLiquidityAmount, usdtLiquidityAmount)
		await mintLiquidity(owner.address, orn, usdt, 0.7, 1.1, ornLiquidityAmount, usdtLiquidityAmount)
		await mintLiquidity(owner.address, orn, usdt, 0.9, 1.3, ornLiquidityAmount, usdtLiquidityAmount)
		pool.filters.Burn
		const globalState = await pool.globalState();
		console.log((Number(globalState.price) / 2**96)**2)
	});
});
