// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract MockKRWStable is ERC20, ERC20Burnable, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");

    event TokenMinted(address indexed to, uint256 amount);
    event TokenBurned(address indexed from, uint256 amount);

    constructor(address initialAdmin, uint256 initialSupply) ERC20("Mock Korean Won", "MockKRW") {
        require(initialAdmin != address(0), "Admin address cannot be zero");
        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
        _grantRole(MINTER_ROLE, initialAdmin);
        _grantRole(BURNER_ROLE, initialAdmin);

        if (initialSupply > 0) {
            _mint(initialAdmin, initialSupply);
            emit TokenMinted(initialAdmin, initialSupply);
        }
    }

    function decimals() public pure override returns (uint8) {
        return 18;
    }

    /**
     * @notice Mint new MockKRW tokens. Restricted to MINTER_ROLE.
     */
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        require(to != address(0), "Cannot mint to zero address");
        _mint(to, amount);
        emit TokenMinted(to, amount);
    }

    /**
     * @notice Burn MockKRW tokens from an address. Restricted to BURNER_ROLE.
     */
    function burnFromAddress(address from, uint256 amount) external onlyRole(BURNER_ROLE) {
        _burn(from, amount);
        emit TokenBurned(from, amount);
    }
}
