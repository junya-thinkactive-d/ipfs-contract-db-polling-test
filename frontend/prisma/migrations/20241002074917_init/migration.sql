-- CreateTable
CREATE TABLE "UploadStatus" (
    "id" TEXT NOT NULL,
    "imageUploadStatus" TEXT NOT NULL,
    "metadataUploadStatus" TEXT NOT NULL,
    "nftMintStatus" TEXT NOT NULL,
    "dbSaveStatus" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UploadStatus_pkey" PRIMARY KEY ("id")
);
