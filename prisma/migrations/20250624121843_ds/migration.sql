/*
  Warnings:

  - You are about to drop the column `extractedId` on the `Upvotes` table. All the data in the column will be lost.
  - You are about to drop the column `url` on the `Upvotes` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Upvotes" DROP COLUMN "extractedId",
DROP COLUMN "url";
