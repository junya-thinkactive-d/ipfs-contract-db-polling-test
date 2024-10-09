"use client";

import React, { useEffect, useState } from "react";
import { UploadStatus } from "../types/types";
import { ethers } from "ethers";
import MyNFTABI from "../../../contract/artifacts/contracts/MyNFT.sol/MyNFT.json";

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as string;

const About = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [uploadStatus, setUploadStatus] = useState<UploadStatus | null>(null);
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setSelectedFile(event.target.files[0]);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedFile) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("name", name);
      formData.append("description", description);

      const response = await fetch("/api/upload-ipfs", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to upload file");
      }

      const data = await response.json();
      console.log("File uploaded to IPFS:", data);
      setUploadId(data.uploadStatusId);

      // Automatically trigger NFT registration after successful upload
      await handleRegisterNFT(data.uploadStatusId);

      setError(null);
    } catch (error) {
      console.error("Error uploading file:", error);
      setError("Failed to upload file or register NFT. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterNFT = async (uploadStatusId: string) => {
    if (!uploadStatusId) return;

    try {
      // Fetch the upload status to get the metadataHash
      const statusResponse = await fetch(
        `/api/upload-ipfs?id=${uploadStatusId}`
      );
      if (!statusResponse.ok) {
        throw new Error("Failed to fetch upload status");
      }
      const status: UploadStatus = await statusResponse.json();
      if (!status.metadataHash) {
        throw new Error("Metadata hash not found");
      }

      // Connect to Ethereum
      if (!window.ethereum) {
        throw new Error("No Ethereum wallet found");
      }
      await window.ethereum.request({ method: "eth_requestAccounts" });
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      // Create contract instance
      const contract = new ethers.Contract(
        CONTRACT_ADDRESS,
        MyNFTABI.abi,
        signer
      );

      // Get the nonce
      const nonce = await contract.getNonce(await signer.getAddress());

      // Create the message to sign
      const message = ethers.solidityPacked(
        ["string", "uint256", "address"],
        [status.metadataHash, nonce, CONTRACT_ADDRESS]
      );

      // Sign the message
      const signature = await signer.signMessage(ethers.getBytes(message));

      // Send the registration request
      const registerResponse = await fetch("/api/register-nft", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          uploadStatusId,
          metadataHash: status.metadataHash,
          nonce: nonce.toString(),
          signature,
        }),
      });

      if (!registerResponse.ok) {
        throw new Error("Failed to register NFT");
      }

      const registerData = await registerResponse.json();
      console.log("NFT registered:", registerData);
      setError(null);
    } catch (error) {
      console.error("Error registering NFT:", error);
      setError("Failed to register NFT. Please try again.");
    }
  };

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const pollStatus = async () => {
      if (!uploadId) return;

      try {
        const response = await fetch(`/api/upload-ipfs?id=${uploadId}`);
        if (response.ok) {
          const status: UploadStatus = await response.json();
          console.log("Received status:", status);
          setUploadStatus(status);
          if (
            status.imageUploadStatus === "failed" ||
            status.metadataUploadStatus === "failed" ||
            status.nftMintStatus === "failed" ||
            status.dbSaveStatus === "failed"
          ) {
            console.log("Upload process failed. Stopping polling.");
            clearInterval(intervalId);
            return;
          }

          if (
            status.imageUploadStatus === "completed" &&
            status.metadataUploadStatus === "completed" &&
            status.nftMintStatus === "completed" &&
            status.dbSaveStatus === "completed"
          ) {
            clearInterval(intervalId);
          }
        } else {
          throw new Error("Failed to fetch status");
        }
      } catch (error) {
        console.error("Error fetching status:", error);
        setError("Failed to fetch status. Please try again.");
      }
    };

    if (uploadId) {
      intervalId = setInterval(pollStatus, 1000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [uploadId]);

  return (
    <div className="flex flex-col items-center justify-center max-w-screen-xl mx-auto">
      <h1 className="text-3xl font-bold my-12">NFT Upload and Registration</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-y-2">
        <input
          type="text"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="border-2 border-stone-800 px-4 py-2 mb-4"
        />
        <textarea
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          className="border-2 border-stone-800 px-4 py-2 mb-4"
        />
        <input type="file" onChange={handleFileChange} required />
        <button
          type="submit"
          className="bg-stone-800 text-white px-4 py-2"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Processing..." : "Upload and Register NFT"}
        </button>
      </form>
      {error && <p className="text-red-500 mt-4">{error}</p>}
      {uploadStatus && (
        <div className="mt-4">
          <h2 className="text-xl font-bold">Upload Status</h2>
          <p>Image Upload: {uploadStatus.imageUploadStatus}</p>
          <p>Metadata Upload: {uploadStatus.metadataUploadStatus}</p>
          <p>NFT Minting: {uploadStatus.nftMintStatus}</p>
          <p>DB Save: {uploadStatus.dbSaveStatus}</p>
          {uploadStatus.tokenId && <p>Token ID: {uploadStatus.tokenId}</p>}
        </div>
      )}
    </div>
  );
};

export default About;
