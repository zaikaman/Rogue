// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title YieldHarvester
 * @notice Executor contract for Rogue Yield Optimizer
 * @dev Handles deposits, compounds, and hedges across DeFi protocols
 */
contract YieldHarvester is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // StakingProxy contract
    address public stakingProxy;

    // Protocol integration addresses (Aave, Frax, etc.)
    mapping(string => address) public protocols;

    // Execution tracking
    struct ExecutionRecord {
        bytes32 positionId;
        string action; // "deposit", "compound", "withdraw", "hedge"
        uint256 amount;
        uint256 executedAt;
        address executor;
    }

    ExecutionRecord[] public executions;
    mapping(bytes32 => uint256[]) public positionExecutions;

    // Events
    event ProtocolAdded(string indexed name, address indexed protocol);
    event ProtocolRemoved(string indexed name);
    
    event Deposited(
        bytes32 indexed positionId,
        string indexed protocol,
        uint256 amount,
        address indexed executor
    );

    event Compounded(
        bytes32 indexed positionId,
        string indexed protocol,
        uint256 yieldAmount,
        address indexed executor
    );

    event Withdrawn(
        bytes32 indexed positionId,
        string indexed protocol,
        uint256 amount,
        address indexed executor
    );

    event Hedged(
        bytes32 indexed positionId,
        uint256 amount,
        address indexed executor
    );

    event RewardsClaimed(
        bytes32 indexed positionId,
        address indexed user,
        uint256 amount
    );

    // Errors
    error InvalidAddress();
    error InvalidAmount();
    error ProtocolNotFound();
    error UnauthorizedExecutor();
    error ExecutionFailed();

    // Modifiers
    modifier onlyStakingProxy() {
        if (msg.sender != stakingProxy) {
            revert UnauthorizedExecutor();
        }
        _;
    }

    modifier onlyAuthorizedExecutor() {
        if (msg.sender != stakingProxy && msg.sender != owner()) {
            revert UnauthorizedExecutor();
        }
        _;
    }

    /**
     * @notice Initialize YieldHarvester
     * @param _stakingProxy StakingProxy contract address
     */
    constructor(address _stakingProxy) Ownable(msg.sender) {
        if (_stakingProxy == address(0)) {
            revert InvalidAddress();
        }
        stakingProxy = _stakingProxy;
    }

    /**
     * @notice Add protocol integration
     * @param name Protocol name (e.g., "Aave", "Frax")
     * @param protocol Protocol contract address
     */
    function addProtocol(string memory name, address protocol) external onlyOwner {
        if (protocol == address(0)) {
            revert InvalidAddress();
        }
        protocols[name] = protocol;
        emit ProtocolAdded(name, protocol);
    }

    /**
     * @notice Remove protocol integration
     * @param name Protocol name
     */
    function removeProtocol(string memory name) external onlyOwner {
        delete protocols[name];
        emit ProtocolRemoved(name);
    }

    /**
     * @notice Deposit funds to a DeFi protocol
     * @param positionId Position identifier
     * @param protocol Protocol name
     * @param token Token address
     * @param amount Amount to deposit
     */
    function depositToProtocol(
        bytes32 positionId,
        string memory protocol,
        address token,
        uint256 amount
    ) external onlyAuthorizedExecutor whenNotPaused nonReentrant {
        if (amount == 0) {
            revert InvalidAmount();
        }
        if (protocols[protocol] == address(0)) {
            revert ProtocolNotFound();
        }

        // Transfer tokens from StakingProxy
        IERC20(token).safeTransferFrom(stakingProxy, address(this), amount);

        // Approve protocol
        IERC20(token).approve(protocols[protocol], amount);

        // Record execution
        uint256 executionId = executions.length;
        executions.push(ExecutionRecord({
            positionId: positionId,
            action: "deposit",
            amount: amount,
            executedAt: block.timestamp,
            executor: msg.sender
        }));
        positionExecutions[positionId].push(executionId);

        emit Deposited(positionId, protocol, amount, msg.sender);
    }

    /**
     * @notice Compound accumulated yield
     * @param positionId Position identifier
     * @param protocol Protocol name
     * @param yieldAmount Yield amount to compound
     */
    function compoundYield(
        bytes32 positionId,
        string memory protocol,
        uint256 yieldAmount
    ) external onlyAuthorizedExecutor whenNotPaused nonReentrant {
        if (yieldAmount == 0) {
            revert InvalidAmount();
        }
        if (protocols[protocol] == address(0)) {
            revert ProtocolNotFound();
        }

        // Record execution
        uint256 executionId = executions.length;
        executions.push(ExecutionRecord({
            positionId: positionId,
            action: "compound",
            amount: yieldAmount,
            executedAt: block.timestamp,
            executor: msg.sender
        }));
        positionExecutions[positionId].push(executionId);

        emit Compounded(positionId, protocol, yieldAmount, msg.sender);
    }

    /**
     * @notice Withdraw funds from protocol
     * @param positionId Position identifier
     * @param protocol Protocol name
     * @param amount Amount to withdraw
     */
    function withdrawFromProtocol(
        bytes32 positionId,
        string memory protocol,
        uint256 amount
    ) external onlyAuthorizedExecutor whenNotPaused nonReentrant {
        if (amount == 0) {
            revert InvalidAmount();
        }
        if (protocols[protocol] == address(0)) {
            revert ProtocolNotFound();
        }

        // Record execution
        uint256 executionId = executions.length;
        executions.push(ExecutionRecord({
            positionId: positionId,
            action: "withdraw",
            amount: amount,
            executedAt: block.timestamp,
            executor: msg.sender
        }));
        positionExecutions[positionId].push(executionId);

        emit Withdrawn(positionId, protocol, amount, msg.sender);
    }

    /**
     * @notice Execute hedge strategy
     * @param positionId Position identifier
     * @param amount Amount to hedge
     */
    function executeHedge(
        bytes32 positionId,
        uint256 amount
    ) external onlyAuthorizedExecutor whenNotPaused nonReentrant {
        if (amount == 0) {
            revert InvalidAmount();
        }

        // Record execution
        uint256 executionId = executions.length;
        executions.push(ExecutionRecord({
            positionId: positionId,
            action: "hedge",
            amount: amount,
            executedAt: block.timestamp,
            executor: msg.sender
        }));
        positionExecutions[positionId].push(executionId);

        emit Hedged(positionId, amount, msg.sender);
    }

    /**
     * @notice Claim rewards (ATP tokens)
     * @param positionId Position identifier
     * @param user User address
     * @param amount Reward amount
     */
    function claimRewards(
        bytes32 positionId,
        address user,
        uint256 amount
    ) external onlyAuthorizedExecutor nonReentrant {
        if (user == address(0)) {
            revert InvalidAddress();
        }
        if (amount == 0) {
            revert InvalidAmount();
        }

        // In production, this would transfer ATP tokens
        // For now, just emit event
        emit RewardsClaimed(positionId, user, amount);
    }

    /**
     * @notice Get execution history for a position
     * @param positionId Position identifier
     * @return Array of execution IDs
     */
    function getPositionExecutions(bytes32 positionId) external view returns (uint256[] memory) {
        return positionExecutions[positionId];
    }

    /**
     * @notice Get execution details
     * @param executionId Execution identifier
     * @return positionId Position ID
     * @return action Action type
     * @return amount Amount
     * @return executedAt Timestamp
     * @return executor Executor address
     */
    function getExecution(uint256 executionId)
        external
        view
        returns (
            bytes32 positionId,
            string memory action,
            uint256 amount,
            uint256 executedAt,
            address executor
        )
    {
        if (executionId >= executions.length) {
            revert ExecutionFailed();
        }

        ExecutionRecord memory record = executions[executionId];
        return (
            record.positionId,
            record.action,
            record.amount,
            record.executedAt,
            record.executor
        );
    }

    /**
     * @notice Update StakingProxy address
     * @param newProxy New StakingProxy address
     */
    function updateStakingProxy(address newProxy) external onlyOwner {
        if (newProxy == address(0)) {
            revert InvalidAddress();
        }
        stakingProxy = newProxy;
    }

    /**
     * @notice Pause contract (emergency)
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Emergency token recovery
     * @param token Token address
     * @param amount Amount to recover
     */
    function emergencyRecoverToken(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }
}
