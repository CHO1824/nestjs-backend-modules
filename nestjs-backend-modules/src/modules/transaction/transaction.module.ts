import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { TransferStateModule } from "../transfer/transfer-state.module";
import { TransactionController } from "./controllers/transaction.controller";
import { TransactionRepository } from "./repositories/transaction.repository";
import { TransactionService } from "./services/transaction.service";

@Module({
  // TransferStateModule (not TransferModule) — we only need the
  // state-transition primitive, not the whole partner adapter / queue
  // / webhook plumbing. The thin module keeps our DI scope clean and
  // unit-test setup small.
  imports: [AuthModule, TransferStateModule],
  controllers: [TransactionController],
  providers: [TransactionService, TransactionRepository],
  exports: [TransactionService],
})
export class TransactionModule {}
