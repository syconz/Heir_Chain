// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./WillRegistry.sol";

/// @title AssetDistributor — executes inheritance transfers for HeirChain
/// @notice V1: ERC-20 + ERC-721 only. No ETH escrow. No vesting.
///         Loops bounded by WillRegistry caps (max 10 beneficiaries, max 20 assets).
contract AssetDistributor is ReentrancyGuard, Pausable, Ownable {
    using SafeERC20 for IERC20;

    WillRegistry public willRegistry;

    event AssetsDistributed(address indexed willOwner, uint256 timestamp);
    event ERC20Sent(address indexed willOwner, address indexed token, address indexed to, uint256 amount);
    event ERC721Sent(address indexed willOwner, address indexed token, uint256 tokenId, address indexed to);

    constructor(address _willRegistry) Ownable(msg.sender) {
        require(_willRegistry != address(0), "Zero address");
        willRegistry = WillRegistry(_willRegistry);
    }

    /// @notice Anyone can call distribute once the dispute window has passed.
    ///         Owner must have pre-approved this contract via ERC20.approve / ERC721.approve.
    function distribute(address _willOwner)
        external
        nonReentrant
        whenNotPaused
    {
        (
            bool exists,
            bool triggered,
            bool distributed,
            ,
            uint256 disputeEndsAt,
            ,

        ) = willRegistry.getWillStatus(_willOwner);

        require(exists,      "Will does not exist");
        require(triggered,   "Will not triggered yet");
        require(!distributed,"Already distributed");
        require(block.timestamp >= disputeEndsAt, "Dispute window still active");

        WillRegistry.Beneficiary[] memory beneficiaries = willRegistry.getBeneficiaries(_willOwner);
        WillRegistry.AssetEntry[]  memory assets        = willRegistry.getAssets(_willOwner);

        // Bounded by MAX_ASSETS (20) and MAX_BENEFICIARIES (10) enforced at will creation
        for (uint i = 0; i < assets.length; i++) {
            WillRegistry.AssetEntry memory asset = assets[i];

            if (asset.assetType == WillRegistry.AssetType.ERC20) {
                _distributeERC20(_willOwner, beneficiaries, asset.tokenAddress, asset.tokenIdOrAmount);
            } else {
                // ERC721 — explicit beneficiary, no pro-rata split
                _distributeERC721(_willOwner, asset.tokenAddress, asset.tokenIdOrAmount, asset.nftBeneficiary);
            }
        }

        willRegistry.markDistributed(_willOwner);
        emit AssetsDistributed(_willOwner, block.timestamp);
    }

    // ─────────────── Internal helpers ───────────────

    function _distributeERC20(
        address _willOwner,
        WillRegistry.Beneficiary[] memory _beneficiaries,
        address _tokenAddress,
        uint256 _totalAmount
    ) internal {
        IERC20 token = IERC20(_tokenAddress);
        // Bounded by MAX_BENEFICIARIES (10)
        uint256 distributed;
        for (uint i = 0; i < _beneficiaries.length; i++) {
            // Give the final beneficiary the remainder so integer division
            // cannot strand token dust in the owner's wallet.
            uint256 share = i == _beneficiaries.length - 1
                ? _totalAmount - distributed
                : (_totalAmount * _beneficiaries[i].sharePercent) / 100;
            if (share == 0) continue;
            token.safeTransferFrom(_willOwner, _beneficiaries[i].wallet, share);
            distributed += share;
            emit ERC20Sent(_willOwner, _tokenAddress, _beneficiaries[i].wallet, share);
        }
    }

    /// @notice Distributes an ERC-721 NFT to its explicit beneficiary.
    /// @dev Uses `safeTransferFrom` which invokes `onERC721Received` on recipient contract.
    ///      Protected against reentrancy attacks by `nonReentrant` modifier on the outer `distribute()` entrypoint.
    function _distributeERC721(
        address _willOwner,
        address _tokenAddress,
        uint256 _tokenId,
        address _nftBeneficiary
    ) internal {
        require(_nftBeneficiary != address(0), "NFT beneficiary is zero");
        IERC721(_tokenAddress).safeTransferFrom(_willOwner, _nftBeneficiary, _tokenId);
        emit ERC721Sent(_willOwner, _tokenAddress, _tokenId, _nftBeneficiary);
    }

    // ─────────────── Admin ───────────────
    function pause()   external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
}
