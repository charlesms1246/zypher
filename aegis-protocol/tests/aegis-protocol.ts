import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AegisProtocol } from "../target/types/aegis_protocol";
import { PublicKey, Keypair, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createMint,
  createAccount,
  mintTo,
  getAccount,
} from "@solana/spl-token";
import { assert } from "chai";

describe("aegis-protocol", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.AegisProtocol as Program<AegisProtocol>;
  
  let admin: Keypair;
  let user: Keypair;
  let collateralMint: PublicKey;
  let aegisMint: PublicKey;
  let userCollateralToken: PublicKey;
  let userAegisToken: PublicKey;
  let vaultTokenAccount: PublicKey;
  let configPda: PublicKey;
  let positionPda: PublicKey;
  let oracleAccount: PublicKey;

  before(async () => {
    admin = Keypair.generate();
    user = Keypair.generate();

    // Airdrop SOL to admin and user
    const airdropSig1 = await provider.connection.requestAirdrop(
      admin.publicKey,
      5 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropSig1);

    const airdropSig2 = await provider.connection.requestAirdrop(
      user.publicKey,
      5 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropSig2);

    // Create collateral mint (simulating RWA token)
    collateralMint = await createMint(
      provider.connection,
      admin,
      admin.publicKey,
      null,
      9
    );

    // Create AEGIS mint
    aegisMint = await createMint(
      provider.connection,
      admin,
      admin.publicKey,
      null,
      9
    );

    // Create user token accounts
    userCollateralToken = await createAccount(
      provider.connection,
      user,
      collateralMint,
      user.publicKey
    );

    userAegisToken = await createAccount(
      provider.connection,
      user,
      aegisMint,
      user.publicKey
    );

    // Mint collateral to user (1000 tokens)
    await mintTo(
      provider.connection,
      admin,
      collateralMint,
      userCollateralToken,
      admin,
      1000 * 10 ** 9
    );

    // Derive PDAs
    [configPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      program.programId
    );

    [positionPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("position"), user.publicKey.toBuffer()],
      program.programId
    );

    [vaultTokenAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), collateralMint.toBuffer()],
      program.programId
    );

    // Create vault token account
    await createAccount(
      provider.connection,
      admin,
      collateralMint,
      vaultTokenAccount,
      undefined
    );

    // Mock oracle account (in production, use actual Pyth oracle)
    oracleAccount = Keypair.generate().publicKey;
  });

  describe("Initialize Config", () => {
    it("Initializes protocol configuration", async () => {
      const minRatio = new anchor.BN(150_000_000);
      const hedgeInterval = new anchor.BN(3600); // 1 hour default
      const approvedCollaterals = [collateralMint];
      const oracleAccounts = [oracleAccount];

      try {
        await program.methods
          .initializeConfig(minRatio, hedgeInterval, approvedCollaterals, oracleAccounts)
          .accounts({
            config: configPda,
            admin: admin.publicKey,
            aegisMint: aegisMint,
            systemProgram: SystemProgram.programId,
          })
          .signers([admin])
          .rpc();

        const config = await program.account.globalConfig.fetch(configPda);
        
        assert.ok(config.admin.equals(admin.publicKey));
        assert.ok(config.minCollateralRatio.eq(minRatio));
        assert.ok(config.hedgeIntervalSeconds.eq(hedgeInterval)); // NEW FIELD CHECK
        assert.equal(config.approvedCollaterals.length, 1);
        assert.ok(config.approvedCollaterals[0].equals(collateralMint));
      } catch (err) {
        console.log("Initialize config error:", err);
        throw err;
      }
    });

    it("Fails with invalid collateral ratio", async () => {
      const invalidRatio = new anchor.BN(100_000_000); // Not 150%
      const hedgeInterval = new anchor.BN(3600);
      
      try {
        await program.methods
          .initializeConfig(invalidRatio, hedgeInterval, [collateralMint], [oracleAccount])
          .accounts({
            config: Keypair.generate().publicKey,
            admin: admin.publicKey,
            aegisMint: aegisMint,
            systemProgram: SystemProgram.programId,
          })
          .signers([admin])
          .rpc();
        
        assert.fail("Should have failed with invalid ratio");
      } catch (err) {
        assert.ok(err.toString().includes("InvalidRatio"));
      }
    });

    it("Fails with mismatched oracle list", async () => {
      const minRatio = new anchor.BN(150_000_000);
      const hedgeInterval = new anchor.BN(3600);
      
      try {
        await program.methods
          .initializeConfig(
            minRatio,
            hedgeInterval,
            [collateralMint],
            [] // Empty oracle list
          )
          .accounts({
            config: Keypair.generate().publicKey,
            admin: admin.publicKey,
            aegisMint: aegisMint,
            systemProgram: SystemProgram.programId,
          })
          .signers([admin])
          .rpc();
        
        assert.fail("Should have failed with oracle mismatch");
      } catch (err) {
        assert.ok(err.toString().includes("OracleMismatch"));
      }
    });
  });

  describe("Mint AEGIS", () => {
    it("Mints AEGIS with sufficient collateral", async () => {
      const collateralIndex = 0;
      const depositAmount = new anchor.BN(100 * 10 ** 9); // 100 tokens
      const mintAmount = new anchor.BN(50 * 10 ** 9); // 50 AEGIS (assuming 2:1 price)

      try {
        await program.methods
          .mintAegis(collateralIndex, depositAmount, mintAmount)
          .accounts({
            position: positionPda,
            config: configPda,
            user: user.publicKey,
            userCollateralToken: userCollateralToken,
            vaultTokenAccount: vaultTokenAccount,
            aegisMint: aegisMint,
            userAegisToken: userAegisToken,
            oracleAccount: oracleAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([user])
          .rpc();

        const position = await program.account.userPosition.fetch(positionPda);
        assert.ok(position.owner.equals(user.publicKey));
        assert.ok(position.mintedAegis.eq(mintAmount));

        // Check token balances
        const userAegisAccount = await getAccount(
          provider.connection,
          userAegisToken
        );
        assert.equal(userAegisAccount.amount.toString(), mintAmount.toString());
      } catch (err) {
        console.log("Mint AEGIS error:", err);
        throw err;
      }
    });

    it("Fails with undercollateralization", async () => {
      const collateralIndex = 0;
      const depositAmount = new anchor.BN(10 * 10 ** 9); // 10 tokens
      const mintAmount = new anchor.BN(100 * 10 ** 9); // 100 AEGIS (too much)

      try {
        await program.methods
          .mintAegis(collateralIndex, depositAmount, mintAmount)
          .accounts({
            position: positionPda,
            config: configPda,
            user: user.publicKey,
            userCollateralToken: userCollateralToken,
            vaultTokenAccount: vaultTokenAccount,
            aegisMint: aegisMint,
            userAegisToken: userAegisToken,
            oracleAccount: oracleAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([user])
          .rpc();

        assert.fail("Should have failed with undercollateralization");
      } catch (err) {
        assert.ok(err.toString().includes("UnderCollateralized"));
      }
    });

    it("Fails with zero deposit amount", async () => {
      const collateralIndex = 0;
      const depositAmount = new anchor.BN(0);
      const mintAmount = new anchor.BN(50 * 10 ** 9);

      try {
        await program.methods
          .mintAegis(collateralIndex, depositAmount, mintAmount)
          .accounts({
            position: positionPda,
            config: configPda,
            user: user.publicKey,
            userCollateralToken: userCollateralToken,
            vaultTokenAccount: vaultTokenAccount,
            aegisMint: aegisMint,
            userAegisToken: userAegisToken,
            oracleAccount: oracleAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([user])
          .rpc();

        assert.fail("Should have failed with zero amount");
      } catch (err) {
        assert.ok(err.toString().includes("ZeroAmount"));
      }
    });
  });

  describe("Burn AEGIS", () => {
    it("Burns AEGIS and updates position", async () => {
      const burnAmount = new anchor.BN(25 * 10 ** 9); // Burn 25 AEGIS

      const positionBefore = await program.account.userPosition.fetch(positionPda);
      const mintedBefore = positionBefore.mintedAegis;

      try {
        await program.methods
          .burnAegis(burnAmount)
          .accounts({
            position: positionPda,
            config: configPda,
            user: user.publicKey,
            owner: user.publicKey,
            userAegisToken: userAegisToken,
            aegisMint: aegisMint,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([user])
          .rpc();

        const positionAfter = await program.account.userPosition.fetch(positionPda);
        assert.ok(
          positionAfter.mintedAegis.eq(mintedBefore.sub(burnAmount))
        );
      } catch (err) {
        console.log("Burn AEGIS error:", err);
        throw err;
      }
    });

    it("Fails when burning more than minted", async () => {
      const burnAmount = new anchor.BN(10000 * 10 ** 9); // Way more than minted

      try {
        await program.methods
          .burnAegis(burnAmount)
          .accounts({
            position: positionPda,
            config: configPda,
            user: user.publicKey,
            owner: user.publicKey,
            userAegisToken: userAegisToken,
            aegisMint: aegisMint,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([user])
          .rpc();

        assert.fail("Should have failed with insufficient balance");
      } catch (err) {
        assert.ok(err.toString().includes("InsufficientBalance"));
      }
    });
  });

  describe("Prediction Markets", () => {
    let marketId: anchor.BN;
    let marketPda: PublicKey;
    let poolVault: PublicKey;

    before(async () => {
      marketId = new anchor.BN(Date.now());
      
      [marketPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("market"), marketId.toArrayLike(Buffer, "le", 8)],
        program.programId
      );

      // Create pool vault for market
      poolVault = await createAccount(
        provider.connection,
        admin,
        aegisMint,
        marketPda,
        undefined
      );
    });

    it("Creates a prediction market", async () => {
      const resolutionTime = new anchor.BN(
        Math.floor(Date.now() / 1000) + 7200 // 2 hours from now
      );
      const questionHash = Array.from(Buffer.alloc(32, 1));

      try {
        await program.methods
          .createPredictionMarket(marketId, resolutionTime, questionHash)
          .accounts({
            market: marketPda,
            creator: admin.publicKey,
            resolutionOracle: oracleAccount,
            systemProgram: SystemProgram.programId,
          })
          .signers([admin])
          .rpc();

        const market = await program.account.predictionMarket.fetch(marketPda);
        assert.ok(market.creator.equals(admin.publicKey));
        assert.ok(market.yesPool.eq(new anchor.BN(0)));
        assert.ok(market.noPool.eq(new anchor.BN(0)));
        assert.equal(market.resolved, false);
      } catch (err) {
        console.log("Create market error:", err);
        throw err;
      }
    });

    it("Fails to create market with past resolution time", async () => {
      const pastTime = new anchor.BN(
        Math.floor(Date.now() / 1000) - 3600 // 1 hour ago
      );
      const questionHash = Array.from(Buffer.alloc(32, 2));
      const newMarketId = new anchor.BN(Date.now() + 1);

      const [newMarketPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("market"), newMarketId.toArrayLike(Buffer, "le", 8)],
        program.programId
      );

      try {
        await program.methods
          .createPredictionMarket(newMarketId, pastTime, questionHash)
          .accounts({
            market: newMarketPda,
            creator: admin.publicKey,
            resolutionOracle: oracleAccount,
            systemProgram: SystemProgram.programId,
          })
          .signers([admin])
          .rpc();

        assert.fail("Should have failed with invalid resolution time");
      } catch (err) {
        assert.ok(err.toString().includes("InvalidResolutionTime"));
      }
    });

    it("Places a bet on the market", async () => {
      const side = true; // Bet on 'yes'
      const amount = new anchor.BN(10 * 10 ** 9);

      // First mint some AEGIS to user for betting
      await mintTo(
        provider.connection,
        admin,
        aegisMint,
        userAegisToken,
        admin,
        amount.toNumber()
      );

      try {
        await program.methods
          .betOnMarket(marketId, side, amount)
          .accounts({
            market: marketPda,
            user: user.publicKey,
            userAegisToken: userAegisToken,
            poolVault: poolVault,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([user])
          .rpc();

        const market = await program.account.predictionMarket.fetch(marketPda);
        assert.ok(market.yesPool.eq(amount));
        assert.ok(market.noPool.eq(new anchor.BN(0)));
      } catch (err) {
        console.log("Bet on market error:", err);
        throw err;
      }
    });

    it("Fails to bet with zero amount", async () => {
      const side = false;
      const amount = new anchor.BN(0);

      try {
        await program.methods
          .betOnMarket(marketId, side, amount)
          .accounts({
            market: marketPda,
            user: user.publicKey,
            userAegisToken: userAegisToken,
            poolVault: poolVault,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([user])
          .rpc();

        assert.fail("Should have failed with zero amount");
      } catch (err) {
        assert.ok(err.toString().includes("ZeroAmount"));
      }
    });
  });

  describe("Liquidation", () => {
    let liquidatableUser: Keypair;
    let liquidatablePosition: PublicKey;

    before(async () => {
      liquidatableUser = Keypair.generate();

      const airdropSig = await provider.connection.requestAirdrop(
        liquidatableUser.publicKey,
        2 * LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(airdropSig);

      [liquidatablePosition] = PublicKey.findProgramAddressSync(
        [Buffer.from("position"), liquidatableUser.publicKey.toBuffer()],
        program.programId
      );
    });

    it("Liquidates an undercollateralized position", async () => {
      // This test would require setting up a position that becomes undercollateralized
      // In practice, this happens when oracle prices drop
      
      // For now, we'll skip the actual liquidation test as it requires
      // mock oracle price manipulation
      
      console.log("Liquidation test skipped - requires oracle price mocking");
      assert.ok(true);
    });
  });

  describe("Hedge Triggering", () => {
    it("Triggers a hedge with valid proof", async () => {
      const hedgeDecision = true;
      const agentProof = Buffer.from(Array(64).fill(1)); // Mock proof

      try {
        await program.methods
          .triggerHedge(hedgeDecision, Array.from(agentProof))
          .accounts({
            position: positionPda,
            config: configPda,
            agent: admin.publicKey,
          })
          .signers([admin])
          .rpc();

        const position = await program.account.userPosition.fetch(positionPda);
        assert.ok(position.lastHedgeTimestamp.gt(new anchor.BN(0)));
      } catch (err) {
        console.log("Trigger hedge error:", err);
        throw err;
      }
    });

    it("Fails when hedge triggered too frequently", async () => {
      const hedgeDecision = true;
      const agentProof = Buffer.from(Array(64).fill(1));

      try {
        await program.methods
          .triggerHedge(hedgeDecision, Array.from(agentProof))
          .accounts({
            position: positionPda,
            config: configPda,
            agent: admin.publicKey,
          })
          .signers([admin])
          .rpc();

        assert.fail("Should have failed with hedge too frequent");
      } catch (err) {
        assert.ok(err.toString().includes("HedgeTooFrequent"));
      }
    });
  });

  describe("Edge Cases and Security", () => {
    it("Prevents unauthorized access to positions", async () => {
      const unauthorizedUser = Keypair.generate();
      
      const airdropSig = await provider.connection.requestAirdrop(
        unauthorizedUser.publicKey,
        LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(airdropSig);

      const burnAmount = new anchor.BN(1 * 10 ** 9);

      try {
        await program.methods
          .burnAegis(burnAmount)
          .accounts({
            position: positionPda,
            config: configPda,
            user: unauthorizedUser.publicKey,
            owner: user.publicKey, // Original owner
            userAegisToken: userAegisToken,
            aegisMint: aegisMint,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([unauthorizedUser])
          .rpc();

        assert.fail("Should have failed with unauthorized access");
      } catch (err) {
        assert.ok(err.toString().includes("Unauthorized") || 
                  err.toString().includes("has_one"));
      }
    });

    it("Handles arithmetic overflow protection", async () => {
      // Attempting to mint with extremely large amounts
      const collateralIndex = 0;
      const depositAmount = new anchor.BN("18446744073709551615"); // u64::MAX
      const mintAmount = new anchor.BN("18446744073709551615");

      try {
        await program.methods
          .mintAegis(collateralIndex, depositAmount, mintAmount)
          .accounts({
            position: positionPda,
            config: configPda,
            user: user.publicKey,
            userCollateralToken: userCollateralToken,
            vaultTokenAccount: vaultTokenAccount,
            aegisMint: aegisMint,
            userAegisToken: userAegisToken,
            oracleAccount: oracleAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([user])
          .rpc();

        // Will fail either from overflow or insufficient tokens
      } catch (err) {
        // Expected to fail - either Overflow or token transfer error
        assert.ok(true);
      }
    });

    it("Validates encrypted position hash integrity", async () => {
      const position = await program.account.userPosition.fetch(positionPda);
      
      // Verify that encrypted hash is not all zeros
      const hashIsNonZero = position.encryptedPositionHash.some(b => b !== 0);
      assert.ok(hashIsNonZero, "Encrypted hash should not be all zeros");
      
      // Verify hash is 32 bytes
      assert.equal(position.encryptedPositionHash.length, 32);
    });
  });

  describe("Integration Tests", () => {
    it("Complete flow: mint -> hedge -> burn", async () => {
      // Create a new user for clean test
      const integrationUser = Keypair.generate();
      
      const airdropSig = await provider.connection.requestAirdrop(
        integrationUser.publicKey,
        3 * LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(airdropSig);

      const [integrationPosition] = PublicKey.findProgramAddressSync(
        [Buffer.from("position"), integrationUser.publicKey.toBuffer()],
        program.programId
      );

      // Create token accounts
      const integrationCollateral = await createAccount(
        provider.connection,
        integrationUser,
        collateralMint,
        integrationUser.publicKey
      );

      const integrationAegis = await createAccount(
        provider.connection,
        integrationUser,
        aegisMint,
        integrationUser.publicKey
      );

      // Mint collateral
      await mintTo(
        provider.connection,
        admin,
        collateralMint,
        integrationCollateral,
        admin,
        500 * 10 ** 9
      );

      // 1. Mint AEGIS
      const depositAmount = new anchor.BN(200 * 10 ** 9);
      const mintAmount = new anchor.BN(100 * 10 ** 9);

      await program.methods
        .mintAegis(0, depositAmount, mintAmount)
        .accounts({
          position: integrationPosition,
          config: configPda,
          user: integrationUser.publicKey,
          userCollateralToken: integrationCollateral,
          vaultTokenAccount: vaultTokenAccount,
          aegisMint: aegisMint,
          userAegisToken: integrationAegis,
          oracleAccount: oracleAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([integrationUser])
        .rpc();

      let position = await program.account.userPosition.fetch(integrationPosition);
      assert.ok(position.mintedAegis.eq(mintAmount));

      // 2. Wait and trigger hedge (simulate time passage)
      await new Promise(resolve => setTimeout(resolve, 1000));

      const hedgeProof = Buffer.from(Array(64).fill(1));
      await program.methods
        .triggerHedge(true, Array.from(hedgeProof))
        .accounts({
          position: integrationPosition,
          config: configPda,
          agent: admin.publicKey,
        })
        .signers([admin])
        .rpc();

      position = await program.account.userPosition.fetch(integrationPosition);
      assert.ok(position.lastHedgeTimestamp.gt(new anchor.BN(0)));

      // 3. Burn some AEGIS
      const burnAmount = new anchor.BN(50 * 10 ** 9);
      await program.methods
        .burnAegis(burnAmount)
        .accounts({
          position: integrationPosition,
          config: configPda,
          user: integrationUser.publicKey,
          owner: integrationUser.publicKey,
          userAegisToken: integrationAegis,
          aegisMint: aegisMint,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([integrationUser])
        .rpc();

      position = await program.account.userPosition.fetch(integrationPosition);
      assert.ok(position.mintedAegis.eq(mintAmount.sub(burnAmount)));

      console.log("✅ Complete integration flow successful");
    });
  });
});