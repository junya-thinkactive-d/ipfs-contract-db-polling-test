export type UploadStatus = {
  id: string;
  imageUploadStatus: string;
  metadataUploadStatus: string;
  nftMintStatus: string;
  dbSaveStatus: string;
  metadataHash?: string;
  tokenId?: string; // この行を追加
  createdAt: Date;
  updatedAt: Date;
};
