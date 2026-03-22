import React, { useState } from 'react';
import styles from './TradeBox.module.css';
import { MarketData, getUserMarketStatus, UserMarketStatus } from '../../../data/markets';
import { claimRewards, placeBet, approveUsdlUnlimited, dripUsdl } from '../../../lib/onchain/writes';
import { useWallet } from '../../providers/WalletProvider';
import { useToast } from '../../providers/ToastProvider';
import { useAllowance } from '../../providers/AllowanceProvider';
import ConnectWalletPrompt from '../Wallet/ConnectWalletPrompt';
import { readContract } from 'wagmi/actions';
import { wagmiConfig } from '../../../lib/onchain/wagmiConfig';
import { baseSepolia } from 'wagmi/chains';
import { USDL_ADDRESS, USDL_MULTIPLIER, FACTORY_ADDRESS, MOCK_USDL_ABI } from '../../../lib/constants';

interface TradeBoxProps {
    probability: number;
    market?: MarketData; // New: Full market data for state-aware display
    // Legacy support for existing usage
}

const TradeBox: React.FC<TradeBoxProps> = ({ probability, market }) => {
    const [amount, setAmount] = useState<string>('');
    const [selectedOutcome, setSelectedOutcome] = useState<'YES' | 'NO'>('YES');
    const [usdlBalance, setUsdlBalance] = React.useState<bigint | undefined>(undefined);
    const [isDripping, setIsDripping] = React.useState(false);
    const [isApproving, setIsApproving] = React.useState(false);
    const [isPlacingBet, setIsPlacingBet] = React.useState(false);

    const { isConnected, walletAddress, connect, isConnecting } = useWallet();
    const { showToast } = useToast();
    const { needsApproval, refetchAllowance } = useAllowance();

    // Fetch USDL balance only (allowance is now handled by context)
    const fetchUsdlBalance = React.useCallback(async () => {
        if (!walletAddress || !isConnected) {
            setUsdlBalance(undefined);
            return;
        }

        try {
            const balance = await readContract(wagmiConfig, {
                chainId: baseSepolia.id,
                address: USDL_ADDRESS,
                abi: MOCK_USDL_ABI,
                functionName: 'balanceOf',
                args: [walletAddress as `0x${string}`]
            });
            setUsdlBalance(balance);
        } catch (error) {
            console.error('Failed to fetch USDL balance:', error);
            setUsdlBalance(undefined);
        }
    }, [walletAddress, isConnected]);

    // Fetch balance when wallet connects/disconnects
    React.useEffect(() => {
        fetchUsdlBalance();
    }, [fetchUsdlBalance]);

    // Get user market status only when connected
    const [userStatus, setUserStatus] = React.useState<UserMarketStatus | null>(null);

    React.useEffect(() => {
        const fetchUserStatus = async () => {
            if (market && isConnected && walletAddress && market.contractId) {
                try {
                    const status = await getUserMarketStatus(market.contractId, walletAddress, market);
                    setUserStatus(status);
                } catch (error) {
                    console.error('Error fetching user status:', error);
                    setUserStatus(null);
                }
            } else {
                setUserStatus(null);
            }
        };

        fetchUserStatus();
    }, [market, isConnected, walletAddress]);

    const handleClaim = async () => {
        if (!market) return;
        try {
            await claimRewards(market.contractId as `0x${string}`);
            showToast('Rewards claimed successfully!', 'success');
            // Refresh balance after successful claim
            fetchUsdlBalance();
        } catch (error) {
            console.error('Failed to claim rewards:', error);
            showToast('Failed to claim rewards. Please try again.', 'error');
        }
    };

    const handleApproval = async () => {
        if (!walletAddress || !isConnected) return;

        setIsApproving(true);
        try {
            await approveUsdlUnlimited(FACTORY_ADDRESS as `0x${string}`);

            // Success: Show immediate feedback and refresh allowance
            showToast('USDL approval successful! You can now place bets.', 'success');

            // Immediately refresh allowance for instant UI update
            await refetchAllowance();

        } catch (error: any) {
            console.error('Failed to approve USDL:', error);

            // Better error handling: distinguish user cancellation from other errors
            const errorMessage = error?.message?.toLowerCase() || '';
            const errorCode = error?.code;

            if (
                errorCode === 4001 || // MetaMask user rejection
                errorCode === 'ACTION_REJECTED' || // Ethers user rejection
                errorMessage.includes('user rejected') ||
                errorMessage.includes('cancelled') ||
                errorMessage.includes('canceled') ||
                errorMessage.includes('declined') ||
                errorMessage.includes('denied')
            ) {
                // User cancelled - no scary error message
                showToast('Approval cancelled. You can try again when ready.', 'info');
            } else {
                // Actual error - show helpful message
                showToast('Approval failed. Please check your wallet and try again.', 'error');
            }
        } finally {
            setIsApproving(false);
        }
    };

    const numericAmount = parseFloat(amount) || 0;
    const outcomePrice = selectedOutcome === 'YES' ? probability / 100 : (100 - probability) / 100;
    const potentialPayout = numericAmount > 0 ? (numericAmount / outcomePrice).toFixed(2) : '0';

    // Handle drip functionality
    const handleDrip = async () => {
        if (!isConnected || !walletAddress) return;

        setIsDripping(true);
        try {
            await dripUsdl();
            showToast('Successfully received 100 USDL!', 'success');
            await fetchUsdlBalance(); // Refresh balance
        } catch (error: any) {
            console.error('Failed to drip USDL:', error);

            const errorMessage = error?.message?.toLowerCase() || '';
            const errorCode = error?.code;

            if (
                errorCode === 4001 ||
                errorCode === 'ACTION_REJECTED' ||
                errorMessage.includes('user rejected') ||
                errorMessage.includes('cancelled') ||
                errorMessage.includes('canceled') ||
                errorMessage.includes('declined') ||
                errorMessage.includes('denied')
            ) {
                showToast('Drip cancelled. You can try again when ready.', 'info');
            } else if (errorMessage.includes('exceeds 24h mint limit')) {
                showToast('You have reached your daily drip limit. Try again in 24 hours.', 'warning');
            } else {
                showToast('Failed to get USDL. Please try again.', 'error');
            }
        } finally {
            setIsDripping(false);
        }
    };

    // Allowance check comes from context, only need to check balance
    const amountInUnits = BigInt(Math.floor(numericAmount * USDL_MULTIPLIER));
    const insufficientBalance = usdlBalance ? usdlBalance < amountInUnits : false;

    // Handle different market states
    if (market) {
        // FINALIZED MARKET: Show results and claim interface
        if (market.state === 'RESOLVED' || market.state === 'UNDETERMINED') {
            if (!isConnected) {
                return (
                    <div className={styles.tradeBox}>
                        <div className={styles.subtleHeader}>
                            <span className={styles.marketStatus}>Market Resolved</span>
                            <span className={`${styles.outcomeTag} ${market.resolvedOutcome === market.sideAName ? styles.outcomeYes : styles.outcomeNo}`}>
                                {market.resolvedOutcome} Won
                            </span>
                        </div>
                        <ConnectWalletPrompt
                            align="left"
                            message="Connect your wallet to start betting."
                        />
                    </div>
                );
            }
            return (
                <div className={styles.tradeBox}>
                    <div className={styles.subtleHeader}>
                        <span className={styles.marketStatus}>Market Resolved</span>
                        <span className={`${styles.outcomeTag} ${market.resolvedOutcome === market.sideAName ? styles.outcomeYes : styles.outcomeNo}`}>
                            {market.resolvedOutcome} Won
                        </span>
                    </div>

                    {userStatus?.hasPosition ? (
                        <div className={styles.positionSummary}>
                            <div className={styles.positionRow}>
                                <span>Your bet:</span>
                                <span>{userStatus.position!.amount} USDL on {userStatus.position!.outcome}</span>
                            </div>
                            {userStatus.userWon ? (
                                <div className={styles.positionRow}>
                                    <span>You won:</span>
                                    <span className={styles.winAmount}>+{userStatus.potentialWinnings.toFixed(0)} USDL</span>
                                </div>
                            ) : (
                                <div className={styles.positionRow}>
                                    <span className={styles.lossText}>You lost your bet</span>
                                </div>
                            )}
                            {userStatus.canClaim && (
                                <button className={styles.claimButton} onClick={handleClaim}>
                                    Claim {userStatus.potentialWinnings.toFixed(0)} USDL
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className={styles.noPosition}>
                            <p>You did not bet on this market.</p>
                        </div>
                    )}
                </div>
            );
        }

        // RESOLVING MARKET: Show resolving status
        if (market.state === 'RESOLVING') {
            if (!isConnected) {
                return (
                    <div className={styles.tradeBox}>
                        <div className={styles.subtleHeader}>
                            <span className={styles.marketStatus}>Resolving...</span>
                            <div className={styles.loadingDot}></div>
                        </div>
                        <ConnectWalletPrompt
                            align="left"
                            message="Connect your wallet to start betting."
                        />
                    </div>
                );
            }
            return (
                <div className={styles.tradeBox}>
                    <div className={styles.subtleHeader}>
                        <span className={styles.marketStatus}>Resolving...</span>
                        <div className={styles.loadingDot}></div>
                    </div>

                    {userStatus?.hasPosition && (
                        <div className={styles.positionSummary}>
                            <div className={styles.positionRow}>
                                <span>Your bet:</span>
                                <span>{userStatus.position!.amount} USDL on {userStatus.position!.outcome}</span>
                            </div>
                            <p className={styles.waitingText}>Waiting for resolution...</p>
                        </div>
                    )}
                </div>
            );
        }

        // No resolvable state - removed

        // ACTIVE MARKET: Show user position if they have one, then trading interface
        if (userStatus?.hasPosition) {
            return (
                <div className={styles.tradeBox}>
                    <div className={styles.positionSummary}>
                        <div className={styles.positionRow}>
                            <span>Current bet:</span>
                            <span>{userStatus.position!.amount} USDL on {userStatus.position!.outcome}</span>
                        </div>
                    </div>

                    <div className={styles.divider}></div>
                    {renderTradingInterface()}
                </div>
            );
        }
    }

    // DEFAULT: Regular trading interface (for active markets without position or legacy usage)
    if (!isConnected) {
        return (
            <div className={styles.tradeBox}>
                <ConnectWalletPrompt
                    align="left"
                    message="Connect your wallet to start betting."
                />
            </div>
        );
    }

    return (
        <div className={styles.tradeBox}>
            {renderTradingInterface()}
        </div>
    );

    function renderTradingInterface() {
        return (
            <>
                <div className={styles.inputGroup}>
                    <div className={styles.inputLabel}>
                        <span>❶</span> Enter amount
                        <span className={styles.pctOptions}>
                            <span onClick={() => setAmount('10')}>10$</span>
                            <span onClick={() => setAmount('20')}>20$</span>
                            <span onClick={() => setAmount('50')}>50$</span>
                            {usdlBalance !== undefined && (
                                <span onClick={() => setAmount((Number(usdlBalance) / USDL_MULTIPLIER).toFixed(2))}>Max</span>
                            )}
                        </span>
                    </div>
                    <div className={styles.amountInputContainer}>
                        <input
                            type="number"
                            className={styles.amountInput}
                            placeholder="0"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                        />
                        <span className={styles.usdcSuffix}>USDL</span>
                    </div>
                    {usdlBalance !== undefined ? (
                        <div style={{
                            fontSize: '11px',
                            color: '#6b7280',
                            marginTop: '4px',
                            textAlign: 'right',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <span>Balance: {(Number(usdlBalance) / USDL_MULTIPLIER).toFixed(2)} USDL</span>
                            <button
                                onClick={handleDrip}
                                disabled={isDripping}
                                style={{
                                    background: '#10b981',
                                    color: 'white',
                                    border: 'none',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    fontSize: '10px',
                                    cursor: isDripping ? 'not-allowed' : 'pointer',
                                    opacity: isDripping ? 0.7 : 1
                                }}
                            >
                                {isDripping ? 'Getting...' : 'Get USDL'}
                            </button>
                        </div>
                    ) : null}
                </div>

                <div className={styles.inputGroup}>
                    <div className={styles.inputLabel}>
                        <span>❷</span> Select outcome
                    </div>
                    <div className={styles.outcomeSelect}>
                        <button
                            className={`${styles.outcomeCard} ${styles.outcomeCardGreen} ${selectedOutcome === 'YES' ? styles.selectedOutcome : styles.unselectedOutcome}`}
                            onClick={() => setSelectedOutcome('YES')}
                        >
                            <div>
                                <div>{market?.sideAName ?? 'YES'}</div>
                            </div>
                            {selectedOutcome === 'YES' && <span>Do it</span>}
                        </button>
                        <button
                            className={`${styles.outcomeCard} ${styles.outcomeCardOrange} ${selectedOutcome === 'NO' ? styles.selectedOutcome : styles.unselectedOutcome}`}
                            onClick={() => setSelectedOutcome('NO')}
                        >
                            <div>
                                <div>{market?.sideBName ?? 'NO'}</div>
                            </div>
                            {selectedOutcome === 'NO' && <span>Do it</span>}
                        </button>
                    </div>
                </div>

                {/* Show insufficient balance message */}
                {insufficientBalance && numericAmount > 0 && (
                    <button
                        className={styles.payoutButton}
                        disabled
                        style={{ backgroundColor: '#ef4444', border: '1px solid #ef4444', opacity: 0.7 }}
                    >
                        Insufficient USDL Balance
                    </button>
                )}

                {/* Show approval button if approval is needed */}
                {needsApproval && !insufficientBalance && (
                    <button
                        className={styles.payoutButton}
                        onClick={handleApproval}
                        disabled={isApproving}
                        style={{ backgroundColor: '#f59e0b', border: '1px solid #f59e0b' }}
                    >
                        {isApproving ? 'Check your wallet to approve...' : 'Approve USDL to place bets'}
                    </button>
                )}

                {/* Show place bet button if no approval needed */}
                {!needsApproval && !insufficientBalance && (
                    <button
                        className={styles.payoutButton}
                        onClick={async () => {
                            if (!market) return;
                            if (!isConnected) {
                                try {
                                    await connect();
                                } catch (error) {
                                    console.error('Failed to connect wallet:', error);
                                    showToast('Failed to connect wallet. Please try again.', 'error');
                                }
                                return;
                            }

                            setIsPlacingBet(true);
                            try {
                                await placeBet(market.contractId as `0x${string}`, selectedOutcome, numericAmount > 0 ? numericAmount : 0);
                                showToast(`Bet placed successfully! ${numericAmount} USDL on ${selectedOutcome}.`, 'success');
                                // Refresh balance after successful bet
                                await fetchUsdlBalance();
                                // Clear the amount input after successful bet
                                setAmount('');
                            } catch (error: any) {
                                console.error('Failed to place bet:', error);

                                // Better error handling for bet placement
                                const errorMessage = error?.message?.toLowerCase() || '';
                                const errorCode = error?.code;

                                if (
                                    errorCode === 4001 ||
                                    errorCode === 'ACTION_REJECTED' ||
                                    errorMessage.includes('user rejected') ||
                                    errorMessage.includes('cancelled') ||
                                    errorMessage.includes('canceled') ||
                                    errorMessage.includes('declined') ||
                                    errorMessage.includes('denied')
                                ) {
                                    // User cancelled - friendly message
                                    showToast('Bet cancelled. You can try again when ready.', 'info');
                                } else {
                                    // Actual error - helpful message
                                    showToast('Failed to place bet. Please check your wallet and try again.', 'error');
                                }
                            } finally {
                                setIsPlacingBet(false);
                            }
                        }}
                        disabled={isPlacingBet || numericAmount <= 0}
                    >
                        {isConnecting
                            ? 'Connecting wallet...'
                            : isPlacingBet
                            ? 'Check your wallet to confirm...'
                            : `Buy ${selectedOutcome === 'YES' ? (market?.sideAName ?? 'YES') : (market?.sideBName ?? 'NO')} for ${numericAmount > 0 ? numericAmount : '0'} USDL`}
                    </button>
                )}
            </>
        );
    }

};

export default TradeBox;
