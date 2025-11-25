import { Transaction } from './wallet';

// Known BaseApp contracts and patterns
const BASEAPP_KNOWN_CONTRACTS = [
  '0x0000000000000000000000000000000000000000', // Placeholder - update with actual BaseApp contracts
];

const BASEAPP_PATTERNS = [
  'tba-social',
  'mypinata',
  'baseapp',
  'handleOps',
];

// Method IDs for common operations
const METHOD_IDS = {
  handleOps: '0x1fad948c',
  safeMint: '0x40c10f19',
  mint: '0x1249c58b',
  transfer: '0xa9059cbb',
};

export interface BaseAppPostTransaction extends Transaction {
  isBaseAppPost: true;
  postTokenAddress: string;
  postId?: string;
  type: 'buy' | 'sell' | 'mint';
  amount?: string;
  price?: string;
}

export function isBaseAppPost(tx: Transaction): boolean {
  // Check if transaction has handleOps function
  if (tx.methodId === METHOD_IDS.handleOps) {
    return true;
  }

  // Check if callData contains BaseApp patterns
  const inputLower = tx.input.toLowerCase();
  for (const pattern of BASEAPP_PATTERNS) {
    if (inputLower.includes(pattern)) {
      return true;
    }
  }

  // Check if to address is a known BaseApp contract
  if (tx.to && BASEAPP_KNOWN_CONTRACTS.includes(tx.to.toLowerCase())) {
    return true;
  }

  // Check if method is not standard transfer/mint
  if (tx.methodId && !Object.values(METHOD_IDS).includes(tx.methodId)) {
    // Could be a BaseApp-specific method
    return true;
  }

  // Check for paymaster data (BaseApp uses paymasters)
  if (tx.input.length > 200) {
    // Long input data might indicate paymaster usage
    return true;
  }

  return false;
}

export function extractPostData(tx: Transaction): Partial<BaseAppPostTransaction> | null {
  if (!isBaseAppPost(tx)) {
    return null;
  }

  // Try to extract post token address from transaction
  // This is a simplified version - actual implementation would need to decode the transaction
  let postTokenAddress = tx.to || '';
  let postId: string | undefined;
  let type: 'buy' | 'sell' | 'mint' = 'buy';

  // Try to extract from input data
  // BaseApp posts typically have specific patterns in the input data
  if (tx.input.length >= 138) {
    // Try to extract address from input (simplified)
    const possibleAddress = '0x' + tx.input.slice(34, 74);
    if (possibleAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      postTokenAddress = possibleAddress;
    }
  }

  // Determine transaction type based on value and direction
  if (tx.value && BigInt(tx.value) > 0n) {
    type = 'buy';
  } else if (tx.from && tx.to) {
    // Could be a sell if tokens are being transferred out
    type = 'sell';
  }

  return {
    isBaseAppPost: true,
    postTokenAddress,
    postId,
    type,
    amount: tx.value,
    price: tx.value,
  };
}

export function detectAllBaseAppPosts(transactions: Transaction[]): BaseAppPostTransaction[] {
  const posts: BaseAppPostTransaction[] = [];

  for (const tx of transactions) {
    const postData = extractPostData(tx);
    if (postData) {
      posts.push({
        ...tx,
        ...postData,
      } as BaseAppPostTransaction);
    }
  }

  return posts;
}

// Group posts by token address
export function groupPostsByToken(posts: BaseAppPostTransaction[]): Map<string, BaseAppPostTransaction[]> {
  const grouped = new Map<string, BaseAppPostTransaction[]>();

  for (const post of posts) {
    const key = post.postTokenAddress.toLowerCase();
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(post);
  }

  return grouped;
}

