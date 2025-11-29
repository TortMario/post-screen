import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html>
      <Head>
        <meta
          httpEquiv="Content-Security-Policy"
          content="default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://*.walletconnect.org https://*.walletlink.org https://unpkg.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; font-src 'self' data:; connect-src 'self' https://api.etherscan.io https://api.basescan.org https://basescan.org https://api.dexscreener.com https://api.coingecko.com https://api.baseapp.xyz https://mainnet.base.org https://*.base.org https://*.baseaccount.org https://*.coinbase.com https://unpkg.com wss://www.walletlink.org wss://*.walletconnect.org wss://*.walletconnect.com https://*.walletconnect.org https://*.walletconnect.com https://*.walletlink.org; frame-src 'self' https://*.walletconnect.org https://*.baseaccount.org;"
        />
        {/* Load Base Account SDK via CDN */}
        <script src="https://unpkg.com/@base-org/account/dist/base-account.min.js" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}

