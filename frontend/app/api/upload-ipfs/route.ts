import { NextRequest, NextResponse } from "next/server";
import { PinataSDK } from "pinata-web3";
import { prisma } from "@/app/libs/prisma";
import { UploadStatus } from "@/app/types/types";

const pinata = new PinataSDK({
  pinataJwt: process.env.PINATA_JWT,
  pinataGateway: process.env.PINATA_GATEWAY,
});

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

    // メタデータのIPFSハッシュを保存
    await prisma.uploadStatus.update({
      where: { id: uploadStatusId },
      data: { metadataHash: metadataResult },
    });
  } catch (error) {
    console.error("Error processing upload:", error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }

    // エラー状態を更新
    await updateStatus(uploadStatusId, {
      imageUploadStatus: "failed",
      metadataUploadStatus: "failed",
    });
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

    return NextResponse.json(status);
  } catch (error) {
    console.error("Error fetching upload status:", error);
    return NextResponse.json(
      { error: "Failed to fetch status" },
      { status: 500 }
    );
  }
}
