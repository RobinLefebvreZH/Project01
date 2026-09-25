# RWA Token Factory

A platform for issuing **permissioned ERC-20 tokens backed by real-world assets** (real estate, private credit, commodities, art, …) on Ethereum.

- **Factory**: the platform owner approves issuers. Approved issuers can deploy a new token in one transaction.
- **Tokens**: immutable [EIP-1167](https://eips.ethereum.org/EIPS/eip-1167) clones of one audited implementation (about 600k gas per token, versus roughly 3M for deploying the full contract each time).
- **Compliance**: only allowlisted (KYC'd) wallets can hold or transfer. Agents can freeze wallets, pause the token, and force-transfer tokens to recover them.
- **Supply**: issuers mint to investors on subscription and burn on redemption, with an optional maximum supply.
- **Asset data**: on-chain record of the asset type, jurisdiction, legal entity, valuation, and legal documents (IPFS URI + keccak256 hash).
- **Web app**: Next.js + wagmi + RainbowKit, with pages for the platform admin, issuers and investors.

```
Project01/
├── contracts/            Foundry project
│   ├── src/
│   │   ├── RWATokenFactory.sol
│   │   ├── RWAToken.sol
│   │   └── interfaces/IRWAToken.sol
│   ├── test/             53 unit + fuzz tests
│   └── script/Deploy.s.sol
├── web/                  Next.js 16 app
│   └── src/app/          / (registry) · /issuer · /admin · /token/[address] · /api/ipfs
└── .github/workflows/    CI: forge fmt/build/test + web typecheck/build
```

## How it works

```
 Platform owner (Safe multisig)
        │ setIssuer(issuer, true)
        ▼
 RWATokenFactory ──createToken()──► RWAToken clone ◄── delegates to ── RWAToken implementation
        ▲                               │
   Approved issuer                      ├─ issuer = DEFAULT_ADMIN_ROLE + AGENT_ROLE
                                        ├─ allowlist / freeze / pause
                                        ├─ mint / burn / forcedTransfer
                                        └─ assetInfo + documents
```

### Roles

| Role | Who | Can |
|---|---|---|
| Factory **owner** | Platform (you) | Approve and revoke issuers. Transfer ownership (two-step). Has **no power** over tokens once they are created. |
| Token **admin** (`DEFAULT_ADMIN_ROLE`) | Issuer | Add and remove agents. |
| Token **agent** (`AGENT_ROLE`) | Issuer + their delegates (transfer agent, compliance officer) | Allowlist, freeze, pause, mint, burn, force-transfer, update valuation and documents. |
| **Investor** | Allowlisted wallet | Hold and transfer to other allowlisted wallets. |

### Transfer rules

| Action | Rules |
|---|---|
| `transfer` / `transferFrom` | Token not paused · sender **and** receiver allowlisted · neither frozen |
| `mint` | Agent only · token not paused · receiver allowlisted and not frozen · cap respected |
| `burn` | Agent only · works while paused or frozen (redemptions, court orders) |
| `forcedTransfer` | Agent only · works while paused or frozen · receiver must be allowlisted |

Valuations are stored in the currency's smallest unit (for example, cents: `2500000000` = 25,000,000.00 CHF).

## Quick start (local)

Requirements: [Foundry](https://getfoundry.sh) and Node.js 20+.

```bash
git clone --recurse-submodules https://github.com/RobinLefebvreZH/Project01.git
cd Project01

# 1. Contracts
cd contracts
forge test                     # 53 tests, including fuzzing

# 2. Local chain + deploy (in a second terminal: `anvil`)
export FACTORY_OWNER=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266   # anvil account #0
export INITIAL_ISSUERS=$FACTORY_OWNER
forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80   # anvil's public test key

# 3. Web app
cd ../web
cp .env.example .env.local      # then set NEXT_PUBLIC_ENABLE_LOCAL=true and NEXT_PUBLIC_FACTORY_ADDRESS_LOCAL
npm install
npm run dev                     # http://localhost:3000
```

Add the Anvil network to MetaMask (RPC `http://127.0.0.1:8545`, chain id `31337`) and import anvil account #0 to act as admin and issuer.

## Deploy to Sepolia, then mainnet

1. Get the keys and accounts listed in [`contracts/.env.example`](contracts/.env.example) and [`web/.env.example`](web/.env.example).
2. Store your deployer key **encrypted** (never in a file):
   ```bash
   cast wallet import deployer --interactive
   ```
3. Deploy and verify on Etherscan:
   ```bash
   cd contracts && source .env
   forge script script/Deploy.s.sol --rpc-url sepolia --account deployer --broadcast --verify
   ```
4. Put the printed factory address in `web/.env.local` (`NEXT_PUBLIC_FACTORY_ADDRESS_SEPOLIA`).
5. Deploy the web app (for example, on Vercel: import the repo, set the root directory to `web`, and add the environment variables).
6. For **mainnet**, repeat step 3 with `--rpc-url mainnet` and set `FACTORY_OWNER` to a **Safe multisig**.

### Before mainnet: checklist

- [ ] Independent smart-contract **security audit**.
- [ ] Factory owner is a **Safe multisig** with hardware-wallet signers.
- [ ] Legal review: in Switzerland, tokenized assets are typically **ledger-based securities** under the DLT Act (CO art. 973d). Check the prospectus, AML/KYC (FINMA) and custody requirements with a lawyer.
- [ ] A KYC provider process that decides who gets allowlisted (the contract enforces the allowlist; it doesn't do KYC).
- [ ] Full dress rehearsal on Sepolia: create, allowlist, mint, transfer, freeze, force-transfer, burn.

## Commands

| Where | Command | What |
|---|---|---|
| `contracts/` | `forge test` | Run all tests |
| `contracts/` | `forge coverage` | Coverage report |
| `contracts/` | `forge build --sizes` | Contract sizes |
| `web/` | `npm run abi` | Re-export ABIs after changing contracts (run `forge build` first) |
| `web/` | `npm run lint` | Type-check |
| `web/` | `npm run build` | Production build |

## Disclaimer

This software is provided as-is and has **not been audited**. Issuing tokens that represent real-world assets is regulated in most jurisdictions. Get legal advice before offering tokens to investors.

## License

MIT
