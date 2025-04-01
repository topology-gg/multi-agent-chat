import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { sepolia } from 'wagmi/chains';

export const wagmiConfig = getDefaultConfig({
  appName: 'My RainbowKit App',
  projectId: 'ffe8af41200806d3c44db219c3a09e52',
  chains: [sepolia],
});