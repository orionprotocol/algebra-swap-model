import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;

    const { owner } = await getNamedAccounts();

    await deploy('LINK', {
        contract: 'GenericToken',
        from: owner,
        skipIfAlreadyDeployed: true,
        args: ["LINK", "LINK", 18],
        log: true
    });
};
export default func;
func.tags = ['LINK', 'tokens'];
func.skip = async (hre) => {
    return !hre.network.tags["local"]
}