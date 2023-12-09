import { Wallet } from "ethers";
import { NetworksUserConfig } from "hardhat/types";
import { env } from "process";

const defaultNamedAccounts = {
  deployer: {
    hardhat: 0,
		localhost: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    default: '0x857851EE6E398651Cb7C72462cc7Ce2A94d8f1C6',
  },
  owner: {
    hardhat: 1,
		localhost: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    default: '0x857851EE6E398651Cb7C72462cc7Ce2A94d8f1C6',
  },
  verifier: {
    hardhat: 5,
    default: '0x607c8c4a4098ba42774f7350e75eb48e2805caeb',
    bsc_production: '0x26B191c658e6D4220c057928FF65E6286436C6cC',
    eth_production: '0x26B191c658e6D4220c057928FF65E6286436C6cC',
  },
}

// Overrides default namedAccounts.deployer with keys from .env.
// If namedAccounts.owner is not specified, it is overridden by namedAccounts.deployer.
export function generateNamedAccounts(networks: NetworksUserConfig) {
  let namedAccounts = defaultNamedAccounts
  const environments = ["testing", "staging", "production"]
  for (const network in networks) {
    for (const environment of environments) {
      if (network.includes(environment)) {
        const deployerPrivateKey = env[`DEPLOYER_${environment.toUpperCase()}`]
        if (deployerPrivateKey) {
          const deployerAddress = new Wallet(deployerPrivateKey).address
          namedAccounts.deployer[network] = deployerAddress
          if (namedAccounts.owner[network] === undefined) namedAccounts.owner[network] = deployerAddress
        }
      }
    }
  }
  return namedAccounts
}
