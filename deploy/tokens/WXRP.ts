import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;

    const { owner } = await getNamedAccounts();

    await deploy('WXRP', {
        contract: 'GenericToken',
        from: owner,
        skipIfAlreadyDeployed: true,
        args: ["WXRP", "WXRP", 8],
        log: true
    });
};
export default func;
func.tags = ['WXRP', 'tokens']
func.skip = async (hre) => {
    return !hre.network.tags["local"]
};