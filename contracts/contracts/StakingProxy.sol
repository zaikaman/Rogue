// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title StakingProxy
 * @notice ERC-20 staking contract for Rogue Yield Optimizer
 * @dev Accepts USDC deposits and delegates execution to YieldHarvester
 */
contract StakingProxy is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // Supported token
    IERC20 public immutable usdc;

    // YieldHarvester contract address
    address public yieldHarvester;

    // Position tracking
    struct Position {
        address user;
        address token;
        uint256 amount;
        uint256 depositedAt;
        uint8 riskProfile; // 0 = low, 1 = medium, 2 = high
        bool active;
    }

    mapping(bytes32 => Position) public positions;
    mapping(address => bytes32[]) public userPositions;

    // Fee balance tracking (ETH deposits to cover gas costs)
    mapping(address => uint256) public feeBalances;

    // Events
    event FeeDeposited(
        address indexed user,
        uint256 amount
    );

    event FeeWithdrawn(
        address indexed user,
        uint256 amount
    );

    event FeeDeducted(
        address indexed user,
        uint256 amount,
        bytes32 indexed positionId
    );

    event Staked(
        bytes32 indexed positionId,
        address indexed user,
        address indexed token,
        uint256 amount,
        uint8 riskProfile
    );

    event Unstaked(
        bytes32 indexed positionId,
        address indexed user,
        uint256 amount,
        uint256 fee
    );

    event YieldHarvesterUpdated(address indexed oldHarvester, address indexed newHarvester);

    event EmergencyWithdraw(
        bytes32 indexed positionId,
        address indexed user,
        uint256 amount
    );

    // Errors
    error InvalidToken();
    error InvalidAmount();
    error InvalidRiskProfile();
    error PositionNotFound();
    error PositionNotActive();
    error Unauthorized();
    error TransferFailed();
    error InsufficientFeeBalance();

    /**
     * @notice Initialize the StakingProxy contract
     * @param _usdc USDC token address
     * @param _yieldHarvester YieldHarvester contract address
     */
    constructor(
        address _usdc,
        address _yieldHarvester
    ) Ownable(msg.sender) {
        if (_usdc == address(0) || _yieldHarvester == address(0)) {
            revert InvalidToken();
        }

        usdc = IERC20(_usdc);
        yieldHarvester = _yieldHarvester;
    }

    /**
     * @notice Stake tokens to create a managed position
     * @param token Token address (must be USDC)
     * @param amount Amount to stake
     * @param riskProfile Risk profile (0=low, 1=medium, 2=high)
     * @return positionId Unique position identifier
     */
    function stake(
        address token,
        uint256 amount,
        uint8 riskProfile
    ) external nonReentrant returns (bytes32 positionId) {
        // Validate inputs
        if (token != address(usdc)) {
            revert InvalidToken();
        }
        if (amount == 0) {
            revert InvalidAmount();
        }
        if (riskProfile > 2) {
            revert InvalidRiskProfile();
        }

        // Generate position ID
        positionId = keccak256(
            abi.encodePacked(msg.sender, token, amount, block.timestamp, block.number)
        );

        // Transfer tokens from user
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        // Create position
        positions[positionId] = Position({
            user: msg.sender,
            token: token,
            amount: amount,
            depositedAt: block.timestamp,
            riskProfile: riskProfile,
            active: true
        });

        // Track user positions
        userPositions[msg.sender].push(positionId);

        // Approve YieldHarvester to manage funds
        IERC20(token).approve(yieldHarvester, amount);

        emit Staked(positionId, msg.sender, token, amount, riskProfile);

        return positionId;
    }

    /**
     * @notice Unstake tokens and withdraw funds
     * @param positionId Position identifier
     * @param unstakeFee Estimated gas cost in wei (deducted from user's ETH fee balance)
     * @return amount Amount withdrawn (full amount, no USDC fee)
     */
    function unstake(bytes32 positionId, uint256 unstakeFee) external nonReentrant returns (uint256 amount) {
        Position storage position = positions[positionId];

        // Validate position
        if (position.user == address(0)) {
            revert PositionNotFound();
        }
        if (position.user != msg.sender) {
            revert Unauthorized();
        }
        if (!position.active) {
            revert PositionNotActive();
        }

        // Deduct gas fee from user's ETH balance (not from USDC)
        if (unstakeFee > 0) {
            if (feeBalances[msg.sender] < unstakeFee) {
                revert InsufficientFeeBalance();
            }
            feeBalances[msg.sender] -= unstakeFee;
            
            // Transfer fee to owner (executor wallet)
            (bool success, ) = payable(owner()).call{value: unstakeFee}("");
            if (!success) {
                revert TransferFailed();
            }
            
            emit FeeDeducted(msg.sender, unstakeFee, positionId);
        }

        // Return full USDC amount (no USDC fee deduction)
        amount = position.amount;

        // Mark position as inactive
        position.active = false;

        // Transfer full tokens back to user
        IERC20(position.token).safeTransfer(position.user, amount);

        emit Unstaked(positionId, position.user, amount, unstakeFee);

        return amount;
    }

    /**
     * @notice Get position details
     * @param positionId Position identifier
     * @return user Position owner
     * @return token Staked token
     * @return stakedAmount Amount staked
     * @return depositedAt Deposit timestamp
     * @return riskProfile Risk profile
     * @return active Position status
     */
    function getPosition(bytes32 positionId)
        external
        view
        returns (
            address user,
            address token,
            uint256 stakedAmount,
            uint256 depositedAt,
            uint8 riskProfile,
            bool active
        )
    {
        Position memory position = positions[positionId];
        return (
            position.user,
            position.token,
            position.amount,
            position.depositedAt,
            position.riskProfile,
            position.active
        );
    }

    /**
     * @notice Get all position IDs for a user
     * @param user User address
     * @return Array of position IDs
     */
    function getUserPositions(address user) external view returns (bytes32[] memory) {
        return userPositions[user];
    }

    /**
     * @notice Deposit ETH to cover gas fees for agent transactions
     * @dev Users deposit ETH which will be deducted when agents execute transactions
     */
    function depositFeeBalance() external payable nonReentrant {
        if (msg.value == 0) {
            revert InvalidAmount();
        }

        feeBalances[msg.sender] += msg.value;

        emit FeeDeposited(msg.sender, msg.value);
    }

    /**
     * @notice Withdraw unused fee balance
     * @param amount Amount of ETH to withdraw
     */
    function withdrawFeeBalance(uint256 amount) external nonReentrant {
        if (amount == 0) {
            revert InvalidAmount();
        }
        if (feeBalances[msg.sender] < amount) {
            revert InsufficientFeeBalance();
        }

        feeBalances[msg.sender] -= amount;

        (bool success, ) = msg.sender.call{value: amount}("");
        if (!success) {
            revert TransferFailed();
        }

        emit FeeWithdrawn(msg.sender, amount);
    }

    /**
     * @notice Deduct fee from user's balance (called by YieldHarvester)
     * @param user User address
     * @param amount Fee amount to deduct
     * @param positionId Associated position ID
     */
    function deductFee(
        address user,
        uint256 amount,
        bytes32 positionId
    ) external nonReentrant {
        if (msg.sender != yieldHarvester) {
            revert Unauthorized();
        }
        if (feeBalances[user] < amount) {
            revert InsufficientFeeBalance();
        }

        feeBalances[user] -= amount;

        // Transfer fee to YieldHarvester owner (executor wallet)
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        if (!success) {
            revert TransferFailed();
        }

        emit FeeDeducted(user, amount, positionId);
    }

    /**
     * @notice Get user's current fee balance
     * @param user User address
     * @return Fee balance in wei
     */
    function getFeeBalance(address user) external view returns (uint256) {
        return feeBalances[user];
    }

    /**
     * @notice Update YieldHarvester contract address
     * @param newHarvester New YieldHarvester address
     */
    function updateYieldHarvester(address newHarvester) external onlyOwner {
        if (newHarvester == address(0)) {
            revert InvalidToken();
        }

        address oldHarvester = yieldHarvester;
        yieldHarvester = newHarvester;

        emit YieldHarvesterUpdated(oldHarvester, newHarvester);
    }

    /**
     * @notice Emergency withdraw function (only for contract owner)
     * @param positionId Position to withdraw
     * @dev Use only in case of critical bugs or migration
     */
    function emergencyWithdraw(bytes32 positionId) external onlyOwner nonReentrant {
        Position storage position = positions[positionId];

        if (position.user == address(0)) {
            revert PositionNotFound();
        }
        if (!position.active) {
            revert PositionNotActive();
        }

        uint256 amount = position.amount;
        position.active = false;

        // Transfer tokens back to user (no fee for emergency)
        IERC20(position.token).safeTransfer(position.user, amount);

        emit EmergencyWithdraw(positionId, position.user, amount);
    }

    /**
     * @notice Check if position is active
     * @param positionId Position identifier
     * @return True if position is active
     */
    function isPositionActive(bytes32 positionId) external view returns (bool) {
        return positions[positionId].active;
    }

    /**
     * @notice Get total staked amount for a token
     * @param token Token address
     * @return Total amount staked
     */
    function getTotalStaked(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }
}
