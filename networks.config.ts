import { node_url} from './orion-tools/utils/network';
import { env } from "process";

export const defaultNetworks = {
	hardhat: {
		initialBaseFeePerGas: 0, // to fix : https://github.com/sc-forks/solidity-coverage/issues/652, see https://github.com/sc-forks/solidity-coverage/issues/652#issuecomment-896330136
		allowUnlimitedContractSize: true,
		tags: ['local'],
	},
	localhost: {
		url: "http://127.0.0.1:8545/",
		tags: ['local'],
	},
	bsc_testing: {
		tags: ['testnet'],
		url: node_url('bsc_testnet'),
		verify: {
			etherscan: {
				apiKey: env.BSCSCAN_API_KEY,
			},
		},
	},
	bsc_staging: {
		tags: ['mainnet'],
		url: node_url('bsc_mainnet'),
		verify: {
			etherscan: {
				apiKey: env.BSCSCAN_API_KEY,
			},
		},
	},
	bsc_production: {
		tags: ['mainnet'],
		url: node_url('bsc_mainnet'),
		verify: {
			etherscan: {
				apiKey: env.BSCSCAN_API_KEY,
			},
		},
	},
	goerli_testing: {
		tags: ['testnet'],
		verify: {
			etherscan: {
				apiKey: env.ETHSCAN_API_KEY,
			},
		},
	},
	eth_staging: {
		tags: ['mainnet'],
		url: node_url('eth'),
		verify: {
			etherscan: {
				apiKey: env.ETHSCAN_API_KEY,
			},
		},
	},
	eth_production: {
		tags: ['mainnet'],
		url: node_url('eth'),
		verify: {
			etherscan: {
				apiKey: env.ETHSCAN_API_KEY,
			},
		},
	},
	polygon_testing: {
		tags: ['testnet'],
		url: node_url('polygon_testnet'),
		verify: {
			etherscan: {
				apiKey: env.POLYGONSCAN_API_KEY,
			},
		},
	},
	polygon_production: {
		tags: ['mainnet'],
		url: node_url('polygon_mainnet'),
		verify: {
			etherscan: {
				apiKey: env.POLYGONSCAN_API_KEY,
			},
		},
	},
	ftm_testing: {
		tags: ['testnet'],
		url: node_url('ftm_testnet'),
		verify: {
			etherscan: {
				apiKey: env.FTMSCAN_API_KEY,
			},
		},
	},
	ftm_production: {
		tags: ['mainnet'],
		url: node_url('ftm_mainnet'),
		verify: {
			etherscan: {
				apiKey: env.FTMSCAN_API_KEY,
			},
		},
	},
	okc_testing: {
		tags: ['testnet'],
		url: node_url('okc_testnet'),
		verify: {
			etherscan: {
				apiKey: env.OKCSCAN_API_KEY,
				apiUrl: 'https://www.oklink.com/',
			},
		},
	},
	okc_production: {
		tags: ['mainnet'],
		url: node_url('okc_mainnet'),
		verify: {
			etherscan: {
				apiKey: env.OKCSCAN_API_KEY,
				apiUrl: 'https://www.oklink.com/',
			},
		},
	},
};
