import React from 'react';
import { useRouter } from 'next/navigation';
import styles from './LandingView.module.css';
import ChartSection from '../SharedMarket/ChartSection';
import ProbabilityGauge from '../SharedMarket/ProbabilityGauge';
import { MarketData } from '../../../data/markets';
import { fetchMarketsByStatus } from '../../../lib/onchain/reads';
import TradeBox from '../SharedMarket/TradeBox';
import { useToast } from '../../providers/ToastProvider';
import { formatAddress } from '../../../utils/formatters';
import CopyIcon from '../Shared/CopyIcon';
import ResolutionRules from '../Shared/ResolutionRules';
import GenLayerInfo from '../GenLayerInfo/GenLayerInfo';

const LandingView: React.FC = () => {
    const router = useRouter();
    const { showToast } = useToast();
    const [selectedMarketId, setSelectedMarketId] = React.useState<string | null>(null);
    const [navStartIndex, setNavStartIndex] = React.useState<number>(0);
    const [markets, setMarkets] = React.useState<MarketData[]>([]);
    const [loading, setLoading] = React.useState<boolean>(true);
    const [showInfoPanel, setShowInfoPanel] = React.useState<boolean>(true);

    React.useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            try {
                const data = await fetchMarketsByStatus('ACTIVE');
                const unique: MarketData[] = [];
                const seen = new Set<string>();
                data.forEach((m) => {
                    // Only process markets that are explicitly active
                    if (m.state !== 'ACTIVE') return;

                    const key = (m.contractId || m.id || unique.length).toString();
                    if (seen.has(key)) return;
                    seen.add(key);
                    unique.push({ ...m, id: (m.contractId || (unique.length + 1).toString()) });
                });
                if (!cancelled) {
                    setMarkets(unique);
                    setSelectedMarketId(unique[0]?.id ?? null);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, []);

    // Get selected market data
    const selectedMarket = markets.find(m => m.id === selectedMarketId) || markets[0];

    // Define the full list for navigation
    const allNavItems = [
        ...markets.slice(0, 4),
        { id: '-1', ticker: 'More Markets', identifier: 'more', type: 'other' } as MarketData
    ].filter(Boolean);

    // Derived view for the carousel (show 3 items)
    const CAROUSEL_SIZE = 3;
    // Max index is Length - SIZE. If we are at that index, we see the last set.
    const maxIndex = Math.max(0, allNavItems.length - CAROUSEL_SIZE);

    // Check boundaries
    const isAtEnd = navStartIndex >= maxIndex;

    const handleNext = () => {
        if (navStartIndex < maxIndex) {
            setNavStartIndex(prev => prev + 1);
        }
    };

    const handlePrev = () => {
        if (navStartIndex > 0) {
            setNavStartIndex(prev => prev - 1);
        }
    };

    return (
        <div className={styles.container}>
            {/* GenLayer Info Panel */}
            {showInfoPanel && (
                <div className={styles.infoPanel}>
                    <GenLayerInfo onClose={() => setShowInfoPanel(false)} />
                </div>
            )}

            {/* Focus Market Card */}
            <div className={styles.marketFocusCard}>
                {loading || !selectedMarket ? (
                    <div className={styles.skeletonCard}>
                        <div className={styles.shimmer}></div>
                    </div>
                ) : (
                    <>
                <div className={styles.marketHeader}>
                    <div className={styles.marketTabs}>
                        {/* Empty left side */}
                    </div>
                    <div className={styles.marketTabs}>
                        {/* Left Chevron */}
                        <div
                            className={styles.chevronBtn}
                            onClick={handlePrev}
                            style={{
                                opacity: navStartIndex > 0 ? 1 : 0,
                                pointerEvents: navStartIndex > 0 ? 'auto' : 'none'
                            }}
                        >
                            ‹
                        </div>

                        {/* Carousel Viewport */}
                        <div className={styles.carouselViewport}>
                            <div
                                className={styles.carouselTrack}
                                style={{ transform: `translateX(-${navStartIndex * 110}px)` }} // 100px width + 10px gap
                            >
                                {allNavItems.map((market) => {
                                    if (market.identifier === 'more') {
                                        return (
                                            <div
                                                key="more"
                                                className={styles.moreMarkets}
                                                onClick={() => router.push('/markets')}
                                                style={{ marginTop: '6px' }}
                                            >
                                                More Markets
                                            </div>
                                        );
                                    }
                                    return market ? (
                                        <div
                                            key={market.contractId || market.id}
                                            className={styles.navItem}
                                            onClick={() => setSelectedMarketId(market.id)}
                                            style={{
                                                fontWeight: selectedMarketId === market.id ? '700' : '500',
                                                color: selectedMarketId === market.id ? '#000' : '#888',
                                            }}
                                        >
                                            <span className={selectedMarketId === market.id ? styles.glowDot : ''} style={{
                                                width: '6px',
                                                height: '6px',
                                                borderRadius: '50%',
                                                background: selectedMarketId === market.id ? '#22c55e' : '#e5e7eb',
                                                display: 'inline-block',
                                                flexShrink: 0
                                            }}></span>
                                            {market.ticker}
                                        </div>
                                    ) : null;
                                })}
                            </div>
                        </div>

                        {/* Right Chevron */}
                        <div
                            className={styles.chevronBtn}
                            onClick={handleNext}
                            style={{
                                opacity: !isAtEnd ? 1 : 0.3,
                                pointerEvents: !isAtEnd ? 'auto' : 'none'
                            }}
                        >
                            ›
                        </div>
                    </div>
                </div>

                <div className={styles.header}>
                    <div className={styles.headerLeft}>
                        <span className={styles.icon}>
                            {selectedMarket.type === 'crypto' ? '₿' : 'G'}
                        </span>
                        <div className={styles.titleGroup}>
                            <h3 className={styles.title}>{selectedMarket.title}</h3>
                            {selectedMarket?.contractId && (
                                <div className={styles.addressRow}>
                                    <span className={styles.addressText}>{formatAddress(selectedMarket.contractId)}</span>
                                    <button
                                        className={styles.copyBtn}
                                        onClick={() => {
                                            if (!selectedMarket?.contractId) return;
                                            navigator.clipboard?.writeText(selectedMarket.contractId);
                                            showToast('Address copied', 'success');
                                        }}
                                        aria-label="Copy contract address"
                                    >
                                        <CopyIcon />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                    <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                        <ProbabilityGauge probability={selectedMarket.probYes * 100} />
                    </div>
                </div>

                <div style={{ marginBottom: '16px' }}>
                    {/* Added Key to force re-mounting when identifier changes for accurate chart update */}
                    <ChartSection
                        key={selectedMarket.identifier}
                        type={selectedMarket.type}
                        identifier={selectedMarket.identifier}
                        probability={selectedMarket.probYes * 100}
                    />
                </div>


                <div className={styles.tradeBoxEmbed}>
                    <TradeBox market={selectedMarket} probability={selectedMarket.probYes * 100} />
                </div>

                <ResolutionRules market={selectedMarket} />
                </>
                )}
            </div>
        </div>
    );
};

export default LandingView;
