import {ethers, deployments, getUnnamedAccounts, getNamedAccounts, time} from 'hardhat';
import {setupNamedUsers, setupUsers} from './utils';
import hre from 'hardhat';
import {pick} from '../orion-tools/extensions/global';
import {wrapHardhatProvider} from 'hardhat-tracer/dist/src/wrapper';
import {AlgebraFactory, AlgebraPool, Mintable} from '../typechain';
import {convert} from '../orion-tools/extensions/bignumber';
import {MAX_SQRT_RATIO} from './quickswap-model/tickMath';
import {Pool} from './quickswap-model/model';

import './quickswap-model/tickTable';
import './quickswap-model/tickMath';
import './quickswap-model/priceMovementMath';
import './quickswap-model/constants';
import './quickswap-model/FullMath';
import './quickswap-model/tickManager';
import './quickswap-model/liquidityMath';
import './quickswap-model/dataStorageOperator';

wrapHardhatProvider(hre);
hre.tracer.enabled = false;

const setup = deployments.createFixture(async () => {
	await deployments.fixture(['algebra']);

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
		...(await setupNamedUsers(namedAccountsForTest, contracts as any)),
		unnamedAccounts: await setupUsers(unnamedAccounts, contracts as any),
	};
});

describe('AlgebraPool', async () => {
	it('Model', async () => {
		const {owner, usdt, orn, factory} = await setup();
		const poolAddress = await factory.poolByPair(orn, usdt);
		const amountRequired = await convert(100, orn);
		await time.mine();
		const model = new Pool(poolAddress);
		// hre.tracer.enabled = true;
		await model.calculateSwap(false, amountRequired, MAX_SQRT_RATIO - 1n);
		// hre.tracer.enabled = false;
	});
	// it("Transaction", async () => {
	//   const { owner, usdt, orn, factory } = await setup()
	//   const poolAddress = await factory.poolByPair(orn, usdt)

	//   const pool = <AlgebraPool>await ethers.getContractAt("AlgebraPool", poolAddress)
	//   console.log(await pool.token0())
	//   console.log(await orn.getAddress())
	//   const amountRequired = await convert(100, orn)
	//   hre.tracer.enabled = true;
	//   const res = await (await pool._calculateSwapAndLock(false, amountRequired, MAX_SQRT_RATIO - 1n)).wait()
	//   hre.tracer.enabled = false;

	// })
});
