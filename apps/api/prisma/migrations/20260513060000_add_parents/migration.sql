-- CreateTable: ParentChildLink
CREATE TABLE "ParentChildLink" (
    "id"         TEXT NOT NULL,
    "parent_id"  TEXT NOT NULL,
    "child_id"   TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParentChildLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ParentLinkInvite
CREATE TABLE "ParentLinkInvite" (
    "id"         TEXT NOT NULL,
    "parent_id"  TEXT NOT NULL,
    "code"       TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at"    TIMESTAMP(3),
    "child_id"   TEXT,

    CONSTRAINT "ParentLinkInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ParentChildLink_parent_id_child_id_key" ON "ParentChildLink"("parent_id", "child_id");
CREATE INDEX "ParentChildLink_parent_id_idx" ON "ParentChildLink"("parent_id");
CREATE INDEX "ParentChildLink_child_id_idx" ON "ParentChildLink"("child_id");

CREATE UNIQUE INDEX "ParentLinkInvite_code_key" ON "ParentLinkInvite"("code");
CREATE INDEX "ParentLinkInvite_parent_id_idx" ON "ParentLinkInvite"("parent_id");
CREATE INDEX "ParentLinkInvite_expires_at_idx" ON "ParentLinkInvite"("expires_at");

-- AddForeignKey
ALTER TABLE "ParentChildLink" ADD CONSTRAINT "ParentChildLink_parent_id_fkey"
    FOREIGN KEY ("parent_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ParentChildLink" ADD CONSTRAINT "ParentChildLink_child_id_fkey"
    FOREIGN KEY ("child_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ParentLinkInvite" ADD CONSTRAINT "ParentLinkInvite_parent_id_fkey"
    FOREIGN KEY ("parent_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
