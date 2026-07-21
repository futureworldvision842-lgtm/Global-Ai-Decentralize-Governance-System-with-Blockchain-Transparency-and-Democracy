# Smart-contract status

No contract in this folder is production-approved or deployed by this project.

- `AuditAnchorRegistry.sol` is the only current production-direction contract.
  It records a Merkle root and metadata URI so off-chain audit batches can later
  prove that a root existed. It cannot decide proposals, identify voters, hold
  funds, mint rewards or prove that source data was truthful.
- `SocietyGovernor.sol`, `SocietyTreasury.sol`, `GigEscrow.sol` and
  `GovernanceToken.sol` are legacy sandbox prototypes. They lack the complete
  membership proof, upgrade/timelock, recovery, dispute, multisig, pause,
  reentrancy, economic, privacy and independent-audit controls required for use.

Do not deploy contracts that custody money or create tokens until the legal model,
threat model, chain, key custody, upgrade policy, incident response, monitoring,
formal test suite and independent audit are approved. GAIGS governance remains
off-chain and server-enforced during the bounded pilot; optional blockchain
anchoring hardens receipts after the underlying controls work.
