import { Query } from '@nestjs/cqrs';

/** Distinct topics in the bank, for filter dropdowns and autocomplete. */
export class ListTopicsQuery extends Query<string[]> {}
