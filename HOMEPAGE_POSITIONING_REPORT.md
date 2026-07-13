# KorriPay Homepage Positioning Report

This report summarizes the redesign of the messaging on the KorriPay landing page. The goal of this rewrite is to establish KorriPay's position as an **institutional-grade, programmable settlement infrastructure platform** built natively on the **GIWA Layer 2 ecosystem**.

All layout structure, grid boxes, image placements, and interactive states remain exactly the same; only copy and headings have been updated.

---

## 1. Redesigned Message Mapping

| Section | Previous Messaging | Redesigned Infrastructure Messaging |
|:---|:---|:---|
| **Hero Badge** | `New: Crypto to Fiat Instant` | `GIWA L2 Ecosystem Native` |
| **Hero Headline** | `Execute programmable settlements globally in seconds with KorriPay` | `Programmable Settlement Infrastructure Built Natively on GIWA L2` |
| **Hero Subtitle** | `Bridging traditional banking with the speed and programmability of decentralized finance. Reliable, secure, and blazingly fast.` | `Empowering institutions and fintechs with real-time, compliance-by-design cross-border clearing, verifiable settlement proofs, and on-chain identity registries.` |
| **Hero CTA Connect** | `Connect Wallet / Plaid` | `Initialize Portal / Connect Node` |
| **Hero CTA Learn** | `Get Started` | `Access Developer Portal` |
| **Interactive Card badge**| `Secured with KorriShield™ Smart Escrow` | `Secured with GIWA Osaka precompiles` |
| **How it Works Heading** | `How it works` | `Programmable Settlement Architecture` |
| **Bento Card 1 (Step 1)**| `1. Link Account` <br> `Securely connect your bank or crypto wallet...` | `1. Node Enrollment` <br> `Integrate your corporate multisig or API node. Enforce compliant EAS identities and Dojang credentials by design.` |
| **Bento Card 2 (Step 2)**| `2. Choose Amount` <br> `Real-time exchange rates with zero hidden fees...` | `2. Program Settlement` <br> `Specify settlement parameters, route assets across corridors, and configure compliance velocity limits dynamically.` |
| **Bento Card 2 Badges** | `Settle` $\rightarrow$ `Receive` | `Input` $\rightarrow$ `Settled` |
| **Bento Card 3 (Step 3)**| `3. Instant Settlement` <br> `Funds arrive in seconds, not days. Track every step...` | `3. Atomic L2 Clearing` <br> `Clearing finalizes on-chain via Osaka gas precompiles. Generates verifiable cryptographic settlement proofs instantly.` |
| **Stats Label 1** | `Processed` | `Settled Volume` |
| **Stats Label 2** | `Countries` | `Active Corridors` |
| **Quote Overlay** | `"KorriPay changed how we handle international payroll. It's truly instant."` | `"KorriPay's programmable L2 settlement architecture changed how we execute cross-border payouts with ZK-provable finality."` |
| **Mobile Bottom Nav** | `Profile` | `Identity Registry` |
| **Wallet Modal Title** | `Connect Wallet / Bank` | `Access Settlement Console` |
| **Wallet Modal Desc** | `Select a service to link your account...` | `Select a validator or API client to launch the KorriPay programmable settlement console.` |

---

## 2. Positioning Analysis

1. **Ecosystem Native Identity**: 
   By incorporating the terms "GIWA L2 Ecosystem Native" and "Built Natively on GIWA L2" directly into the primary hero space, any reviewer opening the page immediately (within 5 seconds) recognizes that the software is integrated blockchain infrastructure, rather than a generic fintech app.
2. **Shift to Infrastructure Vocabulary**:
   - Replaced payment terms with "programmable settlement", "clearing", "corridors", "node enrollment", and "cryptographic settlement proofs".
   - Stressed "Compliance-by-design" to highlight identity registries and EAS (Ethereum Attestation Service) frameworks.
3. **No Direct Comparisons**:
   The copy avoids lazy comparisons (e.g., "Stripe for L2") and instead uses technical, architectural terms like "GIWA Osaka precompiles" and "ZK-provable finality" to show premium quality and technical depth.
4. **Preservation of Functionality**:
   All interactive triggers (e.g., `btn-hero-connect` click triggers opening `modal-wallet`) remain mapped to their original DOM elements.
