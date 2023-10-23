//SPDX-License-Identifier: MIT

pragma solidity 0.7.6;
import "@openzeppelin/contracts-solc-0.7-2/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts-solc-0.7-2/access/AccessControl.sol";

abstract contract Mintable is ERC20, AccessControl {
	uint8 immutable _decimals;
	bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

	function mint(address to, uint256 amount) public {
		require(hasRole(MINTER_ROLE, msg.sender), "Caller is not a minter");
		super._mint(to, amount);
	}

	constructor(uint8 decimals_) {
		_decimals = decimals_;
		_setupRole(MINTER_ROLE, msg.sender);
	}

	function isMinter(address user) public view returns (bool) {
		return hasRole(MINTER_ROLE, user);
	}

	function addMinter(address newMinter) public {
		require(hasRole(MINTER_ROLE, msg.sender), "Caller is not a minter");
		_setupRole(MINTER_ROLE, newMinter);
	}

	function decimals() public view override returns (uint8) {
		return _decimals;
	}
}
