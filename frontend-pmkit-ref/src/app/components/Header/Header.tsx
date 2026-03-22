import React from 'react';
import Image from 'next/image';
import styles from './Header.module.css';
import { useWallet } from '../../providers/WalletProvider';
import { useToast } from '../../providers/ToastProvider';
import { readContract } from 'wagmi/actions';
import { wagmiConfig } from '../../../lib/onchain/wagmiConfig';
import { baseSepolia } from 'wagmi/chains';
import DisconnectIcon from '../Shared/DisconnectIcon';
import TopUpIcon from '../Shared/TopUpIcon';
import InfoIcon from '../Shared/InfoIcon';
import Tooltip from '../Shared/Tooltip';
import { USDL_ADDRESS, MOCK_USDL_ABI, USDL_MULTIPLIER } from '../../../lib/constants';
import { dripUsdl } from '../../../lib/onchain/writes';

interface HeaderProps {
    onNavigate: (page: 'landing' | 'markets') => void;
    currentPage: 'landing' | 'markets';
}

const Header: React.FC<HeaderProps> = ({ onNavigate, currentPage }) => {
    const { isConnected, walletAddress, isConnecting, connect, disconnect } = useWallet();
    const { showToast } = useToast();
    const [usdlBalance, setUsdlBalance] = React.useState<bigint | undefined>(undefined);
    const [isDripping, setIsDripping] = React.useState(false);
    const [walletDropdownOpen, setWalletDropdownOpen] = React.useState(false);
    const [balanceDropdownOpen, setBalanceDropdownOpen] = React.useState(false);
    const walletRef = React.useRef<HTMLDivElement>(null);
    const balanceRef = React.useRef<HTMLDivElement>(null);

    const shortAddress = walletAddress
        ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
        : '';

    // Fetch USDL balance
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

    // Memoized handlers to prevent re-render loops
    const handleBalanceClick = React.useCallback(() => {
        setBalanceDropdownOpen(prev => !prev);
    }, []);

    const handleWalletClick = React.useCallback(() => {
        setWalletDropdownOpen(prev => !prev);
    }, []);

    const handleDisconnect = React.useCallback(() => {
        disconnect();
        setWalletDropdownOpen(false);
    }, [disconnect]);

    const handleTopUp = React.useCallback(async () => {
        setIsDripping(true);
        try {
            await dripUsdl();
            showToast('Successfully received 100 USDL!', 'success');
            await fetchUsdlBalance(); // Refresh balance
            setBalanceDropdownOpen(false);
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
    }, [fetchUsdlBalance, showToast]);

    // Close dropdowns when clicking outside
    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (walletRef.current && !walletRef.current.contains(event.target as Node)) {
                setWalletDropdownOpen(false);
            }
            if (balanceRef.current && !balanceRef.current.contains(event.target as Node)) {
                setBalanceDropdownOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <header className={styles.header}>
            <div className={styles.left}>
                <div
                    className={styles.logo}
                    onClick={() => onNavigate('landing')}
                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                    <Image src="/cofi.svg" alt="Logo" width={30} height={30} />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <h1 style={{ fontSize: '26px', fontWeight: '800', letterSpacing: '-0.5px', margin: 0 }}>PM Kit</h1>
                        <div style={{ fontSize: '11px', color: '#9ca3af', fontWeight: '400' }}>
                            Powered by{' '}
                            <a
                                href="https://genlayer.com"
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                    color: '#6b7280',
                                    textDecoration: 'none',
                                    fontWeight: '500'
                                }}
                                onMouseOver={(e) => {
                                    e.currentTarget.style.color = '#374151';
                                    e.currentTarget.style.textDecoration = 'underline';
                                }}
                                onMouseOut={(e) => {
                                    e.currentTarget.style.color = '#6b7280';
                                    e.currentTarget.style.textDecoration = 'none';
                                }}
                                onClick={(e) => e.stopPropagation()}
                            >
                                GenLayer
                            </a>
                        </div>
                    </div>
                </div>
                <nav className={styles.nav}>
                    <span
                        className={`${styles.navItem} ${currentPage === 'markets' ? styles.active : ''}`}
                        onClick={() => onNavigate('markets')}
                    >
                        Markets
                    </span>
                </nav>
            </div>
            <div className={styles.right}>
                <a
                    href="https://github.com/courtofinternet/pm-kit"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.githubLink}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '8px 12px',
                        marginRight: '12px',
                        borderRadius: '8px',
                        border: '1px solid #e5e7eb',
                        backgroundColor: '#f9fafb',
                        color: '#374151',
                        textDecoration: 'none',
                        fontSize: '13px',
                        fontWeight: '500',
                        transition: 'all 0.15s',
                        cursor: 'pointer'
                    }}
                    onMouseOver={(e) => {
                        e.currentTarget.style.backgroundColor = '#f3f4f6';
                        e.currentTarget.style.borderColor = '#d1d5db';
                    }}
                    onMouseOut={(e) => {
                        e.currentTarget.style.backgroundColor = '#f9fafb';
                        e.currentTarget.style.borderColor = '#e5e7eb';
                    }}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: '6px' }}>
                        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                    </svg>
                    GitHub
                </a>
                {isConnected && usdlBalance !== undefined && (
                    <div ref={balanceRef} style={{ position: 'relative', marginRight: '16px' }}>
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                cursor: 'pointer',
                                padding: '8px 12px',
                                borderRadius: '8px',
                                border: '1px solid #e5e7eb',
                                backgroundColor: '#f9fafb',
                                fontSize: '13px',
                                fontWeight: '500',
                                color: '#374151',
                                transition: 'all 0.15s',
                                minWidth: 'fit-content'
                            }}
                            onClick={handleBalanceClick}
                        >
                            {(Number(usdlBalance) / USDL_MULTIPLIER).toFixed(2)} USDL
                            <Tooltip content="USDL on Base Sepolia Testnet">
                                <div style={{ marginLeft: '6px', color: '#9ca3af', display: 'flex' }}>
                                    <InfoIcon size={12} />
                                </div>
                            </Tooltip>
                        </div>
                        {balanceDropdownOpen && (
                            <div style={{
                                position: 'absolute',
                                top: '100%',
                                right: 0,
                                marginTop: '4px',
                                backgroundColor: 'white',
                                border: '1px solid #e5e7eb',
                                borderRadius: '8px',
                                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                                zIndex: 50,
                                minWidth: '160px'
                            }}>
                                <button
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        width: '100%',
                                        padding: '12px 16px',
                                        border: 'none',
                                        backgroundColor: 'transparent',
                                        fontSize: '14px',
                                        cursor: 'pointer',
                                        borderRadius: '8px'
                                    }}
                                    onClick={handleTopUp}
                                    disabled={isDripping}
                                >
                                    <TopUpIcon size={16} />
                                    <span style={{ marginLeft: '8px' }}>{isDripping ? 'Getting USDL...' : 'Get USDL'}</span>
                                </button>
                                <a
                                    href="https://www.alchemy.com/faucets/base-sepolia"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        width: '100%',
                                        padding: '12px 16px',
                                        border: 'none',
                                        backgroundColor: 'transparent',
                                        fontSize: '14px',
                                        cursor: 'pointer',
                                        borderRadius: '8px',
                                        textDecoration: 'none',
                                        color: 'inherit'
                                    }}
                                >
                                    <TopUpIcon size={16} />
                                    <span style={{ marginLeft: '8px' }}>Get bETH Sepolia</span>
                                </a>
                            </div>
                        )}
                    </div>
                )}
                {isConnected ? (
                    <div ref={walletRef} style={{ position: 'relative' }}>
                        <button
                            className={styles.walletButton}
                            onClick={handleWalletClick}
                        >
                            {shortAddress}
                        </button>
                        {walletDropdownOpen && (
                            <div style={{
                                position: 'absolute',
                                top: '100%',
                                right: 0,
                                marginTop: '4px',
                                backgroundColor: 'white',
                                border: '1px solid #e5e7eb',
                                borderRadius: '8px',
                                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                                zIndex: 50,
                                minWidth: '140px'
                            }}>
                                <button
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        width: '100%',
                                        padding: '12px 16px',
                                        border: 'none',
                                        backgroundColor: 'transparent',
                                        fontSize: '14px',
                                        cursor: 'pointer',
                                        borderRadius: '8px'
                                    }}
                                    onClick={handleDisconnect}
                                >
                                    <DisconnectIcon size={16} />
                                    <span style={{ marginLeft: '8px' }}>Disconnect</span>
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    <button className={styles.walletButton} onClick={connect} disabled={isConnecting}>
                        {isConnecting ? 'Connecting...' : 'Connect Wallet'}
                    </button>
                )}
            </div>
        </header>
    );
};

export default Header;
