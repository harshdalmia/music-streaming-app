/*
  Warnings:

  - Added the required column `extractedId` to the `Upvotes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `url` to the `Upvotes` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Upvotes" ADD COLUMN     "extractedId" TEXT NOT NULL,
ADD COLUMN     "url" TEXT NOT NULL;
