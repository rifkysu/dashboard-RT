-- Kolom untuk fitur "Lupa Password" (token reset sementara, tanpa email).
ALTER TABLE "users" ADD COLUMN "reset_token" VARCHAR(128);
ALTER TABLE "users" ADD COLUMN "reset_token_expires" TIMESTAMP;
CREATE UNIQUE INDEX "users_reset_token_key" ON "users"("reset_token");
