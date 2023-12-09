import { BigNumberish, AddressLike, ZeroAddress, MaxUint256 } from "ethers";
import { getNamedAccounts, time, ethers } from "hardhat";
import { Mintable, WETH, NonfungiblePositionManager, AlgebraFactory, AlgebraPool, INonfungiblePositionManager } from "../../typechain";
import { formatString } from "../../orion-tools/extensions/bignumber";


export async function addressLikeToString(address: AddressLike): Promise<string> {
	address = await address;
	if (typeof address !== 'string') {
		address = await address.getAddress();
	}
	return address;
}

function sqrt(value: BigNumberish) {
	value = BigInt(value);
	let z = (value + 1n) / 2n;
	let y = value;
	while (z - y < 0) {
		y = z;
		z = (value / z + z) / 2n;
	}
	return y;
}

export async function uniMint(token: AddressLike, to: AddressLike, amount: BigNumberish) {
	const {owner} = await getNamedAccounts();
	const signer = await ethers.getSigner(owner);
	const tokenContract = <Mintable>await ethers.getContractAt('Mintable', await token, signer);
	const weth = <WETH>await ethers.getContract('WETH', signer);

	if (token !== (await weth.getAddress())) {
		await (await tokenContract.mint(to, amount)).wait();
	} else {
		await (await (tokenContract as WETH).deposit({value: amount})).wait();
		await (await tokenContract.transfer(to, amount)).wait();
	}
}

export async function initializePool(token0: AddressLike, token1: AddressLike, price: BigNumberish, inversePrice: boolean = false) {
	const positionManager = <NonfungiblePositionManager>await ethers.getContract('NonfungiblePositionManager');
	const token0Contract = <Mintable>await ethers.getContractAt('Mintable', await token0);
	const token1Contract = <Mintable>await ethers.getContractAt('Mintable', await token1);
	const token0Decimals = await token0Contract.decimals();
	const token1Decimals = await token1Contract.decimals();
	if (inversePrice) price = 1 / Number(price)
const adjustedPrice = Number(price) * (10 ** Number(token1Decimals)) / (10 ** Number(token0Decimals))
const sqrtPriceX96 = BigInt(Math.floor(Math.sqrt(adjustedPrice) * 2**96));
await (await positionManager.createAndInitializePoolIfNecessary(token0, token1, sqrtPriceX96)).wait();
	return getPoolInstance(token0, token1)
}

export async function getPoolInstance(token0: AddressLike, token1: AddressLike) {
	const factory = <AlgebraFactory>await ethers.getContract('AlgebraFactory');
	let poolAddress = await factory.poolByPair(token0, token1);
	if (poolAddress === ZeroAddress) {
		throw new Error("Pool wasn't initialized");
	}
	poolAddress = await factory.poolByPair(token0, token1);
	const pool = <AlgebraPool>await ethers.getContractAt('AlgebraPool', poolAddress);
	return pool;
}
export async function priceToTick(price: BigNumberish, pool: AddressLike, inversePrice = false) {
	const poolContract = <AlgebraPool>await ethers.getContractAt('AlgebraPool', await pool);
	const token0 = await poolContract.token0();
	const token1 = await poolContract.token1();
	const token0Contract = <Mintable>await ethers.getContractAt('Mintable', token0);
	const token1Contract = <Mintable>await ethers.getContractAt('Mintable', token1);
	const token0Decimals = await token0Contract.decimals();
	const token1Decimals = await token1Contract.decimals();
	let adjustedPrice = Number(price) * (10 ** Number(token1Decimals)) / (10 ** Number(token0Decimals))
	if (inversePrice) adjustedPrice = 1 / Number(adjustedPrice)
	const tick = Math.floor(Math.log(adjustedPrice) / Math.log(1.0001))
	const tickSpacing = Number(await poolContract.tickSpacing())
	const spacedTick = Math.floor(tick / tickSpacing) * tickSpacing
	return spacedTick
}

export async function mintLiquidity(
	minter: AddressLike,
	token0: AddressLike,
	token1: AddressLike,
	priceLower: BigNumberish,
	priceUpper: BigNumberish,
	amount0: BigNumberish,
	amount1: BigNumberish,
	reversePrice: boolean = false
) {
	[token0, token1, minter] = await Promise.all(
		[token0, token1, minter].map(async (addressLike) => await addressLikeToString(addressLike))
	);
	[token0, token1] = token0 < token1 ? [token0, token1] : [token1, token0];

	const minterSigner = await ethers.getSigner(minter)
	const positionManager = <NonfungiblePositionManager>(
		await ethers.getContract('NonfungiblePositionManager', minterSigner)
	);
	const pool = await getPoolInstance(token0, token1)
	const token0Contract = <Mintable>await ethers.getContractAt('Mintable', token0, minterSigner);
	const token1Contract = <Mintable>await ethers.getContractAt('Mintable', token1, minterSigner);
	await (await token0Contract.approve(positionManager, MaxUint256)).wait();
	await (await token1Contract.approve(positionManager, MaxUint256)).wait();
	await uniMint(token0, minter, amount0);
	await uniMint(token1, minter, amount1);

	const mintParams: INonfungiblePositionManager.MintParamsStruct = {
		token0: token0,
		token1: token1,
		tickLower: await priceToTick(priceLower, pool, reversePrice),
		tickUpper: await priceToTick(priceUpper, pool, reversePrice),
		amount0Desired: amount0,
		amount1Desired: amount1,
		amount0Min: 0,
		amount1Min: 0,
		recipient: minter,
		deadline: (await time.getTime()) + 1000,
	};
	const token0BalanceBefore = await token0Contract.balanceOf(minter)
	const token1BalanceBefore = await token1Contract.balanceOf(minter)
	await (await positionManager.mint(mintParams)).wait();
	const token0BalanceAfter = await token0Contract.balanceOf(minter)
	const token1BalanceAfter = await token1Contract.balanceOf(minter)

	const token0BalanceDiff = formatString(token0BalanceBefore - token0BalanceAfter, await token0Contract.decimals())
	const token1BalanceDiff = formatString(token1BalanceBefore - token1BalanceAfter, await token1Contract.decimals())

	// console.log(`Liquidity provided for token ${await token0Contract.symbol()}: ${token0BalanceDiff}`)
	// console.log(`Liquidity provided for token ${await token1Contract.symbol()}: ${token1BalanceDiff}`)

}
