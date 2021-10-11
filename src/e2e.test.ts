import { JWKInterface } from "arweave/node/lib/wallet";
import { interactWrite, readContract } from "smartweave";
import ArLocalUtils from "../dist";
import ArLocal from "arlocal";
import Arweave from "arweave";

let arweave: Arweave;
let arlocal: ArLocal;
let arlocalUtils: ArLocalUtils;
let wallet: JWKInterface;

const port = 1987;
const COPY_CONTRACT_TEMPLATE = "8IlrRJR3ez3orz3UIchEpuupaXYXZMwCbMiid1u5Ryo";

let copiedContractID = "";

jest.setTimeout(60000);

describe("e2e testing", () => {
  beforeAll(async () => {
    arlocal = new ArLocal(port, false);

    await arlocal.start();

    arweave = new Arweave({
      host: "localhost",
      port,
      protocol: "http"
    });
    wallet = await arweave.wallets.generate();
    await mine();

    arlocalUtils = new ArLocalUtils(arweave, wallet);
  });

  afterAll(async () => {
    await arlocal.stop();
  });

  it("should copy transactions", async () => {
    const id = await arlocalUtils.copyTransaction(
      "FGz4VCxU8_jsLeRth4aaJ586tcwgy96ot-3qD5wAFqw"
    );
    await mine();

    const copiedTx = await arweave.transactions.get(id);
    const appNameTag = copiedTx
      .get("tags")
      // @ts-ignore
      .find(
        (tag) => tag.get("name", { decode: true, string: true }) === "App-Name"
      )
      .get("value", { decode: true, string: true });

    expect(appNameTag).toEqual("ArConnect");
  });

  it("should copy contract", async () => {
    copiedContractID = await arlocalUtils.copyContract(COPY_CONTRACT_TEMPLATE);
    await mine();

    expect(copiedContractID).toMatch(/[a-z0-9_-]{43}/i);
  });

  it("should allow interactions with the copied contract", async () => {
    await interactWrite(arweave, wallet, copiedContractID, {
      function: "addOne"
    });
    await mine();

    const state = await readContract(arweave, copiedContractID);

    expect(state.test).toEqual(1);
  });

  it("should return example PST contracts", async () => {
    const psts = await arlocalUtils.examplePSTs();
    await mine();

    expect(psts).toHaveLength(4);

    for (const pst of psts) {
      expect(pst).toMatch(/[a-z0-9_-]{43}/i);
    }
  });
});

async function mine() {
  await arweave.api.get("mine");
}
