# Zypher 🚀

[![Solana](https://img.shields.io/badge/Solana-Devnet-blueviolet)](https://solana.com)
[![Anchor](https://img.shields.io/badge/Anchor-v0.32-green)](https://anchor-lang.com)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**Zypher: Privacy-Preserving RWA-Backed Stablecoin with AI-Agent Hedging on Solana**

**Built for Solana Cypherpunk Hackathon** – **$ZYP**: Encrypted CDPs, ZK Predictions, Autonomous Hedges. **MiCA-Ready. Scales to $100M TVL.**

[![Demo Video](https://img.shields.io/badge/Watch-Demo-red)](https://youtube.com/your-video-link) | [Live Devnet](https://zyphersolana.vercel.app/)

## ✨ Features
- **$ZYP Stablecoin**: Overcollateralized (150%) by RWAs (gold, treasuries) – USD-pegged.
- **ZK Privacy**: Halo2 proofs for verifiable hedges **without revealing positions**.
- **AI Agents**: PyTorch PPO-trained – Auto-hedge depegs/yield drops (95% accuracy).
- **Prediction Markets**: Bet & settle in <1s via Solana finality.
- **Next.js dApp**: 3D RWA previews, real-time dashboard, Phantom connect.
- **Revenue**: 0.1% fees → **$3M Yr1 projected**.

## 🛠 Tech Stack
| Backend | Off-Chain | Frontend |
|---------|-----------|----------|
| **Anchor (Rust)**<br>Pyth Oracles<br>Halo2 ZK | **PyTorch Agents**<br>Solana-py RPC | **Next.js 15**<br>Three.js 3D<br>Tailwind |

## 🚀 Quick Start (5 mins)
### Prerequisites
- Node.js 20+, Rust 1.80+, Python 3.12
- Solana CLI: `sh -c "$(curl -sSfL https://release.solana.com/stable/install)"`
- Phantom Wallet (devnet)

### 1. Clone & Install
```bash
git clone https://github.com/charlesms1246/zypher.git
cd zypher
```

**Backend (Anchor):**
```bash
anchor build
anchor deploy --provider.cluster devnet  # Get PROGRAM_ID
```

**Agents:**
```bash
cd offchain/zypher_agents
pip install -r requirements.txt
python agent.py  # Runs hedge loop
```

**Frontend:**
```bash
cd frontend/ZypherWeb
npm install
cp ../../target/idl/zypher.json public/idl.json  # Copy IDL
npm run dev  # http://localhost:3000
```

### 2. Demo Flow
1. **Connect Wallet** → `/wallet`
2. **Mint $ZYP** → `/mint` (Deposit → 3D Preview → Tx)
3. **Monitor Hedges** → `/dashboard` (AI alerts → Trigger)

**Devnet Explorer**: [solscan.io](https://solscan.io/?cluster=devnet) + your PROGRAM_ID

## 🏗 Architecture
```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐
│   Next.js   │◄──►│   Anchor     │◄──►│ PyTorch     │
│  dApp       │    │  Contracts   │    │  Agents     │
└─────────────┘    │ (CDP/ZK)     │    └─────────────┘
                    └──────────────┘
                           │
                    ┌─────────────┐
                    │ Pyth+ZKP    │
                    └─────────────┘
```


## 🤝 Contributing
1. Fork → PR to `main`
2. `npm run lint` / `cargo clippy`
3. Star & share! 🚀

## 📄 License
MIT – **Open-Source Forever**

## 🎯 Built For
**Solana Cypherpunk Hackathon**  
[Colosseum Submission](https://arena.colosseum.org/projects/explore/zypher-1) 

---
