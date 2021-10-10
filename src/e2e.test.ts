import ArLocalUtils from "../dist";
import ArLocal from "arlocal";
import Arweave from "arweave";

let arweave: Arweave;
let arlocal: ArLocal;
let arlocalUtils: ArLocalUtils;

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
    arlocalUtils = new ArLocalUtils(arweave);
  });

  afterAll(async () => {
    await arlocal.stop();
  });

  it("should copy transactions", async () => {
    const id = await arlocalUtils.copyTransaction(
      "FGz4VCxU8_jsLeRth4aaJ586tcwgy96ot-3qD5wAFqw"
    );
    await mine();

    expect(
      (await arweave.transactions.get(id)).get("target", {
        decode: true,
        string: true
      })
    ).toEqual("ljvCPN31XCLPkBo9FUeB7vAK0VC6-eY52-CS-6Iho8U");
  });
});

async function mine() {
  await arweave.api.get("mine");
}
