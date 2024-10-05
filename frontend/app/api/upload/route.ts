import { NextRequest, NextResponse } from "next/server";
import { PinataSDK } from "pinata-web3";
import { ethers } from "ethers";
import MyNFTABI from "../../../../contract/artifacts/contracts/MyNFT.sol/MyNFT.json";
import { UploadStatus } from "@/app/types/types";
import { prisma } from "@/app/libs/prisma";
import { MyNFT as MyNFTType } from "../../../../contract/typechain-types";

const pinata = new PinataSDK({
  pinataJwt: process.env.PINATA_JWT,
  pinataGateway: process.env.PINATA_GATEWAY,
});

const myNftAbi = MyNFTABI.abi;
const PRIVATE_KEY = process.env.PRIVATE_KEY as string;

async function updateStatus(id: string, status: Partial<UploadStatus>) {
  await prisma.uploadStatus.update({ where: { id }, data: status });
}

async function handleStep<T>(
  stepName: keyof UploadStatus,
  action: () => Promise<T>,
  uploadStatusId: string
): Promise<T> {
  await updateStatus(uploadStatusId, { [stepName]: "in_progress" });
  try {
    const result = await action();
    await updateStatus(uploadStatusId, { [stepName]: "completed" });
    return result;
  } catch (error) {
    await updateStatus(uploadStatusId, { [stepName]: "failed" });
    throw error;
  }
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File;
  const name = formData.get("name") as string;
  const description = formData.get("description") as string;

  if (!file || !name || !description) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  try {
    const uploadStatus = await prisma.uploadStatus.create({
      data: {
        imageUploadStatus: "pending",
        metadataUploadStatus: "pending",
        nftMintStatus: "pending",
        dbSaveStatus: "pending",
      },
    });

    if (!uploadStatus) {
      throw new Error("Failed to create upload status");
    }

    // バックグラウンドでアップロードプロセスを開始
    processUpload(uploadStatus.id, file, name, description).catch(
      console.error
    );

    return NextResponse.json({
      success: true,
      uploadStatusId: uploadStatus.id,
    });
  } catch (error) {
    console.error("Error initiating upload:", error);
    return NextResponse.json(
      { error: "Failed to initiate upload" },
      { status: 500 }
    );
  }
}

async function processUpload(
  uploadStatusId: string,
  file: File,
  name: string,
  description: string
) {
  try {
    const imageResult = await handleStep(
      "imageUploadStatus",
      () => uploadFileToIPFS(file),
      uploadStatusId
    );

    const metadata = { name, description, image: imageResult };
    const metadataResult = await handleStep(
      "metadataUploadStatus",
      () => uploadMetadataToIPFS(metadata),
      uploadStatusId
    );

    const provider = new ethers.JsonRpcProvider(process.env.ETHEREUM_RPC_URL);
    await provider.getNetwork(); // ネットワーク接続を確認

    const signer = new ethers.Wallet(PRIVATE_KEY, provider);
    const contract = new ethers.Contract(
      process.env.CONTRACT_ADDRESS as string,
      myNftAbi,
      signer
    ) as unknown as MyNFTType;

    const tokenId = await handleStep(
      "nftMintStatus",
      async () => {
        const tx = await contract.mint(signer.address, 1, metadataResult);
        console.log("Mint transaction hash:", tx.hash);
        const receipt = await tx.wait();

        if (receipt === null) {
          console.error("Transaction receipt is null");
          throw new Error("Failed to get transaction receipt");
        }

        console.log("Transaction receipt:", JSON.stringify(receipt, null, 2));

        let tokenId;
        const logs = receipt.logs;
        console.log("Number of logs:", logs.length);

        for (const log of logs) {
          console.log("Processing log:", JSON.stringify(log, null, 2));
          try {
            const parsedLog = contract.interface.parseLog(log);
            console.log("Parsed log:", JSON.stringify(parsedLog, null, 2));
            if (parsedLog && parsedLog.name === "TransferSingle") {
              console.log("Found TransferSingle event");
              if (parsedLog.args && parsedLog.args.id) {
                tokenId = parsedLog.args.id.toString();
                console.log("Extracted tokenId:", tokenId);
              } else {
                console.log("TransferSingle event does not contain id");
              }
              break;
            }
          } catch (e) {
            console.log("Failed to parse log:", e);
          }
        }

        if (!tokenId) {
          console.log(
            "Contract ABI:",
            JSON.stringify(contract.interface.format(), null, 2)
          );
          // トランザクションが成功した場合、currentTokenIDを取得する
          const currentTokenID = await contract.currentTokenID();
          tokenId = (currentTokenID - 1n).toString(); // ミント後にインクリメントされるため、1を引く
          console.log("Retrieved tokenId from currentTokenID:", tokenId);
        }

        if (!tokenId) {
          throw new Error("Failed to extract or retrieve token ID");
        }

        return tokenId;
      },
      uploadStatusId
    );

    await handleStep(
      "dbSaveStatus",
      () => prisma.nFTToken.create({ data: { tokenId } }),
      uploadStatusId
    );
  } catch (error) {
    console.error("Error processing upload:", error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }

    // 現在のステータスを取得
    const currentStatus = await prisma.uploadStatus.findUnique({
      where: { id: uploadStatusId },
    });

    if (currentStatus) {
      // 完了していないステップのみ "failed" に設定
      await updateStatus(uploadStatusId, {
        imageUploadStatus:
          currentStatus.imageUploadStatus === "completed"
            ? "completed"
            : "failed",
        metadataUploadStatus:
          currentStatus.metadataUploadStatus === "completed"
            ? "completed"
            : "failed",
        nftMintStatus:
          currentStatus.nftMintStatus === "completed" ? "completed" : "failed",
        dbSaveStatus:
          currentStatus.dbSaveStatus === "completed" ? "completed" : "failed",
      });
    }
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json(
      { error: "Missing id parameter" },
      { status: 400 }
    );
  }

  try {
    const status = await prisma.uploadStatus.findUnique({
      where: { id: id },
    });

    if (!status) {
      return NextResponse.json({ error: "Status not found" }, { status: 404 });
    }

    return NextResponse.json(status as UploadStatus);
  } catch (error) {
    console.error("Error fetching upload status:", error);
    return NextResponse.json(
      { error: "Failed to fetch status" },
      { status: 500 }
    );
  }
}

async function uploadFileToIPFS(file: File): Promise<string> {
  const upload = await pinata.upload.file(file);
  console.log("Image upload result:", upload);
  return `ipfs://${upload.IpfsHash}`;
}

async function uploadMetadataToIPFS(metadata: {
  name: string;
  description: string;
  image: string;
}): Promise<string> {
  const upload = await pinata.upload.json(metadata);
  console.log("Metadata upload result:", upload);
  return `ipfs://${upload.IpfsHash}`;
}
