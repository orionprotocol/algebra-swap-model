import { BigNumberish, AddressLike, ZeroAddress, MaxUint256 } from "ethers";
import { getNamedAccounts, time, ethers } from "hardhat";
import { Mintable, WETH, NonfungiblePositionManager, AlgebraFactory, AlgebraPool, INonfungiblePositionManager, SwapRouter, ISwapRouter, ERC20 } from "../../typechain";
import { formatString } from "../../orion-tools/extensions/bignumber";
import { NonfungiblePositionManagerInterface } from "../../typechain/contracts/periphery/contracts/NonfungiblePositionManager";

interface Position {
	nonce: bigint; // the nonce for permits
	operator: string; // the address that is approved for spending this token
	poolId: bigint; // the ID of the pool with which this token is connected
	tickLower: bigint; // the tick range of the position
	tickUpper: bigint;
	liquidity: bigint; // the liquidity of the position
	feeGrowthInside0LastX128: bigint; // the fee growth of the aggregate position as of the last action on the individual position
	feeGrowthInside1LastX128: bigint;
	tokensOwed0: bigint; // how many uncollected tokens are owed to the position, as of the last computation
	tokensOwed1: bigint;
}

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
	const { owner } = await getNamedAccounts();
	const signer = await ethers.getSigner(owner);
	const tokenContract = <Mintable>await ethers.getContractAt('Mintable', await token, signer);
	const weth = <WETH>await ethers.getContract('WETH', signer);

	if (token !== (await weth.getAddress())) {
		await (await tokenContract.mint(to, amount)).wait();
	} else {
		await (await (tokenContract as WETH).deposit({ value: amount })).wait();
		await (await tokenContract.transfer(to, amount)).wait();
	}
}

export async function convertSqrtPriceX96ToPrice(pool: AddressLike, sqrtPriceX96: BigNumberish, inversePrice: boolean = false) {
	const poolContract = <AlgebraPool>await ethers.getContractAt("AlgebraPool", await pool)
	const token0 = <ERC20>await ethers.getContractAt("ERC20", await poolContract.token0())
	const token1 = <ERC20>await ethers.getContractAt("ERC20", await poolContract.token1())
	const token0Decimals = await token0.decimals();
	const token1Decimals = await token1.decimals();
	const adjustedPrice = (Number(sqrtPriceX96) / 2 ** 96) ** 2
	const price = adjustedPrice * (10 ** Number(token0Decimals)) / (10 ** Number(token1Decimals))
	return price
}

export async function initializePool(token0: AddressLike, token1: AddressLike, price: BigNumberish, inversePrice: boolean = false) {
	const positionManager = <NonfungiblePositionManager>await ethers.getContract('NonfungiblePositionManager');
	const token0Contract = <Mintable>await ethers.getContractAt('Mintable', await token0);
	const token1Contract = <Mintable>await ethers.getContractAt('Mintable', await token1);
	const token0Decimals = await token0Contract.decimals();
	const token1Decimals = await token1Contract.decimals();
	if (inversePrice) price = 1 / Number(price)
	const adjustedPrice = Number(price) * (10 ** Number(token1Decimals)) / (10 ** Number(token0Decimals))
	const sqrtPriceX96 = BigInt(Math.floor(Math.sqrt(adjustedPrice) * 2 ** 96));
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
	console.log("Mint");
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
	const rc = await (await positionManager.mint(mintParams)).wait();
	const tokenIndex = await positionManager.balanceOf(minter) - 1n
	const tokenId = await positionManager.tokenOfOwnerByIndex(minter, tokenIndex)
	const position = (await positionManager.positions(tokenId) as any).toObject() as Position
	const token0BalanceAfter = await token0Contract.balanceOf(minter)
	const token1BalanceAfter = await token1Contract.balanceOf(minter)

	const token0BalanceDiff = formatString(token0BalanceBefore - token0BalanceAfter, await token0Contract.decimals())
	const token1BalanceDiff = formatString(token1BalanceBefore - token1BalanceAfter, await token1Contract.decimals())

	// console.log(`Liquidity provided for token ${await token0Contract.symbol()}: ${token0BalanceDiff}`)
	// console.log(`Liquidity provided for token ${await token1Contract.symbol()}: ${token1BalanceDiff}`)
	return { tokenId, position }
}

export async function burnLiquidity(
	burner: AddressLike,
	tokenId: BigNumberish,
	liquidity: BigNumberish,
	amount0Min: BigNumberish = 0n,
	amount1Min: BigNumberish = 0n,
	deadline: undefined | BigNumberish = undefined
) {
	console.log("Burn")
	burner = await addressLikeToString(burner)
	if (deadline === undefined) {
		deadline = await time.getTime() + 1000
	}
	const burnerSigner = await ethers.getSigner(burner)
	const positionManager = <NonfungiblePositionManager>(
		await ethers.getContract('NonfungiblePositionManager', burnerSigner)
	);

	const decreaseLiquidityParams: INonfungiblePositionManager.DecreaseLiquidityParamsStruct = {
		tokenId,
		liquidity,
		amount0Min,
		amount1Min,
		deadline
	};
	await (await positionManager.decreaseLiquidity(decreaseLiquidityParams)).wait();
}

export async function swapExactInputSingle(
	swapper: AddressLike,
	tokenIn: AddressLike,
	tokenOut: AddressLike,
	amountIn: BigNumberish,
	amountOutMinimum: BigNumberish = 0n,
	recipient: AddressLike = swapper,
	deadline: undefined | BigNumberish = undefined,
	limitSqrtPrice: BigNumberish = 0
) {
	console.log("Swap");
	[tokenIn, tokenOut, swapper] = await Promise.all(
		[tokenIn, tokenOut, swapper].map(async (addressLike) => await addressLikeToString(addressLike))
	);
	if (deadline == undefined) {
		deadline = await time.getTime() + 1000
	}
	const swapperSigner = await ethers.getSigner(swapper)
	const router = <SwapRouter>await ethers.getContract("SwapRouter", swapper)
	const tokenInContract = <Mintable>await ethers.getContractAt('Mintable', tokenIn, swapperSigner);
	await (await tokenInContract.approve(router, MaxUint256)).wait();
	await uniMint(tokenIn, swapper, amountIn);
	swapper = await addressLikeToString(swapper)
	const swapParams: ISwapRouter.ExactInputSingleParamsStruct = {
		recipient,
		tokenIn,
		tokenOut,
		amountIn,
		amountOutMinimum,
		deadline,
		limitSqrtPrice
	}
	await (await router.exactInputSingle(swapParams)).wait()
}
