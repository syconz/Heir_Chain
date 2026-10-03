export const WILL_REGISTRY_ABI = [
  // Write
  "function createWill(uint8 triggerMode, uint256 requiredGuardians, address[] calldata guardians, tuple(address wallet, uint256 sharePercent)[] calldata beneficiaries, tuple(uint8 assetType, address tokenAddress, uint256 tokenIdOrAmount, address nftBeneficiary)[] calldata assets, string calldata ipfsCID) external",
  "function checkIn() external",
  "function revokeWill() external",
  "function updateIPFSMessage(string calldata _newCID) external",
  "function castGuardianVote(address _willOwner) external",
  "function setContracts(address _triggerVerifier, address _assetDistributor) external",
  // Read
  "function getWillStatus(address _owner) external view returns (bool exists, bool triggered, bool distributed, uint256 lastCheckInAt, uint256 disputeEndsAt, uint8 triggerMode, string memory ipfsMessageCID)",
  "function getBeneficiaries(address _owner) external view returns (tuple(address wallet, uint256 sharePercent)[])",
  "function getAssets(address _owner) external view returns (tuple(uint8 assetType, address tokenAddress, uint256 tokenIdOrAmount, address nftBeneficiary)[])",
  "function getGuardians(address _owner) external view returns (address[])",
  "function isInactive(address _owner) external view returns (bool)",
  "function wills(address) external view returns (address owner, uint8 triggerMode, uint256 lastCheckInAt, uint256 requiredGuardians, bool triggered, bool distributed, bool exists, uint256 disputeEndsAt, string ipfsMessageCID)",
  "function inactivityThreshold() external view returns (uint256)",
  "function disputeWindow() external view returns (uint256)",
  "function guardianVoted(address, address) external view returns (bool)",
  "function guardianVoteCount(address) external view returns (uint256)",
  // Events
  "event WillCreated(address indexed owner, uint8 triggerMode)",
  "event CheckedIn(address indexed owner, uint256 timestamp)",
  "event WillTriggered(address indexed owner, uint256 disputeEndsAt)",
  "event GuardianVoted(address indexed owner, address indexed guardian, uint256 voteCount)",
  "event WillRevoked(address indexed owner)",
  "event WillDistributed(address indexed owner)",
  "event IPFSMessageUpdated(address indexed owner, string cid)",
];

export const TRIGGER_VERIFIER_ABI = [
  "function registerForMonitoring(address willOwner) external",
  "function deregisterMonitoring(address willOwner) external",
  "function deregisterFromRegistry(address willOwner) external",
  "function manualTriggerForDemo(address _willOwner) external",
  "function oracleConfirmDeath(address _willOwner) external",
  "function checkUpkeep(bytes calldata) external view returns (bool upkeepNeeded, bytes memory performData)",
  "function getMonitoredCount() external view returns (uint256)",
  "function isMonitored(address) external view returns (bool)",
  "event DeadmanTriggered(address indexed willOwner)",
  "event MonitoringDeregistered(address indexed willOwner)",
  "event OracleConfirmed(address indexed willOwner)",
];

export const ASSET_DISTRIBUTOR_ABI = [
  "function distribute(address _willOwner) external",
  "event AssetsDistributed(address indexed willOwner, uint256 timestamp)",
  "event ERC20Sent(address indexed willOwner, address indexed token, address indexed to, uint256 amount)",
  "event ERC721Sent(address indexed willOwner, address indexed token, uint256 tokenId, address indexed to)",
];

export const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
  "function symbol() external view returns (string)",
  "function name() external view returns (string)",
];

export const ERC721_ABI = [
  "function approve(address to, uint256 tokenId) external",
  "function getApproved(uint256 tokenId) external view returns (address)",
  "function ownerOf(uint256 tokenId) external view returns (address)",
  "function name() external view returns (string)",
  "function symbol() external view returns (string)",
];
