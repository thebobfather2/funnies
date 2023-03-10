import { CandyShop } from "@liqnft/candy-shop-sdk";
import { Cluster, PublicKey } from "@solana/web3.js";

const CANDY_SHOP_CREATOR_ADDRESS = new PublicKey(
  process.env.REACT_APP_CANDY_SHOP_CREATOR_ADDRESS!
);
const CANDY_SHOP_TREASURY_MINT_CANS = new PublicKey(
  process.env.REACT_APP_CANDY_SHOP_TREASURY_MINT_CANS!
);
const CANDY_SHOP_PROGRAM_ID_CANS = new PublicKey(
  process.env.REACT_APP_CANDY_SHOP_PROGRAM_ID_CANS!
);
const NETWORK = process.env.REACT_APP_SOLANA_NETWORK! as Cluster;
const RPC = 'https://solana-api.projectserum.com/'

const candyShopCans = new CandyShop({
  candyShopCreatorAddress: CANDY_SHOP_CREATOR_ADDRESS,
  treasuryMint: CANDY_SHOP_TREASURY_MINT_CANS,
  candyShopProgramId: CANDY_SHOP_PROGRAM_ID_CANS,
  env: NETWORK,
  settings: {
    currencyDecimals: Number(0),
    currencySymbol: "$CAROT",
    mainnetConnectionUrl: RPC
  },
});

export {
  candyShopCans,
  CANDY_SHOP_CREATOR_ADDRESS,
  CANDY_SHOP_TREASURY_MINT_CANS,
  CANDY_SHOP_PROGRAM_ID_CANS,
  NETWORK,
};

