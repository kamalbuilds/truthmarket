import { createConfig, http } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { injected, coinbaseWallet } from 'wagmi/connectors';

export const wagmiConfig = createConfig({
    chains: [baseSepolia],
    connectors: [
        injected(),
        coinbaseWallet({ appName: 'PM Kit' })
    ],
    transports: {
        [baseSepolia.id]: http('https://sepolia.base.org')
    }
});
