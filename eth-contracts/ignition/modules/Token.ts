import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("Token", (m) => {
  const token = m.contract("MyToken", [
    "MyToken",
    "MTK"
  ]);
  
  return { token };
});
