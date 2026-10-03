// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AutomationCompatibleInterface} from "@chainlink/contracts/src/v0.8/automation/AutomationCompatible.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./WillRegistry.sol";

/// @title TriggerVerifier — Chainlink Automation (deadman) + Oracle stub for HeirChain
/// @notice V1: Deadman + Guardian fully implemented. Oracle = ORACLE_ROLE stub only.
contract TriggerVerifier is AutomationCompatibleInterface, Ownable {

    WillRegistry public willRegistry;

    // ─────────────── Monitored owners (deadman) ───────────────
    address[] private monitoredOwners;
    mapping(address => bool) public isMonitored;

    // ─────────────── Oracle stub ───────────────
    // V1: deployer holds ORACLE_ROLE and calls oracleConfirmDeath manually for demo.
    // V2: replace with FunctionsClient integration.
    mapping(address => bool) public hasOracleRole;

    // ─────────────── Events ───────────────
    event RegisteredForMonitoring(address indexed willOwner);
    event DeadmanTriggered(address indexed willOwner);
    event MonitoringDeregistered(address indexed willOwner);
    event OracleConfirmed(address indexed willOwner);
    event OracleRoleGranted(address indexed account);
    event OracleRoleRevoked(address indexed account);

    // ─────────────── Constructor ───────────────
    constructor(address _willRegistry) Ownable(msg.sender) {
        require(_willRegistry != address(0), "Zero address");
        willRegistry = WillRegistry(_willRegistry);
        // Deployer holds oracle role for demo
        hasOracleRole[msg.sender] = true;
        emit OracleRoleGranted(msg.sender);
    }

    // ─────────────── Oracle Role ───────────────
    function grantOracleRole(address _account) external onlyOwner {
        hasOracleRole[_account] = true;
        emit OracleRoleGranted(_account);
    }

    function revokeOracleRole(address _account) external onlyOwner {
        hasOracleRole[_account] = false;
        emit OracleRoleRevoked(_account);
    }

    modifier onlyOracle() {
        require(hasOracleRole[msg.sender], "Not oracle");
        _;
    }

    // ─────────────── Oracle Stub ───────────────
    /// @notice V1 stub: deployer calls this to simulate oracle death confirmation.
    ///         V2: this will be called from FunctionsClient.fulfillRequest callback.
    /// @dev    V2 note: send `willOwnerAddress` to Functions JS source → hits mock/registry API
    ///         → returns uint256 0 (alive) or 1 (deceased) → fulfillRequest calls this.
    function oracleConfirmDeath(address _willOwner) external onlyOracle {
        willRegistry.triggerWill(_willOwner);
        _deregisterMonitoring(_willOwner);
        emit OracleConfirmed(_willOwner);
    }

    // ─────────────── Deadman — Monitoring Registration ───────────────
    function registerForMonitoring(address _willOwner) external {
        require(
            msg.sender == _willOwner || msg.sender == owner(),
            "Not authorized"
        );
        (
            bool exists,
            ,
            ,
            ,
            ,
            WillRegistry.TriggerMode triggerMode,
        ) = willRegistry.getWillStatus(_willOwner);
        require(exists && triggerMode == WillRegistry.TriggerMode.DEADMAN, "Deadman will required");
        if (!isMonitored[_willOwner]) {
            require(monitoredOwners.length < 200, "Max monitored reached");
            monitoredOwners.push(_willOwner);
            isMonitored[_willOwner] = true;
            emit RegisteredForMonitoring(_willOwner);
        }
    }

    function deregisterMonitoring(address _willOwner) external {
        require(msg.sender == _willOwner || msg.sender == owner(), "Not authorized");
        _deregisterMonitoring(_willOwner);
    }

    /// @notice Called by WillRegistry when an owner revokes an active will.
    /// This prevents revoked wills from consuming one of the finite upkeep slots.
    function deregisterFromRegistry(address _willOwner) external {
        require(msg.sender == address(willRegistry), "Only registry");
        _deregisterMonitoring(_willOwner);
    }

    function _deregisterMonitoring(address _willOwner) internal {
        if (!isMonitored[_willOwner]) return;
        for (uint i = 0; i < monitoredOwners.length; i++) {
            if (monitoredOwners[i] == _willOwner) {
                monitoredOwners[i] = monitoredOwners[monitoredOwners.length - 1];
                monitoredOwners.pop();
                break;
            }
        }
        isMonitored[_willOwner] = false;
        emit MonitoringDeregistered(_willOwner);
    }

    // ─────────────── Chainlink Automation ───────────────
    /// @dev Chainlink node calls this every block to check if upkeep is needed.
    function checkUpkeep(bytes calldata)
        external view override
        returns (bool upkeepNeeded, bytes memory performData)
    {
        for (uint i = 0; i < monitoredOwners.length; i++) {
            address _owner = monitoredOwners[i];
            if (isMonitored[_owner] && willRegistry.isInactive(_owner)) {
                return (true, abi.encode(_owner));
            }
        }
        return (false, "");
    }

    /// @dev Chainlink node calls this when checkUpkeep returns true.
    function performUpkeep(bytes calldata performData) external override {
        address willOwner = abi.decode(performData, (address));
        require(isMonitored[willOwner], "Not monitored -- recheck");
        require(willRegistry.isInactive(willOwner), "Not inactive -- recheck");
        willRegistry.triggerWill(willOwner);
        _deregisterMonitoring(willOwner);
        emit DeadmanTriggered(willOwner);
    }

    // ─────────────── Manual Demo Helper ───────────────
    /// @notice If Chainlink Automation tick is slow on Amoy, call this from
    ///         the deployer wallet for the demo — same outcome, no scrambling on stage.
    function manualTriggerForDemo(address _willOwner) external onlyOwner {
        willRegistry.triggerWill(_willOwner);
        _deregisterMonitoring(_willOwner);
        emit DeadmanTriggered(_willOwner);
    }

    // ─────────────── View ───────────────
    function getMonitoredCount() external view returns (uint256) {
        return monitoredOwners.length;
    }

    function getMonitoredOwners() external view returns (address[] memory) {
        return monitoredOwners;
    }
}
