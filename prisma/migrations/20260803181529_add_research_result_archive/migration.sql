-- CreateTable
CREATE TABLE "ResearchResult" (
    "id" TEXT NOT NULL,
    "niche" TEXT NOT NULL,
    "campaignGoal" TEXT,
    "suggestions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResearchResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ResearchResult_createdAt_idx" ON "ResearchResult"("createdAt");
