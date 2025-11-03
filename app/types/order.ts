import { Customer } from "./customer"
import { Service } from "./service";

export interface Order {
  id: number;
  folio: string;
  status_id: number;
  start_time: string | null;
  programmed_date: string;
  address: string;
  execution: string | null;
  areas: string[] | null;
  additional_comments: string | null;
  price: number;
  signature: string | null;
  updated_at: string;
  service_type: string;
  customer: Customer;
  services: Service[];
}
