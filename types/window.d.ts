interface Window {
  ethereum?: {
    isMetaMask?: boolean;
    providers?: any[];
    request: (args: { method: string; params?: any[] }) => Promise<any>;
    send: (method: string, params?: any[]) => Promise<any>;
    on: (event: string, handler: (...args: any[]) => void) => void;
    removeListener: (event: string, handler: (...args: any[]) => void) => void;
  };
  web3?: {
    currentProvider?: any;
  };
  // Base Account SDK
  createBaseAccountSDK?: (config: {
    appName: string;
    appLogoUrl?: string;
  }) => {
    getProvider: () => any;
  };
  base?: {
    pay: (params: {
      amount: string;
      to: string;
      testnet?: boolean;
    }) => Promise<{ id: string }>;
    getPaymentStatus: (params: {
      id: string;
      testnet?: boolean;
    }) => Promise<{ status: string; [key: string]: any }>;
  };
}

