# Zypher Protocol Web Frontend

Privacy-preserving stablecoin dApp on Solana with AI-powered hedging and prediction markets.

## 🚀 Quick Start

**First time setup?** See [SETUP.md](./SETUP.md) for complete initialization instructions.

### Development

```bash
# Install dependencies
npm install

# Run dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

### Requirements

- Node.js 18+
- Phantom wallet browser extension
- Solana CLI (for initialization)
- SOL on devnet (for testing)

## 📱 Features

- **Wallet Integration**: Seamless Phantom wallet connection on Solana devnet
- **Mint $ZYP**: Deposit collateral to mint Zypher stablecoin
- **3D Previews**: Interactive 3D visualizations of Real-World Assets (RWAs)
- **Oracle Integration**: Real-time price feeds from Pyth Network
- **Privacy-First**: Encrypted CDP positions (coming soon)

## 🏗️ Tech Stack

- **Framework**: Next.js 15.5 (App Router)
- **Blockchain**: Solana (devnet), @solana/web3.js, Anchor
- **Wallet**: @solana/wallet-adapter-react (Phantom)
- **3D**: Three.js, @react-three/fiber, @react-three/drei
- **Styling**: Tailwind CSS
- **Oracles**: Pyth Network

## 📦 Project Structure

```
zypherweb/
├── app/
│   ├── page.tsx          # Landing page
│   ├── wallet/page.tsx   # Wallet connection
│   ├── mint/page.tsx     # Mint interface
│   └── dashboard/page.tsx # User dashboard
├── components/
│   ├── WalletConnect.tsx     # Wallet button
│   ├── MintForm.tsx          # Mint logic
│   ├── ThreeDPreview.tsx     # 3D RWA viewer
│   └── ...
├── lib/
│   └── solana.ts         # Anchor program calls
├── public/
│   ├── idl/zypher.json   # Program IDL
│   └── models/           # 3D GLTF models
├── scripts/
│   └── initialize-config.ts  # Setup script
└── .env.local            # Environment variables
```

## 🔧 Configuration

Required environment variables in `.env.local`:

```bash
NEXT_PUBLIC_PROGRAM_ID=<your_program_id>
NEXT_PUBLIC_ZYPHER_MINT=<zypher_mint_address>
NEXT_PUBLIC_COLLATERAL_MINT=<collateral_token_address>
NEXT_PUBLIC_ORACLE_ACCOUNT=<pyth_oracle_address>
```

Run `npx ts-node scripts/initialize-config.ts` to generate these values.

## 🧪 Testing

1. **Connect Wallet**: Navigate to `/wallet` and connect Phantom (ensure it's on devnet)
2. **Mint Tokens**: Go to `/mint`, select collateral, enter amount, approve transaction
3. **View on Explorer**: Copy transaction signature, paste in Solana Explorer (devnet)

## 📚 Learn More

- [Solana Docs](https://docs.solana.com)
- [Anchor Framework](https://www.anchor-lang.com)
- [Pyth Network](https://pyth.network)
- [Next.js Documentation](https://nextjs.org/docs)

## 🤝 Contributing

This project follows the Zypher style guide. See `.github/instructions/` for coding standards.

## 📄 License

MIT

---

Built with ❤️ for Solana ecosystem

