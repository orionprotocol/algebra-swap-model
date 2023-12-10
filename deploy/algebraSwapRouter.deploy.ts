
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { AlgebraFactory, AlgebraPoolDeployer, WETH } from '../typechain';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const { deployments, getNamedAccounts } = hre;
	const { deploy } = deployments;

	const { owner } = await getNamedAccounts();

	// await hre.ethers.provider.send("evm_setIntervalMining", [5000]);
	const poolDeployer = <AlgebraPoolDeployer>await hre.ethers.getContract("AlgebraPoolDeployer", owner)
	const factory = <AlgebraFactory>await hre.ethers.getContract("AlgebraFactory", owner)
	const weth = <WETH>await hre.ethers.getContract("WETH", owner)

	const res = await deploy('SwapRouter', {
		from: owner,
		args: [await factory.getAddress(), await weth.getAddress(), await poolDeployer.getAddress()],
		log: true,
		autoMine: true,
	});

}
export default func
func.tags = ["AlgebraSwapRouter", "algebra"]
func.dependencies = ["WETH", "AlgebraPoolDeployer", "AlgebraFactory"]
func.skip = async (hre: HardhatRuntimeEnvironment) => !hre.network.tags.local
