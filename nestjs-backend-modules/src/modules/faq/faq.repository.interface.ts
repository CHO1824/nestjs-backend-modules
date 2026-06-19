export const FAQ_REPOSITORY = Symbol("FAQ_REPOSITORY");

export interface FaqEntity {
  id: string;
  question: string;
  answer: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface FindFaqListParams {
  keyword?: string;
  isActive?: boolean;
  skip: number;
  take: number;
  sortBy: "createdAt" | "sortOrder";
  order: "asc" | "desc";
}

export interface CountFaqParams {
  keyword?: string;
  isActive?: boolean;
}

export interface CreateFaqRepositoryParams {
  question: string;
  answer: string;
  isActive: boolean;
  sortOrder: number;
}

export interface UpdateFaqRepositoryParams {
  question?: string;
  answer?: string;
  isActive?: boolean;
  sortOrder?: number;
}

export interface FaqRepositoryInterface {
  create(data: CreateFaqRepositoryParams): Promise<FaqEntity>;
  findById(id: string): Promise<FaqEntity | null>;
  update(id: string, data: UpdateFaqRepositoryParams): Promise<FaqEntity>;
  delete(id: string): Promise<void>;
  findMany(params: FindFaqListParams): Promise<FaqEntity[]>;
  count(params: CountFaqParams): Promise<number>;
}
