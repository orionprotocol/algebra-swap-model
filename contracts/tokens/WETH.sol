// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.7.6;

import "@openzeppelin/contracts-solc-0.7-2/token/ERC20/ERC20.sol";
import "./Mintable.sol";

contract WETH is Mintable {
	event Deposit(address indexed dst, uint wad);
	event Withdrawal(address indexed src, uint wad);

	constructor() Mintable(18) ERC20("Wrapped Ether", "WETH") {}

	receive() external payable {
		deposit();
	}

	function deposit() public payable {
		_mint(msg.sender, msg.value);
		emit Deposit(msg.sender, msg.value);
	}

	function transfer(address recipient, uint256 amount) public virtual override returns (bool) {
		super._transfer(_msgSender(), recipient, amount);
		return true;
	}

	function withdraw(uint wad) public {
		require(balanceOf(msg.sender) >= wad);
		_burn(msg.sender, wad);
		(bool success, ) = msg.sender.call{value: wad}("");
		require(success, "Not enough ETH");
		emit Withdrawal(msg.sender, wad);
	}
}
