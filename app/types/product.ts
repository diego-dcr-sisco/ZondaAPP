import { Lot } from "./lot";
import { ApplicationMethod } from "./application-method";

export interface Product {
  id: number;
  name: string;
  metric: string;
  lots: Lot[];
  application_methods: ApplicationMethod[];
  updated_at: string;
}
