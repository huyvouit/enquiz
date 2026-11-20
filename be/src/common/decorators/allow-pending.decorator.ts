import { SetMetadata } from '@nestjs/common';

export const ALLOW_PENDING_KEY = 'allowPending';

/** Lets a `pending` account (teacher awaiting approval) call this endpoint. */
export const AllowPending = () => SetMetadata(ALLOW_PENDING_KEY, true);
