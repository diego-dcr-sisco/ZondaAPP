export interface Report {
  order_id: number;
  user_id: number | null;
  status_id?: number;
  start_time: string;
  end_time: string | null;
  completed_date: string | null;
  notes: string | null;
  customer_signature: string | null;
  signature_name: string | null;

  reviews: Review[];
  products: ProductReview[];
  pests: PestReview[];

  finalized_at?: string;
  reopened_at?: string;
  is_finalized: boolean;
  is_synchronized: boolean;
}

export interface Review {
  device_id: number;
  pests: PestReview[];
  products: ProductReview[];
  answers: Answer[];
  image: string | null;
  observations?: string;
  is_checked: boolean;
  is_scanned: boolean;
}

export interface Answer {
  question_id: number;
  response: string;
}

export interface PestReview {
  pest_id: number;
  service_id: number;
  count: number | string | null;
}

export interface ProductReview {
  name: string;
  product_id: number;
  service_id: number;
  lot_id: number | null;
  app_method_id: number | null;
  amount: number | string | null;
  metric: string;
}
