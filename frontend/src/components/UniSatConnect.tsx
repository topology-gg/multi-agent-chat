import { useState, useEffect } from 'react';
import { Button } from './ui/button';

declare global {
  interface Window {
    unisat: any;
  }
}

export function UniSatConnect() {
  const [isConnected, setIsConnected] = useState(false);
  const [address, setAddress] = useState<string>('');

  useEffect(() => {
    // Kiểm tra xem UniSat đã được cài đặt chưa
    if (typeof window.unisat !== 'undefined') {
      window.unisat.on('accountsChanged', (accounts: string[]) => {
        if (accounts.length > 0) {
          setAddress(accounts[0]);
          setIsConnected(true);
        } else {
          setAddress('');
          setIsConnected(false);
        }
      });
    }
  }, []);

  const connectWallet = async () => {
    try {
      if (typeof window.unisat === 'undefined') {
        alert('Vui lòng cài đặt UniSat Wallet!');
        return;
      }

      const accounts = await window.unisat.requestAccounts();
      if (accounts.length > 0) {
        setAddress(accounts[0]);
        setIsConnected(true);
      }
    } catch (error) {
      console.error('Lỗi kết nối ví:', error);
      alert('Có lỗi xảy ra khi kết nối ví!');
    }
  };

  return (
    <div className="flex items-center gap-4">
      {!isConnected ? (
        <Button onClick={connectWallet}>
          Kết nối UniSat Wallet
        </Button>
      ) : (
        <div className="flex items-center gap-2">
          <span className="text-sm">Đã kết nối:</span>
          <span className="text-sm font-mono">{address.slice(0, 6)}...{address.slice(-4)}</span>
        </div>
      )}
    </div>
  );
} 