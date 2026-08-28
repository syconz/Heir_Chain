const { expect } = require("chai");
const { ethers }  = require("hardhat");
const { time }    = require("@nomicfoundation/hardhat-network-helpers");

const INACTIVITY = 180;  // 3 min (demo)
const DISPUTE    = 300;  // 5 min (demo)

describe("HeirChain V1", function () {
  let willRegistry, triggerVerifier, assetDistributor;
  let owner, heir1, heir2, guardian1, guardian2, stranger;
  let mockERC20, mockERC721;

  beforeEach(async () => {
    [owner, heir1, heir2, guardian1, guardian2, stranger] = await ethers.getSigners();

    // Deploy core contracts
    const WR = await ethers.getContractFactory("WillRegistry");
    willRegistry = await WR.deploy(INACTIVITY, DISPUTE);

    const TV = await ethers.getContractFactory("TriggerVerifier");
    triggerVerifier = await TV.deploy(await willRegistry.getAddress());

    const AD = await ethers.getContractFactory("AssetDistributor");
    assetDistributor = await AD.deploy(await willRegistry.getAddress());

    await willRegistry.setContracts(
      await triggerVerifier.getAddress(),
      await assetDistributor.getAddress()
    );

    // Deploy mock tokens
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockERC20 = await MockERC20.deploy("MockToken", "MTK", ethers.parseEther("1000"));

    const MockERC721 = await ethers.getContractFactory("MockERC721");
    mockERC721 = await MockERC721.deploy("MockNFT", "MNFT");
    await mockERC721.mint(owner.address, 1);
  });

  // ─────────────── WillRegistry ───────────────
  describe("WillRegistry — createWill", () => {
    it("creates a deadman will successfully", async () => {
      await createDeadmanWill();
      const w = await willRegistry.wills(owner.address);
      expect(w.exists).to.be.true;
      expect(w.triggerMode).to.equal(0); // DEADMAN
    });

    it("sets lastCheckInAt to block.timestamp (no immediate trigger)", async () => {
      await createDeadmanWill();
      const w = await willRegistry.wills(owner.address);
      const blockTime = await time.latest();
      expect(Number(w.lastCheckInAt)).to.be.closeTo(blockTime, 5);
    });

    it("rejects duplicate wills", async () => {
      await createDeadmanWill();
      await expect(createDeadmanWill()).to.be.revertedWith("Will already exists");
    });

    it("rejects shares not summing to 100", async () => {
      await expect(
        willRegistry.connect(owner).createWill(
          0, 0, [],
          [{ wallet: heir1.address, sharePercent: 50 }],
          [], ""
        )
      ).to.be.revertedWith("Shares must sum to 100");
    });

    it("rejects zero beneficiary address", async () => {
      await expect(
        willRegistry.connect(owner).createWill(
          0, 0, [],
          [{ wallet: ethers.ZeroAddress, sharePercent: 100 }],
          [], ""
        )
      ).to.be.revertedWith("Zero beneficiary address");
    });

    it("rejects NFT asset without explicit beneficiary", async () => {
      await expect(
        willRegistry.connect(owner).createWill(
          0, 0, [],
          [{ wallet: heir1.address, sharePercent: 100 }],
          [{ assetType: 1, tokenAddress: await mockERC721.getAddress(), tokenIdOrAmount: 1, nftBeneficiary: ethers.ZeroAddress }],
          ""
        )
      ).to.be.revertedWith("NFT needs explicit beneficiary");
    });

    it("rejects oracle mode in V1", async () => {
      await expect(
        willRegistry.connect(owner).createWill(
          2, 0, [], // ORACLE mode
          [{ wallet: heir1.address, sharePercent: 100 }],
          [], ""
        )
      ).to.be.revertedWith("Oracle mode: use DEADMAN or GUARDIAN in V1");
    });

    it("creates a guardian will successfully", async () => {
      await createGuardianWill();
      const w = await willRegistry.wills(owner.address);
      expect(w.triggerMode).to.equal(1); // GUARDIAN
    });
  });

  describe("WillRegistry — checkIn", () => {
    it("updates lastCheckInAt", async () => {
      await createDeadmanWill();
      await time.increase(60);
      await willRegistry.connect(owner).checkIn();
      const blockTime = await time.latest();
      const w = await willRegistry.wills(owner.address);
      expect(Number(w.lastCheckInAt)).to.be.closeTo(blockTime, 5);
    });

    it("blocks checkIn after trigger", async () => {
      await createDeadmanWill();
      await time.increase(INACTIVITY + 10);
      await triggerVerifier.manualTriggerForDemo(owner.address);
      await expect(
        willRegistry.connect(owner).checkIn()
      ).to.be.revertedWith("Will already triggered");
    });
  });

  describe("WillRegistry — revokeWill", () => {
    it("allows owner to revoke", async () => {
      await createDeadmanWill();
      await willRegistry.connect(owner).revokeWill();
      const w = await willRegistry.wills(owner.address);
      expect(w.exists).to.be.false;
    });
  });

  // ─────────────── TriggerVerifier — Deadman ───────────────
  describe("TriggerVerifier — Deadman Switch", () => {
    beforeEach(createDeadmanWill);

    it("checkUpkeep returns false before inactivity period", async () => {
      await triggerVerifier.registerForMonitoring(owner.address);
      const [needed] = await triggerVerifier.checkUpkeep("0x");
      expect(needed).to.be.false;
    });

    it("checkUpkeep returns true after inactivity period", async () => {
      await triggerVerifier.registerForMonitoring(owner.address);
      await time.increase(INACTIVITY + 10);
      const [needed] = await triggerVerifier.checkUpkeep("0x");
      expect(needed).to.be.true;
    });

    it("performUpkeep triggers the will", async () => {
      await triggerVerifier.registerForMonitoring(owner.address);
      await time.increase(INACTIVITY + 10);
      const [, performData] = await triggerVerifier.checkUpkeep("0x");
      await triggerVerifier.performUpkeep(performData);
      const w = await willRegistry.wills(owner.address);
      expect(w.triggered).to.be.true;
    });

    it("manualTriggerForDemo works for deployer", async () => {
      await triggerVerifier.manualTriggerForDemo(owner.address);
      const w = await willRegistry.wills(owner.address);
      expect(w.triggered).to.be.true;
    });

    it("manualTriggerForDemo blocked for non-owner", async () => {
      await expect(
        triggerVerifier.connect(stranger).manualTriggerForDemo(owner.address)
      ).to.be.reverted;
    });
  });

  // ─────────────── TriggerVerifier — Guardian ───────────────
  describe("TriggerVerifier — Guardian Multi-sig", () => {
    beforeEach(createGuardianWill);

    it("does not trigger with fewer than M votes", async () => {
      await willRegistry.connect(guardian1).castGuardianVote(owner.address);
      const w = await willRegistry.wills(owner.address);
      expect(w.triggered).to.be.false;
    });

    it("triggers when M-of-N guardians vote", async () => {
      await willRegistry.connect(guardian1).castGuardianVote(owner.address);
      await willRegistry.connect(guardian2).castGuardianVote(owner.address);
      const w = await willRegistry.wills(owner.address);
      expect(w.triggered).to.be.true;
    });

    it("prevents double voting", async () => {
      await willRegistry.connect(guardian1).castGuardianVote(owner.address);
      await expect(
        willRegistry.connect(guardian1).castGuardianVote(owner.address)
      ).to.be.revertedWith("Already voted");
    });

    it("prevents non-guardian from voting", async () => {
      await expect(
        willRegistry.connect(stranger).castGuardianVote(owner.address)
      ).to.be.revertedWith("Not a registered guardian");
    });
  });

  // ─────────────── Oracle Stub ───────────────
  describe("TriggerVerifier — Oracle Stub", () => {
    beforeEach(createDeadmanWill);

    it("oracle role holder can confirm death", async () => {
      await triggerVerifier.oracleConfirmDeath(owner.address);
      const w = await willRegistry.wills(owner.address);
      expect(w.triggered).to.be.true;
    });

    it("non-oracle cannot call oracleConfirmDeath", async () => {
      await expect(
        triggerVerifier.connect(stranger).oracleConfirmDeath(owner.address)
      ).to.be.revertedWith("Not oracle");
    });
  });

  // ─────────────── AssetDistributor ───────────────
  describe("AssetDistributor — distribute", () => {
    beforeEach(async () => {
      // Approve tokens
      await mockERC20.connect(owner).approve(
        await assetDistributor.getAddress(),
        ethers.parseEther("1000")
      );
      await mockERC721.connect(owner).approve(
        await assetDistributor.getAddress(),
        1
      );

      // Create will with ERC20 + ERC721
      await willRegistry.connect(owner).createWill(
        0, 0, [],
        [
          { wallet: heir1.address, sharePercent: 60 },
          { wallet: heir2.address, sharePercent: 40 },
        ],
        [
          { assetType: 0, tokenAddress: await mockERC20.getAddress(), tokenIdOrAmount: ethers.parseEther("100"), nftBeneficiary: ethers.ZeroAddress },
          { assetType: 1, tokenAddress: await mockERC721.getAddress(), tokenIdOrAmount: 1, nftBeneficiary: heir1.address },
        ],
        "ipfs://testCID"
      );
    });

    it("blocks distribution before trigger", async () => {
      await expect(
        assetDistributor.distribute(owner.address)
      ).to.be.revertedWith("Will not triggered yet");
    });

    it("blocks distribution during dispute window", async () => {
      await triggerVerifier.manualTriggerForDemo(owner.address);
      await expect(
        assetDistributor.distribute(owner.address)
      ).to.be.revertedWith("Dispute window still active");
    });

    it("distributes ERC20 and ERC721 after dispute window", async () => {
      await triggerVerifier.manualTriggerForDemo(owner.address);
      await time.increase(DISPUTE + 10);

      const heir1Before = await mockERC20.balanceOf(heir1.address);
      await assetDistributor.distribute(owner.address);

      const heir1After  = await mockERC20.balanceOf(heir1.address);
      expect(heir1After - heir1Before).to.equal(ethers.parseEther("60")); // 60% of 100

      // NFT should be with heir1 (explicit beneficiary)
      expect(await mockERC721.ownerOf(1)).to.equal(heir1.address);
    });

    it("blocks double distribution", async () => {
      await triggerVerifier.manualTriggerForDemo(owner.address);
      await time.increase(DISPUTE + 10);
      await assetDistributor.distribute(owner.address);
      await expect(
        assetDistributor.distribute(owner.address)
      ).to.be.revertedWith("Already distributed");
    });
  });

  // ─────────────── Helpers ───────────────
  async function createDeadmanWill() {
    return willRegistry.connect(owner).createWill(
      0, // DEADMAN
      0, [],
      [
        { wallet: heir1.address, sharePercent: 60 },
        { wallet: heir2.address, sharePercent: 40 },
      ],
      [],
      "ipfs://testCID"
    );
  }

  async function createGuardianWill() {
    return willRegistry.connect(owner).createWill(
      1, // GUARDIAN
      2, // 2-of-2
      [guardian1.address, guardian2.address],
      [{ wallet: heir1.address, sharePercent: 100 }],
      [],
      ""
    );
  }
});
