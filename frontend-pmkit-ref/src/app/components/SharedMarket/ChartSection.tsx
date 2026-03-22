import React from 'react';
import styles from './ChartSection.module.css';
import TradingViewWidget from './TradingViewWidget';
import GeckoWidget from './GeckoWidget';

interface ChartSectionProps {
    probability: number;
    type?: 'crypto' | 'stock' | 'other';
    identifier?: string;
}

const ChartSection: React.FC<ChartSectionProps> = ({
    probability,
    type = 'crypto',
    identifier = 'bitcoin'
}) => {
    return (
        <div className={styles.chartSection}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div className={styles.timeTabs}>
                    <div style={{ fontSize: '12px', fontWeight: 600 }}>
                        {type === 'crypto' ? 'Coin Price' : 'Stock Price'}
                    </div>
                </div>
                <div style={{ fontSize: '11px', color: '#999' }}>
                    Powered by {type === 'crypto' ? 'CoinGecko' : 'TradingView'}
                </div>
            </div>

            <div style={{ height: '320px', marginTop: '20px' }}>
                {type === 'crypto' ? (
                    <GeckoWidget coinId={identifier} />
                ) : type === 'stock' ? (
                    <TradingViewWidget symbol={identifier} />
                ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#aaa' }}>
                        No Chart Available
                    </div>
                )}
            </div>
        </div>
    );
};

export default ChartSection;
