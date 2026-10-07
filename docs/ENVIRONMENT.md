# Vaultbreaker Environment & Configuration Audit

## 1. Environment Variable Audit

The project defines environment variable requirements in `.env.example`.

| Variable Name | Purpose | Location | Default / Fallback in Code | Required for Production |
|---|---|---|---|---|
| `DEPLOYER_PRIVATE_KEY` | EVM Private key for contract deployment | Root / Contracts | `"0x0000000000000000000000000000000000000000000000000000000000000000"` | Yes |
| `HEDERA_JSON_RPC_URL` | RPC URL for Hedera EVM Testnet | Root / Broker / Contracts | `"https://testnet.hashio.io/api"` | Yes |
| `HEDERA_CHAIN_ID` | EVM Chain ID for Hedera Testnet | Root / Broker | `296` | Yes |
| `HEDERA_OPERATOR_ID` | Hedera Native Account ID for HCS SDK | Root / Broker | `"0.0.123456"` (Triggers local mirror mode if default) | Yes (for real HCS logs) |
| `HEDERA_OPERATOR_KEY` | Hedera Native Private Key (ECDSA) for HCS | Root / Broker | Triggers fallback seed key ring if missing | Yes (for real HCS logs) |
| `HEDERA_HCS_TOPIC_ID` | Hedera Consensus Service Topic ID | Root / Broker | `"0.0.654321"` | Yes |
| `CONTRACT_CAPABILITY_REGISTRY` | Deployed `CapabilityRegistry.sol` address | Root / Broker | `"0x0000000000000000000000000000000000000000"` | Yes (for on-chain read sync) |
| `CONTRACT_FACILITATOR_ADAPTER` | Deployed `X402FacilitatorAdapter.sol` address | Root / Broker | `"0x0000000000000000000000000000000000000000"` | Optional |
| `NEXT_PUBLIC_HEDERA_JSON_RPC_URL` | Frontend Hedera RPC URL | App | `"https://testnet.hashio.io/api"` | Yes |
| `NEXT_PUBLIC_HEDERA_CHAIN_ID` | Frontend Hedera Chain ID | App | `296` | Yes |
| `NEXT_PUBLIC_CAPABILITY_REGISTRY_ADDRESS` | Frontend registry address | App | `"0x0000000000000000000000000000000000000000"` | Yes |
| `NEXT_PUBLIC_FACILITATOR_ADAPTER_ADDRESS` | Frontend adapter address | App | `"0x0000000000000000000000000000000000000000"` | Optional |
| `NEXT_PUBLIC_HCS_TOPIC_ID` | Frontend HCS Topic ID for links | App | `"0.0.654321"` | Yes |
| `NEXT_PUBLIC_BROKER_URL` | Frontend URL for Broker REST API | App | `"http://localhost:3001"` | Yes |
| `LEDGER_CLI_PATH` | Path to Ledger KeyRing CLI binary | Broker | `"wallet-cli"` | Optional (falls back to seed) |
| `BLOCKY402_FACILITATOR_URL` | x402 facilitator endpoint | Broker | `"https://blocky402.com/api"` | Optional |
| `BLOCKY402_API_KEY` | x402 facilitator API key | Broker | `"bk_test_placeholder_key"` | Optional |
| `JWT_SECRET` | Secret key for signing capability JWTs | Broker | `"vaultbreaker-broker-jwt-signing-secret-2026"` | Yes (MUST be changed in prod) |

---

## 2. Workspace & Build Configuration Analysis

### Root (`package.json`)
- `"workspaces": ["broker", "app"]`
- Uses `concurrently` v9.1.2, `tsx` v4.19.3, `typescript` v5.8.2.

### Contracts (`foundry.toml` & `remappings.txt`)
- Foundry profile targeting `src = "src"`, `out = "out"`, `libs = ["lib"]`.
- Remappings: `@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/`, `forge-std/=lib/forge-std/src/`.

### Broker (`broker/tsconfig.json`)
- `"target": "ES2022"`, `"module": "NodeNext"`, `"moduleResolution": "NodeNext"`.
- Output directory: `./dist`.

### App (`app/next.config.ts` & `vercel.json`)
- Next.js 16 App Router configuration.
- `vercel.json` configures Vercel deployment:
  ```json
  {
    "buildCommand": "cd app && npm install && npm run build",
    "outputDirectory": "app/.next",
    "installCommand": "cd app && npm install",
    "framework": "nextjs",
    "rootDirectory": "app"
  }
  ```

---

## 3. Local Development vs Production Baseline

- **Local Development**: Run `npm run dev`. Starts broker on `http://localhost:3001` and frontend on `http://localhost:3000`.
- **Production Requirements**:
  1. A persistent database/key-value store for Policy & Capability states in the broker.
  2. A dedicated HSM / Ledger CLI host for credential protection.
  3. Valid `HEDERA_OPERATOR_ID` and `HEDERA_OPERATOR_KEY` for on-chain HCS topic logging.
  4. Deployed `CapabilityRegistry.sol` contract address.
