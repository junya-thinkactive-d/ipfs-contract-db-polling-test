"use client";

import React, { useEffect, useState } from "react";
import { UploadStatus } from "../types/types";

const About = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [uploadStatus, setUploadStatus] = useState<UploadStatus | null>(null);
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setSelectedFile(event.target.files[0]);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedFile) return;

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("name", name);
    formData.append("description", description);

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to upload file");
      }

      const data = await response.json();
      console.log("File uploaded and NFT created:", data);
      setUploadId(data.uploadStatusId);
      setError(null);
    } catch (error) {
      console.error("Error uploading file:", error);
      setError("Failed to upload file. Please try again.");
    }
  };

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const pollStatus = async () => {
      if (!uploadId) return;

      try {
        const response = await fetch(`/api/upload?id=${uploadId}`);
        if (response.ok) {
          const status: UploadStatus = await response.json();
          console.log("Received status:", status); // デバッグログ
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
      <h1 className="text-3xl font-bold my-12">NFT Upload</h1>
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
        <button type="submit" className="bg-stone-800 text-white px-4 py-2">
          Upload
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
        </div>
      )}
    </div>
  );
};

export default About;
