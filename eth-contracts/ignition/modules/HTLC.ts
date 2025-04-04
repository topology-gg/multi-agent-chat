import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("HTLC", (m) => {
  const htlc = m.contract("HashedTimelockERC20", []);
  
  return { htlc };
});
