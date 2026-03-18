/*
  Warnings:

  - You are about to drop the column `finishedAt` on the `Execution` table. All the data in the column will be lost.
  - You are about to drop the column `startedAt` on the `Execution` table. All the data in the column will be lost.
  - You are about to drop the column `workflowId` on the `Execution` table. All the data in the column will be lost.
  - The `status` column on the `Execution` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `createdAt` on the `Rule` table. All the data in the column will be lost.
  - You are about to drop the column `field` on the `Rule` table. All the data in the column will be lost.
  - You are about to drop the column `operator` on the `Rule` table. All the data in the column will be lost.
  - You are about to drop the column `stepId` on the `Rule` table. All the data in the column will be lost.
  - You are about to drop the column `value` on the `Rule` table. All the data in the column will be lost.
  - You are about to drop the column `config` on the `Step` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Step` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `Step` table. All the data in the column will be lost.
  - You are about to drop the column `workflowId` on the `Step` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Workflow` table. All the data in the column will be lost.
  - You are about to drop the column `isActive` on the `Workflow` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Workflow` table. All the data in the column will be lost.
  - Added the required column `workflow_id` to the `Execution` table without a default value. This is not possible if the table is not empty.
  - Made the column `logs` on table `Execution` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `condition` to the `Rule` table without a default value. This is not possible if the table is not empty.
  - Added the required column `step_id` to the `Rule` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `Rule` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `Step` table without a default value. This is not possible if the table is not empty.
  - Added the required column `workflow_id` to the `Step` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `Workflow` table without a default value. This is not possible if the table is not empty.
  - Made the column `description` on table `Workflow` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Execution" DROP CONSTRAINT "Execution_workflowId_fkey";

-- DropForeignKey
ALTER TABLE "Rule" DROP CONSTRAINT "Rule_stepId_fkey";

-- DropForeignKey
ALTER TABLE "Step" DROP CONSTRAINT "Step_workflowId_fkey";

-- AlterTable
ALTER TABLE "Execution" DROP COLUMN "finishedAt",
DROP COLUMN "startedAt",
DROP COLUMN "workflowId",
ADD COLUMN     "current_step_id" TEXT,
ADD COLUMN     "data" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "ended_at" TIMESTAMP(3),
ADD COLUMN     "retries" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "triggered_by" TEXT NOT NULL DEFAULT 'user',
ADD COLUMN     "workflow_id" TEXT NOT NULL,
ADD COLUMN     "workflow_version" INTEGER NOT NULL DEFAULT 1,
DROP COLUMN "status",
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'pending',
ALTER COLUMN "logs" SET NOT NULL,
ALTER COLUMN "logs" SET DEFAULT '[]';

-- AlterTable
ALTER TABLE "Rule" DROP COLUMN "createdAt",
DROP COLUMN "field",
DROP COLUMN "operator",
DROP COLUMN "stepId",
DROP COLUMN "value",
ADD COLUMN     "condition" TEXT NOT NULL,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "next_step_id" TEXT,
ADD COLUMN     "priority" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "step_id" TEXT NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Step" DROP COLUMN "config",
DROP COLUMN "createdAt",
DROP COLUMN "type",
DROP COLUMN "workflowId",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "metadata" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "step_type" TEXT NOT NULL DEFAULT 'task',
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "workflow_id" TEXT NOT NULL,
ALTER COLUMN "order" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "Workflow" DROP COLUMN "createdAt",
DROP COLUMN "isActive",
DROP COLUMN "updatedAt",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "input_schema" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "start_step_id" TEXT,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1,
ALTER COLUMN "description" SET NOT NULL,
ALTER COLUMN "description" SET DEFAULT '';

-- DropEnum
DROP TYPE "ExecutionStatus";

-- DropEnum
DROP TYPE "StepType";

-- AddForeignKey
ALTER TABLE "Step" ADD CONSTRAINT "Step_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "Workflow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rule" ADD CONSTRAINT "Rule_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "Step"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Execution" ADD CONSTRAINT "Execution_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "Workflow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
