import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import MyNFTABI from "../../../../contract/artifacts/contracts/MyNFT.sol/MyNFT.json";
import { prisma } from "@/app/libs/prisma";
import { MyNFT as MyNFTType } from "../../../../contract/typechain-types";

const myNftAbi = MyNFTABI.abi;
const PRIVATE_KEY = process.env.PRIVATE_KEY as string;

export async function POST(req: NextRequest) {
  const { uploadStatusId } = await req.json();

  if (!uploadStatusId) {
    return NextResponse.json(
      { error: "Missing uploadStatusId" },
      { status: 400 }
    );
  }

  try {
    const uploadStatus = await prisma.uploadStatus.findUnique({
      where: { id: uploadStatusId },
    });

    if (!uploadStatus || !uploadStatus.metadataHash) {
      return NextResponse.json(
        { error: "Upload status not found or metadata not uploaded" },
        { status: 404 }
      );
    }

    const provider = new ethers.JsonRpcProvider(process.env.ETHEREUM_RPC_URL);
    await provider.getNetwork(); // ネットワーク接続を確認

    const signer = new ethers.Wallet(PRIVATE_KEY, provider);
    const contract = new ethers.Contract(
      process.env.CONTRACT_ADDRESS as string,
      myNftAbi,
      signer
    ) as unknown as MyNFTType;

    const nonce = await contract.getNonce(signer.address);
    const message = ethers.solidityPacked(
      ["string", "uint256"],
      [uploadStatus.metadataHash, nonce]
    );
    const signature = await signer.signMessage(ethers.getBytes(message));

    const tx = await contract.registerNFT(
      uploadStatus.metadataHash,
      nonce,
      signature
    );
    const receipt = await tx.wait();

    if (!receipt) {
      throw new Error("Failed to get transaction receipt");
    }

    const tokenId = receipt.logs[0].topics[2];

    await prisma.uploadStatus.update({
      where: { id: uploadStatusId },
      data: { nftMintStatus: "completed", tokenId: tokenId },
    });

    return NextResponse.json({ success: true, tokenId: tokenId });
  } catch (error) {
    console.error("Error registering NFT:", error);
    await prisma.uploadStatus.update({
      where: { id: uploadStatusId },
      data: { nftMintStatus: "failed" },
    });
    return NextResponse.json(
      { error: "Failed to register NFT" },
      { status: 500 }
    );
  }
}
