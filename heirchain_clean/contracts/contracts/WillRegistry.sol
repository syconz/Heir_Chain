// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title WillRegistry — stores on-chain wills for HeirChain
/// @notice V1: ERC-20 + ERC-721 only. No ETH escrow. No vesting.
contract WillRegistry is ReentrancyGuard, Pausable, Ownable {

    // ─────────────── Enums ───────────────
    enum TriggerMode { DEADMAN, GUARDIAN, ORACLE }
    enum AssetType   { ERC20, ERC721 }          // ETH removed in V1

    // ─────────────── Structs ───────────────
    struct Beneficiary {
        address wallet;
        uint256 sharePercent; // out of 100; used for ERC-20 splits only
    }

    /// @dev For ERC721: nftBeneficiary is the explicit heir (sharePercent ignored)
    ///      For ERC20:  nftBeneficiary = address(0); sharePercent applied
    struct AssetEntry {
        AssetType assetType;
        address   tokenAddress;
        uint256   tokenIdOrAmount;
        address   nftBeneficiary; // required when assetType == ERC721
    }

    struct Will {
        address       owner;
        TriggerMode   triggerMode;
        uint256       lastCheckInAt;     // block.timestamp at creation / check-in
        uint256       requiredGuardians; // M in M-of-N (guardian mode only)
        bool          triggered;
        bool          distributed;
        bool          exists;
        uint256       disputeEndsAt;     // 0 until trigger fires
        string        ipfsMessageCID;
    }

    // ─────────────── State ───────────────
    mapping(address => Will)            public wills;
    mapping(address => Beneficiary[])   public beneficiariesOf;
    mapping(address => AssetEntry[])    public assetsOf;
    mapping(address => address[])       public guardiansOf;
    mapping(address => mapping(address => bool)) public guardianVoted;
    mapping(address => uint256)         public guardianVoteCount;

    address public triggerVerifier;
    address public assetDistributor;

    uint256 public immutable inactivityThreshold; // seconds
    uint256 public immutable disputeWindow;        // seconds

    uint256 public constant MAX_BENEFICIARIES = 10;
    uint256 public constant MAX_ASSETS        = 20;

    // ─────────────── Events ───────────────
    event WillCreated(address indexed owner, TriggerMode triggerMode);
    event CheckedIn(address indexed owner, uint256 timestamp);
    event GuardianVoted(address indexed owner, address indexed guardian, uint256 voteCount);
    event WillTriggered(address indexed owner, uint256 disputeEndsAt);
    event WillRevoked(address indexed owner);
    event WillDistributed(address indexed owner);

    // ─────────────── Modifiers ───────────────
    modifier willExists(address _owner) {
        require(wills[_owner].exists, "No will found");
        _;
    }

    modifier onlyAuthorized() {
        require(
            msg.sender == triggerVerifier || msg.sender == assetDistributor,
            "Not authorized contract"
        );
        _;
    }

    // ─────────────── Constructor ───────────────
    /// @param _inactivityThreshold seconds of inactivity before deadman fires (180 for demo, 7776000 for prod)
    /// @param _disputeWindow       seconds of dispute window after trigger (300 for demo, 2592000 for prod)
    constructor(uint256 _inactivityThreshold, uint256 _disputeWindow) Ownable(msg.sender) {
        require(_inactivityThreshold > 0, "Invalid inactivity threshold");
        require(_disputeWindow > 0, "Invalid dispute window");
        inactivityThreshold = _inactivityThreshold;
        disputeWindow       = _disputeWindow;
    }

    // ─────────────── Setup ───────────────
    function setContracts(address _triggerVerifier, address _assetDistributor) external onlyOwner {
        require(triggerVerifier == address(0), "Already set");
        require(_triggerVerifier != address(0) && _assetDistributor != address(0), "Zero address");
        triggerVerifier  = _triggerVerifier;
        assetDistributor = _assetDistributor;
    }

    // ─────────────── Will Management ───────────────
    function createWill(
        TriggerMode         _triggerMode,
        uint256             _requiredGuardians,
        address[]  calldata _guardians,
        Beneficiary[] calldata _beneficiaries,
        AssetEntry[]  calldata _assets,
        string     calldata _ipfsCID
    ) external whenNotPaused nonReentrant {
        require(!wills[msg.sender].exists, "Will already exists");
        require(_beneficiaries.length > 0 && _beneficiaries.length <= MAX_BENEFICIARIES, "1-10 beneficiaries");
        require(_assets.length <= MAX_ASSETS, "Max 20 assets");

        if (_triggerMode == TriggerMode.GUARDIAN) {
            require(_guardians.length > 0, "Need guardians");
            require(_requiredGuardians > 0 && _requiredGuardians <= _guardians.length, "Invalid M-of-N");
        }
        if (_triggerMode == TriggerMode.ORACLE) {
            revert("Oracle mode: use DEADMAN or GUARDIAN in V1");
        }

        // Validate beneficiary shares sum to 100
        uint256 totalShares;
        for (uint i = 0; i < _beneficiaries.length; i++) {
            require(_beneficiaries[i].wallet != address(0), "Zero beneficiary address");
            totalShares += _beneficiaries[i].sharePercent;
        }
        require(totalShares == 100, "Shares must sum to 100");

        // Validate assets
        for (uint i = 0; i < _assets.length; i++) {
            require(_assets[i].tokenAddress != address(0), "Zero token address");
            if (_assets[i].assetType == AssetType.ERC721) {
                require(_assets[i].nftBeneficiary != address(0), "NFT needs explicit beneficiary");
            }
        }

        // Store will
        wills[msg.sender] = Will({
            owner:            msg.sender,
            triggerMode:      _triggerMode,
            lastCheckInAt:    block.timestamp,
            requiredGuardians:_requiredGuardians,
            triggered:        false,
            distributed:      false,
            exists:           true,
            disputeEndsAt:    0,
            ipfsMessageCID:   _ipfsCID
        });

        for (uint i = 0; i < _beneficiaries.length; i++) beneficiariesOf[msg.sender].push(_beneficiaries[i]);
        for (uint i = 0; i < _assets.length; i++)       assetsOf[msg.sender].push(_assets[i]);
        for (uint i = 0; i < _guardians.length; i++) {
            require(_guardians[i] != address(0), "Zero guardian address");
            guardiansOf[msg.sender].push(_guardians[i]);
        }

        emit WillCreated(msg.sender, _triggerMode);
    }

    function checkIn() external willExists(msg.sender) {
        require(!wills[msg.sender].triggered, "Will already triggered");
        wills[msg.sender].lastCheckInAt = block.timestamp;
        emit CheckedIn(msg.sender, block.timestamp);
    }

    function revokeWill() external willExists(msg.sender) {
        require(!wills[msg.sender].distributed, "Already distributed");
        delete wills[msg.sender];
        delete beneficiariesOf[msg.sender];
        delete assetsOf[msg.sender];
        delete guardiansOf[msg.sender];
        emit WillRevoked(msg.sender);
    }

    function updateIPFSMessage(string calldata _newCID) external willExists(msg.sender) {
        require(!wills[msg.sender].triggered, "Already triggered");
        wills[msg.sender].ipfsMessageCID = _newCID;
    }

    // ─────────────── Guardian Voting ───────────────
    function castGuardianVote(address _willOwner) external willExists(_willOwner) {
        Will storage w = wills[_willOwner];
        require(!w.triggered, "Already triggered");
        require(w.triggerMode == TriggerMode.GUARDIAN, "Not guardian mode");
        require(!guardianVoted[_willOwner][msg.sender], "Already voted");

        bool isGuardian;
        address[] storage gs = guardiansOf[_willOwner];
        for (uint i = 0; i < gs.length; i++) {
            if (gs[i] == msg.sender) { isGuardian = true; break; }
        }
        require(isGuardian, "Not a registered guardian");

        guardianVoted[_willOwner][msg.sender] = true;
        guardianVoteCount[_willOwner]++;
        emit GuardianVoted(_willOwner, msg.sender, guardianVoteCount[_willOwner]);

        if (guardianVoteCount[_willOwner] >= w.requiredGuardians) {
            _triggerWill(_willOwner);
        }
    }

    // ─────────────── Trigger ───────────────
    function triggerWill(address _willOwner) external onlyAuthorized willExists(_willOwner) {
        _triggerWill(_willOwner);
    }

    function _triggerWill(address _willOwner) internal {
        Will storage w = wills[_willOwner];
        require(!w.triggered, "Already triggered");
        w.triggered   = true;
        w.disputeEndsAt = block.timestamp + disputeWindow;
        emit WillTriggered(_willOwner, w.disputeEndsAt);
    }

    function markDistributed(address _willOwner) external onlyAuthorized {
        wills[_willOwner].distributed = true;
        emit WillDistributed(_willOwner);
    }

    // ─────────────── View ───────────────
    function isInactive(address _owner) external view returns (bool) {
        Will storage w = wills[_owner];
        if (!w.exists || w.triggered || w.triggerMode != TriggerMode.DEADMAN) return false;
        return block.timestamp > w.lastCheckInAt + inactivityThreshold;
    }

    function getBeneficiaries(address _owner) external view returns (Beneficiary[] memory) {
        return beneficiariesOf[_owner];
    }

    function getAssets(address _owner) external view returns (AssetEntry[] memory) {
        return assetsOf[_owner];
    }

    function getGuardians(address _owner) external view returns (address[] memory) {
        return guardiansOf[_owner];
    }

    function getWillStatus(address _owner) external view returns (
        bool exists, bool triggered, bool distributed,
        uint256 lastCheckInAt, uint256 disputeEndsAt,
        TriggerMode triggerMode, string memory ipfsMessageCID
    ) {
        Will storage w = wills[_owner];
        return (w.exists, w.triggered, w.distributed, w.lastCheckInAt, w.disputeEndsAt, w.triggerMode, w.ipfsMessageCID);
    }

    // ─────────────── Admin ───────────────
    function pause()   external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
}
