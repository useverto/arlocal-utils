import { JWKInterface } from "arweave/node/lib/wallet";
import ArLocalUtils from "../dist";
import ArLocal from "arlocal";
import Arweave from "arweave";

let arweave: Arweave;
let arlocal: ArLocal;
let arlocalUtils: ArLocalUtils;
let wallet: JWKInterface;

const port = 1987;

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
});

async function mine() {
  await arweave.api.get("mine");
}
